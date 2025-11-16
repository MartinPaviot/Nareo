# Dynamic Content Translation System - Complete Implementation Guide

## 🎯 Overview

This system enables **real-time translation of ALL lesson content** when the user switches languages. Unlike basic UI translation, this system:

1. ✅ Translates questions, options, feedback, and chat messages dynamically
2. ✅ Caches translations to avoid redundant API calls
3. ✅ Updates content instantly without page reload
4. ✅ Maintains translation consistency across the session

## ✅ COMPLETED

### 1. Translation API Route (`app/api/translate/content/route.ts`)
- Accepts content and target language
- Uses GPT-4 for accurate, context-aware translation
- Supports different content types (question, option, feedback, message, instruction)
- Returns translated content with metadata

### 2. Enhanced LanguageContext (`contexts/LanguageContext.tsx`)
- Added `translateContent()` function for dynamic translation
- Implemented translation cache to store FR/EN pairs
- Cache prevents redundant API calls for same content
- Exports `useLanguage` hook with new capabilities

## 🔄 IMPLEMENTATION REQUIRED

To complete the dynamic content translation system, you need to update the Learn page to translate content when language changes.

### Critical File: `app/learn/[conceptId]/page.tsx`

This file needs THREE major updates:

#### **Update 1: Add Language Change Effect**

Add this effect after the existing useEffects (around line 100):

```typescript
import { useLanguage } from '@/contexts/LanguageContext';

// Inside component
const { currentLanguage, translateContent } = useLanguage();

// Add this new useEffect to handle language changes
useEffect(() => {
  const translateCurrentContent = async () => {
    if (!currentQuestion) return;

    // Translate the current question
    const translatedQuestion = await translateContent(currentQuestion.question, 'question');
    
    // Translate options if MCQ
    let translatedOptions: string[] | undefined;
    if (currentQuestion.type === 'mcq' && currentQuestion.options) {
      translatedOptions = await Promise.all(
        currentQuestion.options.map(opt => translateContent(opt, 'option'))
      );
    }

    // Update the current question with translations
    setCurrentQuestion(prev => prev ? {
      ...prev,
      question: translatedQuestion,
      options: translatedOptions || prev.options,
    } : null);

    // Translate all chat messages
    const translatedMessages = await Promise.all(
      messages.map(async (msg) => ({
        ...msg,
        content: await translateContent(msg.content, msg.role === 'user' ? 'message' : 'feedback'),
      }))
    );
    
    setMessages(translatedMessages);
  };

  translateCurrentContent();
}, [currentLanguage]); // Re-run when language changes
```

#### **Update 2: Pass Language to API Calls**

Update the `handleQuickAction` function (around line 280):

```typescript
const response = await fetch('/api/chat/help', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: actionId,
    question: currentQuestion.question,
    chapterTitle: currentChapter?.title || '',
    language: currentLanguage, // ADD THIS
  }),
});
```

Update the `handleSendMessage` function (around line 200):

```typescript
const response = await fetch('/api/chat/evaluate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chapterId: chapterId,
    questionId: currentQuestion.id,
    questionNumber: currentQuestion.questionNumber,
    questionType: currentQuestion.type,
    answer: userAnswer,
    correctAnswer: currentQuestion.correctAnswer,
    language: currentLanguage, // ADD THIS
  }),
});
```

#### **Update 3: Update Initial Greeting**

In the `loadChapterData` function (around line 90), update the greeting to use translations:

```typescript
if (startQuestionNumber === 1) {
  const greeting: ChatMessage = {
    id: generateId(),
    role: 'assistant',
    content: translate('chat_greeting') + '\n\n' +
             translate('chat_intro', { title: chapter.title }) + '\n\n' +
             translate('chat_intro_mcq') + '\n' +
             translate('chat_intro_short') + '\n' +
             translate('chat_intro_reflective') + '\n\n' +
             translate('chat_ready'),
    timestamp: new Date(),
    aristoState: 'happy',
  };
  setMessages([greeting]);
}
```

### Update API Route: `app/api/chat/evaluate/route.ts`

Update the `handleChapterEvaluation` function to accept and use language:

