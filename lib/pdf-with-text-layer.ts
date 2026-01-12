/**
 * PDF generation with visual fidelity AND selectable text
 *
 * Approach: Generate PDF as image (preserves exact look including formulas)
 * with an invisible text layer for selection/search (may not be perfectly aligned)
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import html2canvas from 'html2canvas-pro';

const PAGE_WIDTH_PT = 595.28;
const PAGE_HEIGHT_PT = 841.89;

interface TextRect {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
}

function extractTextRects(container: HTMLElement): TextRect[] {
  const rects: TextRect[] = [];
  const containerRect = container.getBoundingClientRect();

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const textContent = node.textContent;
    if (!textContent || !textContent.trim()) continue;

    const parent = node.parentElement;
    if (!parent) continue;

    const style = window.getComputedStyle(parent);
    if (style.display === 'none' || style.visibility === 'hidden') continue;

    const fontSize = parseFloat(style.fontSize) || 16;

    const range = document.createRange();
    range.selectNodeContents(node);
    const clientRects = range.getClientRects();

    const fullText = textContent.trim();

    if (clientRects.length === 1) {
      const rect = clientRects[0];
      if (rect.width > 0 && rect.height > 0) {
        rects.push({
          text: fullText,
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
          fontSize,
        });
      }
    } else if (clientRects.length > 1) {
      // Multiple lines - split text proportionally
      const totalWidth = Array.from(clientRects).reduce((sum, r) => sum + r.width, 0);
      let charIndex = 0;

      for (const rect of clientRects) {
        if (rect.width <= 0 || rect.height <= 0) continue;

        const proportion = rect.width / totalWidth;
        const charsForLine = Math.max(1, Math.round(fullText.length * proportion));
        const lineText = fullText.slice(charIndex, charIndex + charsForLine).trim();
        charIndex += charsForLine;

        if (lineText) {
          rects.push({
            text: lineText,
            left: rect.left - containerRect.left,
            top: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height,
            fontSize,
          });
        }
      }
    }
  }

  return rects;
}

// Sanitize text for PDF (remove unsupported characters)
function sanitizeForPDF(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\x20-\x7E]/g, ' ')   // Replace non-printable ASCII with space
    .replace(/\s+/g, ' ')            // Collapse multiple spaces
    .trim();
}

export async function generatePDFWithTextLayer(
  element: HTMLElement,
  filename: string,
  options: { margin?: number; scale?: number } = {}
): Promise<void> {
  const { margin = 15, scale = 2 } = options;

  const marginPt = margin * 2.83465;
  const contentWidthPt = PAGE_WIDTH_PT - 2 * marginPt;
  const contentHeightPt = PAGE_HEIGHT_PT - 2 * marginPt;

  // Get element dimensions
  const elementRect = element.getBoundingClientRect();
  const elementWidth = elementRect.width;
  const elementHeight = elementRect.height;

  // Step 1: Convert images to base64 using API proxy
  console.log('[PDF] Step 1: Converting images to base64...');
  const originalImages = Array.from(element.getElementsByTagName('img'));
  const imageDataMap = new Map<string, string>();

  console.log(`[PDF] Found ${originalImages.length} images total`);

  for (let i = 0; i < originalImages.length; i++) {
    const img = originalImages[i];
    const src = img.src;

    // Skip if already base64
    if (src.startsWith('data:')) {
      console.log(`[PDF] Image ${i + 1}: Already base64, skipping`);
      continue;
    }

    try {
      // Use API proxy to load image without CORS issues
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;

      const corsImage = new Image();
      corsImage.crossOrigin = 'anonymous';

      // Wait for image to load via proxy
      await new Promise<void>((resolve, reject) => {
        corsImage.onload = () => resolve();
        corsImage.onerror = () => reject(new Error('Failed to load via proxy'));
        corsImage.src = proxyUrl;
      });

      // Create a canvas to convert to base64
      const canvas = document.createElement('canvas');
      canvas.width = corsImage.naturalWidth || corsImage.width;
      canvas.height = corsImage.naturalHeight || corsImage.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw the proxied image
      ctx.drawImage(corsImage, 0, 0);

      // Convert to base64
      const base64 = canvas.toDataURL('image/jpeg', 0.95);

      imageDataMap.set(src, base64);
      console.log(`[PDF] Image ${i + 1}: ✓ Converted via proxy`);
    } catch (error: any) {
      console.error(`[PDF] Image ${i + 1}: Failed -`, error.message);
    }
  }

  console.log(`[PDF] Converted ${imageDataMap.size}/${originalImages.length} images to base64`);

  if (imageDataMap.size === 0 && originalImages.length > 0) {
    console.error('[PDF] ❌ ERREUR: Aucune image n\'a pu être convertie!');
    alert('Erreur: Impossible de charger les images pour le PDF');
    return;
  }

  // Step 2: Clone and replace image sources with base64
  console.log('[PDF] Step 2: Cloning element...');
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: ${elementWidth}px;
    background-color: #ffffff;
    color: #374151;
  `;
  clone.classList.remove('dark-mode');

  // Replace all image sources with base64 versions
  const cloneImages = Array.from(clone.getElementsByTagName('img'));
  for (const img of cloneImages) {
    const base64 = imageDataMap.get(img.src);
    if (base64) {
      img.src = base64;
      img.removeAttribute('crossorigin');
    }
  }

  document.body.appendChild(clone);

  // Wait for images to render
  console.log('[PDF] Waiting 500ms for images to render...');
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Calculate number of pages needed
    // Each page is contentHeightPt in PDF points
    // Convert to element pixels: contentHeightPt / (contentWidthPt / elementWidth)
    const pageHeightPx = (contentHeightPt * elementWidth) / contentWidthPt;
    const numPages = Math.ceil(elementHeight / pageHeightPx);

    console.log(`[PDF] Element: ${elementWidth}x${elementHeight}px`);
    console.log(`[PDF] Page height: ${Math.round(pageHeightPx)}px`);
    console.log(`[PDF] Total pages: ${numPages}`);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Generate PDF page by page
    for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
      console.log(`[PDF] Generating page ${pageIdx + 1}/${numPages}...`);

      // Calculate the Y position and height for this page slice
      const sliceY = pageIdx * pageHeightPx;
      const sliceH = Math.min(pageHeightPx, elementHeight - sliceY);

      // Create a wrapper div that will show only this page's content
      const pageWrapper = document.createElement('div');
      pageWrapper.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: ${elementWidth}px;
        height: ${sliceH}px;
        overflow: hidden;
        background-color: #ffffff;
      `;

      // Clone the content again and offset it
      const pageContent = clone.cloneNode(true) as HTMLElement;
      pageContent.style.cssText = `
        position: absolute;
        left: 0;
        top: ${-sliceY}px;
        width: ${elementWidth}px;
      `;

      pageWrapper.appendChild(pageContent);
      document.body.appendChild(pageWrapper);

      // Wait a tiny bit for the DOM to update
      await new Promise(resolve => setTimeout(resolve, 50));

      // Capture this page with html2canvas
      const pageCanvas = await html2canvas(pageWrapper, {
        scale,
        useCORS: false,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        width: elementWidth,
        height: sliceH,
      });

      // Remove the temporary wrapper
      document.body.removeChild(pageWrapper);

      console.log(`[PDF] Page ${pageIdx + 1}: Canvas ${pageCanvas.width}x${pageCanvas.height}px`);

      // Convert to JPEG
      const jpegUrl = pageCanvas.toDataURL('image/jpeg', 0.92);
      const jpegData = await fetch(jpegUrl).then(r => r.arrayBuffer());
      const jpegImage = await pdfDoc.embedJpg(jpegData);

      // Add page to PDF
      const page = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);

      // Calculate image dimensions in PDF points
      const imgW = contentWidthPt;
      const imgH = (sliceH * scale * contentWidthPt) / (elementWidth * scale);
      const imgX = marginPt;
      const imgY = PAGE_HEIGHT_PT - marginPt - imgH;

      // Draw the image
      page.drawImage(jpegImage, { x: imgX, y: imgY, width: imgW, height: imgH });

      console.log(`[PDF] Page ${pageIdx + 1}: ✓ Added to PDF`);
    }

    // Extract text for the entire document (for text layer)
    console.log('[PDF] Extracting text layer...');
    const textRects = extractTextRects(clone);
    console.log(`[PDF] Found ${textRects.length} text rects`);

    // Add invisible text layer to each page
    const pages = pdfDoc.getPages();
    for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
      const page = pages[pageIdx];
      const sliceY = pageIdx * pageHeightPx;
      const sliceH = Math.min(pageHeightPx, elementHeight - sliceY);

      let textCount = 0;
      for (const tr of textRects) {
        const trTop = tr.top;
        const trBottom = tr.top + tr.height;

        // Check if text is on this page
        if (trBottom <= sliceY || trTop >= sliceY + sliceH) continue;

        // Sanitize text for PDF encoding
        const cleanText = sanitizeForPDF(tr.text);
        if (!cleanText) continue;

        const relTop = tr.top - sliceY;

        // Convert to PDF coordinates
        const pxToPt = contentWidthPt / (elementWidth * scale);
        const textXPt = marginPt + (tr.left * scale * pxToPt);
        const textTopPt = relTop * scale * pxToPt;
        const targetHeightPt = tr.height * scale * pxToPt;

        const textYPt = PAGE_HEIGHT_PT - marginPt - textTopPt - (targetHeightPt * 0.78);
        const pdfFontSize = Math.max(4, targetHeightPt * 0.8);

        try {
          page.drawText(cleanText, {
            x: textXPt,
            y: textYPt,
            size: pdfFontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: 0,
          });
          textCount++;
        } catch {
          // Skip text that fails to render
        }
      }

      console.log(`[PDF] Page ${pageIdx + 1}: Added ${textCount} text elements`);
    }

    // Download
    console.log('[PDF] Saving PDF...');
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[PDF] ✓ PDF downloaded successfully!');

  } finally {
    document.body.removeChild(clone);
  }
}

// Alias for backward compatibility
export { generatePDFWithTextLayer as generatePDFFromMarkdown };
