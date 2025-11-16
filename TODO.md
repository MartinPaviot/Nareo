# Image Text Extraction & Prompt Enhancement - Implementation TODO

## Phase 1: Extract and Store Raw Text from Images ✅
- [x] Update `lib/openai-vision.ts` - Add `extractTextFromImage()` function
- [x] Update `lib/openai-vision.ts` - Modify `extractConceptsFromImage()` to return text
- [x] Update `types/database.types.ts` - Add text fields to types
- [x] Update `lib/memory-store.ts` - Add text storage capabilities

## Phase 2: Update Upload Process ✅
- [x] Update `app/api/upload/route.ts` - Store extracted text

## Phase 3: Enhance Question Generation ✅
- [x] Update `lib/openai-vision.ts` - Enhance `generateQuizQuestion()` with source text
- [x] Update `app/api/chat/question/route.ts` - Pass source text to generation

## Phase 4: Enhance Answer Evaluation ✅
- [x] Update `lib/openai-vision.ts` - Enhance `evaluateAnswer()` with source text
- [x] Update `app/api/chat/evaluate/route.ts` - Pass source text to evaluation

## Testing 🧪
- [ ] Test image upload with text extraction
- [ ] Test question generation with context
- [ ] Test answer evaluation with context
- [ ] Test with various image types

---
**Status**: ✅ Implementation Complete - Ready for Testing
**Last Updated**: Now

## Summary of Changes:

### 1. **Text Extraction & Storage**
   - Added `extractTextFromImage()` function for OCR
   - Modified `extractConceptsFromImage()` to return both concepts and raw text
   - Added `extractedText` field to Chapter type
   - Added `sourceText` field to Concept type

### 2. **Enhanced Upload Process**
   - Upload route now stores extracted text in chapters
   - Each concept stores its relevant source text excerpt

### 3. **Context-Aware Question Generation**
   - `generateQuizQuestion()` now accepts optional `sourceText` parameter
   - Questions are generated based on actual content from images
   - More accurate and contextual questions

### 4. **Context-Aware Answer Evaluation**
   - `evaluateAnswer()` now accepts optional `sourceText` parameter
   - Feedback references original source material
   - More accurate evaluation based on actual content

### 5. **Complete Integration**
   - Question generation route passes source text
   - Evaluation route passes source text
   - Entire learning journey enhanced with original content
