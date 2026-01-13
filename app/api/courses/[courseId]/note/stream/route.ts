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
import { getRecapsPrompt, RECAPS_HEADER } from '@/lib/prompts/recaps';
import {
  getSinglePassPromptV3,
  getStructurePromptV3,
  getTranscriptionPromptV3,
  getFinalSynthesisPrompt
} from '@/lib/prompts/excellent-revision-v3';
import {
  formatGraphicsContext,
  getCourseGraphicsSummaries,
  extractGraphicReferences,
  formatGraphicsForStructureAnalysis,
  getGraphicsForSection,
  formatGraphicsContextForSection,
  resolveGraphicsUrls,
  GraphicAssignment,
  GraphicWithUrl
} from '@/lib/backend/graphics-enricher';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHUNK_SIZE = 12000;

// Helper for retrying API calls with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 10000
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error?.status === 429 && attempt < maxRetries) {
        const retryAfter = error?.headers?.get?.('retry-after-ms');
        const delay = retryAfter ? parseInt(retryAfter) + 1000 : baseDelay * Math.pow(2, attempt);
        console.log(`[Stream] Rate limit hit, retrying in ${Math.round(delay / 1000)}s`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

function getLanguageName(language: string): string {
  const languageMap: Record<string, string> = {
    'FR': 'French',
    'DE': 'German',
    'ES': 'Spanish',
    'IT': 'Italian',
    'PT': 'Portuguese',
    'NL': 'Dutch',
    'PL': 'Polish',
    'RU': 'Russian',
    'ZH': 'Chinese',
    'JA': 'Japanese',
    'KO': 'Korean',
    'AR': 'Arabic',
    'TR': 'Turkish',
    'SV': 'Swedish',
    'DA': 'Danish',
    'NO': 'Norwegian',
    'FI': 'Finnish',
    'CS': 'Czech',
    'RO': 'Romanian',
    'HU': 'Hungarian',
    'EL': 'Greek',
    'HE': 'Hebrew',
    'TH': 'Thai',
    'VI': 'Vietnamese',
    'EN': 'English',
  };
  return languageMap[language.toUpperCase()] || 'English';
}

interface ContentTypes {
  definitions: string[];
  formulas: string[];
  numerical_examples: string[];
  graphs_or_visuals: string[];
  exercises: string[];
}

interface EssentialContent {
  coreDefinitions?: string[];
  keyFormulas?: string[];
  criticalExamples?: string[];
  pedagogicalGraphs?: Array<{
    description: string;
    pageNumber: number;
    figureReference?: string;
    pedagogicalValue?: string;
  }>;
}

interface ActiveLearningOpportunities {
  definitionsToTransformIntoQuestions?: string[];
  conceptsForAnalogies?: string[];
  exercisesWithSolutions?: string[];
}

interface Connections {
  prerequisiteSections?: string[];
  relatedConcepts?: string[];
}

interface Section {
  title: string;
  startMarker: string;
  endMarker: string;
  contentTypes: ContentTypes;
  keyTopics: string[];
  isEssential?: boolean;
  essentialContent?: EssentialContent;
  activeLearningOpportunities?: ActiveLearningOpportunities;
  connections?: Connections;
  // V4: Graphic assignment during structure analysis
  assignedGraphics?: GraphicAssignment[];
}

interface DocumentStructure {
  title: string;
  metadata_to_ignore: string[];
  sections: Section[];
  coreIdeas?: string[];
}

interface VerificationResult {
  verification: Array<{ item: string; status: string; details: string }>;
  missing_content: string;
  completeness_score: number;
}

// Extract structure (non-streaming, quick)
// V4: Now assigns graphics to sections during structure analysis
async function extractStructure(
  sourceText: string,
  language: string,
  config: PersonnalisationConfig,
  graphicsContext: string = ''
): Promise<DocumentStructure> {
  const languageName = getLanguageName(language);
  const textForStructure = sourceText.substring(0, 20000);
  // V4: Pass graphics context for assignment
  const structurePrompt = getStructurePromptV3(config, languageName, graphicsContext);

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: structurePrompt },
        { role: 'user', content: `Analyze the following course text and return ONLY a valid JSON object (no other text):\n\n${textForStructure}` },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 4000, // Increased for V4's graphic assignments
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Failed to extract document structure');
    return JSON.parse(content) as DocumentStructure;
  });
}

