# 🧪 Testing Checklist - LevelUp Application

## ✅ Tests Completed

### 1. Build & Compilation
- [x] TypeScript compilation successful
- [x] No type errors
- [x] All routes compile correctly
- [x] Production build successful

### 2. Server Startup
- [x] Dev server starts on http://localhost:3000
- [x] No startup errors
- [x] Environment variables loaded

### 3. Dependencies
- [x] All npm packages installed
- [x] pdf-parse installed
- [x] OpenAI SDK available

## 🔄 Tests In Progress

### Frontend Testing

#### 1. Upload Page (/)
- [ ] Page loads without errors
- [ ] Drag & drop zone visible
- [ ] "Choose PDF File" button clickable
- [ ] File input accepts PDF files
- [ ] Upload progress indicator shows
- [ ] Aristo' mascot displays (or emoji placeholder)
- [ ] Error handling for invalid files
- [ ] Redirect to chapter page after upload

**Test Steps:**
1. Open http://localhost:3000
2. Click "Choose PDF File" or drag a PDF
3. Select a valid PDF file (course material)
4. Wait for processing (15-30 seconds)
5. Verify redirect to /chapter/[id]

**Expected Issues:**
- ⚠️ Mascot images show as 404 (need actual images)
- ⚠️ Requires valid OpenAI API key in .env.local

#### 2. Chapter Overview (/chapter/[id])
- [ ] Chapter title displays
- [ ] Summary text shows
- [ ] Concept cards render
- [ ] Difficulty badges show (📘📗📕)
- [ ] Phase indicators visible
- [ ] "Start Learning Now" button works
- [ ] Concept tracker sidebar visible
- [ ] Score bar at top

**Test Steps:**
1. After upload, verify chapter page loads
2. Check all concepts are listed
3. Click on a concept card
4. Verify navigation to /learn/[conceptId]

#### 3. Chat Interface (/learn/[conceptId])
- [ ] Chat interface loads
- [ ] Aristo' avatar displays
- [ ] First question appears automatically
- [ ] Message bubbles styled correctly
- [ ] Input field functional
- [ ] Quick action buttons work
- [ ] Phase progression indicator
- [ ] Score updates in real-time
- [ ] Concept tracker updates

**Test Steps:**
1. Navigate to a concept
2. Read the first question (Phase 1 - QCM)
3. Type an answer and submit
4. Verify AI evaluation
5. Check score update
6. Progress to Phase 2 (Short Answer)
7. Progress to Phase 3 (Reflective)
8. Complete all phases

**Quick Action Buttons to Test:**
- [ ] "I don't get it" - triggers simplification
- [ ] "Simplify" - requests easier explanation
- [ ] "Give example" - provides concrete example

#### 4. Session Recap (/recap/[sessionId])
- [ ] Recap page loads
- [ ] Statistics display correctly
- [ ] Concept table shows all concepts
- [ ] Scores and badges visible
- [ ] "Retry weak concepts" button works
- [ ] "Upload new chapter" button works

### Backend API Testing

#### 5. Upload API (/api/upload)
**Test with curl:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@path/to/your/course.pdf"
```

**Expected Response:**
```json
{
  "chapterId": "uuid",
  "title": "Chapter Title",
  "concepts": [...]
}
```

**Checks:**
- [ ] Accepts PDF file
- [ ] Extracts text from PDF
- [ ] Calls GPT-4 for concept extraction
- [ ] Returns chapter ID
- [ ] Stores in memory

#### 6. Chapters API (/api/chapters/[id])
**Test with curl:**
```bash
curl http://localhost:3000/api/chapters/[chapter-id]
```

**Checks:**
- [ ] Returns chapter details
- [ ] Includes concepts list
- [ ] Shows progress for each concept

#### 7. Concepts API (/api/concepts/[id])
**Test with curl:**
```bash
curl http://localhost:3000/api/concepts/[concept-id]
```

**Checks:**
- [ ] Returns concept details
- [ ] Includes chat history
- [ ] Shows current progress

#### 8. Chat Question API (/api/chat/question)
**Test with curl:**
```bash
curl -X POST http://localhost:3000/api/chat/question \
  -H "Content-Type: application/json" \
  -d '{
    "conceptId": "concept-id",
    "phase": 1
  }'
