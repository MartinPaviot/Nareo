# Document Upload Implementation Guide

## Overview

The upload API has been successfully extended to support **PDF** and **Word (DOCX)** document submissions in addition to images. This allows users to upload course materials in multiple formats.

## Supported File Types

### Images
- JPEG/JPG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- GIF (`.gif`)
- WebP (`.webp`)

### Documents
- PDF (`.pdf`)
- Word Document (`.docx`)
- Legacy Word (`.doc`)

## Implementation Details

### 1. New Dependencies

**Installed Packages:**
- `mammoth` - For parsing Word/DOCX documents
- `pdf-parse` - Already installed, now actively used for PDF parsing

### 2. New Files Created

#### `lib/document-parser.ts`
Handles Word document parsing with the following functions:
- `parseDocx(buffer)` - Extracts text from DOCX files
- `cleanDocumentText(text)` - Cleans and normalizes extracted text
- `extractDocumentTitle(text, filename)` - Extracts document title
- `splitIntoSections(text, maxSections)` - Splits document into logical sections

#### `lib/pdf-parser.ts` (Updated)
Updated from mock implementation to real PDF parsing:
- `parsePDF(buffer)` - Extracts text from PDF files using pdf-parse
- `cleanPDFText(text)` - Cleans PDF text artifacts
- `extractTitle(text, filename)` - Extracts PDF title

### 3. Updated Files

#### `lib/openai-vision.ts`
Added new function for text analysis:
- `extractConceptsFromText(text, title?)` - Analyzes plain text from documents and extracts structured learning concepts (similar to image analysis but for text)

#### `app/api/upload/route.ts`
Enhanced to handle multiple file types:
- Validates file type (image or document)
- Routes to appropriate parser based on file type
- Processes images with GPT-4 Vision
- Processes documents with text extraction + GPT-4 analysis
- Creates 3 chapters with 5 questions each (consistent across all file types)

## How It Works

### Upload Flow

```
1. User uploads file
   ↓
2. API validates file type
   ↓
3a. IF IMAGE:                    3b. IF DOCUMENT:
    - Convert to base64              - Extract text (PDF/DOCX parser)
    - GPT-4 Vision analysis          - Extract title
    - Extract concepts               - GPT-4 text analysis
                                     - Extract concepts
   ↓                                ↓
4. Create 3 chapters (easy, medium, hard)
   ↓
5. Generate 5 questions per chapter
   ↓
6. Store in memory
   ↓
7. Return first chapter ID
```

### Chapter Creation

For all file types:
- **3 chapters** are created automatically
- **Difficulty progression**: Easy → Medium → Hard
- **5 questions per chapter**:
  - Questions 1-3: Multiple choice (10 points each)
  - Question 4: Short answer (35 points)
  - Question 5: Reflective (35 points)

### Text Extraction Quality

**PDF Documents:**
- Extracts all text content
- Removes page numbers and headers/footers
- Cleans PDF artifacts
- Preserves document structure

**Word Documents:**
- Extracts raw text using mammoth library
- Preserves formatting where possible
- Handles both .docx and legacy .doc formats
- Cleans special characters

## API Usage

### Endpoint
```
POST /api/upload
```

### Request
```typescript
FormData {
  file: File // Image, PDF, or DOCX file
}
```

### Response (Success)
```json
{
  "success": true,
  "chapterId": "chapter-id-123",
  "title": "Document Title",
  "chapters": [
    {
      "id": "chapter-1",
      "title": "Chapter 1 Title",
      "difficulty": "easy",
      "questionCount": 5
    },
    {
      "id": "chapter-2",
      "title": "Chapter 2 Title",
      "difficulty": "medium",
      "questionCount": 5
    },
    {
      "id": "chapter-3",
      "title": "Chapter 3 Title",
      "difficulty": "hard",
      "questionCount": 5
    }
  ],
  "totalQuestions": 15
}
```

### Response (Error)
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

## Error Handling

The implementation includes comprehensive error handling:

1. **File Type Validation**: Rejects unsupported file types
2. **Parsing Errors**: Catches and reports PDF/DOCX parsing failures
3. **AI Analysis Errors**: Falls back to default concepts if OpenAI fails
4. **Question Generation Errors**: Uses fallback questions if generation fails

## Testing

### Test with PDF
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test-sample.pdf"
```

### Test with DOCX
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@sample-document.docx"
```

### Test with Image
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@sample-image.jpg"
```

## Benefits

1. **Flexibility**: Users can upload course materials in their preferred format
2. **Consistency**: All file types produce the same structured output (3 chapters, 5 questions each)
3. **Quality**: Real text extraction from documents provides better context for AI analysis
4. **Reliability**: Fallback mechanisms ensure the system works even if parsing fails

## Future Enhancements

Potential improvements:
1. Support for more document formats (RTF, TXT, etc.)
2. Better section detection in long documents
3. Image extraction from PDFs
4. Table and diagram recognition
5. Multi-language document support
6. Batch upload support

## Technical Notes

### PDF Parsing
- Uses `pdf-parse` library with canvas support
- Requires native dependencies (already installed)
- Works with most standard PDF formats
- May struggle with scanned PDFs (OCR not included)

### DOCX Parsing
- Uses `mammoth` library
- Converts DOCX to plain text
- Preserves basic structure
- Does not extract images or complex formatting

### AI Analysis
- Uses GPT-4 for concept extraction
- Analyzes up to 8000 characters of text
- Generates structured JSON output
- Falls back to default concepts on failure

## Troubleshooting

### PDF Parsing Fails
- Ensure the PDF is not password-protected
- Check if the PDF contains actual text (not just images)
- Verify canvas dependencies are installed

### DOCX Parsing Fails
- Ensure the file is a valid .docx format
- Check file is not corrupted
- Verify mammoth package is installed

### No Concepts Extracted
- Check OpenAI API key is configured
- Verify the document contains meaningful educational content
- Review console logs for specific errors

## Conclusion

The document upload feature is now fully functional and supports images, PDFs, and Word documents. The implementation maintains consistency across all file types while providing robust error handling and fallback mechanisms.