function findSectionText(
  fullText: string,
  section: Section,
  allSections: Section[],
  sectionIndex: number
): string {
  let startIndex = fullText.toLowerCase().indexOf(section.startMarker.toLowerCase().substring(0, 50));
  if (startIndex === -1) {
    const chunkSize = Math.floor(fullText.length / allSections.length);
    startIndex = sectionIndex * chunkSize;
  }

  let endIndex = fullText.length;
  if (sectionIndex < allSections.length - 1) {
    const nextSection = allSections[sectionIndex + 1];
    const nextStart = fullText.toLowerCase().indexOf(
      nextSection.startMarker.toLowerCase().substring(0, 50),
      startIndex + 100
    );
    if (nextStart !== -1) endIndex = nextStart;
  }

  let sectionText = fullText.substring(startIndex, endIndex);
  if (sectionText.length > CHUNK_SIZE) {
    sectionText = sectionText.substring(0, CHUNK_SIZE) + '\n\n[... section continue ...]';
  }
  return sectionText;
}

// Streaming transcription of a section
async function* transcribeSectionStreaming(
  sectionText: string,
  sectionTitle: string,
  language: string,
  contentTypes: ContentTypes,
  metadataToIgnore: string[],
  config: PersonnalisationConfig,
  imageContext: string = '',
  section?: Section
): AsyncGenerator<string, void, unknown> {
  const languageName = getLanguageName(language);
  const formulaReminder = contentTypes.formulas.length > 0
    ? '\n\nATTENTION : Cette section contient des formules. Utilise OBLIGATOIREMENT $$ pour les formules centrées et $ pour les formules en ligne.'
    : '';

  const transcriptionPrompt = section
    ? getTranscriptionPromptV3(
        config,
        section.essentialContent || {},
        section.activeLearningOpportunities || {},
        section.connections || {},
        metadataToIgnore,
        languageName,
        formulaReminder,
        imageContext
      )
    : getTranscriptionPrompt(
        config,
        contentTypes,
        metadataToIgnore,
        languageName,
        formulaReminder,
        imageContext
      );

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: transcriptionPrompt },
      { role: 'user', content: `Section : ${sectionTitle}\n\n${sectionText}` },
    ],
    temperature: 0.3,
    max_tokens: 5000,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

// Streaming single-pass generation
async function* singlePassGenerationStreaming(
  sourceText: string,
  language: string,
  config: PersonnalisationConfig,
  imageContext: string = ''
): AsyncGenerator<string, void, unknown> {
  const languageName = getLanguageName(language);
  const singlePassPrompt = getSinglePassPromptV3(config, languageName, imageContext);

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: singlePassPrompt },
      { role: 'user', content: `Retranscris ce cours intégralement dans un format structuré :\n\n${sourceText}` },
    ],
    temperature: 0.3,
    max_tokens: 16000,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

// Non-streaming helpers
async function generateGlossary(
  transcribedContent: string,
  language: string,
  config: PersonnalisationConfig
): Promise<string> {
  const languageName = getLanguageName(language);
  const contentForGlossary = transcribedContent.length > 15000
    ? transcribedContent.substring(transcribedContent.length - 15000)
    : transcribedContent;

  const glossairePrompt = getGlossairePrompt(config, languageName);

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: glossairePrompt },
        { role: 'user', content: contentForGlossary },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });
    return response.choices[0].message.content || '';
  });
}