```

**Checks:**
- [ ] Generates appropriate question for phase
- [ ] Phase 1: Multiple choice format
- [ ] Phase 2: Short answer format
- [ ] Phase 3: Reflective question
- [ ] Stores in chat history

#### 9. Chat Evaluate API (/api/chat/evaluate)
**Test with curl:**
```bash
curl -X POST http://localhost:3000/api/chat/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "conceptId": "concept-id",
    "phase": 1,
    "answer": "student answer here"
  }'
```

**Checks:**
- [ ] Evaluates answer with GPT-4
- [ ] Returns feedback
- [ ] Calculates score
- [ ] Updates progress
- [ ] Assigns badge if complete

#### 10. Sessions API (/api/sessions/[id])
**Test with curl:**
```bash
curl http://localhost:3000/api/sessions/[session-id]
```

**Checks:**
- [ ] Returns session statistics
- [ ] Lists all concepts with scores
- [ ] Calculates completion percentage

### Integration Testing

#### 11. Complete Learning Flow
**Full User Journey:**
1. [ ] Upload PDF
2. [ ] View chapter overview
3. [ ] Select first concept
4. [ ] Complete Phase 1 (QCM)
5. [ ] Complete Phase 2 (Short Answer)
6. [ ] Complete Phase 3 (Reflective)
7. [ ] Earn badge (Bronze/Silver/Gold)
8. [ ] Move to next concept
9. [ ] Complete 3 concepts
10. [ ] View session recap

**Scoring Verification:**
- [ ] Phase 1: +10 points
- [ ] Phase 2: +30 points
- [ ] Phase 3: +60 points
- [ ] Total: 100 points max per concept
- [ ] Bronze badge: ≥60 points
- [ ] Silver badge: ≥80 points
- [ ] Gold badge: 100 points

#### 12. Replay Feature
- [ ] "Retry this concept" button appears
- [ ] Generates new question variants
- [ ] Maintains difficulty level
- [ ] Updates score on retry
- [ ] Can improve badge

### Responsive Design Testing

#### 13. Mobile View (< 768px)
- [ ] Concept tracker collapses
- [ ] Chat interface adapts
- [ ] Buttons remain accessible
- [ ] Text readable
- [ ] Upload works on mobile

#### 14. Tablet View (768px - 1024px)
- [ ] Partial sidebar visible
- [ ] Layout adjusts properly
- [ ] Touch interactions work

#### 15. Desktop View (> 1024px)
- [ ] Full layout displays
- [ ] Sidebar always visible
- [ ] Optimal spacing

### Performance Testing

#### 16. Load Times
- [ ] Initial page load < 2s
- [ ] PDF upload feedback immediate
- [ ] Concept extraction < 30s
- [ ] Chat responses < 5s
- [ ] Page transitions smooth

#### 17. Memory Usage
- [ ] No memory leaks
- [ ] Data persists during session
- [ ] Clears on server restart (expected)

### Error Handling

#### 18. Error Scenarios
- [ ] Invalid PDF file
- [ ] Missing OpenAI API key
- [ ] Network errors
- [ ] Invalid concept ID
- [ ] Empty answers
- [ ] Server errors

## 🐛 Known Issues

1. **Mascot Images**: 404 errors for mascot images (need actual PNG files)
2. **Voice Features**: Not implemented yet (requires ElevenLabs API)
3. **Data Persistence**: Lost on server restart (by design for demo)
4. **Multi-user**: Not supported in memory version

## 📝 Test Results

### Issues Found:
1. ✅ FIXED: pdf-parse import error
2. ⚠️ PENDING: Mascot images need to be added
3. ⚠️ PENDING: Need to test with actual OpenAI API key

### Next Steps:
1. Add OpenAI API key to .env.local
2. Test complete upload flow
3. Test all 3 learning phases
4. Verify scoring system
5. Test on mobile device

## ✅ Sign-off

- [ ] All critical paths tested
- [ ] No blocking bugs
- [ ] Documentation complete
- [ ] Ready for user testing

---

**Tester**: _____________  
**Date**: _____________  
**Version**: 1.0.0 (In-Memory)
