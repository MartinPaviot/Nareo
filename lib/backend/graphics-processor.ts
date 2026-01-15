/**
 * Graphics Processor - Extract and analyze pedagogical graphics
 *
 * Integrates Mistral OCR + Claude Vision into the course pipeline
 * to automatically extract, analyze, and store graphics with metadata.
 */

import { getServiceSupabase } from '@/lib/supabase';
import { extractImagesFromPDF } from '@/lib/pdf-ocr-server';
import { analyzeGraphicsBatch, type GraphicAnalysis } from '@/lib/image-analysis';

/**
 * Configuration for graphics processing
 */
export const GRAPHICS_CONFIG = {
  maxImagesPerCourse: 50, // Maximum images to extract
  maxToAnalyze: 50, // Maximum to analyze with Claude - increased to capture all graphics
  maxPerPage: 10, // Limit per page (avoid false positives on decorative pages)
  minConfidence: 0.3, // Minimum threshold to include a graphic
  priorityTypes: [ // Types to always include even if confidence is lower
    'supply_demand_curve',
    'equilibrium_graph',
    'surplus_graph',
    'elasticity_graph',
    'shift_graph',
    'histogram',
    'pie_chart',
    'line_chart',
    'table',
    'formula_visual',
    'concept_map',
  ],
  storageBasePath: 'course-graphics',
};

/**
 * Result of graphics processing
 */
export interface GraphicsProcessingResult {
  totalImages: number;
  analyzed: number;
  stored: number;
  skipped: number;
  errors: number;
}

/**
 * Convert language code to full language name for the vision prompt
 */
function getLanguageName(languageCode: string): string {
  const languageMap: Record<string, string> = {
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish',
    'it': 'Italian',
    'pt': 'Portuguese',
  };
  return languageMap[languageCode.toLowerCase()] || 'English';
}

/**
 * Process graphics from a PDF document
 *
 * Steps:
 * 1. Extract images with Mistral OCR (includeImageBase64: true)
 * 2. Analyze subset with Claude Vision
 * 3. Upload images to Supabase Storage
 * 4. Store metadata in course_graphics table
 *
 * @param courseId - Course UUID
 * @param userId - User UUID (or 'guest')
 * @param buffer - PDF file buffer
 * @param filename - Original filename
 * @param contentLanguage - Language code for descriptions (default: 'en')
 * @returns Processing statistics
 */
