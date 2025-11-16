/**
 * Content Translation Utilities
 * Handles translation of dynamic content (questions, messages, etc.)
 */

import { ChatMessage } from '@/types/chat.types';
import { ChapterQuestion } from '@/types/concept.types';

/**
 * Convert internal language code to API format
 * 'fr' | 'en' → 'FR' | 'EN'
 */
export function getApiLanguage(language: 'fr' | 'en'): 'FR' | 'EN' {
  return language.toUpperCase() as 'FR' | 'EN';
}

/**
 * Translate a question object including all its properties
 */
export async function translateQuestionObject(
  question: ChapterQuestion,
  targetLanguage: 'fr' | 'en'
): Promise<ChapterQuestion> {
  try {
    // Translate the question text
    const translatedQuestion = await translateText(
      question.question,
      targetLanguage,
      'question'
    );

    // Translate options if it's an MCQ
    let translatedOptions = question.options;
    if (question.type === 'mcq' && question.options) {
      translatedOptions = await Promise.all(
        question.options.map(option =>
          translateText(option, targetLanguage, 'option')
        )
      );
    }

    return {
      ...question,
      question: translatedQuestion,
      options: translatedOptions,
    };
  } catch (error) {
    console.error('Error translating question:', error);
    return question; // Return original on error
  }
}

/**
 * Translate a batch of chat messages
 */
export async function translateMessageBatch(
  messages: ChatMessage[],
  targetLanguage: 'fr' | 'en'
): Promise<ChatMessage[]> {
  try {
    const translatedMessages = await Promise.all(
      messages.map(async (message) => {
        const translatedContent = await translateText(
          message.content,
          targetLanguage,
          'message'
        );
        return {
          ...message,
          content: translatedContent,
        };
      })
    );
    return translatedMessages;
  } catch (error) {
    console.error('Error translating messages:', error);
    return messages; // Return original on error
  }
}

/**
 * Translate a single text string using the translation API
 */
export async function translateText(
  text: string,
  targetLanguage: 'fr' | 'en',
  contentType: 'question' | 'option' | 'message' | 'feedback' | 'instruction' = 'message'
): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }

  try {
    const response = await fetch('/api/translate/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: text,
        targetLanguage: getApiLanguage(targetLanguage),
        contentType,
      }),
    });

    if (!response.ok) {
      console.error('Translation API error:', response.statusText);
      return text;
    }

    const data = await response.json();
    return data.translated || text;
  } catch (error) {
    console.error('Error translating text:', error);
    return text;
  }
}

/**
 * Check if content needs translation based on language detection
 * Simple heuristic: check for common French/English words
 */
export function detectLanguage(text: string): 'fr' | 'en' | 'unknown' {
  const lowerText = text.toLowerCase();
  
  // Common French indicators
  const frenchIndicators = [
    'le ', 'la ', 'les ', 'un ', 'une ', 'des ',
    'est ', 'sont ', 'être ', 'avoir ',
    'vous ', 'nous ', 'ils ', 'elles ',
    'quel', 'quelle', 'comment', 'pourquoi',
    'réponse', 'question', 'expliquer'
  ];
  
  // Common English indicators
  const englishIndicators = [
    'the ', 'a ', 'an ', 'is ', 'are ', 'be ', 'have ',
    'you ', 'we ', 'they ',
    'what', 'which', 'how', 'why',
    'answer', 'question', 'explain'
  ];
  
  const frenchCount = frenchIndicators.filter(word => lowerText.includes(word)).length;
  const englishCount = englishIndicators.filter(word => lowerText.includes(word)).length;
  
  if (frenchCount > englishCount && frenchCount > 2) return 'fr';
  if (englishCount > frenchCount && englishCount > 2) return 'en';
  return 'unknown';
}

/**
 * Format content for the current language
 * Translates if needed based on language detection
 */