// V4: No longer checks for graphics - they are handled separately via structure assignment
async function verifyCompleteness(
  structure: DocumentStructure,
  transcribedContent: string,
  language: string,
  config: PersonnalisationConfig
): Promise<VerificationResult> {
  const languageName = getLanguageName(language);
  const expectedItems: string[] = [];

  for (const section of structure.sections) {
    if (section.contentTypes.definitions.length > 0)
      expectedItems.push(`Définitions: ${section.contentTypes.definitions.join(', ')}`);
    if (section.contentTypes.formulas.length > 0)
      expectedItems.push(`Formules: ${section.contentTypes.formulas.join(', ')}`);
    if (section.contentTypes.numerical_examples.length > 0)
      expectedItems.push(`Exemples: ${section.contentTypes.numerical_examples.join(', ')}`);
    // V4: Graphics are now handled via structure-phase assignment, not verification
    // Removed: graphs_or_visuals check to prevent "Contenu complémentaire" section with graphics
  }

  const expectedContent = expectedItems.join('\n');
  const verificationPrompt = getVerificationPrompt(config, expectedContent, languageName);
  const transcriptionForVerification = transcribedContent.length > 20000
    ? transcribedContent.substring(0, 20000) + '\n...[tronqué pour vérification]'
    : transcribedContent;

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: verificationPrompt },
        { role: 'user', content: `TRANSCRIPTION GÉNÉRÉE :\n${transcriptionForVerification}\n\nVérifie la complétude de la transcription.` },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 3000,
    });

    const content = response.choices[0].message.content;
    if (!content) return { verification: [], missing_content: '', completeness_score: 100 };

    try {
      return JSON.parse(content) as VerificationResult;
    } catch {
      return { verification: [], missing_content: '', completeness_score: 100 };
    }
  });
}

async function generateFinalSynthesis(
  noteContent: string,
  language: string,
  config: PersonnalisationConfig
): Promise<string> {
  const languageName = getLanguageName(language);
  const synthesisPrompt = getFinalSynthesisPrompt(config, languageName);
  const contentForSynthesis = noteContent.length > 20000
    ? noteContent.substring(noteContent.length - 20000)
    : noteContent;

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: synthesisPrompt },
        { role: 'user', content: contentForSynthesis },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });
    return response.choices[0].message.content || '';
  });
}

