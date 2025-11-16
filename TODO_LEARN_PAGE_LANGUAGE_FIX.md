# Learn Page Language Fix - Implementation Plan

## Objective
Fix the Learn page bilingual behavior so ALL content (questions, chatbot messages, feedback, help) always matches the selected UI language (FR/EN).

## Implementation Checklist

### Phase 1: Create Translation Helper Utility ✅
- [x] Create `lib/content-translator.ts`
- [x] Add `translateQuestionObject()` function
- [x] Add `translateMessageBatch()` function
- [x] Add `getApiLanguage()` helper

### Phase 2: Update Learn Page Component ✅
- [x] Add language change detection with useEffect
- [x] Add question translation in loadQuestion()
- [x] Add message re-translation on language switch
- [x] Update all API calls to use uppercase language codes
- [x] Add translation indicator UI

### Phase 3: Update API Endpoints ✅
- [x] Verified `/api/chat/evaluate/route.ts` - already handles language correctly
- [x] Verified `/api/chat/help/route.ts` - already handles language correctly

### Phase 4: Add Missing Translations ✅
- [x] All required translations already exist in `lib/translations.ts`

### Phase 5: Testing
- [ ] Test language toggle with existing messages
- [ ] Test new question generation in FR
- [ ] Test new question generation in EN
- [ ] Test quick action buttons in both languages
- [ ] Test feedback messages in both languages
- [ ] Test all 5 questions in both languages

## Current Status
✅ **Implementation Complete!** Ready for testing.

## Summary of Changes

### 1. Created Translation Helper (`lib/content-translator.ts`)
- `getApiLanguage()` - Converts 'fr'/'en' to 'FR'/'EN' for API calls
- `translateQuestionObject()` - Translates questions including all options
- `translateMessageBatch()` - Translates multiple chat messages at once
- `translateText()` - Translates individual text strings via API
- `detectLanguage()` - Detects if content is in French or English
- `formatForLanguage()` - Translates content if needed based on detection

### 2. Updated Learn Page (`app/learn/[conceptId]/page.tsx`)
- Added `useEffect` to detect language changes and re-translate all content
- Modified `loadQuestion()` to translate questions before displaying
- Updated all API calls to use `getApiLanguage()` for consistent uppercase format
- Added translation indicator UI when switching languages
- Questions, options, and all messages now translate dynamically

### 3. Verified API Endpoints
- `/api/chat/evaluate/route.ts` - Already handles 'FR'/'EN' language parameter
- `/api/chat/help/route.ts` - Already handles 'FR'/'EN' language parameter
- Both endpoints generate responses in the requested language

## How It Works

1. **Initial Load**: Questions are translated to current language when loaded
2. **Language Switch**: All messages and current question are re-translated
3. **New Content**: All AI-generated content uses the selected language
4. **Quick Actions**: Help responses are generated in the selected language
5. **Feedback**: Evaluation feedback is provided in the selected language

## Expected Behavior

✅ When user switches to FR:
- All past messages translate to French
- Current question translates to French
- All options (A/B/C/D) translate to French
- Quick action buttons show French labels
- Help responses are in French
- Feedback messages are in French
- System instructions are in French

✅ When user switches to EN:
- All content translates back to English
- Same behavior as above but in English