export async function processDocumentGraphics(
  courseId: string,
  userId: string | null,
  buffer: Buffer,
  filename: string,
  contentLanguage: string = 'en'
): Promise<GraphicsProcessingResult> {
  console.log(`\n🖼️ [Graphics Processor] Starting for course ${courseId}`);

  const result: GraphicsProcessingResult = {
    totalImages: 0,
    analyzed: 0,
    stored: 0,
    skipped: 0,
    errors: 0,
  };

  const admin = getServiceSupabase();

  try {
    // ========================================================================
    // STEP 1: Extract images with Mistral OCR
    // ========================================================================
    console.log('📄 [Step 1/4] Extracting images with Mistral OCR...');

    const images = await extractImagesFromPDF(buffer, filename);
    result.totalImages = images.length;

    if (images.length === 0) {
      console.log('✅ No images found in document');
      return result;
    }

    console.log(`   Found ${images.length} images`);

    // Limit total images (cost control)
    const imagesToProcess = images.slice(0, GRAPHICS_CONFIG.maxImagesPerCourse);
    if (images.length > GRAPHICS_CONFIG.maxImagesPerCourse) {
      result.skipped = images.length - GRAPHICS_CONFIG.maxImagesPerCourse;
      console.log(`   ⚠️ Limiting to ${GRAPHICS_CONFIG.maxImagesPerCourse} images (${result.skipped} skipped)`);
    }

    // ========================================================================
    // STEP 2: Analyze graphics with Claude Vision
    // ========================================================================
    console.log('\n🔍 [Step 2/4] Analyzing graphics with Claude Vision...');

    // Select images to analyze (first N)
    const imagesToAnalyze = imagesToProcess.slice(0, GRAPHICS_CONFIG.maxToAnalyze);

    // Convert to format expected by analyzeGraphicsBatch
    // OpenAI Vision API requires full data URL format
    const imagesForAnalysis = imagesToAnalyze.map(img => ({
      pageNum: img.pageNum,
      imageId: img.imageId,
      base64Data: `data:image/jpeg;base64,${img.imageBuffer.toString('base64')}`,
    }));

    const targetLanguage = getLanguageName(contentLanguage);
    const analyses = await analyzeGraphicsBatch(imagesForAnalysis, 20, targetLanguage);
    result.analyzed = analyses.size;

    console.log(`   Analyzed ${analyses.size}/${imagesToAnalyze.length} graphics (language: ${targetLanguage})`);

    // ========================================================================
    // STEP 3: Upload images to Supabase Storage
    // ========================================================================
    console.log('\n💾 [Step 3/4] Uploading images to Supabase Storage...');

    for (const img of imagesToProcess) {
      try {
        // Build storage path: {userId}/{courseId}/{imageId}
        const storagePath = `${userId || 'guest'}/${courseId}/${img.imageId}`;

        // Upload to course-graphics bucket
        const { error: uploadError } = await admin.storage
          .from(GRAPHICS_CONFIG.storageBasePath)
          .upload(storagePath, img.imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true, // Overwrite if exists
          });

        if (uploadError) {
          console.error(`   ❌ Failed to upload ${img.imageId}:`, uploadError.message);
          result.errors++;
          continue;
        }

        console.log(`   ✅ Uploaded ${img.imageId} (page ${img.pageNum})`);

        // ====================================================================
        // STEP 4: Store metadata in database
        // ====================================================================

        const analysis = analyses.get(img.imageId);

        // Store graphic even without analysis (can be analyzed later)
        // Skip only if analysis exists but confidence is too low
        // UNLESS it's a priority type (always keep those)
        const isPriorityType = analysis?.type && GRAPHICS_CONFIG.priorityTypes.includes(analysis.type);
        if (analysis && analysis.confidence < GRAPHICS_CONFIG.minConfidence && !isPriorityType) {
          result.skipped++;
          console.log(`   ⚠️ Skipped ${img.imageId} (low confidence: ${analysis.confidence})`);
          continue;
        }

        // Insert into course_graphics table
        const { error: dbError } = await admin.from('course_graphics').insert({
          course_id: courseId,
          user_id: userId,
          page_number: img.pageNum,
          image_id: img.imageId,
          storage_path: storagePath,

          // Analysis data (nullable if analysis failed)
          graphic_type: analysis?.type || null,
          confidence: analysis?.confidence || null,
          description: analysis?.description || null,
          elements: analysis?.elements || null,
          suggestions: analysis?.suggestions || null,

          // File metadata
          width: img.width || 0,
          height: img.height || 0,
          file_size: img.imageBuffer.length,
          mime_type: 'image/jpeg',
        });

        if (dbError) {
          console.error(`   ❌ Failed to store metadata for ${img.imageId}:`, dbError.message);
          result.errors++;
          continue;
        }

        result.stored++;
        if (analysis) {
          console.log(`   ✅ Stored metadata for ${img.imageId} (${analysis.type})`);
        } else {
          console.log(`   ✅ Stored ${img.imageId} (will analyze later)`);
        }

      } catch (error: any) {
        console.error(`   ❌ Error processing ${img.imageId}:`, error.message);
        result.errors++;
      }
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('\n📊 [Graphics Processing Summary]');
    console.log(`   Total images found: ${result.totalImages}`);
    console.log(`   Analyzed with Claude: ${result.analyzed}`);
    console.log(`   Stored in database: ${result.stored}`);
    console.log(`   Skipped (low confidence/limit): ${result.skipped}`);
    console.log(`   Errors: ${result.errors}`);

    return result;

  } catch (error: any) {
    console.error('❌ [Graphics Processor] Fatal error:', error.message);
    throw error;
  }
}

/**
 * Re-analyze graphics for a course
 * Useful if Claude prompt is improved or if analysis failed initially
 *
 * @param courseId - Course UUID
 * @param contentLanguage - Language code for descriptions (default: 'en')
 * @returns Number of graphics re-analyzed
 */
