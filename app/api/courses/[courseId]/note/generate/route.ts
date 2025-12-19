import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/api-auth';
import OpenAI from 'openai';
// Image extraction temporarily disabled due to pdfjs-dist/Turbopack incompatibility
// import { extractAndUploadImages, generateImageContext, AnalyzedImage } from '@/lib/pdf-image-extractor';
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

// Pass 1: Extract structure from the document
const STRUCTURE_EXTRACTION_PROMPT = `Tu es un expert en analyse de documents pédagogiques.

OBJECTIF : Identifier la structure EXHAUSTIVE du cours pour garantir qu'aucun concept ne sera omis lors de la transcription.

RETOURNE UN JSON VALIDE :
{
  "title": "Titre du cours",
  "metadata_to_ignore": ["éléments répétitifs à filtrer : headers, footers, numéros de page, plans répétés..."],
  "sections": [
    {
      "title": "Titre de la section",
      "startMarker": "10-20 premiers mots EXACTS",
      "endMarker": "10-20 derniers mots EXACTS",
      "contentTypes": {
        "definitions": ["liste des termes définis"],
        "formulas": ["liste des formules présentes"],
        "numerical_examples": ["liste des exemples chiffrés"],
        "graphs_or_visuals": ["description de chaque graphique/schéma"],
        "exercises": ["liste des exercices avec numéros"]
      },
      "keyTopics": ["topic1", "topic2"]
    }
  ]
}

RÈGLES :
- Identifie 5 à 15 sections (plus granulaire = moins d'omissions)
- CHAQUE graphique doit être listé dans graphs_or_visuals
- CHAQUE exemple numérique avec calculs doit être listé
- metadata_to_ignore : liste les éléments qui se répètent sur plusieurs pages (headers, "Plan de la session", etc.)`;

// Pass 2: Detailed transcription of each section
const SECTION_TRANSCRIPTION_PROMPT = `Tu es un transcripteur EXHAUSTIF. Ta mission : ZÉRO PERTE D'INFORMATION.

=== RÈGLES DE TRANSCRIPTION ===

**DÉFINITIONS** : Chaque terme technique = une définition complète
Format : **[Terme]** : [définition complète du cours]

**FORMULES** : Toujours en LaTeX avec explication des variables
Format :
> **Formule : [Nom]**
> $$formule$$
> où $variable_1$ = ..., $variable_2$ = ...

**EXEMPLES NUMÉRIQUES** : Reproduis CHAQUE ÉTAPE du calcul
Format :
> **Exemple : [contexte]**
> - Donnée 1 : valeur
> - Donnée 2 : valeur
> - Calcul : étape 1 → étape 2 → résultat final
> - Interprétation : [ce que ça signifie]

**GRAPHIQUES ET IMAGES** :
- Si des images sont fournies dans le contexte ci-dessous, INSÈRE-LES au bon endroit
- COPIE EXACTEMENT le code Markdown fourni (![titre](url)) - ne modifie JAMAIS l'URL
- Place l'image APRÈS avoir expliqué le concept qu'elle illustre
- Ajoute une légende en italique sous l'image

Format :
> **[Nom du graphique]**
> [Explication du concept]
> ![Titre exact fourni](URL exacte fournie)
> *Figure: Description courte*
> - Axe X : [variable]
> - Axe Y : [variable]
> - Interprétation : [ce qu'on peut en déduire]

⚠️ NE PAS inventer d'URLs - utilise UNIQUEMENT les URLs fournies dans le contexte des images.

**LISTES NUMÉROTÉES** : Si le cours liste N conditions/étapes, tu dois avoir exactement N points.

=== STRUCTURE ===
- Utilise ## pour le titre de section
- Utilise ### pour les sous-sections

=== VALIDATION FINALE ===
Avant de terminer, vérifie :
☑ Toutes les définitions attendues sont présentes ?
☑ Toutes les formules attendues sont présentes ?
☑ Tous les exemples numériques avec leurs calculs complets ?
☑ Tous les graphiques décrits ?

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

// Pass 4: Verification of completeness
const VERIFICATION_PROMPT = `Compare la transcription générée avec le contenu attendu.

