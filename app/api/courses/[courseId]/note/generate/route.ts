import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/api-auth';
import OpenAI from 'openai';
import { PersonnalisationConfig, DEFAULT_CONFIG } from '@/types/personnalisation';
import { getStructurePrompt } from '@/lib/prompts/multi-pass/structure';
import { getTranscriptionPrompt } from '@/lib/prompts/multi-pass/transcription';
import { getGlossairePrompt } from '@/lib/prompts/multi-pass/glossaire';
import { getVerificationPrompt } from '@/lib/prompts/multi-pass/verification';
import { getSinglePassPrompt } from '@/lib/prompts/single-pass';
import { getRecapsPrompt, shouldGenerateRecaps, RECAPS_HEADER } from '@/lib/prompts/recaps';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

// Image extraction temporarily disabled due to pdfjs-dist/Turbopack incompatibility
type AnalyzedImage = { url: string; description: string; title?: string; type: string; };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration
const CHUNK_SIZE = 12000; // Characters per chunk for detailed transcription
const MAX_CONCURRENT_CHUNKS = 2; // Reduced to avoid rate limits

// Helper for retrying API calls with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 10000 // 10 seconds base delay
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Check if it's a rate limit error
      if (error?.status === 429 && attempt < maxRetries) {
        // Get retry-after from headers or use exponential backoff
        const retryAfter = error?.headers?.get?.('retry-after-ms');
        const delay = retryAfter ? parseInt(retryAfter) + 1000 : baseDelay * Math.pow(2, attempt);
        console.log(`[A+ Note] Rate limit hit, retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

// Helper to create a streaming response with progress updates
function createProgressStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const sendProgress = (data: { type: string; message?: string; progress?: number; content?: string }) => {
    if (controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    }
  };

  const close = () => {
    if (controller) {
      controller.close();
    }
  };

  return { stream, sendProgress, close };
}

// Helper to get language name from code
function getLanguageName(language: string): string {
  return language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';
}

interface ContentTypes {
  definitions: string[];
  formulas: string[];
  numerical_examples: string[];
  graphs_or_visuals: string[];
  exercises: string[];
}

interface Section {
  title: string;
  startMarker: string;
  endMarker: string;
  contentTypes: ContentTypes;
  keyTopics: string[];
}

interface DocumentStructure {
  title: string;
  metadata_to_ignore: string[];
  sections: Section[];
}

interface VerificationResult {
  verification: Array<{ item: string; status: string; details: string }>;
  missing_content: string;
  completeness_score: number;
}

/**
 * Extract document structure (Pass 1)
 */
async function extractStructure(
  sourceText: string,
  language: string,
  config: PersonnalisationConfig
): Promise<DocumentStructure> {
  const languageName = getLanguageName(language);

  // Use first 20k chars for structure detection
  const textForStructure = sourceText.substring(0, 20000);
  const structurePrompt = getStructurePrompt(config, languageName);

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast model for structure
      messages: [
        {
          role: 'system',
          content: structurePrompt,
        },
        {
          role: 'user',
          content: textForStructure,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Failed to extract document structure');
    }

    return JSON.parse(content) as DocumentStructure;
  });
}

/**
 * Find section boundaries in the full text
 */
function findSectionText(
  fullText: string,
  section: Section,
  allSections: Section[],
  sectionIndex: number
): string {
  // Try to find the start marker
  let startIndex = fullText.toLowerCase().indexOf(section.startMarker.toLowerCase().substring(0, 50));

  if (startIndex === -1) {
    // Fallback: divide text equally
    const chunkSize = Math.floor(fullText.length / allSections.length);
    startIndex = sectionIndex * chunkSize;
  }

  // Find end: either the next section's start or end marker
  let endIndex = fullText.length;

  if (sectionIndex < allSections.length - 1) {
    const nextSection = allSections[sectionIndex + 1];
    const nextStart = fullText.toLowerCase().indexOf(
      nextSection.startMarker.toLowerCase().substring(0, 50),
      startIndex + 100
    );
    if (nextStart !== -1) {
      endIndex = nextStart;
    }
  }

  // Extract and limit section text
  let sectionText = fullText.substring(startIndex, endIndex);

  // If section is too long, truncate intelligently
  if (sectionText.length > CHUNK_SIZE) {
    sectionText = sectionText.substring(0, CHUNK_SIZE) + '\n\n[... section continue ...]';
  }

  return sectionText;
}

/**
 * Transcribe a single section (Pass 2)
 */
async function transcribeSection(
  sectionText: string,
  sectionTitle: string,
  language: string,
  contentTypes: ContentTypes,
  metadataToIgnore: string[],
  config: PersonnalisationConfig,
  imageContext: string = ''
): Promise<string> {
  const languageName = getLanguageName(language);

  const formulaReminder = contentTypes.formulas.length > 0
    ? '\n\nATTENTION : Cette section contient des formules. Utilise OBLIGATOIREMENT $$ pour les formules centrées et $ pour les formules en ligne.'
    : '';

  const transcriptionPrompt = getTranscriptionPrompt(
    config,
    contentTypes,
    metadataToIgnore,
    languageName,
    formulaReminder,
    imageContext
  );

  // Use retry wrapper for rate limit handling
  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: transcriptionPrompt,
        },
        {
          role: 'user',
          content: `Section : ${sectionTitle}\n\n${sectionText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    return response.choices[0].message.content || '';
  });
}