export async function reanalyzeGraphics(courseId: string, contentLanguage: string = 'en'): Promise<number> {
  const targetLanguage = getLanguageName(contentLanguage);
  console.log(`\n🔄 [Re-analyze] Starting for course ${courseId} (language: ${targetLanguage})`);

  const admin = getServiceSupabase();

  // Fetch existing graphics without analysis or low confidence
  // Include: confidence < 0.9, confidence IS NULL, or elements IS NULL
  const { data: graphics, error } = await admin
    .from('course_graphics')
    .select('*')
    .eq('course_id', courseId)
    .or('confidence.is.null,confidence.lt.0.9,elements.is.null');

  if (error) {
    console.error('❌ Error fetching graphics:', error);
    return 0;
  }

  if (!graphics || graphics.length === 0) {
    console.log('✅ No graphics to re-analyze');
    return 0;
  }

  console.log(`   Found ${graphics.length} graphics to re-analyze`);

  // Download images and re-analyze
  const imagesForAnalysis = [];

  for (const graphic of graphics) {
    // Download image from storage
    const { data: imageData, error: downloadError } = await admin.storage
      .from(GRAPHICS_CONFIG.storageBasePath)
      .download(graphic.storage_path);

    if (downloadError || !imageData) {
      console.error(`   ❌ Failed to download ${graphic.image_id}`);
      continue;
    }

    const buffer = Buffer.from(await imageData.arrayBuffer());
    imagesForAnalysis.push({
      pageNum: graphic.page_number,
      imageId: graphic.image_id,
      base64Data: `data:image/jpeg;base64,${buffer.toString('base64')}`, // Add data URL prefix for OpenAI Vision
      graphicDbId: graphic.id,
    });
  }

  // Analyze with Claude
  const analyses = await analyzeGraphicsBatch(imagesForAnalysis, 20, targetLanguage);

  // Update database with new analyses
  let updated = 0;
  for (const [imageId, analysis] of analyses) {
    const graphic = graphics.find(g => g.image_id === imageId);
    if (!graphic) continue;

    const { error: updateError } = await admin
      .from('course_graphics')
      .update({
        graphic_type: analysis.type,
        confidence: analysis.confidence,
        description: analysis.description,
        elements: analysis.elements,
        suggestions: analysis.suggestions,
      })
      .eq('id', graphic.id);

    if (updateError) {
      console.error(`   ❌ Failed to update ${imageId}`);
      continue;
    }

    updated++;
    console.log(`   ✅ Updated ${imageId} (${analysis.type})`);
  }

  console.log(`\n✅ Re-analyzed ${updated}/${graphics.length} graphics`);
  return updated;
}

/**
 * Delete graphics for a course
 * Useful for cleanup or re-processing
 *
 * @param courseId - Course UUID
 * @returns Number of graphics deleted
 */
export async function deleteGraphics(courseId: string): Promise<number> {
  console.log(`\n🗑️ [Delete Graphics] Starting for course ${courseId}`);

  const admin = getServiceSupabase();

  // Fetch all graphics for course
  const { data: graphics, error } = await admin
    .from('course_graphics')
    .select('*')
    .eq('course_id', courseId);

  if (error || !graphics || graphics.length === 0) {
    console.log('✅ No graphics to delete');
    return 0;
  }

  // Delete from storage
  const pathsToDelete = graphics.map(g => g.storage_path);

  const { error: storageError } = await admin.storage
    .from(GRAPHICS_CONFIG.storageBasePath)
    .remove(pathsToDelete);

  if (storageError) {
    console.error('❌ Error deleting from storage:', storageError.message);
  }

  // Delete from database (cascade will handle this when course is deleted)
  const { error: dbError } = await admin
    .from('course_graphics')
    .delete()
    .eq('course_id', courseId);

  if (dbError) {
    console.error('❌ Error deleting from database:', dbError.message);
    return 0;
  }

  console.log(`✅ Deleted ${graphics.length} graphics`);
  return graphics.length;
}
