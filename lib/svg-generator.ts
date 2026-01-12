// @ts-nocheck
/**
 * SVG Generator for Annotated Graphics
 *
 * DEPRECATED: This module uses an old GraphicAnalysis interface format.
 * The interface has been simplified in image-analysis.ts - elements are now string[]
 * instead of objects with coords, type, label, etc.
 *
 * This file is kept for reference but is not used in production.
 */

import type { GraphicAnalysis } from './image-analysis';

// Legacy interface for backward compatibility with this file
interface GraphicElement {
  coords: { x: number; y: number };
  type: 'point' | 'texte' | 'courbe' | 'fleche' | 'noeud';
  label: string;
  details?: { equilibre?: boolean };
}

/**
 * Generate SVG overlay markup for a graphic
 *
 * @param analysis - Graphic analysis from Claude
 * @param imageWidth - Original image width in pixels
 * @param imageHeight - Original image height in pixels
 * @returns SVG markup string
 */
export function generateSVGOverlay(
  analysis: GraphicAnalysis,
  imageWidth: number,
  imageHeight: number
): string {
  const elements: string[] = [];

  // Generate SVG elements for each extracted element
  for (const element of analysis.elements) {
    const x = element.coords.x * imageWidth;
    const y = element.coords.y * imageHeight;

    switch (element.type) {
      case 'point':
        // Equilibrium points and other key points
        const isEquilibrium = element.details?.equilibre === true;
        elements.push(`
          <!-- ${element.label} -->
          <circle
            cx="${x}"
            cy="${y}"
            r="8"
            fill="${isEquilibrium ? '#ff4444' : '#4444ff'}"
            stroke="white"
            stroke-width="2"
            class="annotation-point ${isEquilibrium ? 'equilibrium' : ''}"
          />
          <text
            x="${x + 15}"
            y="${y + 5}"
            font-size="14"
            font-weight="bold"
            fill="${isEquilibrium ? '#ff4444' : '#4444ff'}"
            class="annotation-label"
          >${element.label}</text>
        `);
        break;

      case 'texte':
        // Labels and axis titles
        elements.push(`
          <!-- ${element.label} -->
          <text
            x="${x}"
            y="${y}"
            font-size="16"
            font-weight="600"
            fill="#333"
            class="annotation-text"
          >${element.label}</text>
        `);
        break;

      case 'courbe':
        // Curve indicators
        elements.push(`
          <!-- ${element.label} -->
          <circle
            cx="${x}"
            cy="${y}"
            r="6"
            fill="#22aa22"
            stroke="white"
            stroke-width="2"
            class="annotation-curve-marker"
          />
          <text
            x="${x + 12}"
            y="${y + 5}"
            font-size="12"
            font-weight="600"
            fill="#22aa22"
            class="annotation-label"
          >${element.label}</text>
        `);
        break;

      case 'fleche':
        // Arrows (for flow diagrams)
        elements.push(`
          <!-- ${element.label} -->
          <path
            d="M ${x - 20} ${y} L ${x + 20} ${y}"
            stroke="#666"
            stroke-width="2"
            marker-end="url(#arrowhead)"
            class="annotation-arrow"
          />
        `);
        break;

      case 'noeud':
        // Nodes (for flowcharts)
        elements.push(`
          <!-- ${element.label} -->
          <rect
            x="${x - 40}"
            y="${y - 20}"
            width="80"
            height="40"
            fill="#eef"
            stroke="#44f"
            stroke-width="2"
            rx="5"
            class="annotation-node"
          />
          <text
            x="${x}"
            y="${y + 5}"
            text-anchor="middle"
            font-size="12"
            fill="#333"
          >${element.label}</text>
        `);
        break;
    }
  }

  // Build complete SVG
  return `
<svg
  width="${imageWidth}"
  height="${imageHeight}"
  viewBox="0 0 ${imageWidth} ${imageHeight}"
  xmlns="http://www.w3.org/2000/svg"
  class="graphic-overlay"
>
  <!-- Arrow marker definition -->
  <defs>
    <marker
      id="arrowhead"
      markerWidth="10"
      markerHeight="10"
      refX="9"
      refY="3"
      orient="auto"
    >
      <polygon points="0 0, 10 3, 0 6" fill="#666" />
    </marker>
  </defs>

  <!-- Graphic annotations -->
  ${elements.join('\n  ')}
</svg>
`.trim();
}

/**
 * Generate complete HTML page with image + SVG overlay
 *
 * @param analysis - Graphic analysis from Claude
 * @param imageBase64 - Base64 encoded image data
 * @param imageWidth - Original image width
 * @param imageHeight - Original image height
 * @returns Complete HTML page
 */
export function generateAnnotatedHTML(
  analysis: GraphicAnalysis,
  imageBase64: string,
  imageWidth: number = 800,
  imageHeight: number = 600
): string {
  const svg = generateSVGOverlay(analysis, imageWidth, imageHeight);

  // Extract format from base64 data URL
  const format = imageBase64.includes('image/jpeg') ? 'jpeg' : 'png';
  const dataUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/${format};base64,${imageBase64}`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${analysis.description}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: ${imageWidth}px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
      color: #333;
    }
    .header .meta {
      display: flex;
      gap: 20px;
      font-size: 14px;
      color: #666;
    }
    .header .badge {
      padding: 4px 12px;
      border-radius: 12px;
      background: #e3f2fd;
      color: #1976d2;
      font-weight: 600;
    }
    .graphic-container {
      position: relative;
      display: inline-block;
      width: 100%;
    }
    .graphic-container img {
      display: block;
      width: 100%;
      height: auto;
    }
    .graphic-overlay {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
    }
    .annotations {
      padding: 20px;
      border-top: 1px solid #e0e0e0;
    }
    .annotations h2 {
      margin: 0 0 10px 0;
      font-size: 18px;
      color: #333;
    }
    .annotations ul {
      margin: 0;
      padding-left: 20px;
    }
    .annotations li {
      margin: 5px 0;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${analysis.description}</h1>
      <div class="meta">
        <span class="badge">${analysis.type.replace(/_/g, ' ')}</span>
        <span>Confidence: ${(analysis.confidence * 100).toFixed(0)}%</span>
        <span>${analysis.elements.length} éléments identifiés</span>
      </div>
    </div>

    <div class="graphic-container">
      <img src="${dataUrl}" alt="${analysis.description}" />
      ${svg}
    </div>

    ${analysis.suggestions.annotations.length > 0 ? `
    <div class="annotations">
      <h2>💡 Annotations pédagogiques</h2>
      <ul>
        ${analysis.suggestions.annotations.map(a => `<li>${a}</li>`).join('\n        ')}
      </ul>
    </div>
    ` : ''}
  </div>
</body>
</html>
`.trim();
}
