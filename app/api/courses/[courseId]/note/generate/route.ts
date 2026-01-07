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

  const sendProgress = (data: {
    type: string;
    message?: string;
    step?: string;
    progress?: number;
    content?: string;
    sectionIndex?: number;
    totalSections?: number;
  }) => {
    if (controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    }
  };

  const sendChunk = (content: string, section?: string, sectionIndex?: number, totalSections?: number) => {
    if (controller && content) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'chunk',
        content,
        section,
        sectionIndex,
        totalSections,
      })}\n\n`));
    }
  };

  const close = () => {
    if (controller) {
      controller.close();
    }
  };

  return { stream, sendProgress, sendChunk, close };
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
 * Transcribe a single section (Pass 2) - Non-streaming version
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
 * Transcribe a single section with streaming - sends chunks as they arrive
 */
async function transcribeSectionStreaming(
  sectionText: string,
  sectionTitle: string,
  language: string,
  contentTypes: ContentTypes,
  metadataToIgnore: string[],
  config: PersonnalisationConfig,
  imageContext: string = '',
  sendChunk: (content: string, section?: string, sectionIndex?: number, totalSections?: number) => void,
  sectionIndex: number,
  totalSections: number
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

  let fullContent = '';

  // Use streaming with retry for rate limit handling
  return withRetry(async () => {
    const stream = await openai.chat.completions.create({
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
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullContent += content;
        // Send each chunk to the client
        sendChunk(content, sectionTitle, sectionIndex, totalSections);
      }
    }

    return fullContent;
  });
}

/**
 * Single-pass generation with streaming
 */
async function singlePassGenerationStreaming(
  sourceText: string,
  language: string,
  config: PersonnalisationConfig,
  imageContext: string = '',
  sendChunk: (content: string) => void
): Promise<string> {
  const languageName = getLanguageName(language);
  const singlePassPrompt = getSinglePassPrompt(config, languageName, imageContext);

  let fullContent = '';

  return withRetry(async () => {
    const stream = await openai.chat.completions.create({
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
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullContent += content;
        sendChunk(content);
      }
    }

    return fullContent;
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
  const { stream, sendProgress, sendChunk, close } = createProgressStream();

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
        console.log('[A+ Note] Using MULTI-PASS generation with STREAMING (document > 15k chars)');

        // Pass 1: Extract structure (0-20%)
        // Send initial progress with step key for frontend translation
        sendProgress({ type: 'progress', step: 'analyzing_document', progress: 1 });
        console.log('[A+ Note] Pass 1: Extracting document structure...');

        // Start a progress ticker to show activity during structure extraction
        // Slower progression from 0-20% for a smoother initial experience
        let structureProgress = 1;
        const structureTicker = setInterval(() => {
          if (structureProgress < 18) {
            structureProgress += 0.5;
            sendProgress({ type: 'progress', step: 'analyzing_document', progress: Math.round(structureProgress) });
          }
        }, 1200); // Increment every 1.2 seconds for slower progression

        let structure;
        try {
          structure = await extractStructure(sourceText, language, config);
        } finally {
          clearInterval(structureTicker);
        }

        console.log(`[A+ Note] Found ${structure.sections.length} sections`);
        sendProgress({ type: 'progress', step: 'analyzing_document', progress: 20 });

        // Pass 2: Transcribe each section with streaming (20-70%)
        const sectionCount = structure.sections.length;
        const metadataToIgnore = structure.metadata_to_ignore || [];
        sendProgress({ type: 'progress', step: 'extracting_chapter', progress: 21, sectionIndex: 1, totalSections: sectionCount });

        // Send initial title as chunk
        const titleChunk = `# ${structure.title || course.title}\n\n`;
        sendChunk(titleChunk);

        const transcribedSections: string[] = [];

        // Process sections sequentially for streaming (one at a time for smooth UX)
        for (let i = 0; i < structure.sections.length; i++) {
          const section = structure.sections[i];
          // Progress from 20% to 70% based on section completion
          const progressPercent = 20 + Math.floor(((i + 0.5) / structure.sections.length) * 50);

          sendProgress({
            type: 'progress',
            step: 'extracting_chapter',
            progress: progressPercent,
            sectionIndex: i + 1,
            totalSections: sectionCount,
          });

          const sectionSourceText = findSectionText(sourceText, section, structure.sections, i);
          console.log(`[A+ Note] Streaming section ${i + 1}/${sectionCount}: ${section.title}`);

          // Add separator between sections
          if (i > 0) {
            sendChunk('\n\n---\n\n');
          }

          const sectionContent = await transcribeSectionStreaming(
            sectionSourceText,
            section.title,
            language,
            section.contentTypes || { definitions: [], formulas: [], numerical_examples: [], graphs_or_visuals: [], exercises: [] },
            metadataToIgnore,
            config,
            imageContext,
            sendChunk,
            i + 1,
            sectionCount
          );

          transcribedSections.push(sectionContent);
        }

        // Assemble content for post-processing
        let mainContent = titleChunk + transcribedSections.join('\n\n---\n\n');

        // Pass 3: Verify completeness (70-80%)
        sendProgress({ type: 'progress', step: 'verifying_content', progress: 70 });
        console.log('[A+ Note] Pass 3: Verifying completeness...');

        // Progress ticker during verification
        let verifyProgress = 70;
        const verifyTicker = setInterval(() => {
          if (verifyProgress < 78) {
            verifyProgress += 1;
            sendProgress({ type: 'progress', step: 'verifying_content', progress: verifyProgress });
          }
        }, 600);

        let verification;
        try {
          verification = await verifyCompleteness(structure, mainContent, language, config);
        } finally {
          clearInterval(verifyTicker);
        }

        console.log(`[A+ Note] Completeness score: ${verification.completeness_score}%`);
        sendProgress({ type: 'progress', step: 'verifying_content', progress: 79 });

        // Append missing content if any
        if (verification.missing_content && verification.missing_content.trim().length > 0) {
          console.log('[A+ Note] Adding missing content...');
          const missingChunk = `\n\n---\n\n## Contenu complémentaire\n\n${verification.missing_content}`;
          sendChunk(missingChunk);
          mainContent += missingChunk;
        }

        // Glossaire généré UNIQUEMENT si l'option est cochée dans les récaps (80-95%)
        if (config.recaps.definitions) {
          sendProgress({ type: 'progress', step: 'generating_content', progress: 80 });
          console.log('[A+ Note] Generating glossary (user requested)...');

          // Progress ticker during glossary generation
          let glossaryProgress = 80;
          const glossaryTicker = setInterval(() => {
            if (glossaryProgress < 92) {
              glossaryProgress += 1;
              sendProgress({ type: 'progress', step: 'generating_content', progress: glossaryProgress });
            }
          }, 500);

          let glossary;
          try {
            glossary = await generateGlossary(mainContent, language, config);
          } finally {
            clearInterval(glossaryTicker);
          }

          sendProgress({ type: 'progress', step: 'generating_content', progress: 93 });
          const glossaryChunk = `\n\n---\n\n${glossary}`;
          sendChunk(glossaryChunk);
          noteContent = mainContent + glossaryChunk;
        } else {
          noteContent = mainContent;
        }

      } else {
        console.log('[A+ Note] Using SINGLE-PASS generation with STREAMING (document <= 15k chars)');
        // For short documents, use single-pass with progressive updates (0-95%)
        sendProgress({ type: 'progress', step: 'analyzing_document', progress: 1 });

        // Progress ticker during single-pass generation
        // Slower progression from 0-20% then faster after
        let singlePassProgress = 1;
        const singlePassTicker = setInterval(() => {
          if (singlePassProgress < 85) {
            // Slower increment before 20%, faster after
            const increment = singlePassProgress < 20 ? 0.8 : 2;
            singlePassProgress += increment;
            const step = singlePassProgress < 20 ? 'analyzing_document' : 'generating_content';
            sendProgress({ type: 'progress', step, progress: Math.round(singlePassProgress) });
          }
        }, 1200); // 1.2 seconds between updates for slower initial feel

        try {
          noteContent = await singlePassGenerationStreaming(sourceText, language, config, imageContext, (content) => {
            sendChunk(content);
          });
        } finally {
          clearInterval(singlePassTicker);
        }

        sendProgress({ type: 'progress', step: 'generating_content', progress: 90 });
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
        sendProgress({ type: 'progress', step: 'generating_content', progress: 90 });
        console.log('[A+ Note] Generating recaps (formules/schemas)...');

        // Progress ticker during recaps generation
        let recapsProgress = 90;
        const recapsTicker = setInterval(() => {
          if (recapsProgress < 94) {
            recapsProgress += 1;
            sendProgress({ type: 'progress', step: 'generating_content', progress: recapsProgress });
          }
        }, 400);

        let recapsContent;
        try {
          recapsContent = await generateRecaps(noteContent, language, config);
        } finally {
          clearInterval(recapsTicker);
        }

        sendProgress({ type: 'progress', step: 'generating_content', progress: 94 });
        if (recapsContent && recapsContent.trim().length > 0) {
          noteContent = `${noteContent}${RECAPS_HEADER}${recapsContent}`;
        }
      }

      console.log(`[A+ Note] Generation complete. Note length: ${noteContent.length} characters`);

      sendProgress({ type: 'progress', step: 'finalizing', progress: 95 });

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
