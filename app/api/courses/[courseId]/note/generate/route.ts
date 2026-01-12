import { NextRequest, NextResponse } from 'next/server';
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
// V3: Nouveau système basé sur les 7 principes de la fiche de révision excellente
import {
  getSinglePassPromptV3,
  getStructurePromptV3,
  getTranscriptionPromptV3,
  getFinalSynthesisPrompt
} from '@/lib/prompts/excellent-revision-v3';
import { formatGraphicsContext, getCourseGraphicsSummaries, replaceGraphicPlaceholders, extractGraphicReferences } from '@/lib/backend/graphics-enricher';

// Max duration for note generation
export const maxDuration = 300;

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

// Image extraction temporarily disabled
type AnalyzedImage = { url: string; description: string; title?: string; type: string; };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration
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
        console.log(`[A+ Note] Rate limit hit, retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
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

// V3: Extended structure for excellent revision sheet
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
  // V3 additions
  isEssential?: boolean;
  essentialContent?: EssentialContent;
  activeLearningOpportunities?: ActiveLearningOpportunities;
  connections?: Connections;
}

interface DocumentStructure {
  title: string;
  metadata_to_ignore: string[];
  sections: Section[];
  // V3 additions
  coreIdeas?: string[];
}

interface VerificationResult {
  verification: Array<{ item: string; status: string; details: string }>;
  missing_content: string;
  completeness_score: number;
}

// Update progress in database (fire-and-forget, doesn't throw)
async function updateNoteProgress(
  admin: ReturnType<typeof getServiceSupabase>,
  courseId: string,
  data: {
    progress?: number;
    currentStep?: string;
    sectionIndex?: number | null;
    totalSections?: number | null;
    status?: 'generating' | 'ready' | 'failed';
    errorMessage?: string | null;
    partialContent?: string | null;
  }
) {
  try {
    const updateData: Record<string, unknown> = {};

    if (data.progress !== undefined) updateData.note_progress = data.progress;
    if (data.currentStep !== undefined) updateData.note_current_step = data.currentStep;
    if (data.sectionIndex !== undefined) updateData.note_section_index = data.sectionIndex;
    if (data.totalSections !== undefined) updateData.note_total_sections = data.totalSections;
    if (data.status !== undefined) updateData.note_status = data.status;
    if (data.errorMessage !== undefined) updateData.note_error_message = data.errorMessage;
    if (data.partialContent !== undefined) updateData.note_partial_content = data.partialContent;

    if (data.status === 'ready') {
      updateData.note_completed_at = new Date().toISOString();
    }

    await admin.from('courses').update(updateData).eq('id', courseId);
  } catch (e) {
    console.error('[note-generate] Failed to update progress:', e);
  }
}

/**
 * Extract document structure (Pass 1)
 * V3: Uses the new structure prompt based on the 7 principles
 */
async function extractStructure(
  sourceText: string,
  language: string,
  config: PersonnalisationConfig,
  useV3: boolean = true
): Promise<DocumentStructure> {
  const languageName = getLanguageName(language);
  const textForStructure = sourceText.substring(0, 20000);

  // V3: Use new prompt focused on essential content and active learning
  const structurePrompt = useV3
    ? getStructurePromptV3(config, languageName)
    : getStructurePrompt(config, languageName);

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: structurePrompt },
        { role: 'user', content: `Analyze the following course text and return ONLY a valid JSON object (no other text):\n\n${textForStructure}` },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 3000, // Increased for V3's richer structure
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
    if (nextStart !== -1) {
      endIndex = nextStart;
    }
  }

  let sectionText = fullText.substring(startIndex, endIndex);

  if (sectionText.length > CHUNK_SIZE) {
    sectionText = sectionText.substring(0, CHUNK_SIZE) + '\n\n[... section continue ...]';
  }

  return sectionText;
}

/**
 * Transcribe a single section (Pass 2)
 * V3: Uses the new transcription prompt with active learning focus
 */
async function transcribeSection(
  sectionText: string,
  sectionTitle: string,
  language: string,
  contentTypes: ContentTypes,
  metadataToIgnore: string[],
  config: PersonnalisationConfig,
  imageContext: string = '',
  section?: Section,
  useV3: boolean = true
): Promise<string> {
  const languageName = getLanguageName(language);

  const formulaReminder = contentTypes.formulas.length > 0
    ? '\n\nATTENTION : Cette section contient des formules. Utilise OBLIGATOIREMENT $$ pour les formules centrées et $ pour les formules en ligne.'
    : '';

  let transcriptionPrompt: string;

  if (useV3 && section) {
    // V3: Use new prompt with essential content, active learning, and connections
    transcriptionPrompt = getTranscriptionPromptV3(
      config,
      section.essentialContent || {},
      section.activeLearningOpportunities || {},
      section.connections || {},
      metadataToIgnore,
      languageName,
      formulaReminder,
      imageContext
    );
  } else {
    // Legacy prompt
    transcriptionPrompt = getTranscriptionPrompt(
      config,
      contentTypes,
      metadataToIgnore,
      languageName,
      formulaReminder,
      imageContext
    );
  }

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: transcriptionPrompt },
        { role: 'user', content: `Section : ${sectionTitle}\n\n${sectionText}` },
      ],
      temperature: 0.3,
      max_tokens: 5000, // Increased for V3's richer content (questions, analogies, exercises)
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
 * V3: Uses the new single-pass prompt based on the 7 principles
 */
async function singlePassGeneration(
  sourceText: string,
  language: string,
  config: PersonnalisationConfig,
  imageContext: string = '',
  useV3: boolean = true
): Promise<string> {
  const languageName = getLanguageName(language);

  // V3: Use new prompt focused on active learning and the 7 principles
  const singlePassPrompt = useV3
    ? getSinglePassPromptV3(config, languageName, imageContext)
    : getSinglePassPrompt(config, languageName, imageContext);

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: singlePassPrompt },
        { role: 'user', content: `Retranscris ce cours intégralement dans un format structuré :\n\n${sourceText}` },
      ],
      temperature: 0.3,
      max_tokens: 16000,
    });

    return response.choices[0].message.content || '';
  });
}

/**
 * Generate final synthesis section (V3)
 * Applies Principle 7: Actionability
 */
async function generateFinalSynthesis(
  noteContent: string,
  language: string,
  config: PersonnalisationConfig
): Promise<string> {
  const languageName = getLanguageName(language);
  const synthesisPrompt = getFinalSynthesisPrompt(config, languageName);

  // Use last 20k chars for synthesis (most relevant content)
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

// Main note generation function - runs independently of HTTP connection
async function runNoteGeneration(
  courseId: string,
  courseTitle: string,
  sourceText: string,
  language: string,
  config: PersonnalisationConfig
) {
  const admin = getServiceSupabase();

  try {
    console.log(`[A+ Note V3] Starting generation for course ${courseId}`);
    console.log(`[A+ Note V3] Source text length: ${sourceText.length} characters`);
    console.log(`[A+ Note V3] Config: matiere=${config.matiere}, niveau=${config.niveau}, includeGraphics=${config.includeGraphics ?? false}`);
    console.log(`[A+ Note V3] Using 7-Principles Excellent Revision Sheet System`);

    // Fetch available graphics for this course ONLY if includeGraphics is enabled
    let graphics: Awaited<ReturnType<typeof getCourseGraphicsSummaries>> = [];
    if (config.includeGraphics) {
      graphics = await getCourseGraphicsSummaries(courseId);
      console.log(`[A+ Note V3] Found ${graphics.length} high-confidence graphics to include`);
    } else {
      console.log(`[A+ Note V3] Graphics extraction disabled by user preference`);
    }

    const imageContext = config.includeGraphics ? formatGraphicsContext(graphics) : '';
    let noteContent: string;
    const USE_V3 = true; // Enable V3 by default

    // Decision: Use multi-pass for documents > 15k chars
    if (sourceText.length > 15000) {
      console.log('[A+ Note V3] Using MULTI-PASS generation (document > 15k chars)');

      // Pass 1: Extract structure (0-20%)
      await updateNoteProgress(admin, courseId, {
        progress: 1,
        currentStep: 'analyzing_document',
      });

      const structure = await extractStructure(sourceText, language, config, USE_V3);
      console.log(`[A+ Note V3] Found ${structure.sections.length} sections`);
      if (USE_V3 && structure.coreIdeas) {
        console.log(`[A+ Note V3] Identified ${structure.coreIdeas.length} core ideas:`, structure.coreIdeas);
      }

      await updateNoteProgress(admin, courseId, {
        progress: 20,
        currentStep: 'analyzing_document',
        totalSections: structure.sections.length,
      });

      // Pass 2: Transcribe each section (20-70%)
      const sectionCount = structure.sections.length;
      const metadataToIgnore = structure.metadata_to_ignore || [];
      const transcribedSections: string[] = [];

      // Track graphics already placed to prevent duplicates across sections
      const usedGraphicIds = new Set<string>();

      // Initialize partial content with title
      let partialContent = `# ${structure.title || courseTitle}\n\n`;
      await updateNoteProgress(admin, courseId, {
        progress: 20,
        currentStep: 'extracting_chapter',
        sectionIndex: 0,
        totalSections: sectionCount,
        partialContent,
      });

      for (let i = 0; i < structure.sections.length; i++) {
        const section = structure.sections[i];
        const progressPercent = 20 + Math.floor(((i + 0.5) / structure.sections.length) * 50);

        await updateNoteProgress(admin, courseId, {
          progress: progressPercent,
          currentStep: 'extracting_chapter',
          sectionIndex: i + 1,
          totalSections: sectionCount,
        });

        const sectionSourceText = findSectionText(sourceText, section, structure.sections, i);
        console.log(`[A+ Note V3] Processing section ${i + 1}/${sectionCount}: ${section.title}`);
        if (USE_V3 && section.isEssential) {
          console.log(`[A+ Note V3]   → Essential section with active learning opportunities`);
        }

        // Generate image context excluding already-used graphics (only if graphics enabled)
        const sectionImageContext = config.includeGraphics ? formatGraphicsContext(graphics, usedGraphicIds) : '';
        if (config.includeGraphics) {
          console.log(`[A+ Note V3]   → ${graphics.length - usedGraphicIds.size} graphics available (${usedGraphicIds.size} already placed)`);
        }

        const sectionContent = await transcribeSection(
          sectionSourceText,
          section.title,
          language,
          section.contentTypes || { definitions: [], formulas: [], numerical_examples: [], graphs_or_visuals: [], exercises: [] },
          metadataToIgnore,
          config,
          sectionImageContext, // Use filtered context instead of full imageContext
          section, // Pass full section for V3
          USE_V3
        );

        // Extract graphics used in this section and add to tracking set (only if graphics enabled)
        if (config.includeGraphics) {
          const sectionGraphicIds = extractGraphicReferences(sectionContent);
          sectionGraphicIds.forEach(id => usedGraphicIds.add(id));
          if (sectionGraphicIds.length > 0) {
            console.log(`[A+ Note V3]   → Placed ${sectionGraphicIds.length} graphic(s) in this section`);
          }
        }

        transcribedSections.push(sectionContent);

        // Update partial content after each section for live streaming
        partialContent = `# ${structure.title || courseTitle}\n\n` + transcribedSections.join('\n\n---\n\n');
        const progressAfterSection = 20 + Math.floor(((i + 1) / structure.sections.length) * 50);
        await updateNoteProgress(admin, courseId, {
          progress: progressAfterSection,
          currentStep: 'extracting_chapter',
          sectionIndex: i + 1,
          totalSections: sectionCount,
          partialContent,
        });
      }

      if (config.includeGraphics) {
        console.log(`[A+ Note V3] Total graphics placed: ${usedGraphicIds.size}/${graphics.length}`);
      }

      // Assemble content
      let mainContent = partialContent;

      // Pass 3: Verify completeness (70-80%)
      await updateNoteProgress(admin, courseId, {
        progress: 70,
        currentStep: 'verifying_content',
        sectionIndex: null,
        partialContent: mainContent,
      });

      const verification = await verifyCompleteness(structure, mainContent, language, config);
      console.log(`[A+ Note] Completeness score: ${verification.completeness_score}%`);

      // Append missing content if any
      if (verification.missing_content && verification.missing_content.trim().length > 0) {
        console.log('[A+ Note] Adding missing content...');
        mainContent += `\n\n---\n\n## Contenu complémentaire\n\n${verification.missing_content}`;
        // Update partial content with missing content
        await updateNoteProgress(admin, courseId, {
          progress: 75,
          currentStep: 'verifying_content',
          partialContent: mainContent,
        });
      }

      // V3: Generate final synthesis (Principle 7: Actionability) (80-85%)
      if (USE_V3) {
        await updateNoteProgress(admin, courseId, {
          progress: 80,
          currentStep: 'generating_content',
          partialContent: mainContent,
        });

        console.log('[A+ Note V3] Generating final synthesis (Principle 7: Actionability)...');
        const finalSynthesis = await generateFinalSynthesis(mainContent, language, config);
        if (finalSynthesis && finalSynthesis.trim().length > 0) {
          mainContent += `\n\n---\n\n${finalSynthesis}`;
          await updateNoteProgress(admin, courseId, {
            progress: 85,
            currentStep: 'generating_content',
            partialContent: mainContent,
          });
        }
      }

      // Glossary if requested (85-90%)
      if (config.recaps.definitions) {
        await updateNoteProgress(admin, courseId, {
          progress: USE_V3 ? 85 : 80,
          currentStep: 'generating_content',
          partialContent: mainContent,
        });

        console.log('[A+ Note] Generating glossary...');
        const glossary = await generateGlossary(mainContent, language, config);
        mainContent += `\n\n---\n\n${glossary}`;
        // Update partial content with glossary
        await updateNoteProgress(admin, courseId, {
          progress: USE_V3 ? 90 : 85,
          currentStep: 'generating_content',
          partialContent: mainContent,
        });
      }

      noteContent = mainContent;

    } else {
      console.log('[A+ Note V3] Using SINGLE-PASS generation (document <= 15k chars)');

      await updateNoteProgress(admin, courseId, {
        progress: 5,
        currentStep: 'analyzing_document',
      });

      noteContent = await singlePassGeneration(sourceText, language, config, imageContext, USE_V3);

      await updateNoteProgress(admin, courseId, {
        progress: 80,
        currentStep: 'generating_content',
      });

      // V3: Single-pass already includes synthesis section, so no need to generate separately
      console.log('[A+ Note V3] Single-pass includes synthesis section (Principle 7)');

      // Generate glossary if requested (also for single-pass)
      if (config.recaps.definitions) {
        await updateNoteProgress(admin, courseId, {
          progress: 85,
          currentStep: 'generating_content',
          partialContent: noteContent,
        });

        console.log('[A+ Note] Generating glossary (single-pass)...');
        const glossary = await generateGlossary(noteContent, language, config);
        noteContent += `\n\n---\n\n${glossary}`;

        await updateNoteProgress(admin, courseId, {
          progress: 88,
          currentStep: 'generating_content',
          partialContent: noteContent,
        });
      }
    }

    if (!noteContent) {
      throw new Error('Failed to generate note content');
    }

    // Generate recaps if formulas or schemas requested
    const needsFormulasRecap = config.recaps.formules;
    const needsSchemasRecap = config.recaps.schemas;

    if (needsFormulasRecap || needsSchemasRecap) {
      await updateNoteProgress(admin, courseId, {
        progress: 90,
        currentStep: 'generating_content',
      });

      console.log('[A+ Note] Generating recaps (formules/schemas)...');
      const recapsContent = await generateRecaps(noteContent, language, config);

      if (recapsContent && recapsContent.trim().length > 0) {
        noteContent = `${noteContent}${RECAPS_HEADER}${recapsContent}`;
      }
    }

    console.log(`[A+ Note] Generation complete. Note length: ${noteContent.length} characters`);

    await updateNoteProgress(admin, courseId, {
      progress: 95,
      currentStep: 'finalizing',
    });

    // Replace graphic placeholders with actual image URLs (only if graphics were included)
    if (config.includeGraphics) {
      console.log('[A+ Note] Replacing graphic placeholders with actual URLs...');
      noteContent = await replaceGraphicPlaceholders(noteContent, courseId);
    }

    // Save note and config to course
    const { error: updateError } = await admin
      .from('courses')
      .update({
        aplus_note: noteContent,
        note_config: config,
        note_status: 'ready',
        note_progress: 100,
        note_current_step: 'complete',
        note_completed_at: new Date().toISOString(),
        note_error_message: null,
      })
      .eq('id', courseId);

    if (updateError) {
      console.error('Error saving note:', updateError);
      throw new Error('Failed to save note');
    }

    console.log(`[A+ Note] Course ${courseId} note generation complete.`);

  } catch (error: any) {
    console.error('[note-generate] Generation error:', error);

    await admin
      .from('courses')
      .update({
        note_status: 'failed',
        note_error_message: error.message || 'Erreur lors de la génération de la fiche',
        note_current_step: 'error',
      })
      .eq('id', courseId);
  }
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  if (error) {
    console.error('Error fetching course:', error);
    return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
  }

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  if (!course.source_text) {
    return NextResponse.json({ error: 'Course has no source text' }, { status: 400 });
  }

  // Check if already generating
  if (course.note_status === 'generating') {
    return NextResponse.json({
      success: true,
      message: 'Note generation already in progress',
      courseId,
      status: 'generating',
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
        includeGraphics: body.config.includeGraphics ?? DEFAULT_CONFIG.includeGraphics ?? false,
      };
    }
  } catch {
    // No body or invalid JSON, use default config
    console.log('[A+ Note] No personnalisation config provided, using defaults');
  }

  const language = course.content_language?.toUpperCase() || 'EN';

  // Mark note as generating + reset progress
  const { error: updateError } = await admin
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
    })
    .eq('id', courseId);

  if (updateError) {
    console.error('Error updating course status:', updateError);
    return NextResponse.json({ error: 'Failed to start note generation' }, { status: 500 });
  }

  // Start generation in background - this runs independently of HTTP connection
  setTimeout(() => {
    runNoteGeneration(courseId, course.title, course.source_text, language, config)
      .catch(err => {
        console.error('[note-generate] Background generation failed:', err);
      });
  }, 0);

  // Return immediately with status - client will poll for updates
  return NextResponse.json({
    success: true,
    message: 'Note generation started',
    courseId,
    status: 'generating',
  });
}
