/**
 * Prompts pour les différents types de questions de quiz
 * - QCM (existant, modifié pour utiliser getNiveauBlock)
 * - Vrai/Faux (nouveau)
 * - Texte à trous (nouveau)
 */

import {
  NiveauQuantite,
  getAdjustedQuestionCount,
} from '@/types/quiz-personnalisation';

// ============================================================================
// BLOC DE NIVEAU (injecté dans tous les prompts)
// ============================================================================

/**
 * Génère le bloc de niveau à injecter dans les prompts selon la configuration
 */
export function getNiveauBlock(niveau: NiveauQuantite, baseCount: number): string {
  const adjustedCount = getAdjustedQuestionCount(baseCount, niveau);

  const blocks: Record<NiveauQuantite, string> = {
    synthetique: `
QUESTION COUNT: EXACTLY ${adjustedCount} questions (MODE SYNTHÉTIQUE - 5 questions par chapitre)

SYNTHÉTIQUE RULES:
- Generate EXACTLY 5 questions for this chapter
- Focus on the MOST ESSENTIAL concepts only
- Each question must test a CORE learning objective
- Skip secondary details and nuances
- Prioritize: definitions, main formulas, key relationships
- Every question must be "exam-critical"
`,
    standard: `
QUESTION COUNT: EXACTLY ${adjustedCount} questions (MODE STANDARD - 8 questions par chapitre)

STANDARD RULES:
- Generate EXACTLY 8 questions for this chapter
- Balanced coverage of all learning objectives
- Include main concepts and important details
- Test both fundamental and intermediate understanding
`,
    exhaustif: `
QUESTION COUNT: ${adjustedCount}+ questions (MODE EXHAUSTIF - Maximum de questions)

EXHAUSTIF RULES:
- Generate MORE than 10 questions - as many as needed to fully cover all concepts
- COMPREHENSIVE coverage of ALL concepts in the chapter
- Include nuances, exceptions, and edge cases
- Test deep understanding and subtle distinctions
- Cover secondary concepts and detailed applications
- Multiple questions per major concept to test different angles
`,
  };

  return blocks[niveau];
}

// ============================================================================
// INTERFACES POUR LES DONNÉES DE CHAPITRE
// ============================================================================

export interface ChapterDataForPrompt {
  title: string;
  difficulty?: number;
  short_summary?: string;
  learning_objectives?: string[];
  key_concepts?: string[];
}

export interface FactForPrompt {
  category: string;
  statement: string;
  source_quote: string;
}

// ============================================================================
// PROMPT VRAI/FAUX
// ============================================================================