async function generateRecaps(
  noteContent: string,
  language: string,
  config: PersonnalisationConfig
): Promise<string> {
  const languageName = getLanguageName(language);
  const recapsPrompt = getRecapsPrompt(config, languageName);
  const contentForRecaps = noteContent.length > 20000
    ? noteContent.substring(noteContent.length - 20000)
    : noteContent;

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: recapsPrompt },
        { role: 'user', content: contentForRecaps },
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

  // Authentication
  const auth = await authenticateRequest(request);
  const guestSessionId = getGuestSessionIdFromRequest(request);
  if (!auth && !guestSessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const admin = getServiceSupabase();

  // Get course with source text
  let course;
  let error;

  if (auth) {
    const result = await supabase
      .from('courses')
      .select('id, title, source_text, content_language, note_status')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    course = result.data;
    error = result.error;
  } else {
    const result = await admin
      .from('courses')
      .select('id, title, source_text, content_language, note_status, user_id, guest_session_id')
      .eq('id', courseId)
      .is('user_id', null)
      .eq('guest_session_id', guestSessionId)
      .maybeSingle();
    course = result.data;
    error = result.error;
  }

  if (error || !course) {
    return new Response(JSON.stringify({ error: 'Course not found' }), { status: 404 });
  }

  if (!course.source_text) {
    return new Response(JSON.stringify({ error: 'Course has no source text' }), { status: 400 });
  }

  // Parse config
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
        includeGraphics: body.config.includeGraphics ?? DEFAULT_CONFIG.includeGraphics ?? false,
      };
    }
  } catch {
    // Use default config
  }

  const language = course.content_language?.toUpperCase() || 'EN';

  // Mark as generating
  await admin
    .from('courses')
    .update({
      note_status: 'generating',
      note_progress: 0,
      note_current_step: 'starting',
      note_section_index: null,
      note_total_sections: null,
      note_error_message: null,
      note_started_at: new Date().toISOString(),
      note_completed_at: null,
      note_config: config,
      note_partial_content: null,
    })
    .eq('id', courseId);

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        console.log(`[Stream V4] Starting generation for course ${courseId}`);

        // V4: Fetch graphics and prepare for structure analysis
        let graphics: Awaited<ReturnType<typeof getCourseGraphicsSummaries>> = [];
        let graphicsWithUrls: GraphicWithUrl[] = [];
        let graphicsForStructure = '';
        let imageContext = ''; // Legacy: for single-pass mode

        if (config.includeGraphics) {
          graphics = await getCourseGraphicsSummaries(courseId);
          graphicsWithUrls = resolveGraphicsUrls(graphics);
          graphicsForStructure = formatGraphicsForStructureAnalysis(graphics);
          imageContext = formatGraphicsContext(graphics); // Legacy for single-pass
          console.log(`[Stream V4] Graphics enabled: ${graphics.length} graphics for assignment`);
        } else {
          console.log('[Stream V4] Graphics disabled by user preference');
        }

        let noteContent = '';
        const sourceText = course.source_text;

        // Send start event
        send('start', { courseId, timestamp: Date.now() });

        if (sourceText.length > 15000) {
          // MULTI-PASS with streaming
          console.log('[Stream V4] Using MULTI-PASS generation');

          // Pass 1: Extract structure + assign graphics (not streamed, quick)
          send('progress', { step: 'analyzing_document', progress: 5 });
          // V4: Pass graphics for assignment during structure analysis
          const structure = await extractStructure(sourceText, language, config, graphicsForStructure);
          console.log(`[Stream V4] Found ${structure.sections.length} sections`);

          // V4: Build section -> graphics map from structure analysis
          const sectionGraphicsMap = new Map<number, string[]>();
          let totalAssignedGraphics = 0;
          if (config.includeGraphics) {
            for (let i = 0; i < structure.sections.length; i++) {
              const section = structure.sections[i];
              const assignedIds = section.assignedGraphics?.map(a => a.graphicId) || [];
              sectionGraphicsMap.set(i, assignedIds);
              totalAssignedGraphics += assignedIds.length;
              if (assignedIds.length > 0) {
                console.log(`[Stream V4] Section "${section.title}": ${assignedIds.length} graphic(s) assigned`);
              }
            }
            console.log(`[Stream V4] Total graphics assigned: ${totalAssignedGraphics}/${graphics.length}`);
          }

          send('progress', {
            step: 'analyzing_document',
            progress: 15,
            totalSections: structure.sections.length
          });

          // Start with title
          const title = `# ${structure.title || course.title}\n\n`;
          noteContent = title;
          send('content', { text: title });

          // Pass 2: Transcribe each section with streaming
          const metadataToIgnore = structure.metadata_to_ignore || [];

          // Track graphics actually placed (for logging)
          const usedGraphicIds = new Set<string>();

          for (let i = 0; i < structure.sections.length; i++) {
            const section = structure.sections[i];
            const progressBase = 15 + Math.floor((i / structure.sections.length) * 55);

            send('progress', {
              step: 'extracting_chapter',
              progress: progressBase,
              sectionIndex: i + 1,
              totalSections: structure.sections.length,
              sectionTitle: section.title,
            });

            const sectionSourceText = findSectionText(sourceText, section, structure.sections, i);

            // V4: Get PRE-ASSIGNED graphics for this section (not all graphics!)
            let sectionImageContext = '';
            if (config.includeGraphics) {
              const assignedIds = sectionGraphicsMap.get(i) || [];
              if (assignedIds.length > 0) {
                const sectionGraphics = getGraphicsForSection(graphicsWithUrls, assignedIds);
                sectionImageContext = formatGraphicsContextForSection(sectionGraphics);
                console.log(`[Stream V4] Section "${section.title}": ${sectionGraphics.length} graphic(s) PRE-ASSIGNED`);
              } else {
                console.log(`[Stream V4] Section "${section.title}": No graphics assigned`);
              }
            }

            // Stream this section
            const sectionGenerator = transcribeSectionStreaming(
              sectionSourceText,
              section.title,
              language,
              section.contentTypes || { definitions: [], formulas: [], numerical_examples: [], graphs_or_visuals: [], exercises: [] },
              metadataToIgnore,
              config,
              sectionImageContext, // V4: PRE-FILTERED context
              section
            );

            let sectionContent = '';
            for await (const chunk of sectionGenerator) {
              sectionContent += chunk;
              noteContent += chunk;
              send('content', { text: chunk });
            }

            // Extract graphics used in this section and mark them as used
            const graphicsInSection = extractGraphicReferences(sectionContent);
            for (const graphicId of graphicsInSection) {
              usedGraphicIds.add(graphicId);
            }
            if (graphicsInSection.length > 0) {
              console.log(`[Stream V4] Section "${section.title}": placed ${graphicsInSection.length} graphic(s)`);
            }

            // Add separator between sections
            if (i < structure.sections.length - 1) {
              const separator = '\n\n---\n\n';
              noteContent += separator;
              send('content', { text: separator });
            }

            // Update partial content in DB periodically
            await admin
              .from('courses')
              .update({
                note_partial_content: noteContent,
                note_progress: progressBase + 5,
                note_section_index: i + 1,
              })
              .eq('id', courseId);
          }

          if (config.includeGraphics) {
            console.log(`[Stream V4] Total graphics placed: ${usedGraphicIds.size}/${graphics.length}`);
          }

          // Pass 3: Verify completeness (quick, not streamed)
          send('progress', { step: 'verifying_content', progress: 72 });
          const verification = await verifyCompleteness(structure, noteContent, language, config);
          console.log(`[Stream] Completeness score: ${verification.completeness_score}%`);

          if (verification.missing_content && verification.missing_content.trim().length > 0) {
            const missingSection = `\n\n---\n\n## Contenu complémentaire\n\n${verification.missing_content}`;
            noteContent += missingSection;
            send('content', { text: missingSection });
          }

          // Pass 4: Final synthesis (quick, not streamed)
          send('progress', { step: 'generating_content', progress: 80 });
          console.log('[Stream] Generating final synthesis...');
          const synthesis = await generateFinalSynthesis(noteContent, language, config);
          if (synthesis && synthesis.trim().length > 0) {
            const synthesisSection = `\n\n---\n\n${synthesis}`;
            noteContent += synthesisSection;
            send('content', { text: synthesisSection });
          }

        } else {
          // SINGLE-PASS with streaming
          console.log('[Stream] Using SINGLE-PASS generation');

          send('progress', { step: 'generating_content', progress: 10 });

          const generator = singlePassGenerationStreaming(sourceText, language, config, imageContext);

          for await (const chunk of generator) {
            noteContent += chunk;
            send('content', { text: chunk });
          }
        }

        // Glossary if requested (works for both multi-pass and single-pass)
        if (config.recaps.definitions) {
          send('progress', { step: 'generating_glossary', progress: 85 });
          console.log('[Stream] Generating glossary...');
          const glossary = await generateGlossary(noteContent, language, config);
          if (glossary && glossary.trim().length > 0) {
            const glossarySection = `\n\n---\n\n${glossary}`;
            noteContent += glossarySection;
            send('content', { text: glossarySection });
          }
        }

        // Recaps (formulas) if requested
        if (config.recaps.formules || config.recaps.schemas) {
          send('progress', { step: 'generating_content', progress: 90 });
          console.log('[Stream] Generating recaps...');
          const recaps = await generateRecaps(noteContent, language, config);
          if (recaps && recaps.trim().length > 0) {
            const recapsSection = `${RECAPS_HEADER}${recaps}`;
            noteContent += recapsSection;
            send('content', { text: recapsSection });
          }
        }

        // Finalize (no placeholder replacement needed - URLs are already embedded)
        send('progress', { step: 'finalizing', progress: 95 });

        // Save final content
        await admin
          .from('courses')
          .update({
            aplus_note: noteContent,
            note_config: config,
            note_status: 'ready',
            note_progress: 100,
            note_current_step: 'complete',
            note_completed_at: new Date().toISOString(),
            note_error_message: null,
            note_partial_content: null,
          })
          .eq('id', courseId);

        console.log(`[Stream] Generation complete. Length: ${noteContent.length}`);
        send('complete', { success: true, length: noteContent.length });
        controller.close();

      } catch (err: any) {
        console.error('[Stream] Generation error:', err);

        await admin
          .from('courses')
          .update({
            note_status: 'failed',
            note_error_message: err.message || 'Erreur lors de la génération',
            note_current_step: 'error',
          })
          .eq('id', courseId);

        send('error', { message: err.message || 'Erreur lors de la génération' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
