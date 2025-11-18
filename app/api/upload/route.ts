import { NextRequest, NextResponse } from 'next/server';
import { parseImage } from '@/lib/image-parser';
import { extractConceptsFromImage, extractConceptsFromText, generateChapterQuestions } from '@/lib/openai-vision';
import { parsePDF, extractTitle as extractPDFTitle } from '@/lib/pdf-parser';
import { parseDocx, extractDocumentTitle } from '@/lib/document-parser';
import { memoryStore } from '@/lib/memory-store';
import { generateId } from '@/lib/utils';
import { ChapterQuestion } from '@/types/concept.types';
import { requireAuth, isErrorResponse } from '@/lib/api-auth';
import { validateExtractedText, truncateTextIntelligently } from '@/lib/openai-fallback';

/**
 * Detect file type from filename extension when MIME type is unreliable
 */
function detectFileTypeFromExtension(filename: string): string | null {
  const extension = filename.toLowerCase().split('.').pop();
  
  const extensionMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
  };
  
  return extension ? extensionMap[extension] || null : null;
}

export async function POST(request: NextRequest) {
  // Authenticate the request
  const authResult = await requireAuth(request);
  if (isErrorResponse(authResult)) {
    return authResult;
  }
  
  const { user } = authResult;
  console.log('🔐 Authenticated user for upload:', user.id);

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Robust file type detection
    let fileType = file.type;
    
    // If file.type is empty, unknown, or generic, detect from extension
    if (!fileType || fileType === 'application/octet-stream' || fileType === '') {
      console.log('⚠️ File type is empty or generic, detecting from extension...');
      const detectedType = detectFileTypeFromExtension(file.name);
      if (detectedType) {
        fileType = detectedType;
        console.log('✅ Detected file type from extension:', fileType);
      }
    }
    
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validDocumentTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword' // .doc (legacy)
    ];
    
    const isImage = validImageTypes.includes(fileType);
    const isDocument = validDocumentTypes.includes(fileType);
    
    if (!isImage && !isDocument) {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileType}. Please upload an image (JPG, PNG, GIF, WebP) or document (PDF, DOCX)` },
        { status: 400 }
      );
    }

    console.log('📄 Processing file upload:', file.name, '(', file.size, 'bytes)', 'Type:', fileType);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let extractedData: any;
    
    if (isImage) {
      // Process image file
      console.log('🔄 Converting image to base64...');
      const imageDataUrl = await parseImage(buffer);
      
      console.log('🤖 Analyzing image with AI...');
      extractedData = await extractConceptsFromImage(imageDataUrl);
      
      console.log('✅ Successfully extracted', extractedData.concepts?.length || 0, 'concepts from image');
      console.log('📝 Extracted text length:', extractedData.extractedText?.length || 0, 'characters');
    } else {
      // Process document file (PDF or DOCX)
      let extractedText = '';
      let documentTitle = '';
      
      if (fileType === 'application/pdf') {
        console.log('📄 Parsing PDF document...');
        extractedText = await parsePDF(buffer);
        documentTitle = extractPDFTitle(extractedText, file.name);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        console.log('📄 Parsing DOCX document...');
        extractedText = await parseDocx(buffer);
        documentTitle = extractDocumentTitle(extractedText, file.name);
      } else {
        return NextResponse.json(
          { error: 'Unsupported document format' },
          { status: 400 }
        );
      }
      
      console.log('✅ Extracted', extractedText.length, 'characters from document');
      console.log('📚 Document title:', documentTitle);
      
      // Validate extracted text quality
      const validation = validateExtractedText(extractedText, 300);
      
      if (!validation.isValid) {
        console.error('❌ Insufficient text extracted:', validation.reason);
        return NextResponse.json(
          { 
            error: 'Insufficient text extracted from document',
            details: validation.reason,
            suggestion: 'The document may be empty, image-based, or encrypted. Please try a different document with readable text content.'
          },
          { status: 400 }
        );
      }
      
      console.log('✅ Text validation passed:', validation.length, 'characters');
      
      // Truncate text intelligently if too long
      const processedText = truncateTextIntelligently(extractedText, 20000);
      
      console.log('🤖 Analyzing document text with AI...');
      extractedData = await extractConceptsFromText(processedText, documentTitle);
      
      // Store the full extracted text for reference
      extractedData.extractedText = extractedText;
      
      console.log('✅ Successfully extracted', extractedData.concepts?.length || 0, 'concepts from document');
    }

    // Create exactly 3 chapters from the extracted concepts
    const concepts = extractedData.concepts || [];
    const chaptersToCreate = 3; // Always create exactly 3 chapters
    
    console.log(`📚 Creating ${chaptersToCreate} chapters with 5 questions each...`);
    
    const createdChapters = [];
    
    // Define difficulty levels for each chapter (always: easy, medium, hard)
    const difficultyLevels: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];
    
    // Distribute concepts across 3 chapters
    for (let i = 0; i < chaptersToCreate; i++) {
      const chapterId = generateId();
      
      // Get concepts for this chapter (distribute evenly)
      const conceptsPerChapter = Math.ceil(concepts.length / chaptersToCreate);
      const startIdx = i * conceptsPerChapter;
      const endIdx = Math.min(startIdx + conceptsPerChapter, concepts.length);
      const chapterConcepts = concepts.slice(startIdx, endIdx);
      
      // Determine chapter title and content
      const chapterTitle = chapterConcepts.length > 0 
        ? chapterConcepts[0].title 
        : `${extractedData.title || 'Course Content'} - Part ${i + 1}`;
      
      const chapterContent = chapterConcepts
        .map((c: any) => `${c.title}: ${c.content || c.description || ''}`)
        .join('\n\n');
      
      const chapterSourceText = chapterConcepts
        .map((c: any) => c.sourceText || '')
        .filter((t: string) => t.length > 0)
        .join('\n\n');
      
      // Assign difficulty: Chapter 1 = easy, Chapter 2 = medium, Chapter 3 = hard
      const difficulty = difficultyLevels[i];
      
      console.log(`📝 Generating 5 questions for chapter ${i + 1}: "${chapterTitle}"...`);
      
      // Generate 5 questions for this chapter
      const questions = await generateChapterQuestions(
        chapterTitle,
        chapterContent,
        chapterSourceText || extractedData.extractedText
      );
      
      // Add chapter ID to each question
      const questionsWithChapterId: ChapterQuestion[] = questions.map((q: any) => ({
        ...q,
        id: generateId(),
        chapterId: chapterId,
      }));
      
      console.log(`✅ Generated ${questionsWithChapterId.length} questions for chapter ${i + 1}`);
      
      // Prepare chapter summary
      const chapterSummary = chapterConcepts.length > 0 
        ? chapterConcepts[0].content?.substring(0, 200) || 'Learn about this important concept.'
        : 'Concepts extracted from your uploaded image.';
      
      // Translate title and summary to French
      console.log(`🌐 Translating chapter ${i + 1} to French...`);
      let frenchTitle = chapterTitle;
      let frenchSummary = chapterSummary;
      
      try {
        // Translate title
        const titleResponse = await fetch(`${request.url.split('/api')[0]}/api/translate/content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: chapterTitle,
            targetLanguage: 'FR',
            contentType: 'title',
          }),
        });
        
        if (titleResponse.ok) {
          const titleData = await titleResponse.json();
          frenchTitle = titleData.translated || chapterTitle;
        }
        
        // Translate summary
        const summaryResponse = await fetch(`${request.url.split('/api')[0]}/api/translate/content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: chapterSummary,
            targetLanguage: 'FR',
            contentType: 'description',
          }),
        });
        
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          frenchSummary = summaryData.translated || chapterSummary;
        }
        
        console.log(`✅ Chapter ${i + 1} translated to French`);
      } catch (error) {
        console.error(`⚠️ Translation failed for chapter ${i + 1}, using English:`, error);
      }
      
      // Store chapter in memory with questions and both language versions
      await memoryStore.addChapter({
        id: chapterId,
        title: chapterTitle, // Backward compatibility
        summary: chapterSummary, // Backward compatibility
        englishTitle: chapterTitle,
        englishDescription: chapterSummary,
        frenchTitle: frenchTitle,
        frenchDescription: frenchSummary,
        pdfText: '', // No PDF text for images
        extractedText: extractedData.extractedText || '',
        difficulty: difficulty as 'easy' | 'medium' | 'hard',
        orderIndex: i,
        questions: questionsWithChapterId,
        sourceText: chapterSourceText || extractedData.extractedText,
        createdAt: new Date(),
      }, user.id);
      
      // Initialize progress for this chapter
      await memoryStore.initializeChapterProgress(chapterId, user.id);
      
      // Store concepts in memory (for backward compatibility)
      for (const concept of chapterConcepts) {
        await memoryStore.addConcept({
          id: generateId(),
          chapterId: chapterId,
          title: concept.title,
          description: concept.content || concept.description || '',
          difficulty: concept.difficulty || 'medium',
          orderIndex: chapterConcepts.indexOf(concept),
          sourceText: concept.sourceText || '',
        }, user.id);
      }
      
      createdChapters.push({
        id: chapterId,
        title: chapterTitle,
        difficulty: difficulty,
        questionCount: questionsWithChapterId.length,
      });
    }
    
    console.log(`🎉 Successfully created ${createdChapters.length} chapters with questions!`);

    // Return the first chapter ID to redirect to
    const firstChapterId = createdChapters[0].id;

    return NextResponse.json({
      success: true,
      chapterId: firstChapterId,
      title: extractedData.title || 'Course Content',
      chapters: createdChapters,
      totalQuestions: createdChapters.reduce((sum, ch) => sum + ch.questionCount, 0),
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
