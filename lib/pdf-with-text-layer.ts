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

  // Get element dimensions and extract text
  const elementRect = element.getBoundingClientRect();
  const elementWidth = elementRect.width;
  const elementHeight = elementRect.height;
  const textRects = extractTextRects(element);

  // Clone for rendering
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
  document.body.appendChild(clone);

  try {
    const canvas = await html2canvas(clone, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: elementWidth,
      height: elementHeight,
    });

    const canvasWidthPx = canvas.width;
    const canvasHeightPx = canvas.height;

    // Scale factor: canvas pixels -> PDF points
    const pxToPt = contentWidthPt / canvasWidthPx;
    const totalHeightPt = canvasHeightPx * pxToPt;
    const numPages = Math.ceil(totalHeightPt / contentHeightPt);
    const canvasPxPerPage = contentHeightPt / pxToPt;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
      const page = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]);

      // Canvas slice for this page
      const sliceY = pageIdx * canvasPxPerPage;
      const sliceH = Math.min(canvasPxPerPage, canvasHeightPx - sliceY);

      // Create slice canvas
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvasWidthPx;
      sliceCanvas.height = Math.ceil(sliceH);
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, sliceY, canvasWidthPx, sliceH, 0, 0, canvasWidthPx, sliceH);

      // Embed as PNG
      const pngUrl = sliceCanvas.toDataURL('image/png');
      const pngData = await fetch(pngUrl).then(r => r.arrayBuffer());
      const pngImage = await pdfDoc.embedPng(pngData);

      // Image dimensions and position
      const imgW = contentWidthPt;
      const imgH = sliceH * pxToPt;
      const imgX = marginPt;
      const imgY = PAGE_HEIGHT_PT - marginPt - imgH;

      // Draw image
      page.drawImage(pngImage, { x: imgX, y: imgY, width: imgW, height: imgH });

      // Add text layer (invisible, for selection)
      const elemSliceStartY = sliceY / scale;
      const elemSliceEndY = (sliceY + sliceH) / scale;

      for (const tr of textRects) {
        const trTop = tr.top;
        const trBottom = tr.top + tr.height;

        // Check if text is on this page
        if (trBottom <= elemSliceStartY || trTop >= elemSliceEndY) continue;

        // Sanitize text for PDF encoding
        const cleanText = sanitizeForPDF(tr.text);
        if (!cleanText) continue;

        const relTop = tr.top - elemSliceStartY;

        // Convert to PDF coordinates
        const textXPt = marginPt + (tr.left * scale * pxToPt);
        const textTopPt = relTop * scale * pxToPt;
        const targetHeightPt = tr.height * scale * pxToPt;

        // Position text at baseline (approximately 75-80% down from top)
        const textYPt = PAGE_HEIGHT_PT - marginPt - textTopPt - (targetHeightPt * 0.78);

        // Font size based on line height
        const pdfFontSize = Math.max(4, targetHeightPt * 0.8);

        try {
          page.drawText(cleanText, {
            x: textXPt,
            y: textYPt,
            size: pdfFontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: 0, // Invisible but selectable
          });
        } catch {
          // Skip text that fails to render
        }
      }
    }

    // Download
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

  } finally {
    document.body.removeChild(clone);
  }
}

// Alias for backward compatibility
export { generatePDFWithTextLayer as generatePDFFromMarkdown };
