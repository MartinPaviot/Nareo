/**
 * PDF Image Extractor
 * Extracts embedded images from PDFs using pdfjs-dist with legacy build
 * Uses GPT-4 Vision for filtering educational content
 */

import { getServiceSupabase } from '@/lib/supabase';
import { openai } from './openai-vision';
import { LLM_CONFIG } from './llm/index';

// Helper for retrying API calls with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 5000
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error?.status === 429 && attempt < maxRetries) {
        const retryAfter = error?.headers?.get?.('retry-after-ms');
        const delay = retryAfter ? parseInt(retryAfter) + 1000 : baseDelay * Math.pow(2, attempt);
        console.log(`🔄 Rate limit, retrying in ${Math.round(delay / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

export interface ExtractedImage {
  index: number;
  pageNumber: number;
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: 'image/png' | 'image/jpeg';
}

export interface UploadedImage {
  index: number;
  pageNumber: number;
  url: string;
  width: number;
  height: number;
}

export interface AnalyzedImage extends UploadedImage {
  description: string;
  type: 'graph' | 'diagram' | 'table' | 'chart' | 'illustration' | 'photo' | 'decorative';
  title?: string;
  isEducational: boolean;
}

/**
 * Extract embedded images from PDF
 *
 * NOTE: Image extraction is temporarily disabled due to pdfjs-dist worker
 * incompatibility with Next.js Turbopack. The worker cannot be loaded in
 * the serverless environment, causing route compilation failures.
 *
 * TODO: Re-enable when a compatible solution is found (e.g., pdf2pic,
 * server-side puppeteer, or a working pdfjs-dist configuration)
 */
export async function extractImagesFromPDF(
  _buffer: Buffer,
  _options: {
    maxImages?: number;
    minWidth?: number;
    minHeight?: number;
  } = {}
): Promise<ExtractedImage[]> {
  // Image extraction disabled - return empty array
  // This allows note generation to work without images
  console.log('🖼️ Image extraction is currently disabled (pdfjs-dist worker incompatibility with Turbopack)');
  return [];
}

/**
 * Upload extracted images to Supabase Storage
 */
export async function uploadImagesToStorage(
  images: ExtractedImage[],
  courseId: string,
  userId: string
): Promise<UploadedImage[]> {
  const supabase = getServiceSupabase();
  const uploadedImages: UploadedImage[] = [];

  console.log(`📤 Uploading ${images.length} images to Supabase Storage...`);

  for (const image of images) {
    const ext = image.mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const fileName = `${userId}/${courseId}/img-${image.index}.${ext}`;

    try {
      const { error } = await supabase.storage
        .from('note-images')
        .upload(fileName, image.buffer, {
          contentType: image.mimeType,
          upsert: true,
        });

      if (error) {
        console.error(`❌ Failed to upload image ${image.index}:`, error.message);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('note-images')
        .getPublicUrl(fileName);

      uploadedImages.push({
        index: image.index,
        pageNumber: image.pageNumber,
        url: urlData.publicUrl,
        width: image.width,
        height: image.height,
      });

      console.log(`✅ Uploaded image ${image.index}: ${urlData.publicUrl}`);
    } catch (err: any) {
      console.error(`❌ Error uploading image ${image.index}:`, err.message);
    }
  }

  console.log(`📤 Successfully uploaded ${uploadedImages.length}/${images.length} images`);
  return uploadedImages;
}

/**
 * Analyze images with GPT-4 Vision to filter educational content
 */
export async function analyzeImagesWithVision(
  images: UploadedImage[],
  language: string = 'FR'
): Promise<AnalyzedImage[]> {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

  console.log(`🔬 Analyzing ${images.length} images with GPT-4 Vision...`);

  const analyzedImages: AnalyzedImage[] = [];
  const BATCH_SIZE = 3; // Reduced to avoid rate limits

  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (image) => {
      try {
        // Use retry wrapper for rate limit handling
        const response = await withRetry(() => openai.chat.completions.create({
          model: LLM_CONFIG.models.vision,
          messages: [
            {
              role: 'system',
              content: `You analyze images from educational documents to determine if they are useful for study notes.

Your task:
1. Determine the TYPE: graph, diagram, table, chart, illustration, photo, or decorative
2. Determine if it's EDUCATIONAL (useful for studying) or just decorative/logos/icons
3. If educational, provide a TITLE and DESCRIPTION

IMPORTANT: Be GENEROUS about what counts as "educational" - when in doubt, include it:
- Graphs showing data, trends, concepts → educational
- Diagrams explaining processes, systems, relationships → educational
- Tables with data → educational
- Charts visualizing information → educational
- Illustrations that explain concepts → educational
- Mathematical figures, geometric shapes → educational
- Flowcharts, schemas, mind maps → educational
- Any visual that helps understand a concept → educational

ONLY exclude these:
- University/company logos → NOT educational
- Decorative borders, backgrounds → NOT educational
- Generic stock photos of people → NOT educational
- Pure icons without context → NOT educational

Respond in ${languageName} with this JSON:
{
  "type": "graph|diagram|table|chart|illustration|photo|decorative",
  "isEducational": true/false,
  "title": "Short descriptive title (only if educational)",
  "description": "2-3 sentence description explaining what the image shows (only if educational)"
}`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: image.url,
                    detail: 'high',
                  },
                },
                {
                  type: 'text',
                  text: 'Analyze this image. Is it educational content useful for study notes?',
                },
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 400,
          response_format: { type: 'json_object' },
        }));

        const content = response.choices[0].message.content;
        if (!content) {
          throw new Error('No response from Vision API');
        }

        const analysis = JSON.parse(content);

        return {
          ...image,
          description: analysis.description || '',
          type: analysis.type || 'decorative',
          title: analysis.title,
          isEducational: analysis.isEducational === true,
        } as AnalyzedImage;

      } catch (err: any) {
        console.error(`❌ Failed to analyze image ${image.index}:`, err.message);
        return {
          ...image,
          description: '',
          type: 'decorative' as const,
          isEducational: false,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    analyzedImages.push(...batchResults);

    console.log(`✅ Analyzed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(images.length / BATCH_SIZE)}`);
  }

  // Filter to only educational images
  const educationalImages = analyzedImages.filter(img => img.isEducational);
  console.log(`🔬 Analysis complete: ${educationalImages.length}/${analyzedImages.length} educational images`);

  return educationalImages;
}

/**
 * Generate Markdown for images to append to notes
 */
export function generateImageMarkdown(images: AnalyzedImage[], language: string = 'FR'): string {
  if (images.length === 0) {
    return '';
  }

  const sectionTitle = language === 'FR' ? 'Graphiques et Illustrations' :
                       language === 'DE' ? 'Grafiken und Illustrationen' :
                       'Graphics and Illustrations';

  const markdown = images.map((image, idx) => {
    const title = image.title || `Figure ${idx + 1}`;

    return `### ${title}

![${title}](${image.url})

${image.description}
`;
  }).join('\n---\n\n');

  return `\n\n---\n\n## ${sectionTitle}\n\n${markdown}`;
}