/**
 * Generate glossary from transcribed content (Pass 3)
 */
async function generateGlossary(
  transcribedContent: string,
  language: string,
  config: PersonnalisationConfig
): Promise<string> {
  const languageName = getLanguageName(language);

  // Use last 15k chars of content for glossary (to capture all terms)
  const contentForGlossary = transcribedContent.length > 15000
    ? transcribedContent.substring(transcribedContent.length - 15000)
    : transcribedContent;

  const glossairePrompt = getGlossairePrompt(config, languageName);

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: glossairePrompt,
        },
        {
          role: 'user',
          content: contentForGlossary,
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    return response.choices[0].message.content || '';
  });
}

/**
 * Verify completeness of transcription (Pass 4)
 */
async function verifyCompleteness(
  structure: DocumentStructure,
  transcribedContent: string,
  language: string,
  config: PersonnalisationConfig
): Promise<VerificationResult> {
  const languageName = getLanguageName(language);

  // Build expected content summary from structure
  const expectedItems: string[] = [];
  for (const section of structure.sections) {
    if (section.contentTypes.definitions.length > 0) {
      expectedItems.push(`Définitions: ${section.contentTypes.definitions.join(', ')}`);
    }
    if (section.contentTypes.formulas.length > 0) {
      expectedItems.push(`Formules: ${section.contentTypes.formulas.join(', ')}`);
    }
    if (section.contentTypes.numerical_examples.length > 0) {
      expectedItems.push(`Exemples: ${section.contentTypes.numerical_examples.join(', ')}`);
    }
    if (section.contentTypes.graphs_or_visuals.length > 0) {
      expectedItems.push(`Graphiques: ${section.contentTypes.graphs_or_visuals.join(', ')}`);
    }
  }

  const expectedContent = expectedItems.join('\n');
  const verificationPrompt = getVerificationPrompt(config, expectedContent, languageName);

  // Limit transcription size for verification
  const transcriptionForVerification = transcribedContent.length > 20000
    ? transcribedContent.substring(0, 20000) + '\n...[tronqué pour vérification]'
    : transcribedContent;

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: verificationPrompt,
        },
        {
          role: 'user',
          content: `TRANSCRIPTION GÉNÉRÉE :\n${transcriptionForVerification}\n\nVérifie la complétude de la transcription.`,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 3000,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return { verification: [], missing_content: '', completeness_score: 100 };
    }

    try {
      return JSON.parse(content) as VerificationResult;
    } catch {
      console.error('[A+ Note] Failed to parse verification result');
      return { verification: [], missing_content: '', completeness_score: 100 };
    }
  });
}

/**
 * Single-pass generation for short documents
 */