export async function formatForLanguage(
  content: string,
  currentLanguage: 'fr' | 'en',
  contentType: 'question' | 'option' | 'message' | 'feedback' | 'instruction' = 'message'
): Promise<string> {
  const detectedLang = detectLanguage(content);
  
  // If detected language doesn't match current language, translate
  if (detectedLang !== 'unknown' && detectedLang !== currentLanguage) {
    return await translateText(content, currentLanguage, contentType);
  }
  
  // If we can't detect or it matches, return as-is
  return content;
}

/**
 * Get localized chapter title based on current language
 * Falls back to translation if localized version is missing
 * This is a synchronous function that returns the best available title
 */
export function getLocalizedChapterTitle(
  chapter: {
    title?: string;
    englishTitle?: string;
    frenchTitle?: string;
  },
  language: 'fr' | 'en'
): string {
  if (language === 'fr') {
    // Try frenchTitle first
    if (chapter.frenchTitle && chapter.frenchTitle.trim().length > 0) {
      return chapter.frenchTitle;
    }
    // Fallback to englishTitle or title (both assumed to be in English)
    // Note: For real-time translation, use getLocalizedChapterTitleAsync instead
    return chapter.englishTitle || chapter.title || 'Chapitre sans titre';
  } else {
    // For English, prefer englishTitle, then title
    if (chapter.englishTitle && chapter.englishTitle.trim().length > 0) {
      return chapter.englishTitle;
    }
    return chapter.title || 'Untitled Chapter';
  }
}

/**
 * Async version that translates chapter titles on-the-fly if localized version is missing
 * Use this when you can handle async operations (e.g., in useEffect)
 */
export async function getLocalizedChapterTitleAsync(
  chapter: {
    title?: string;
    englishTitle?: string;
    frenchTitle?: string;
  },
  language: 'fr' | 'en'
): Promise<string> {
  if (language === 'fr') {
    // Try frenchTitle first
    if (chapter.frenchTitle && chapter.frenchTitle.trim().length > 0) {
      return chapter.frenchTitle;
    }
    // If missing, translate from English
    const sourceTitle = chapter.englishTitle || chapter.title;
    if (sourceTitle) {
      try {
        return await translateText(sourceTitle, 'fr', 'instruction');
      } catch (error) {
        console.error('Error translating chapter title:', error);
        return sourceTitle; // Return English as fallback
      }
    }
    return 'Chapitre sans titre';
  } else {
    // For English, prefer englishTitle, then title
    if (chapter.englishTitle && chapter.englishTitle.trim().length > 0) {
      return chapter.englishTitle;
    }
    return chapter.title || 'Untitled Chapter';
  }
}

/**
 * Get localized chapter description based on current language
 */
export function getLocalizedChapterDescription(
  chapter: {
    summary?: string;
    englishDescription?: string;
    frenchDescription?: string;
  },
  language: 'fr' | 'en'
): string {
  if (language === 'fr') {
    return chapter.frenchDescription || chapter.summary || chapter.englishDescription || '';
  } else {
    return chapter.englishDescription || chapter.summary || '';
  }
}

/**
 * Translate chapter title if localized version is missing
 * This can be used to populate missing translations
 */
export async function ensureChapterTitleTranslation(
  chapter: {
    title?: string;
    englishTitle?: string;
    frenchTitle?: string;
  },
  targetLanguage: 'fr' | 'en'
): Promise<string> {
  const currentTitle = getLocalizedChapterTitle(chapter, targetLanguage);
  
  // If we got a title, return it
  if (currentTitle && currentTitle !== 'Untitled Chapter') {
    return currentTitle;
  }
  
  // Otherwise, translate from the other language
  const sourceTitle = targetLanguage === 'fr' 
    ? (chapter.englishTitle || chapter.title)
    : (chapter.frenchTitle || chapter.title);
  
  if (sourceTitle) {
    return await translateText(sourceTitle, targetLanguage, 'instruction');
  }
  
  return 'Untitled Chapter';
}
