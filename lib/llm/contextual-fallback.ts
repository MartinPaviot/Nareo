/**
 * Contextual Fallback System
 *
 * Generates relevant fallback content based on the actual course context
 * instead of generic Machine Learning content.
 */

export interface FallbackConcept {
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  content: string;
  definitions: string[];
  keyIdeas: string[];
  sourceText?: string;
}

export interface FallbackChapter {
  index: number;
  title: string;
  short_summary: string;
  difficulty: number;
}

export interface FallbackQuestion {
  type: 'multiple_choice';
  prompt: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  concept_ids?: string[];
  points: number;
}

/**
 * Extract keywords from text using simple heuristics
 */
export function extractKeywords(text: string, maxKeywords: number = 10): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'this', 'that', 'these', 'those', 'it', 'its', 'as', 'if', 'when', 'than', 'so',
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'mais', 'dans',
    'sur', 'pour', 'par', 'avec', 'est', 'sont', 'être', 'avoir', 'qui', 'que',
    'ce', 'cette', 'ces', 'il', 'elle', 'ils', 'elles', 'nous', 'vous', 'leur',
    'der', 'die', 'das', 'und', 'oder', 'aber', 'in', 'auf', 'für', 'mit', 'ist',
    'sind', 'sein', 'haben', 'werden', 'kann', 'muss', 'soll',
  ]);

  // Extract words
  const words = text
    .toLowerCase()
    .replace(/[^\w\sàâäéèêëïîôöùûüç-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  // Count word frequency
  const wordCount = new Map<string, number>();
  for (const word of words) {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  }

  // Sort by frequency and take top keywords
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

/**
 * Extract potential section titles from text
 */
export function extractSectionTitles(text: string): string[] {
  const titles: string[] = [];

  // Pattern for numbered sections: 1. Title, 1.1 Title, Chapter 1: Title, etc.
  const sectionPatterns = [
    /^(\d+\.?\d*\.?)\s+([A-Z][^\n]{5,50})$/gm,
    /^(Chapter|Section|Part|Chapitre|Section|Partie|Kapitel|Abschnitt)\s*\d*[:\s]+([^\n]{5,50})$/gim,
    /^([A-Z][A-Z\s]{3,30})$/gm, // ALL CAPS titles
    /^#+\s*(.+)$/gm, // Markdown headers
  ];

  for (const pattern of sectionPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const title = (match[2] || match[1]).trim();
      if (title.length > 3 && title.length < 60) {
        titles.push(title);
      }
    }
  }

  return [...new Set(titles)].slice(0, 10);
}

/**
 * Detect the subject/domain of the text
 */
export function detectSubject(text: string): string {
  const lowerText = text.toLowerCase();

  const subjects: Record<string, string[]> = {
    'Informatique': ['algorithme', 'programmation', 'code', 'logiciel', 'données', 'base de données', 'software', 'programming', 'computer', 'algorithm'],
    'Mathématiques': ['équation', 'fonction', 'théorème', 'calcul', 'algèbre', 'géométrie', 'equation', 'theorem', 'algebra', 'geometry'],
    'Physique': ['force', 'énergie', 'mouvement', 'électricité', 'magnétisme', 'physics', 'energy', 'motion', 'electricity'],
    'Chimie': ['molécule', 'atome', 'réaction', 'élément', 'chimique', 'molecule', 'atom', 'reaction', 'chemical'],
    'Biologie': ['cellule', 'organisme', 'évolution', 'génétique', 'adn', 'cell', 'organism', 'evolution', 'genetic', 'dna'],
    'Économie': ['marché', 'offre', 'demande', 'prix', 'économique', 'market', 'supply', 'demand', 'price', 'economic'],
    'Marketing': ['client', 'vente', 'marque', 'publicité', 'stratégie', 'customer', 'sales', 'brand', 'advertising', 'marketing'],
    'Droit': ['loi', 'juridique', 'contrat', 'droit', 'tribunal', 'law', 'legal', 'contract', 'court', 'justice'],
    'Management': ['entreprise', 'gestion', 'leadership', 'organisation', 'management', 'company', 'organization', 'team'],
    'Histoire': ['siècle', 'guerre', 'révolution', 'période', 'historique', 'century', 'war', 'revolution', 'historical'],
    'Philosophie': ['pensée', 'philosophe', 'éthique', 'morale', 'philosophie', 'thought', 'ethics', 'moral', 'philosophy'],
  };

  let bestMatch = 'Cours général';
  let bestScore = 0;

  for (const [subject, keywords] of Object.entries(subjects)) {
    const score = keywords.reduce((acc, kw) => acc + (lowerText.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = subject;
    }
  }

  return bestScore >= 2 ? bestMatch : 'Cours général';
}

/**
 * Generate contextual fallback concepts based on the actual course text
 */
export function generateContextualConcepts(
  text: string,
  title: string,
  language: 'EN' | 'FR' | 'DE' = 'EN'
): { title: string; summary: string; concepts: FallbackConcept[] } {
  const keywords = extractKeywords(text, 15);
  const sectionTitles = extractSectionTitles(text);
  const subject = detectSubject(text);

  // Use section titles if available, otherwise use keywords
  const conceptSources = sectionTitles.length >= 3
    ? sectionTitles.slice(0, 7)
    : keywords.slice(0, 7);

  const summaryTemplates = {
    EN: `This chapter covers key concepts related to ${subject}, including ${conceptSources.slice(0, 3).join(', ')}.`,
    FR: `Ce chapitre couvre les concepts clés liés à ${subject}, notamment ${conceptSources.slice(0, 3).join(', ')}.`,
    DE: `Dieses Kapitel behandelt Schlüsselkonzepte zu ${subject}, einschließlich ${conceptSources.slice(0, 3).join(', ')}.`,
  };

  const contentTemplates = {
    EN: (concept: string) => `This section explains the key aspects of ${concept} and its importance in the context of ${subject}.`,
    FR: (concept: string) => `Cette section explique les aspects clés de ${concept} et son importance dans le contexte de ${subject}.`,
    DE: (concept: string) => `Dieser Abschnitt erklärt die Schlüsselaspekte von ${concept} und seine Bedeutung im Kontext von ${subject}.`,
  };

  const concepts: FallbackConcept[] = conceptSources.map((conceptTitle, idx) => ({
    title: conceptTitle,
    difficulty: idx < 2 ? 'easy' : idx < 4 ? 'medium' : 'hard',
    content: contentTemplates[language](conceptTitle),
    definitions: keywords.slice(idx * 2, idx * 2 + 3),
    keyIdeas: keywords.slice(idx, idx + 3),
    sourceText: text.substring(idx * 500, (idx + 1) * 500),
  }));

  return {
    title: title || `${subject} - Course`,
    summary: summaryTemplates[language],
    concepts,
  };
}

/**
 * Generate contextual fallback chapters based on the actual course text
 */
export function generateContextualChapters(
  text: string,
  courseTitle: string,
  language: 'EN' | 'FR' | 'DE' = 'EN'
): FallbackChapter[] {
  const sectionTitles = extractSectionTitles(text);
  const keywords = extractKeywords(text, 20);
  const subject = detectSubject(text);

  // If we found section titles, use them
  if (sectionTitles.length >= 2) {
    return sectionTitles.map((title, idx) => ({
      index: idx + 1,
      title,
      short_summary: generateShortSummary(title, subject, language),
      difficulty: idx < 2 ? 1 : idx < 4 ? 2 : 3,
    }));
  }

  // Otherwise, create chapters from keywords
  const chapterKeywords = keywords.slice(0, 5);
  return chapterKeywords.map((keyword, idx) => ({
    index: idx + 1,
    title: keyword,
    short_summary: generateShortSummary(keyword, subject, language),
    difficulty: idx < 2 ? 1 : idx < 3 ? 2 : 3,
  }));
}

/**
 * Generate a short summary for a chapter/concept
 */
function generateShortSummary(title: string, subject: string, language: 'EN' | 'FR' | 'DE'): string {
  const templates = {
    EN: [
      `Introduction to ${title} and its key principles in ${subject}.`,
      `Understanding ${title}: concepts, applications, and best practices.`,
      `Deep dive into ${title} with practical examples.`,
    ],
    FR: [
      `Introduction à ${title} et ses principes clés en ${subject}.`,
      `Comprendre ${title} : concepts, applications et bonnes pratiques.`,
      `Approfondissement de ${title} avec des exemples pratiques.`,
    ],
    DE: [
      `Einführung in ${title} und seine Schlüsselprinzipien in ${subject}.`,
      `${title} verstehen: Konzepte, Anwendungen und Best Practices.`,
      `Vertiefung von ${title} mit praktischen Beispielen.`,
    ],
  };

  const options = templates[language];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate contextual fallback questions based on the actual course content
 */
export function generateContextualQuestions(
  chapterTitle: string,
  chapterText: string,
  language: 'EN' | 'FR' | 'DE' = 'EN',
  count: number = 5
): FallbackQuestion[] {
  const keywords = extractKeywords(chapterText, 10);
  const subject = detectSubject(chapterText);

  const questionTemplates = {
    EN: [
      { prompt: `What is the main purpose of ${keywords[0] || chapterTitle}?`, type: 'definition' },
      { prompt: `Which of the following best describes ${keywords[1] || chapterTitle}?`, type: 'description' },
      { prompt: `What is an important characteristic of ${keywords[2] || chapterTitle}?`, type: 'characteristic' },
      { prompt: `How does ${keywords[0] || chapterTitle} relate to ${keywords[1] || subject}?`, type: 'relationship' },
      { prompt: `What would be the result of applying ${keywords[0] || chapterTitle}?`, type: 'application' },
    ],
    FR: [
      { prompt: `Quel est l'objectif principal de ${keywords[0] || chapterTitle} ?`, type: 'definition' },
      { prompt: `Laquelle des propositions suivantes décrit le mieux ${keywords[1] || chapterTitle} ?`, type: 'description' },
      { prompt: `Quelle est une caractéristique importante de ${keywords[2] || chapterTitle} ?`, type: 'characteristic' },
      { prompt: `Comment ${keywords[0] || chapterTitle} est-il lié à ${keywords[1] || subject} ?`, type: 'relationship' },
      { prompt: `Quel serait le résultat de l'application de ${keywords[0] || chapterTitle} ?`, type: 'application' },
    ],
    DE: [
      { prompt: `Was ist der Hauptzweck von ${keywords[0] || chapterTitle}?`, type: 'definition' },
      { prompt: `Welche der folgenden Aussagen beschreibt ${keywords[1] || chapterTitle} am besten?`, type: 'description' },
      { prompt: `Was ist eine wichtige Eigenschaft von ${keywords[2] || chapterTitle}?`, type: 'characteristic' },
      { prompt: `Wie hängt ${keywords[0] || chapterTitle} mit ${keywords[1] || subject} zusammen?`, type: 'relationship' },
      { prompt: `Was wäre das Ergebnis der Anwendung von ${keywords[0] || chapterTitle}?`, type: 'application' },
    ],
  };

  const optionTemplates = {
    EN: {
      correct: [
        `It helps understand ${keywords[0] || 'the concept'}`,
        `To apply ${keywords[1] || 'key principles'} effectively`,
        `It demonstrates ${keywords[2] || 'important aspects'}`,
        `${keywords[0] || 'The concept'} enables better ${keywords[1] || 'results'}`,
      ],
      wrong: [
        'It has no significant impact',
        'It only applies in theoretical contexts',
        'It contradicts basic principles',
        'It is unrelated to the main topic',
      ],
    },
    FR: {
      correct: [
        `Cela aide à comprendre ${keywords[0] || 'le concept'}`,
        `Pour appliquer ${keywords[1] || 'les principes clés'} efficacement`,
        `Cela démontre ${keywords[2] || 'des aspects importants'}`,
        `${keywords[0] || 'Le concept'} permet de meilleurs ${keywords[1] || 'résultats'}`,
      ],
      wrong: [
        `Cela n'a pas d'impact significatif`,
        `Cela ne s'applique que dans des contextes théoriques`,
        'Cela contredit les principes de base',
        'Cela est sans rapport avec le sujet principal',
      ],
    },
    DE: {
      correct: [
        `Es hilft, ${keywords[0] || 'das Konzept'} zu verstehen`,
        `Um ${keywords[1] || 'Schlüsselprinzipien'} effektiv anzuwenden`,
        `Es zeigt ${keywords[2] || 'wichtige Aspekte'}`,
        `${keywords[0] || 'Das Konzept'} ermöglicht bessere ${keywords[1] || 'Ergebnisse'}`,
      ],
      wrong: [
        'Es hat keine signifikante Auswirkung',
        'Es gilt nur in theoretischen Kontexten',
        'Es widerspricht grundlegenden Prinzipien',
        'Es ist nicht mit dem Hauptthema verbunden',
      ],
    },
  };

  const questions: FallbackQuestion[] = [];
  const templates = questionTemplates[language];
  const options = optionTemplates[language];

  for (let i = 0; i < Math.min(count, templates.length); i++) {
    const template = templates[i];
    const correctIdx = Math.floor(Math.random() * 4);

    const questionOptions = [...options.wrong];
    questionOptions[correctIdx] = options.correct[i % options.correct.length];

    questions.push({
      type: 'multiple_choice',
      prompt: template.prompt,
      options: questionOptions,
      correct_option_index: correctIdx,
      explanation: `${options.correct[i % options.correct.length]} - This is a key concept covered in this chapter.`,
      points: 10,
    });
  }

  return questions;
}