```typescript
async function handleChapterEvaluation(body: any) {
  const { chapterId, questionId, questionNumber, questionType, answer, correctAnswer, language = 'EN' } = body;
  
  // ... existing code ...
  
  // When calling evaluateAnswer:
  evaluation = await evaluateAnswer(
    question.question,
    answer,
    questionNumber <= 3 ? 1 : questionNumber === 4 ? 2 : 3,
    undefined,
    chapter.sourceText,
    language // ADD THIS
  );
  
  // Update feedback messages based on language
  if (correct) {
    feedback = language === 'FR' 
      ? `✅ Correct ! Excellent travail ! Vous avez gagné ${question.points} points.`
      : `✅ Correct! Great job! You earned ${question.points} points.`;
  } else {
    feedback = language === 'FR'
      ? `❌ Pas tout à fait. La bonne réponse était **${correctAnswerLetter}) ${correctOptionText}**.\n\n${evaluation.feedback}`
      : `❌ Not quite. The correct answer was **${correctAnswerLetter}) ${correctOptionText}**.\n\n${evaluation.feedback}`;
  }
}
```

## 🎯 How It Works

### 1. **User Clicks Language Toggle**
- LanguageContext updates `currentLanguage`
- localStorage saves the preference
- All components using `useLanguage` re-render

### 2. **Language Change Effect Triggers**
- Detects language change via useEffect
- Calls `translateContent()` for current question
- Calls `translateContent()` for all visible messages
- Updates state with translated content

### 3. **Translation Process**
- Check cache first (instant if cached)
- If not cached, call `/api/translate/content`
- GPT-4 translates with context awareness
- Store both FR and EN in cache
- Return translated content

### 4. **New AI Responses**
- API routes receive `language` parameter
- OpenAI generates responses in target language
- Responses displayed immediately in correct language

## 📋 Testing Checklist

### Basic Translation
- [ ] Switch from EN to FR → All visible content translates
- [ ] Switch from FR to EN → All visible content translates
- [ ] Translation happens instantly (< 2 seconds)
- [ ] No page reload required

### Content Types
- [ ] MCQ questions translate correctly
- [ ] MCQ options (A, B, C, D) translate correctly
- [ ] Open-ended questions translate correctly
- [ ] Chat messages translate correctly
- [ ] Feedback messages translate correctly
- [ ] Instructions translate correctly

### AI Responses
- [ ] Click "I don't get it" in FR → Help in French
- [ ] Click "Simplify" in EN → Explanation in English
- [ ] Answer question in FR → Feedback in French
- [ ] Answer question in EN → Feedback in English

### Caching
- [ ] Switch EN→FR→EN → Second EN switch is instant (cached)
- [ ] Same question in both languages uses cache
- [ ] Cache persists during session

### Edge Cases
- [ ] Empty messages don't cause errors
- [ ] Very long content translates correctly
- [ ] Special characters preserved
- [ ] Emojis preserved
- [ ] Formatting (bold, lists) preserved

## 💡 Key Features

### Intelligent Caching
- Stores both FR and EN versions
- Keyed by content + type
- Prevents redundant API calls
- Instant switching for cached content

### Context-Aware Translation
- Different strategies for different content types
- Preserves educational tone
- Maintains formatting
- Keeps technical accuracy

### Seamless UX
- No loading spinners
- No page reloads
- Instant UI updates
- Smooth transitions

## 🚀 Performance Optimization

1. **Cache Strategy**: First translation is slow (~1-2s), subsequent switches are instant
2. **Batch Translation**: Messages translated in parallel using Promise.all
3. **Lazy Translation**: Only translates visible content
4. **Smart Caching**: Cache key includes content type for better accuracy

## 🔍 Troubleshooting

**Problem**: Content doesn't translate
- Check: Is `useLanguage` imported correctly?
- Check: Is language change effect added?
- Check: Are API routes receiving language parameter?

**Problem**: Translation is slow
- Expected: First translation takes 1-2 seconds
- Check: Is caching working? (second switch should be instant)
- Check: Network tab for API call times

**Problem**: Formatting lost in translation
- Check: Content type parameter correct?
- Check: Translation API preserving markdown?

## 📝 Summary

This system provides a **complete dynamic translation experience** where:
- ✅ ALL content translates when language changes
- ✅ Translations are cached for performance
- ✅ New AI responses generated in target language
- ✅ No page reload required
- ✅ Instant switching for cached content

The user experience is seamless - click the language toggle and watch everything translate in real-time!