/**
 * Extract, upload, and analyze images with GPT-4 Vision
 * Returns only EDUCATIONAL images (graphs, diagrams, charts) with descriptions
 * Filters out logos, decorations, title pages, etc.
 */
export async function extractAndUploadImages(
  pdfBuffer: Buffer,
  courseId: string,
  userId: string,
  language: string = 'FR',
  onProgress?: (message: string, progress: number) => void
): Promise<AnalyzedImage[]> {
  onProgress?.('Extracting images from PDF...', 5);

  // Step 1: Extract embedded images from PDF
  // Lower thresholds to capture more graphics
  const extractedImages = await extractImagesFromPDF(pdfBuffer, {
    maxImages: 40,
    minWidth: 100,
    minHeight: 100,
  });

  if (extractedImages.length === 0) {
    console.log('📭 No embedded images found in PDF');
    return [];
  }

  onProgress?.(`Uploading ${extractedImages.length} images...`, 30);

  // Step 2: Upload to Supabase Storage
  const uploadedImages = await uploadImagesToStorage(extractedImages, courseId, userId);

  if (uploadedImages.length === 0) {
    console.log('📭 No images uploaded');
    return [];
  }

  onProgress?.(`Analyzing ${uploadedImages.length} images with AI...`, 50);

  // Step 3: Analyze with GPT-4 Vision to filter and describe
  const analyzedImages = await analyzeImagesWithVision(uploadedImages, language);

  console.log(`✅ ${analyzedImages.length}/${uploadedImages.length} educational images found`);
  return analyzedImages;
}

/**
 * Generate image reference map for note generation
 * Maps page numbers to image URLs for inline insertion
 */
export function generateImageReferences(images: UploadedImage[]): Map<number, string[]> {
  const pageToImages = new Map<number, string[]>();

  for (const img of images) {
    const existing = pageToImages.get(img.pageNumber) || [];
    existing.push(img.url);
    pageToImages.set(img.pageNumber, existing);
  }

  return pageToImages;
}

/**
 * Generate inline image context for the transcription prompt
 * This tells the AI which images are available and WHERE to place them
 * Uses ANALYZED images with real descriptions from GPT-4 Vision
 */