export function getTrueFalsePrompt(
  chapterData: ChapterDataForPrompt,
  niveau: NiveauQuantite,
  baseCount: number,
  factsForPrompt: string,
  learningObjectives: string,
  keyConcepts: string,
  truncatedText: string
): string {
  const niveauBlock = getNiveauBlock(niveau, baseCount);

  return `Generate TRUE/FALSE quiz for this chapter.

⚠️ ABSOLUTE PRIORITY - CONTENT FILTER (READ THIS FIRST!) ⚠️
NEVER create statements about COURSE LOGISTICS or ADMINISTRATIVE INFORMATION:
❌ FORBIDDEN TOPICS (skip entirely - do not generate statements about these):
- Exam format, duration, number of parts, grading policies
- Course structure: séances, parties, activités pédagogiques
- Supports de cours, diapositives, matériel fourni
- Professor names, office hours, contact info
- Assignment deadlines, submission procedures
- University procedures, prerequisites, syllabus structure

❌ EXAMPLES OF BAD STATEMENTS (NEVER create these):
- "L'examen final dure 2 heures." → FORBIDDEN (exam logistics)
- "Le cours est divisé en deux parties." → FORBIDDEN (course structure)
- "Les diapositives sont disponibles sur Moodle." → FORBIDDEN (course materials)
- "Les séances commencent par un cours théorique." → FORBIDDEN (pedagogical activities)

✅ ONLY test ACADEMIC CONTENT - the actual subject matter being taught:
- Concepts, theories, definitions from the discipline
- Formulas, methods, procedures of the field
- Relationships between academic concepts

Each question MUST include:
- "type": "true_false"
- "statement": A clear affirmation about the course content
- "correct_answer": true or false (boolean)
- "explanation": REQUIRED - Pedagogical explanation in 2-3 sentences that:
  1. States whether the statement is TRUE or FALSE and why (cite/paraphrase the course)
  2. If false, explains what the correct information is
  Example: "Cette affirmation est fausse. Le cours indique que le coût des capitaux propres est généralement SUPÉRIEUR au coût de la dette car les actionnaires supportent plus de risque. La dette est moins risquée car les créanciers sont payés en priorité."
- "source_reference": REQUIRED - The EXACT quote from the source text (15-50 words) that proves the answer. Copy verbatim from the provided text.
- "cognitive_level": One of "remember" (recall facts), "understand" (explain concepts)
- "concept_tested": Which key concept or learning objective this question tests

CRITICAL RULES FOR TRUE/FALSE QUALITY:
1. UNAMBIGUOUS: The statement must be CLEARLY true OR false based on the source text. No gray areas, no "it depends".
2. NO DOUBLE NEGATIVES: Avoid confusing phrasing like "It is not incorrect that..." or "Il n'est pas faux de dire que..."
3. BALANCE: Generate roughly 50% true and 50% false statements.
4. TEST REAL UNDERSTANDING:
   - Don't just negate a true statement mechanically
   - Create statements that test common misconceptions
   - Test nuances and distinctions between similar concepts
5. MANDATORY SOURCE REFERENCE: Every statement MUST have a source_reference field with the exact text passage that proves the answer. If you cannot find explicit support in the text, DO NOT create that question.
6. NO TRIVIAL STATEMENTS: Don't create statements about obvious facts or specific numbers from examples.

GOOD TRUE/FALSE EXAMPLES:
- "Le WACC représente le coût moyen pondéré du capital." -> TRUE
- "Le coût des capitaux propres est généralement inférieur au coût de la dette." -> FALSE
- "Dans le CAPM, le beta mesure le risque spécifique de l'entreprise." -> FALSE (c'est le risque systématique)
- "Les intérêts de la dette sont déductibles fiscalement, ce qui crée un tax shield." -> TRUE

BAD TRUE/FALSE (avoid):
- Statements that are "mostly true" or "partially correct"
- "Le WACC dans l'exemple est de 8.5%." (mémorisation de chiffres)
- "Le WACC est un concept." (trivial)
- Statements requiring calculation to verify

${niveauBlock}

COVERAGE REQUIREMENTS:
1. Every learning objective MUST be tested by at least one statement
2. Every key concept MUST be covered by at least one statement
3. Statements should be distributed across all sections of the chapter
4. If content overlaps, one statement can test multiple objectives/concepts (indicate in concept_tested field)

Prioritize quality and coverage.

Balance cognitive levels: 60% remember, 40% understand.

Example output:
{
  "questions": [
    {
      "type": "true_false",
      "statement": "Le WACC est utilisé comme taux d'actualisation dans les modèles DCF.",
      "correct_answer": true,
      "explanation": "Cette affirmation est vraie. Le cours indique que le WACC représente le coût du capital de l'entreprise et sert de taux d'actualisation pour ramener les flux de trésorerie futurs à leur valeur présente dans les modèles Discounted Cash Flow.",
      "source_reference": "Le WACC est utilisé comme taux d'actualisation pour ramener les flux futurs à leur valeur présente.",
      "cognitive_level": "understand",
      "concept_tested": "Utilisation du WACC dans la valorisation"
    }
  ]
}

CHAPTER: ${chapterData.title}
DIFFICULTY: ${chapterData.difficulty || 2}
SUMMARY: ${chapterData.short_summary || ''}
${learningObjectives}
${keyConcepts}
${factsForPrompt}

SOURCE TEXT:
${truncatedText}`;
}

// ============================================================================
// PROMPT TEXTE À TROUS
// ============================================================================