async function singlePassGeneration(
  sourceText: string,
  language: string,
  config: PersonnalisationConfig,
  imageContext: string = ''
): Promise<string> {
  const languageName = getLanguageName(language);
  const singlePassPrompt = getSinglePassPrompt(config, languageName, imageContext);

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: singlePassPrompt,
        },
        {
          role: 'user',
          content: `Retranscris ce cours intégralement dans un format structuré :\n\n${sourceText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 16000,
    });

    return response.choices[0].message.content || '';
  });
}

/**
 * Generate recaps from note content
 */
async function generateRecaps(
  noteContent: string,
  language: string,
  config: PersonnalisationConfig
): Promise<string> {
  const languageName = getLanguageName(language);
  const recapsPrompt = getRecapsPrompt(config, languageName);

  // Use last 20k chars for recap generation
  const contentForRecaps = noteContent.length > 20000
    ? noteContent.substring(noteContent.length - 20000)
    : noteContent;

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: recapsPrompt,
        },
        {
          role: 'user',
          content: contentForRecaps,
        },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    });

    return response.choices[0].message.content || '';
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;

  // Try to authenticate user (optional for guest users)
  const auth = await authenticateRequest(request);
  const guestSessionId = getGuestSessionIdFromRequest(request);

  // Must have either authentication or guest session
  if (!auth && !guestSessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = await createSupabaseServerClient();
  const admin = getServiceSupabase();

  // Get course with source text and storage path
  // For authenticated users: check user_id match
  // For guest users: check guest_session_id match and user_id is null
  let course;
  let error;

  if (auth) {
    // Authenticated user: must own the course
    const result = await supabase
      .from('courses')
      .select('id, title, source_text, content_language, storage_path, storage_bucket')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    course = result.data;
    error = result.error;
  } else {
    // Guest user: course must have no user_id and matching guest_session_id
    const result = await admin
      .from('courses')
      .select('id, title, source_text, content_language, storage_path, storage_bucket, user_id, guest_session_id')
      .eq('id', courseId)
      .is('user_id', null)
      .eq('guest_session_id', guestSessionId)
      .maybeSingle();
    course = result.data;
    error = result.error;
  }

  if (error) {
    console.error('Error fetching course:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch course' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!course) {
    return new Response(JSON.stringify({ error: 'Course not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!course.source_text) {
    return new Response(JSON.stringify({ error: 'Course has no source text' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse request body for personnalisation config
  let config: PersonnalisationConfig = DEFAULT_CONFIG;
  try {
    const body = await request.json();
    if (body.config) {
      config = {
        matiere: body.config.matiere || DEFAULT_CONFIG.matiere,
        niveau: body.config.niveau || DEFAULT_CONFIG.niveau,
        recaps: {
          definitions: body.config.recaps?.definitions ?? DEFAULT_CONFIG.recaps.definitions,
          formules: body.config.recaps?.formules ?? DEFAULT_CONFIG.recaps.formules,
          schemas: body.config.recaps?.schemas ?? DEFAULT_CONFIG.recaps.schemas,
        },
      };
    }
  } catch {
    // No body or invalid JSON, use default config
    console.log('[A+ Note] No personnalisation config provided, using defaults');
  }

  const language = course.content_language?.toUpperCase() || 'EN';
  const sourceText = course.source_text;

  // Create streaming response for progress updates
  const { stream, sendProgress, close } = createProgressStream();

  // Start async generation process
  (async () => {
    try {
      console.log(`[A+ Note] Starting generation for course ${courseId}`);
      console.log(`[A+ Note] Source text length: ${sourceText.length} characters`);
      console.log(`[A+ Note] Config: matiere=${config.matiere}, niveau=${config.niveau}, recaps=${JSON.stringify(config.recaps)}`);

      // STEP 0: Image extraction temporarily disabled due to pdfjs-dist/Turbopack incompatibility
      const analyzedImages: AnalyzedImage[] = [];
      const imageContext = '';
      console.log('[A+ Note] Image extraction is temporarily disabled');

      let noteContent: string;

      // Decision: Use multi-pass for documents > 15k chars
      if (sourceText.length > 15000) {
        console.log('[A+ Note] Using MULTI-PASS generation (document > 15k chars)');

        // Pass 1: Extract structure
        sendProgress({ type: 'progress', message: 'Analyzing document structure...', progress: 15 });
        console.log('[A+ Note] Pass 1: Extracting document structure...');
        const structure = await extractStructure(sourceText, language, config);
        console.log(`[A+ Note] Found ${structure.sections.length} sections`);

        // Pass 2: Transcribe each section (with image context)
        const sectionCount = structure.sections.length;
        const metadataToIgnore = structure.metadata_to_ignore || [];
        sendProgress({ type: 'progress', message: `Transcribing ${sectionCount} sections...`, progress: 20 });

        const transcribedSections: string[] = [];
        for (let i = 0; i < structure.sections.length; i += MAX_CONCURRENT_CHUNKS) {
          const batch = structure.sections.slice(i, i + MAX_CONCURRENT_CHUNKS);
          const progressPercent = 20 + Math.floor((i / structure.sections.length) * 45);
          sendProgress({
            type: 'progress',
            message: `Transcribing section ${Math.min(i + MAX_CONCURRENT_CHUNKS, sectionCount)}/${sectionCount}...`,
            progress: progressPercent,
          });

          const batchPromises = batch.map(async (section, batchIndex) => {
            const globalIndex = i + batchIndex;
            const sectionText = findSectionText(sourceText, section, structure.sections, globalIndex);
            console.log(`[A+ Note] Transcribing section ${globalIndex + 1}/${sectionCount}: ${section.title}`);
            return transcribeSection(
              sectionText,
              section.title,
              language,
              section.contentTypes || { definitions: [], formulas: [], numerical_examples: [], graphs_or_visuals: [], exercises: [] },
              metadataToIgnore,
              config,
              imageContext
            );
          });

          const batchResults = await Promise.all(batchPromises);
          transcribedSections.push(...batchResults);
        }

        // Assemble content
        let mainContent = `# ${structure.title || course.title}\n\n${transcribedSections.join('\n\n---\n\n')}`;

        // Pass 3: Verify completeness
        sendProgress({ type: 'progress', message: 'Verifying completeness...', progress: 70 });
        console.log('[A+ Note] Pass 3: Verifying completeness...');
        const verification = await verifyCompleteness(structure, mainContent, language, config);
        console.log(`[A+ Note] Completeness score: ${verification.completeness_score}%`);

        // Append missing content if any
        if (verification.missing_content && verification.missing_content.trim().length > 0) {
          console.log('[A+ Note] Adding missing content...');
          mainContent += `\n\n---\n\n## Contenu complémentaire\n\n${verification.missing_content}`;
        }

        // Glossaire généré UNIQUEMENT si l'option est cochée dans les récaps
        if (config.recaps.definitions) {
          sendProgress({ type: 'progress', message: 'Generating glossary...', progress: 80 });
          console.log('[A+ Note] Generating glossary (user requested)...');
          const glossary = await generateGlossary(mainContent, language, config);
          noteContent = `${mainContent}\n\n---\n\n${glossary}`;
        } else {
          noteContent = mainContent;
        }

      } else {
        console.log('[A+ Note] Using SINGLE-PASS generation (document <= 15k chars)');
        sendProgress({ type: 'progress', message: 'Generating note...', progress: 30 });
        noteContent = await singlePassGeneration(sourceText, language, config, imageContext);
      }

      if (!noteContent) {
        sendProgress({ type: 'error', message: 'Failed to generate note content' });
        close();
        return;
      }

      // Generate recaps si formules ou schemas demandés (definitions = glossaire, déjà géré)
      const needsFormulasRecap = config.recaps.formules;
      const needsSchemasRecap = config.recaps.schemas;

      if (needsFormulasRecap || needsSchemasRecap) {
        sendProgress({ type: 'progress', message: 'Generating recaps...', progress: 90 });
        console.log('[A+ Note] Generating recaps (formules/schemas)...');
        const recapsContent = await generateRecaps(noteContent, language, config);
        if (recapsContent && recapsContent.trim().length > 0) {
          noteContent = `${noteContent}${RECAPS_HEADER}${recapsContent}`;
        }
      }

      console.log(`[A+ Note] Generation complete. Note length: ${noteContent.length} characters`);

      sendProgress({ type: 'progress', message: 'Saving note...', progress: 95 });

      // Save note and config to course (use admin client to bypass RLS for guest users)
      const { error: updateError } = await admin
        .from('courses')
        .update({
          aplus_note: noteContent,
          note_config: config // Sauvegarde la config pour la régénération
        })
        .eq('id', courseId);

      if (updateError) {
        console.error('Error saving note:', updateError);
        sendProgress({ type: 'error', message: 'Failed to save note' });
        close();
        return;
      }

      // Send final success with content
      sendProgress({ type: 'complete', content: noteContent, progress: 100 });
      close();
    } catch (error) {
      console.error('Error generating note:', error);
      sendProgress({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate note',
      });
      close();
    }
  })();

  // Return streaming response immediately
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