export function generateImageContext(images: AnalyzedImage[]): string {
  if (images.length === 0) return '';

  const lines: string[] = [
    '',
    '=== IMAGES ÉDUCATIVES DISPONIBLES ===',
    '',
    'INSTRUCTIONS CRITIQUES POUR LE PLACEMENT DES IMAGES:',
    '',
    '1. ANALYSE le contenu de chaque image (description ci-dessous)',
    '2. IDENTIFIE le concept/section de la note qui correspond à cette image',
    '3. INSÈRE l\'image IMMÉDIATEMENT APRÈS avoir expliqué le concept qu\'elle illustre',
    '4. NE PAS regrouper les images à la fin - les disperser dans le texte',
    '',
    'EXEMPLE DE BON PLACEMENT:',
    '```',
    '## La courbe de demande',
    'La courbe de demande représente la relation entre le prix et la quantité demandée...',
    '',
    '![Courbe de demande](url)',
    '*Figure: La courbe de demande montre la relation inverse prix-quantité*',
    '',
    'On observe que lorsque le prix augmente...',
    '```',
    '',
    '---',
    'LISTE DES IMAGES À PLACER:',
    ''
  ];

  // Group images by their likely topic based on description
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const title = img.title || `Figure ${i + 1}`;
    const typeLabel = img.type === 'graph' ? 'Graphique' :
                      img.type === 'diagram' ? 'Schéma' :
                      img.type === 'table' ? 'Tableau' :
                      img.type === 'chart' ? 'Graphique' :
                      img.type === 'illustration' ? 'Illustration' : 'Figure';

    lines.push(`${i + 1}. ${typeLabel.toUpperCase()}: "${title}"`);
    lines.push(`   📝 Description: ${img.description}`);
    lines.push(`   🎯 À PLACER: Après avoir expliqué le concept illustré par cette image`);
    lines.push(`   📋 Code Markdown: ![${title}](${img.url})`);
    lines.push('');
  }

  lines.push('---');
  lines.push('RÈGLES DE PLACEMENT:');
  lines.push('');
  lines.push('✅ BON: Image placée juste après l\'explication du concept');
  lines.push('❌ MAUVAIS: Toutes les images regroupées à la fin');
  lines.push('❌ MAUVAIS: Images dans une section "Annexes" ou "Figures"');
  lines.push('');
  lines.push('Pour CHAQUE image:');
  lines.push('1. Lis sa description pour comprendre ce qu\'elle montre');
  lines.push('2. Trouve l\'endroit dans ta note où tu parles de ce sujet');
  lines.push('3. Insère l\'image à cet endroit précis');
  lines.push('4. Ajoute une légende en italique: *Figure: description courte*');
  lines.push('');
  lines.push('IMPORTANT: Copie EXACTEMENT le code Markdown fourni (![titre](url))');
  lines.push('');

  return lines.join('\n');
}

/**
 * Full pipeline: Extract → Upload → Analyze → Generate Markdown (LEGACY - for appendix mode)
 */
export async function processImagesForNote(
  pdfBuffer: Buffer,
  _pageTexts: Map<number, string>, // Kept for API compatibility
  courseId: string,
  userId: string,
  language: string = 'FR',
  onProgress?: (message: string, progress: number) => void
): Promise<{ markdown: string; images: AnalyzedImage[] }> {

  onProgress?.('Extracting images from PDF...', 5);

  // Step 1: Extract embedded images from PDF
  const extractedImages = await extractImagesFromPDF(pdfBuffer, {
    maxImages: 25,
    minWidth: 150,
    minHeight: 150,
  });

  if (extractedImages.length === 0) {
    console.log('📭 No embedded images found in PDF');
    return { markdown: '', images: [] };
  }

  onProgress?.(`Uploading ${extractedImages.length} images...`, 20);

  // Step 2: Upload to Supabase Storage
  const uploadedImages = await uploadImagesToStorage(extractedImages, courseId, userId);

  if (uploadedImages.length === 0) {
    console.log('📭 No images uploaded successfully');
    return { markdown: '', images: [] };
  }

  onProgress?.(`Analyzing ${uploadedImages.length} images with AI...`, 40);

  // Step 3: Analyze with GPT-4 Vision (filters non-educational images)
  const educationalImages = await analyzeImagesWithVision(uploadedImages, language);

  if (educationalImages.length === 0) {
    console.log('📭 No educational images found');
    return { markdown: '', images: [] };
  }

  onProgress?.('Generating image section...', 60);

  // Step 4: Generate Markdown
  const markdown = generateImageMarkdown(educationalImages, language);

  console.log(`✅ Image processing complete: ${educationalImages.length} educational images`);

  return { markdown, images: educationalImages };
}
