import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration
const CHUNK_SIZE = 12000; // Characters per chunk for detailed transcription
const MAX_CONCURRENT_CHUNKS = 3; // Parallel API calls

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

// Pass 1: Extract structure from the document
const STRUCTURE_EXTRACTION_PROMPT = `Tu es un expert en analyse de documents. Analyse ce cours et identifie sa structure.

RETOURNE UN JSON VALIDE avec cette structure exacte :
{
  "title": "Titre du cours",
  "sections": [
    {
      "title": "Titre de la section",
      "startMarker": "Premiers mots distinctifs de cette section (10-20 mots)",
      "endMarker": "Derniers mots distinctifs de cette section (10-20 mots)",
      "hasFormulas": true/false,
      "keyTopics": ["topic1", "topic2"]
    }
  ]
}

RÈGLES :
- Identifie 3 à 10 sections principales
- Les markers doivent être des phrases EXACTES du texte (pour le découpage)
- hasFormulas = true si la section contient des équations/formules
- Ne résume pas, identifie juste la structure`;

// Pass 2: Detailed transcription of each section
const SECTION_TRANSCRIPTION_PROMPT = `Tu es un transcripteur expert. Retranscris INTÉGRALEMENT cette section de cours.

RÈGLES ABSOLUES :
1. Tu ne résumes JAMAIS. Tu retranscris TOUT.
2. Chaque définition, formule, exemple, liste doit apparaître.
3. Les formules utilisent TOUJOURS les délimiteurs LaTeX : $formule$ ou $$formule$$
4. Ne traduis pas les termes techniques.

FORMAT :
- Utilise ## pour le titre de section
- Utilise ### pour les sous-sections
- Les formules importantes :
> **Formule : [Nom]**
> $$formule$$
> *où $variable$ = définition*

- Les définitions en gras : **Terme** : définition complète
- Les listes avec des puces

Retranscris cette section :`;

// Pass 3: Generate glossary from all content
const GLOSSARY_PROMPT = `À partir de cette note de cours, génère un glossaire complet.

FORMAT (tableau Markdown) :
## Glossaire

| Terme | Définition |
|-------|------------|
| terme1 | définition complète |
| terme2 | définition complète |

RÈGLES :
- Inclus TOUS les termes techniques, acronymes, et concepts clés
- Les définitions doivent être concises mais complètes
- Ordonne alphabétiquement
- Minimum 10 termes, maximum 30`;

interface Section {
  title: string;
  startMarker: string;
  endMarker: string;
  hasFormulas: boolean;
  keyTopics: string[];
}

interface DocumentStructure {
  title: string;
  sections: Section[];
}

/**
 * Extract document structure (Pass 1)
 */
