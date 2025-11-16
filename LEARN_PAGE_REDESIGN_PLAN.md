# Learn Page Redesign Plan

## Task Summary (French)
Il faut que la page learn ressemble davantage à la page ci-jointe car à partir de l'extraction du texte il faut construire 3 chapitres différents comportant 5 questions chacuns (dont 3 qcm avec réponse A,B, C et D dans le chat et 2 réponses ouvertes)

## Task Summary (English)
The learn page needs to look more like the attached page because from the text extraction we need to build 3 different chapters containing 5 questions each (including 3 MCQs with answers A, B, C, and D in the chat and 2 open-ended questions)

## Current State Analysis

### What We Have:
1. **Current Structure**: Concept-based learning with 3 phases per concept
2. **Question Flow**: Dynamic question generation, one at a time
3. **UI**: Simple chat interface without sidebar progress tracker
4. **Data Model**: Chapters contain multiple concepts, each concept has 3 phases

### What's Missing:
1. **Sidebar Progress Tracker**: Left sidebar showing all chapters with progress
2. **Fixed Question Structure**: 5 questions per chapter (3 MCQ + 2 open)
3. **Chapter-Based Learning**: Learn by chapter, not by individual concept
4. **Visual MCQ Display**: Clear A, B, C, D options in chat bubbles
5. **Phase Indicators**: Visual indicators for MCQ Phase, Short Answer, Reflective

## Reference Image Analysis

From the attached image, the UI should have:

### Left Sidebar:
- **Your Progress** section at top (0/3 mastered)
- **Current Score** bar (0/100)
- **Chapter List** with:
  - Chapter title
  - Difficulty badge (easy/medium/hard)
  - Three phase indicators: MCQ Phase, Short Answer, Reflective
  - Progress bar for each chapter (0/100)
  - Orange border for active chapter

### Main Chat Area:
- Chapter title at top: "Articles in English Grammar: Understanding Countability and Definiteness"
- Phase indicator: "Phase 1: MCQ Warmup • Score: 0 pts"
- Aristo avatar with chat bubbles
- MCQ questions displayed with:
  - Question number (e.g., "**Question 1:**")
  - Clear A), B), C), D) options
  - Input field: "_Type A, B, C, or D_"
- Quick action buttons: "I don't get it", "Simplify", "Give example"
- Voice input and send button

## Implementation Plan

### Phase 1: Update Data Model & Types

**Files to modify:**
- `types/concept.types.ts` - Add chapter-based question structure
- `lib/memory-store.ts` - Add chapter progress tracking

**Changes:**
```typescript
// New types for chapter-based learning
interface ChapterQuestion {
  id: string;
  chapterId: string;
  questionNumber: number; // 1-5
  type: 'mcq' | 'open'; // 3 MCQ (1-3), 2 open (4-5)
  question: string;
  options?: string[]; // [A, B, C, D] for MCQ
  correctAnswer?: string; // For MCQ
  phase: 'mcq' | 'short' | 'reflective'; // mcq for Q1-3, short for Q4, reflective for Q5
}

interface ChapterProgress {
  chapterId: string;
  currentQuestion: number; // 1-5
  questionsAnswered: number;
  score: number; // 0-100
  completed: boolean;
  answers: {
    questionId: string;
    answer: string;
    correct?: boolean;
    score: number;
  }[];
}
```

### Phase 2: Update Question Generation Logic

**Files to modify:**
- `lib/openai-vision.ts` - Add function to generate all 5 questions at once
- `app/api/chat/question/route.ts` - Update to use pre-generated questions

**New function:**
```typescript
export async function generateChapterQuestions(
  chapterTitle: string,
  chapterContent: string,
  sourceText?: string
): Promise<ChapterQuestion[]> {
  // Generate exactly 5 questions:
  // - Questions 1-3: MCQ with A, B, C, D options
  // - Question 4: Short answer (explain in own words)
  // - Question 5: Reflective (real-world application)
}
```

### Phase 3: Create Sidebar Component

**New file:**
- `components/layout/ChapterSidebar.tsx`

**Features:**
- Display all chapters from current upload
- Show progress for each chapter (0/100)
- Highlight active chapter with orange border
- Display difficulty badges
- Show three phase indicators per chapter
- Overall progress at top (X/3 mastered)

