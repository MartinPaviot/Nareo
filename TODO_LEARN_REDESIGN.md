# Learn Page Redesign - Implementation Progress

## Completed ✅
1. ✅ Created comprehensive redesign plan (LEARN_PAGE_REDESIGN_PLAN.md)
2. ✅ Updated type definitions (types/concept.types.ts)
   - Added ChapterQuestion, ChapterProgress, ChapterData interfaces
   - Added helper function getPhaseForQuestion()
   - Updated LEARNING_PHASES with correct names and points
3. ✅ Updated memory store (lib/memory-store.ts)
   - Added chapterProgress Map
   - Added chapter progress methods
   - Added getAllChapters() method
4. ✅ Created ChapterSidebar component (components/layout/ChapterSidebar.tsx)
   - Shows all chapters with progress
   - Displays phase indicators
   - Shows difficulty badges
   - Progress bars for each chapter
5. ✅ Added generateChapterQuestions() function (lib/openai-vision.ts)
   - Generates all 5 questions at once
   - 3 MCQs + 2 open-ended
   - Includes fallback questions
6. ✅ Updated upload flow (app/api/upload/route.ts)
   - Creates exactly 3 chapters from extracted content
   - Generates 5 questions per chapter immediately
   - Stores questions in chapter data
   - Initializes progress tracking

## In Progress ⏳
7. ⏳ Redesign learn page with sidebar layout
8. ⏳ Update chat bubble formatting for MCQs
9. ⏳ Update question/evaluation API routes
10. ⏳ Test complete flow

## Next Steps

### Step 6: Update Upload Flow
**File:** `app/api/upload/route.ts`
- Modify to create exactly 3 chapters from extracted text
- Generate 5 questions per chapter immediately
- Store questions in chapter data

### Step 7: Redesign Learn Page
**File:** `app/learn/[conceptId]/page.tsx` (or rename to [chapterId])
- Add two-column layout with sidebar
- Integrate ChapterSidebar component
- Display current question number and phase
- Show MCQ options clearly formatted
- Add input hint for MCQs

### Step 8: Update Chat Bubble
**File:** `components/chat/ChatBubble.tsx`
- Better formatting for MCQ options (A, B, C, D)
- Clear visual separation
- Highlight selected answer

### Step 9: Update API Routes
**Files:** 
- `app/api/chat/question/route.ts` - Use pre-generated questions
- `app/api/chat/evaluate/route.ts` - Handle MCQ vs open differently

### Step 10: Testing
- Upload an image
- Verify 3 chapters are created
- Check 5 questions per chapter
- Test MCQ answer checking
- Test open-ended evaluation
- Verify progress tracking
- Check sidebar updates

## Design Requirements Checklist
- [ ] Left sidebar showing all chapters
- [ ] Progress tracker (X/3 mastered)
- [ ] Current score display (0/100)
- [ ] Chapter cards with:
  - [ ] Title
  - [ ] Difficulty badge
  - [ ] 3 phase indicators (MCQ, Short Answer, Reflective)
  - [ ] Progress bar (0/100)
  - [ ] Orange border for active chapter
- [ ] Main chat area with:
  - [ ] Chapter title at top
  - [ ] Phase indicator (e.g., "Phase 1: MCQ Warmup • Score: 0 pts")
  - [ ] Question number (e.g., "**Question 1:**")
  - [ ] MCQ options as A), B), C), D)
  - [ ] Input hint: "_Type A, B, C, or D_"
  - [ ] Quick action buttons
  - [ ] Voice input

## Notes
- Each chapter must have exactly 5 questions
- Questions 1-3: MCQ (10 points each = 30 total)
- Question 4: Short answer (35 points)
- Question 5: Reflective (35 points)
- Total per chapter: 100 points
- Total for 3 chapters: 300 points