async function extractStructure(
  sourceText: string,
  language: string
): Promise<DocumentStructure> {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

  // Use first 20k chars for structure detection
  const textForStructure = sourceText.substring(0, 20000);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Fast model for structure
    messages: [
      {
        role: 'system',
        content: `${STRUCTURE_EXTRACTION_PROMPT}\n\nAnalyse en ${languageName}.`,
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
  hasFormulas: boolean
): Promise<string> {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

  const formulaReminder = hasFormulas
    ? '\n\nATTENTION : Cette section contient des formules. Utilise OBLIGATOIREMENT $$ pour les formules centrées et $ pour les formules en ligne.'
    : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `${SECTION_TRANSCRIPTION_PROMPT}${formulaReminder}\n\nRetranscris en ${languageName}.`,
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
}

/**
 * Generate glossary from transcribed content (Pass 3)
 */
async function generateGlossary(
  transcribedContent: string,
  language: string
): Promise<string> {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

  // Use last 15k chars of content for glossary (to capture all terms)
  const contentForGlossary = transcribedContent.length > 15000
    ? transcribedContent.substring(transcribedContent.length - 15000)
    : transcribedContent;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `${GLOSSARY_PROMPT}\n\nGénère en ${languageName}.`,
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
}

/**
 * Process sections with controlled concurrency
 */
async function processSectionsWithConcurrency(
  sections: Section[],
  fullText: string,
  language: string
): Promise<string[]> {
  const results: string[] = new Array(sections.length);

  // Process in batches of MAX_CONCURRENT_CHUNKS
  for (let i = 0; i < sections.length; i += MAX_CONCURRENT_CHUNKS) {
    const batch = sections.slice(i, i + MAX_CONCURRENT_CHUNKS);
    const batchPromises = batch.map(async (section, batchIndex) => {
      const globalIndex = i + batchIndex;
      const sectionText = findSectionText(fullText, section, sections, globalIndex);

      console.log(`[A+ Note] Transcribing section ${globalIndex + 1}/${sections.length}: ${section.title}`);

      const transcribed = await transcribeSection(
        sectionText,
        section.title,
        language,
        section.hasFormulas
      );

      return { index: globalIndex, content: transcribed };
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(({ index, content }) => {
      results[index] = content;
    });
  }

  return results;
}

/**
 * Fallback: Single-pass generation for short documents
 */
async function singlePassGeneration(
  sourceText: string,
  language: string
): Promise<string> {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

  const SINGLE_PASS_PROMPT = `Tu es un transcripteur expert. Ta tâche est de RETRANSCRIRE intégralement le contenu d'un cours dans un format Markdown structuré et lisible.

RÈGLE ABSOLUE : Tu ne résumes PAS. Tu RETRANSCRIS. Chaque information du cours doit apparaître dans ta note.

=== CE QUE TU FAIS ===

1. Tu lis le cours du début à la fin
2. Tu retranscris TOUT le contenu pédagogique dans un format structuré
3. Tu organises par thèmes/sections logiques
4. Tu conserves chaque définition, chaque formule, chaque exemple, chaque liste

=== CE QUE TU NE FAIS PAS ===

- Tu ne résumes pas
- Tu n'omets rien
- Tu n'inventes rien
- Tu ne traduis pas les termes techniques

=== FORMULES (CRITIQUE) ===

TOUTES les formules doivent utiliser les délimiteurs LaTeX :
- Formule en ligne : $formule$
- Formule centrée : $$formule$$

JAMAIS de parenthèses simples pour les formules. Toujours $$ ou $.

Exemple CORRECT :
$$
EV_0 = \\sum_{i=1}^{n} \\frac{FCFF_i}{(1+k_{wacc})^i} + \\frac{TV_n}{(1+k_{wacc})^n}
$$

Les formules importantes peuvent être mises en valeur :

> **Formule : [Nom]**
> $$
> formule
> $$
> *où $variable$ = définition*

=== FORMAT ===

# [Titre]

## [Section 1]

[Contenu retranscrit de la section]

### [Sous-section si nécessaire]

[Contenu]

**Formule :** (si présente dans le cours)
$$
formule exacte du cours
$$
*où chaque variable = sa définition*

---

## Glossaire

| Terme | Définition |
|-------|------------|
| ... | ... |`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `${SINGLE_PASS_PROMPT}\n\nRetranscris en ${languageName}.`,
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
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;

  // Authenticate user
  const auth = await authenticateRequest(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = await createSupabaseServerClient();

  // Get course with source text
  const { data: course, error } = await supabase
    .from('courses')
    .select('id, title, source_text, content_language')
    .eq('id', courseId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

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

  const language = course.content_language?.toUpperCase() || 'EN';
  const sourceText = course.source_text;

  // Create streaming response for progress updates
  const { stream, sendProgress, close } = createProgressStream();

  // Start async generation process
  (async () => {
    try {
      console.log(`[A+ Note] Starting generation for course ${courseId}`);
      console.log(`[A+ Note] Source text length: ${sourceText.length} characters`);

      let noteContent: string;

      // Decision: Use multi-pass for documents > 15k chars
      if (sourceText.length > 15000) {
        const totalSteps = 3; // structure + sections + glossary
        console.log('[A+ Note] Using MULTI-PASS generation (document > 15k chars)');

        // Pass 1: Extract structure
        sendProgress({ type: 'progress', message: 'Analyzing document structure...', progress: 10 });
        console.log('[A+ Note] Pass 1: Extracting document structure...');
        const structure = await extractStructure(sourceText, language);
        console.log(`[A+ Note] Found ${structure.sections.length} sections`);

        // Pass 2: Transcribe each section
        const sectionCount = structure.sections.length;
        sendProgress({ type: 'progress', message: `Transcribing ${sectionCount} sections...`, progress: 20 });

        const transcribedSections: string[] = [];
        for (let i = 0; i < structure.sections.length; i += MAX_CONCURRENT_CHUNKS) {
          const batch = structure.sections.slice(i, i + MAX_CONCURRENT_CHUNKS);
          const progressPercent = 20 + Math.floor((i / structure.sections.length) * 60);
          sendProgress({
            type: 'progress',
            message: `Transcribing section ${Math.min(i + MAX_CONCURRENT_CHUNKS, sectionCount)}/${sectionCount}...`,
            progress: progressPercent,
          });

          const batchPromises = batch.map(async (section, batchIndex) => {
            const globalIndex = i + batchIndex;
            const sectionText = findSectionText(sourceText, section, structure.sections, globalIndex);
            console.log(`[A+ Note] Transcribing section ${globalIndex + 1}/${sectionCount}: ${section.title}`);
            return transcribeSection(sectionText, section.title, language, section.hasFormulas);
          });

          const batchResults = await Promise.all(batchPromises);
          transcribedSections.push(...batchResults);
        }

        // Assemble content
        const mainContent = `# ${structure.title || course.title}\n\n${transcribedSections.join('\n\n---\n\n')}`;

        // Pass 3: Generate glossary
        sendProgress({ type: 'progress', message: 'Generating glossary...', progress: 85 });
        console.log('[A+ Note] Pass 3: Generating glossary...');
        const glossary = await generateGlossary(mainContent, language);

        noteContent = `${mainContent}\n\n---\n\n${glossary}`;

      } else {
        console.log('[A+ Note] Using SINGLE-PASS generation (document <= 15k chars)');
        sendProgress({ type: 'progress', message: 'Generating note...', progress: 30 });
        noteContent = await singlePassGeneration(sourceText, language);
      }

      if (!noteContent) {
        sendProgress({ type: 'error', message: 'Failed to generate note content' });
        close();
        return;
      }

      console.log(`[A+ Note] Generation complete. Note length: ${noteContent.length} characters`);
      sendProgress({ type: 'progress', message: 'Saving note...', progress: 95 });

      // Save note to course
      const { error: updateError } = await supabase
        .from('courses')
        .update({ aplus_note: noteContent })
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