export function getFillBlankPrompt(
  chapterData: ChapterDataForPrompt,
  niveau: NiveauQuantite,
  baseCount: number,
  factsForPrompt: string,
  learningObjectives: string,
  keyConcepts: string,
  truncatedText: string
): string {
  const niveauBlock = getNiveauBlock(niveau, baseCount);

  return `Generate FILL-IN-THE-BLANK quiz for this chapter.

⚠️ ABSOLUTE PRIORITY - CONTENT FILTER (READ THIS FIRST!) ⚠️
NEVER create blanks about COURSE LOGISTICS or ADMINISTRATIVE INFORMATION:
❌ FORBIDDEN TOPICS (skip entirely - do not generate blanks about these):
- Exam format, duration, number of parts, grading policies
- Course structure: séances, parties, activités pédagogiques
- Supports de cours, diapositives, matériel fourni
- Professor names, office hours, contact info
- Assignment deadlines, submission procedures
- University procedures, prerequisites, syllabus structure

❌ EXAMPLES OF BAD BLANKS (NEVER create these):
- "L'examen final dure _____ heures." → FORBIDDEN (exam logistics)
- "La première partie de chaque séance est le _____." → FORBIDDEN (course structure)
- "Les _____ sont disponibles sur la plateforme." → FORBIDDEN (course materials)

✅ ONLY test ACADEMIC CONTENT - the actual subject matter being taught:
- Technical terms from the discipline
- Key concept names and formulas
- Important theories and their authors (in academic context)

Each question MUST include:
- "type": "fill_blank"
- "sentence": A sentence with exactly ONE blank marked as "_____" (5 underscores)
- "correct_answer": The exact word or short phrase that fills the blank
- "accepted_answers": Array of acceptable variations (lowercase, uppercase, synonyms, acronym expansions)
- "explanation": REQUIRED - Pedagogical explanation in 2-3 sentences that:
  1. States the correct answer and why it's the right term
  2. Provides context about this concept from the course
  Example: "Le terme correct est WACC (Weighted Average Cost of Capital). Le cours définit le WACC comme le coût moyen pondéré du capital, calculé en pondérant le coût des fonds propres et le coût de la dette selon leur proportion dans la structure financière."
- "source_reference": REQUIRED - The EXACT quote from the source text (15-50 words) that contains this term. Copy verbatim from the provided text.
- "cognitive_level": One of "remember" (recall terms), "understand" (explain concepts)
- "concept_tested": Which key concept or learning objective this question tests

CRITICAL RULES FOR FILL-IN-THE-BLANK QUALITY:
1. KEY TERMS ONLY: The blank must be a TECHNICAL TERM, KEY CONCEPT, or IMPORTANT NAME - never a common word like "est", "un", "pour".
2. ONE LOGICAL ANSWER: The sentence context must make only ONE answer correct. If multiple terms could fit, rephrase the sentence to be more specific.
3. SUFFICIENT CONTEXT: The sentence must provide enough clues to recall the term. Don't make it a guessing game.
4. ACCEPT VARIATIONS: Always include in accepted_answers:
   - Case variations (WACC, wacc, Wacc)
   - Full name and acronym (WACC, Weighted Average Cost of Capital)
   - Common synonyms if applicable
   - French and English versions if both are used in the course
5. MANDATORY SOURCE REFERENCE: Every question MUST have a source_reference field with the exact text passage containing this term. If you cannot find explicit support in the text, DO NOT create that question.
6. NO NUMBER BLANKS: Never ask students to fill in specific numerical results from examples.

GOOD FILL-IN-THE-BLANK EXAMPLES:
- "Le _____ représente le coût moyen pondéré du capital." -> WACC
- "Le modèle _____ permet de calculer le coût des capitaux propres en fonction du risque systématique." -> CAPM
- "Les intérêts de la dette sont multipliés par (1-T) pour tenir compte du _____." -> tax shield
- "Le _____ mesure la sensibilité d'un actif aux mouvements du marché." -> beta

BAD FILL-IN-THE-BLANK (avoid):
- "Le WACC est un _____ important." (trop vague - concept? indicateur? outil?)
- "Le WACC _____ utilisé pour l'actualisation." (mot commun "est")
- "Le WACC dans cet exemple est de _____." (mémorisation de chiffres)
- "Le _____ et le _____ sont deux composantes du WACC." (deux blancs)

${niveauBlock}

COVERAGE REQUIREMENTS:
1. Every KEY TERM from the learning objectives MUST be tested
2. Every important FORMULA NAME or CONCEPT NAME must be covered
3. Prioritize terms that students MUST know for exams
4. Focus on vocabulary that distinguishes an expert from a beginner

Prioritize quality and coverage.

Balance cognitive levels: 70% remember, 30% understand.

Example output:
{
  "questions": [
    {
      "type": "fill_blank",
      "sentence": "Le modèle _____ définit le coût des capitaux propres comme rf + β × (Rm - rf).",
      "correct_answer": "CAPM",
      "accepted_answers": ["CAPM", "capm", "MEDAF", "medaf", "Capital Asset Pricing Model"],
      "explanation": "Le terme correct est CAPM (Capital Asset Pricing Model). Ce modèle est le standard pour estimer ke en fonction du risque systématique.",
      "source_reference": "Le CAPM (Capital Asset Pricing Model) définit ke = rf + β × (Rm - rf).",
      "cognitive_level": "remember",
      "concept_tested": "Formule du CAPM"
    }
  ]
}

CHAPTER: ${chapterData.title}
DIFFICULTY: ${chapterData.difficulty || 2}
SUMMARY: ${chapterData.short_summary || ''}
${learningObjectives}
${keyConcepts}
${factsForPrompt}

SOURCE TEXT:
${truncatedText}`;
}

// ============================================================================
// HELPER: SHUFFLE ARRAY
// ============================================================================

/**
 * Mélange un tableau de manière aléatoire (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