### Phase 4: Redesign Learn Page

**Files to modify:**
- `app/learn/[conceptId]/page.tsx` → Rename to `app/learn/[chapterId]/page.tsx`

**New structure:**
- Two-column layout: Sidebar (25%) + Chat (75%)
- Sidebar: ChapterSidebar component
- Main area: Chat interface with chapter context
- Display current question number (1-5)
- Show phase indicator at top
- Format MCQ options clearly in chat bubbles
- Add input hint for MCQ: "_Type A, B, C, or D_"

### Phase 5: Update Chat Display

**Files to modify:**
- `components/chat/ChatBubble.tsx` - Better MCQ formatting
- `components/chat/QuickActionButtons.tsx` - Match reference design

**MCQ Display Format:**
```
**Question 1:** Which two main factors determine whether an English 
noun needs an article?

A) Countability and definiteness
B) Gender and number
C) Length and complexity
D) Origin and frequency

_Type A, B, C, or D_
```

### Phase 6: Update Upload Flow

**Files to modify:**
- `app/api/upload/route.ts` - Generate 3 chapters with 5 questions each
- `lib/openai-vision.ts` - Update concept extraction to create chapter structure

**Logic:**
1. Extract text from image/PDF
2. Analyze and split into 3 chapters
3. For each chapter, generate 5 questions immediately
4. Store all questions in memory
5. Redirect to first chapter's learn page

### Phase 7: Update Evaluation Logic

**Files to modify:**
- `app/api/chat/evaluate/route.ts` - Handle MCQ vs open-ended differently

**MCQ Evaluation:**
- Check if answer matches correct option (A, B, C, or D)
- Award points: 10 points per MCQ (30 total)
- Immediate feedback

**Open-Ended Evaluation:**
- Use AI to evaluate depth and understanding
- Award points: 35 points each (70 total)
- Provide constructive feedback

## File Structure Summary

### Files to Create:
1. `components/layout/ChapterSidebar.tsx` - New sidebar component
2. `LEARN_PAGE_REDESIGN_PLAN.md` - This file

### Files to Modify:
1. `types/concept.types.ts` - Add chapter question types
2. `lib/memory-store.ts` - Add chapter progress tracking
3. `lib/openai-vision.ts` - Add chapter question generation
4. `app/api/upload/route.ts` - Generate questions on upload
5. `app/api/chat/question/route.ts` - Use pre-generated questions
6. `app/api/chat/evaluate/route.ts` - Handle MCQ vs open differently
7. `app/learn/[conceptId]/page.tsx` - Redesign with sidebar
8. `components/chat/ChatBubble.tsx` - Better MCQ formatting
9. `components/chat/QuickActionButtons.tsx` - Match design

### Files to Potentially Rename:
1. `app/learn/[conceptId]/` → `app/learn/[chapterId]/` (if we switch to chapter-based routing)

## Implementation Steps

1. ✅ Create this plan document
2. ⏳ Update type definitions
3. ⏳ Create ChapterSidebar component
4. ⏳ Update question generation logic
5. ⏳ Redesign learn page with sidebar
6. ⏳ Update chat bubble formatting
7. ⏳ Update upload flow to generate all questions
8. ⏳ Update evaluation logic
9. ⏳ Test complete flow
10. ⏳ Polish UI to match reference

## Key Design Decisions

1. **Chapter vs Concept**: Switch from concept-based to chapter-based learning
2. **Pre-generate Questions**: Generate all 5 questions on upload, not dynamically
3. **Fixed Structure**: Always 3 MCQ + 2 open per chapter
4. **Sidebar Always Visible**: Show progress for all chapters simultaneously
5. **Sequential Questions**: Must answer questions 1-5 in order

## Success Criteria

- [ ] Sidebar shows all 3 chapters with progress
- [ ] Each chapter has exactly 5 questions (3 MCQ + 2 open)
- [ ] MCQ options displayed as A, B, C, D in chat
- [ ] Phase indicators show MCQ Phase, Short Answer, Reflective
- [ ] Progress bars update correctly
- [ ] UI matches reference image design
- [ ] Questions are based on extracted text content
- [ ] Scoring: 30 points for MCQs, 70 points for open-ended
