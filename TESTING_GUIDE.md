# Testing Guide: Image Text Extraction Feature

## Prerequisites
- Development server running on http://localhost:3001 (or 3000)
- Educational image ready (screenshot, notes, diagram, etc.)
- Browser with developer console open

## Quick Test Checklist

### ✅ Test 1: Image Upload & Text Extraction
**Steps:**
1. Open http://localhost:3001
2. Upload an educational image
3. Open browser console (F12)

**Expected Console Logs:**
```
📸 Processing image upload: [filename] ( [size] bytes)
🔄 Converting image to base64...
🤖 Analyzing image with AI...
📝 Extracting raw text from image...
✅ Extracted [X] characters of text from image
🔍 Analyzing image with GPT-4 Vision...
✅ Successfully extracted [X] concepts from image
📝 Extracted text length: [X] characters
```

**Pass Criteria:**
- ✓ No errors in console
- ✓ Text extraction shows character count > 0
- ✓ Concepts extracted successfully
- ✓ Redirected to chapter page

---

### ✅ Test 2: Concept Creation with Source Text
**Steps:**
1. After upload, view the chapter page
2. Click on any concept card
3. Verify concept page loads

**Expected Behavior:**
- Chapter shows all extracted concepts
- Each concept has title and difficulty badge
- Clicking concept navigates to learning page

**Pass Criteria:**
- ✓ All concepts displayed
- ✓ No loading errors
- ✓ Smooth navigation

---

### ✅ Test 3: Context-Aware Questions (Phase 1)
**Steps:**
1. On learning page, observe the first question
2. Read the question carefully
3. Compare with your uploaded image content

**Example:**
- **Generic Question:** "What is machine learning?"
- **Context-Aware Question:** "According to the material, what are the three main types of machine learning mentioned in the diagram?"

**Pass Criteria:**
- ✓ Question references specific content from image
- ✓ Multiple choice options are relevant
- ✓ Question is not generic

---

### ✅ Test 4: Context-Aware Feedback
**Steps:**
1. Answer the question (correct or incorrect)
2. Read the feedback provided
3. Check if it references your material

**Example Feedback:**
- **Generic:** "Good job! That's correct."
- **Context-Aware:** "Correct! As shown in your notes, supervised learning uses labeled data to train models."

**Pass Criteria:**
- ✓ Feedback mentions concepts from image
- ✓ Feedback is specific and helpful
- ✓ References original material

---

### ✅ Test 5: Complete Learning Journey
**Steps:**
1. Complete Phase 1 (Multiple Choice)
2. Complete Phase 2 (Short Answer)
3. Complete Phase 3 (Reflective)
4. Check final score and badge

**Pass Criteria:**
- ✓ All phases use image context
- ✓ Progress tracked correctly
- ✓ Badge awarded appropriately
- ✓ Can view recap

---

## Advanced Testing

### Test 6: Various Image Types

#### A. Screenshot of Presentation Slides
- Upload a PowerPoint/Google Slides screenshot
- Verify text from slides is extracted
- Check if bullet points are preserved

#### B. Handwritten Notes
- Upload photo of handwritten notes
- Verify handwriting is recognized
- Check concept extraction accuracy

#### C. Diagrams with Labels
- Upload a diagram (flowchart, mind map, etc.)
- Verify labels and text in diagram extracted
- Check if relationships are understood

#### D. Mixed Content
- Upload image with text + diagrams + photos
- Verify all text elements extracted
- Check concept organization

---

### Test 7: Edge Cases

#### A. Image with No Text
**Steps:**
1. Upload a pure image (photo, artwork)
2. Check console logs

**Expected:**
- Extracted text length: 0 or very small
- Fallback concepts generated
- No errors

#### B. Very Large Image
**Steps:**
1. Upload high-resolution image (>5MB)
2. Monitor upload time
3. Check if processing completes

**Expected:**
- Upload succeeds (may take longer)
- Text extracted successfully
- No timeout errors

#### C. Low Quality Image
**Steps:**
1. Upload blurry or low-res image
2. Check extraction accuracy

**Expected:**
- Some text may be missed
- Concepts still generated
- No crashes

---

### Test 8: API Endpoint Testing

#### Test Upload Endpoint
```bash
# Create a test image upload
curl -X POST http://localhost:3001/api/upload \
  -F "file=@path/to/your/image.jpg" \
  -H "Content-Type: multipart/form-data"
```

**Expected Response:**
```json
{
  "success": true,
  "chapterId": "...",
  "title": "...",
  "conceptCount": 5
}
```

#### Test Question Generation
```bash
# After getting conceptId from upload
curl -X POST http://localhost:3001/api/chat/question \
  -H "Content-Type: application/json" \
  -d '{"conceptId": "your-concept-id", "phase": 1}'
```

**Expected Response:**
```json
{
  "success": true,
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "A",
  "phase": 1
}
```

---

## Verification Checklist

### Implementation Verification
- [ ] Text extracted from images (check console)
- [ ] Text stored in chapter (check memory store)
- [ ] Source text stored in concepts
- [ ] Questions use source text
- [ ] Evaluation uses source text

### Functionality Verification
- [ ] Upload works without errors
- [ ] Concepts created correctly
- [ ] Questions are contextual
- [ ] Feedback is contextual
- [ ] Progress tracking works

### User Experience Verification
- [ ] Upload is smooth
- [ ] Loading states are clear
- [ ] Questions make sense
- [ ] Feedback is helpful
- [ ] Navigation works

---

## Troubleshooting

### Issue: No text extracted
**Symptoms:** Console shows "Extracted 0 characters"
**Solutions:**
1. Check image has visible text
2. Try higher quality image
3. Check API key is valid
4. Review console for API errors

### Issue: Generic questions
**Symptoms:** Questions don't reference image content
**Solutions:**
1. Verify sourceText is not empty in concept
2. Check console logs for text extraction
3. Ensure question route passes sourceText
4. Review API response

### Issue: Upload fails
**Symptoms:** Error message on upload
**Solutions:**
1. Check file type (JPG, PNG, GIF, WebP only)
2. Verify file size is reasonable
3. Check API endpoint is running
4. Review server logs

---

## Success Criteria

### Minimum (Critical Path)
✅ Image uploads successfully
✅ Text is extracted (>0 characters)
✅ Concepts are created
✅ Questions reference image content
✅ Feedback references image content

### Complete (Thorough)
✅ All image types work
✅ Edge cases handled gracefully
✅ API endpoints respond correctly
✅ Full learning flow works
✅ No console errors
✅ Good user experience

---

## Test Results Template

```
Date: [DATE]
Tester: [NAME]

Test 1 - Upload & Extraction: [ ] Pass [ ] Fail
Test 2 - Concept Creation: [ ] Pass [ ] Fail
Test 3 - Context Questions: [ ] Pass [ ] Fail
Test 4 - Context Feedback: [ ] Pass [ ] Fail
Test 5 - Complete Flow: [ ] Pass [ ] Fail
Test 6 - Various Images: [ ] Pass [ ] Fail
Test 7 - Edge Cases: [ ] Pass [ ] Fail
Test 8 - API Endpoints: [ ] Pass [ ] Fail

Notes:
[Add any observations, issues, or suggestions]

Overall Result: [ ] All Tests Passed [ ] Some Tests Failed
```

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Document any observations
2. Consider additional features
3. Deploy to production

### If Tests Fail ❌
1. Document specific failures
2. Review error messages
3. Fix issues and retest
4. Update implementation as needed

---

**Happy Testing! 🧪**