CONTENU ATTENDU (de l'analyse structurelle) :
{expected_content}

TRANSCRIPTION GÉNÉRÉE :
{generated_transcription}

Pour chaque élément attendu, indique :
- ✅ PRÉSENT : l'élément est correctement transcrit
- ⚠️ PARTIEL : l'élément est présent mais incomplet (précise ce qui manque)
- ❌ ABSENT : l'élément n'a pas été transcrit

Si des éléments sont PARTIEL ou ABSENT, génère le contenu manquant au format Markdown.

RETOURNE UN JSON VALIDE :
{
  "verification": [
    {"item": "nom de l'élément", "status": "PRÉSENT|PARTIEL|ABSENT", "details": "..."}
  ],
  "missing_content": "contenu Markdown à ajouter (vide si tout est présent)",
  "completeness_score": 85
}`;

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
  language: string
): Promise<DocumentStructure> {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

  // Use first 20k chars for structure detection
  const textForStructure = sourceText.substring(0, 20000);

  return withRetry(async () => {
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
  imageContext: string = ''
): Promise<string> {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

  // Build expected content context
  const expectedContent = `
CONTENU ATTENDU pour cette section :
- Définitions attendues : ${contentTypes.definitions.length > 0 ? contentTypes.definitions.join(', ') : 'aucune identifiée'}
- Formules attendues : ${contentTypes.formulas.length > 0 ? contentTypes.formulas.join(', ') : 'aucune identifiée'}
- Exemples numériques attendus : ${contentTypes.numerical_examples.length > 0 ? contentTypes.numerical_examples.join(', ') : 'aucun identifié'}
- Graphiques/visuels à décrire : ${contentTypes.graphs_or_visuals.length > 0 ? contentTypes.graphs_or_visuals.join(', ') : 'aucun identifié'}
- Exercices : ${contentTypes.exercises.length > 0 ? contentTypes.exercises.join(', ') : 'aucun identifié'}

ÉLÉMENTS À IGNORER (métadonnées répétitives) :
${metadataToIgnore.length > 0 ? metadataToIgnore.join(', ') : 'aucun'}`;

  const formulaReminder = contentTypes.formulas.length > 0
    ? '\n\nATTENTION : Cette section contient des formules. Utilise OBLIGATOIREMENT $$ pour les formules centrées et $ pour les formules en ligne.'
    : '';

  // Use retry wrapper for rate limit handling
  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `${SECTION_TRANSCRIPTION_PROMPT}${expectedContent}${formulaReminder}${imageContext}\n\nRetranscris en ${languageName}.`,
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
  language: string
): Promise<string> {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

  // Use last 15k chars of content for glossary (to capture all terms)
  const contentForGlossary = transcribedContent.length > 15000
    ? transcribedContent.substring(transcribedContent.length - 15000)
    : transcribedContent;

  return withRetry(async () => {
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
  });
}

/**
 * Verify completeness of transcription (Pass 4)
 */
async function verifyCompleteness(
  structure: DocumentStructure,
  transcribedContent: string,
  language: string
): Promise<VerificationResult> {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

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

  // Limit transcription size for verification
  const transcriptionForVerification = transcribedContent.length > 20000
    ? transcribedContent.substring(0, 20000) + '\n...[tronqué pour vérification]'
    : transcribedContent;

  const prompt = VERIFICATION_PROMPT
    .replace('{expected_content}', expectedContent)
    .replace('{generated_transcription}', transcriptionForVerification);

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${prompt}\n\nRéponds en ${languageName}.`,
        },
        {
          role: 'user',
          content: 'Vérifie la complétude de la transcription.',
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
 * Fallback: Single-pass generation for short documents
 */
async function singlePassGeneration(
  sourceText: string,
  language: string,
  imageContext: string = ''
): Promise<string> {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

  const SINGLE_PASS_PROMPT = `Tu es un transcripteur EXHAUSTIF. Ta mission : ZÉRO PERTE D'INFORMATION.

Le document que tu vas traiter est un cours pédagogique. Tu dois produire une note de révision qui permet à un étudiant de réviser SANS avoir besoin de retourner au document original.

=== ÉTAPE 1 : ANALYSE PRÉALABLE (fais-le mentalement avant d'écrire) ===

Avant de commencer la transcription, identifie :
1. Les éléments répétitifs à ignorer (headers, footers, "Plan de la session" répété, numéros de slides...)
2. Le nombre exact de définitions/concepts clés
3. Le nombre exact de formules
4. Le nombre exact d'exemples numériques avec calculs
5. Le nombre exact de graphiques/schémas
6. Le nombre exact d'exercices et leurs corrections

=== ÉTAPE 2 : TRANSCRIPTION PAR TYPE DE CONTENU ===

**DÉFINITIONS** — Chaque terme technique doit avoir sa définition complète
Format :
**[Terme]** : [définition exacte du cours, pas de reformulation qui perd du sens]

**CONDITIONS/HYPOTHÈSES NUMÉROTÉES** — Si le cours liste N conditions, tu DOIS avoir N points
Exemple : "Les 5 conditions de la concurrence parfaite" → tu dois lister les 5, pas 3 ou 4
Format :
1. **[Condition 1]** : [explication]
2. **[Condition 2]** : [explication]
...

**FORMULES** — Toujours en LaTeX avec définition de CHAQUE variable
Format :
> **Formule : [Nom de la formule]**
> $$formule$$
> où :
> - $variable_1$ = [définition]
> - $variable_2$ = [définition]

**EXEMPLES NUMÉRIQUES** — Reproduis TOUTES les étapes du calcul, pas juste le résultat
Format :
> **Exemple : [Contexte]**
> Données :
> - [Donnée 1] = [valeur]
> - [Donnée 2] = [valeur]
>
> Calcul :
> - Étape 1 : [calcul] = [résultat intermédiaire]
> - Étape 2 : [calcul] = [résultat intermédiaire]
> - **Résultat final : [valeur]**
>
> Interprétation : [ce que ça signifie économiquement/concrètement]

**GRAPHIQUES ET SCHÉMAS** — RÈGLES STRICTES pour l'insertion d'images :
1. Si des images sont listées dans le contexte ci-dessous, tu DOIS les insérer
2. COPIE EXACTEMENT le code Markdown fourni (![titre](url)) - ne modifie JAMAIS l'URL
3. Place chaque image APRÈS avoir expliqué le concept qu'elle illustre
4. NE PAS regrouper les images à la fin - les disperser dans le texte pertinent
5. Ajoute une légende en italique sous chaque image

Format :
> **[Nom du graphique]**
> [Explication du concept que ce graphique illustre]
>
> ![Titre exact fourni dans le contexte](URL exacte fournie dans le contexte)
> *Figure: Description courte de ce que montre le graphique*
>
> - Axe horizontal : [variable, unité]
> - Axe vertical : [variable, unité]
> - Interprétation : [ce qu'il démontre]

⚠️ IMPORTANT: N'invente JAMAIS d'URLs. Utilise UNIQUEMENT les URLs fournies dans "IMAGES ÉDUCATIVES DISPONIBLES" ci-dessous.

**TABLEAUX** — Reproduis-les intégralement en Markdown
| Colonne 1 | Colonne 2 | ... |
|-----------|-----------|-----|
| valeur    | valeur    | ... |

**EXERCICES ET CORRECTIONS** — Inclus l'énoncé ET la correction complète si présente
Format :
> **Exercice N : [Titre/Thème]**
> *Énoncé :* [énoncé complet]
>
> *Correction :*
> [étapes détaillées de résolution]
> **Réponse : [réponse finale]**

=== ÉTAPE 3 : STRUCTURE DU DOCUMENT FINAL ===

# [Titre du cours]

## [Section 1]
[contenu transcrit selon les formats ci-dessus]

### [Sous-section 1.1 si pertinent]
[contenu]

## [Section 2]
[contenu]

...

## Exercices

[Tous les exercices avec corrections]

---

## Glossaire

| Terme | Définition |
|-------|------------|
| [terme 1] | [définition concise mais complète] |
| [terme 2] | [définition] |
...

=== CE QUE TU NE FAIS JAMAIS ===

- Résumer ou condenser (ex: "plusieurs facteurs influencent..." au lieu de lister TOUS les facteurs)
- Omettre des étapes de calcul (ex: donner juste "surplus = 13,5€" sans montrer les étapes)
- Ignorer les graphiques (ils sont souvent essentiels à la compréhension)
- Traduire ou reformuler les termes techniques
- Répéter les éléments de navigation (plans répétés, headers...)
- Inventer du contenu non présent dans le cours
- Fusionner des concepts distincts

=== VALIDATION FINALE (vérifie avant de soumettre) ===

- Chaque définition du cours est présente ?
- Chaque formule est en LaTeX avec ses variables définies ?
- Chaque exemple numérique a TOUTES ses étapes de calcul ?
- Chaque graphique est décrit (axes, courbes, interprétation) ?
- Les listes numérotées ont le bon nombre d'éléments ?
- Les exercices ont leurs corrections si elles existent ?
- Le glossaire couvre tous les termes techniques ?`;

  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `${SINGLE_PASS_PROMPT}${imageContext}\n\nRetranscris en ${languageName}.`,
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

  // Get course with source text and storage path
  const { data: course, error } = await supabase
    .from('courses')
    .select('id, title, source_text, content_language, storage_path, storage_bucket')
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

      // STEP 0: Image extraction temporarily disabled due to pdfjs-dist/Turbopack incompatibility
      // TODO: Re-enable when a compatible solution is found
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
        const structure = await extractStructure(sourceText, language);
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
              imageContext // Pass image context to each section
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
        const verification = await verifyCompleteness(structure, mainContent, language);
        console.log(`[A+ Note] Completeness score: ${verification.completeness_score}%`);

        // Append missing content if any
        if (verification.missing_content && verification.missing_content.trim().length > 0) {
          console.log('[A+ Note] Adding missing content...');
          mainContent += `\n\n---\n\n## Contenu complémentaire\n\n${verification.missing_content}`;
        }

        // Pass 4: Generate glossary
        sendProgress({ type: 'progress', message: 'Generating glossary...', progress: 85 });
        console.log('[A+ Note] Pass 4: Generating glossary...');
        const glossary = await generateGlossary(mainContent, language);

        noteContent = `${mainContent}\n\n---\n\n${glossary}`;

      } else {
        console.log('[A+ Note] Using SINGLE-PASS generation (document <= 15k chars)');
        sendProgress({ type: 'progress', message: 'Generating note...', progress: 30 });
        noteContent = await singlePassGeneration(sourceText, language, imageContext);
      }

      if (!noteContent) {
        sendProgress({ type: 'error', message: 'Failed to generate note content' });
        close();
        return;
      }

      console.log(`[A+ Note] Generation complete. Note length: ${noteContent.length} characters`);

      // Images are now INLINE in the note content, no need to append

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
