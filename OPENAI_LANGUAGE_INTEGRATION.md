# OpenAI Language Integration - Implementation Guide

## ✅ COMPLETED

### Backend API Updates
1. **app/api/chat/help/route.ts** - Added `language` parameter support
   - Accepts `language: 'EN' | 'FR'` in request body
   - Passes language instruction to OpenAI prompts
   - Returns responses in the selected language

2. **lib/openai-vision.ts** - Updated core functions with language support:
   - `generateChapterQuestions()` - Now accepts `language` parameter
   - `evaluateAnswer()` - Now accepts `language` parameter  
   - Both functions include language instructions in OpenAI prompts
   - Fallback responses are also language-aware

## 🔄 REMAINING WORK

### Frontend Components Need Updates

The following components need to be updated to pass the current language to API calls:

#### 1. **app/learn/[conceptId]/page.tsx**
This is the main learning page where students interact with questions.

**Required Changes:**
```typescript
// Add at top of component
import { useLanguage } from '@/contexts/LanguageContext';

// Inside component
const { currentLanguage } = useLanguage();

// Update handleQuickAction function (line ~280)
const response = await fetch('/api/chat/help', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: actionId,
    question: currentQuestion.question,
    chapterTitle: currentChapter?.title || '',
    language: currentLanguage, // ADD THIS LINE
  }),
});

// Update handleSendMessage function (line ~200)
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
    language: currentLanguage, // ADD THIS LINE
  }),
});
```

#### 2. **app/api/chat/evaluate/route.ts**
Update to accept and use the language parameter.

**Required Changes:**
```typescript
// In handleChapterEvaluation function
async function handleChapterEvaluation(body: any) {
  const { chapterId, questionId, questionNumber, questionType, answer, correctAnswer, language = 'EN' } = body;
  
  // ... existing code ...
  
  // When calling evaluateAnswer for MCQ wrong answers:
  evaluation = await evaluateAnswer(
    `Question: ${question.question}...`,
    `The student chose ${userAnswer}...`,
    questionNumber <= 3 ? 1 : questionNumber === 4 ? 2 : 3,
    undefined,
    chapter.sourceText,
    language // ADD THIS PARAMETER
  );
  
  // For open-ended questions:
  evaluation = await evaluateAnswer(
    question.question,
    answer,
    questionNumber <= 3 ? 1 : questionNumber === 4 ? 2 : 3,
    undefined,
    chapter.sourceText,
    language // ADD THIS PARAMETER
  );
  
  // Update feedback messages based on language
  if (correct) {
    feedback = language === 'FR' 
      ? `✅ Correct ! Excellent travail ! Vous avez gagné ${question.points} points.`
      : `✅ Correct! Great job! You earned ${question.points} points.`;
  } else {
    const correctOptionText = question.options?.[correctOptionIndex] || '';
    feedback = language === 'FR'
      ? `❌ Pas tout à fait. La bonne réponse était **${correctAnswerLetter}) ${correctOptionText}**.\n\n${evaluation.feedback}`
      : `❌ Not quite. The correct answer was **${correctAnswerLetter}) ${correctOptionText}**.\n\n${evaluation.feedback}`;
  }
}
```

#### 3. **app/api/upload/route.ts** (Optional but Recommended)
When generating questions for a new chapter, pass the user's language preference.

**Required Changes:**
```typescript
// Accept language from request or detect from headers
const language = /* get from request or default to 'EN' */;

// When calling generateChapterQuestions:
const questions = await generateChapterQuestions(
  chapter.title,
  chapter.summary,
  chapter.sourceText,
  language // ADD THIS PARAMETER
);
```

#### 4. **Initial Greeting Message in Learn Page**
Update the hardcoded greeting message to use translations:

```typescript
// In loadChapterData function (line ~90)
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

## 📝 Testing Checklist

After implementing the above changes, test the following scenarios:

### English Mode (EN)
- [ ] Upload an image → Questions generated in English
- [ ] Answer MCQ correctly → Feedback in English
- [ ] Answer MCQ incorrectly → Explanation in English
- [ ] Answer open question → Evaluation in English
- [ ] Click "I don't get it" → Help text in English
- [ ] Click "Simplify" → Simplified explanation in English
- [ ] Click "Give example" → Example in English

### French Mode (FR)
- [ ] Upload an image → Questions generated in French
- [ ] Answer MCQ correctly → Feedback in French
- [ ] Answer MCQ incorrectly → Explanation in French
- [ ] Answer open question → Evaluation in French
- [ ] Click "Je ne comprends pas" → Help text in French
- [ ] Click "Simplifier" → Simplified explanation in French
- [ ] Click "Donner un exemple" → Example in French

### Language Switching
- [ ] Switch language mid-session → New responses in new language
- [ ] Refresh page → Language preference persists
- [ ] Previous messages remain in original language
- [ ] New AI responses use current language

## 🎯 Expected Behavior

1. **On Page Load:**
   - Browser language detected (FR if starts with 'fr', otherwise EN)
   - Stored in localStorage
   - Language toggle shows current language

2. **During Learning:**
   - All AI-generated content (questions, feedback, help) in selected language
   - Quick action buttons show translated labels
   - UI text uses translate() function

3. **On Language Switch:**
   - Toggle button updates immediately
   - localStorage updated
   - Next AI interaction uses new language
   - Page re-renders with new UI language

## 💡 Implementation Priority

1. **HIGH PRIORITY:** Update `app/learn/[conceptId]/page.tsx` to pass language to API calls
2. **HIGH PRIORITY:** Update `app/api/chat/evaluate/route.ts` to use language parameter
3. **MEDIUM PRIORITY:** Update `app/api/upload/route.ts` for initial question generation
4. **LOW PRIORITY:** Update greeting messages to use translations

## 🔍 Key Points

- The OpenAI functions now support language parameter
- Frontend must pass `currentLanguage` from LanguageContext to API calls
- All AI responses will automatically be in the correct language
- Fallback responses are also language-aware
- No changes needed to translation dictionary - it's already complete
