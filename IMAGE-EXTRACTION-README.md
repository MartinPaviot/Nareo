# 🖼️ Image Extraction & Analysis Pipeline

Complete pipeline for extracting and analyzing pedagogical graphics from PDFs using Mistral OCR + Claude Vision.

## 🎯 Overview

This pipeline combines two powerful AI services:
1. **Mistral OCR** - Extracts images and text from PDFs
2. **Claude Vision** - Analyzes and annotates pedagogical graphics

## ✨ Features

### 1. Image Extraction (Mistral OCR)
- ✅ Extracts images directly as base64 (no PDF rendering needed)
- ✅ Detects image locations with bounding boxes
- ✅ Processes entire PDFs at once
- ✅ Much faster and cheaper than page-by-page OCR

### 2. Graphic Analysis (Claude Vision)
- ✅ Classifies graphics into 5 categories:
  - `courbe_offre_demande` - Supply/demand curves, mathematical functions
  - `diagramme_flux` - Flowcharts, processes, algorithms
  - `organigramme` - Hierarchies, org charts
  - `tableau` - Tables, matrices
  - `autre` - Other (anatomy, circuits, etc.)
- ✅ Extracts key elements with normalized coordinates [0,1]
- ✅ Identifies equilibrium points (P*, Q*) on economic curves
- ✅ Provides pedagogical annotations
- ✅ Recommends display format (SVG, Mermaid, or original image)

### 3. SVG Overlay Generation
- ✅ Generates annotated HTML visualizations
- ✅ Interactive overlays with labels and markers
- ✅ Ready for integration into revision cards

## 📦 Key Files

### Core Libraries

**[lib/mistral-ocr.ts](lib/mistral-ocr.ts)**
- `extractTextWithMistralOCR()` - Extract text + images from PDF
- `extractImagesFromMistralResult()` - Get images from OCR result
- **IMPORTANT**: Uses `includeImageBase64: true` to get image data

**[lib/image-analysis.ts](lib/image-analysis.ts)**
- `analyzeGraphicWithClaude()` - Analyze single graphic
- `analyzeGraphicsBatch()` - Batch process multiple graphics
- Returns structured `GraphicAnalysis` with elements and coordinates

**[lib/svg-generator.ts](lib/svg-generator.ts)**
- `generateSVGOverlay()` - Create SVG annotation layer
- `generateAnnotatedHTML()` - Full HTML page with image + annotations

**[lib/pdf-ocr-server.ts](lib/pdf-ocr-server.ts)**
- `extractImagesFromPDF()` - High-level API for image extraction
- `extractTextFromPdfWithOCR()` - OCR with Mistral or GPT-4 Vision fallback

### Test Scripts

**[test-mistral-images.ts](test-mistral-images.ts)**
- Test Mistral image extraction with `includeImageBase64: true`
- Fastest way to extract images

**[test-complete-pipeline.ts](test-complete-pipeline.ts)**
- Complete pipeline: Mistral extraction + Claude analysis
- Saves images + `_summary.json` with all analyses
- Usage: `npx tsx test-complete-pipeline.ts <pdf> [max-images]`

**[test-generate-html.ts](test-generate-html.ts)**
- Generate annotated HTML visualizations from `_summary.json`
- Creates interactive graphics with SVG overlays

## 🚀 Quick Start

### 1. Extract and Analyze Graphics

```bash
# Extract up to 5 images and analyze them
npx tsx test-complete-pipeline.ts ./document.pdf 5
```

This will:
1. Extract all images from PDF with Mistral OCR
2. Analyze the first 5 images with Claude Vision
3. Save results to `test-output/complete-pipeline/`
4. Create `_summary.json` with all analyses

### 2. Generate Annotated HTML

```bash
# Generate interactive HTML visualizations
npx tsx test-generate-html.ts
```

This will:
1. Read `_summary.json`
2. Generate annotated HTML for each analyzed image
3. Save to `test-output/annotated-html/`

Open any `.html` file in your browser to see the annotated graphic!

### 3. Use in Your Application

```typescript
import { extractImagesFromPDF } from './lib/pdf-ocr-server';
import { analyzeGraphicsBatch } from './lib/image-analysis';

// Extract images
const images = await extractImagesFromPDF(pdfBuffer, 'document.pdf');

// Analyze graphics
const analyses = await analyzeGraphicsBatch(images);

// Use the results
for (const [imageId, analysis] of analyses) {
  console.log(`${imageId}: ${analysis.type}`);
  console.log(`  Elements: ${analysis.elements.length}`);
  console.log(`  Display: ${analysis.suggestions.affichage}`);
}
```

## 📊 Example Output

### Supply/Demand Curve Analysis

```json
{
  "type": "courbe_offre_demande",
  "confidence": 0.95,
  "description": "Courbe d'offre et de demande avec point d'équilibre marqué.",
  "elements": [
    {
      "id": "courbe_offre",
      "type": "courbe",
      "label": "Offre",
      "coords": {"x": 0.1, "y": 0.9}
    },
    {
      "id": "P_equilibre",
      "type": "point",
      "label": "P*",
      "coords": {"x": 0.5, "y": 0.5},
      "details": {"equilibre": true}
    }
  ],
  "suggestions": {
    "affichage": "SVG",
    "annotations": [
      "Expliciter le déplacement de l'équilibre si la demande augmente"
    ]
  }
}
```

## 🔧 Critical Fixes Applied

### 1. Lazy Initialization for API Clients

**Problem**: Mistral and OpenAI clients were initialized at module import time, before environment variables were loaded by dotenv.

**Solution**: ([mistral-ocr.ts](lib/mistral-ocr.ts#L15-L22), [openai-vision.ts](lib/openai-vision.ts#L37-L51))
```typescript
// Lazy-initialize client
let mistral: Mistral | null = null;

function getMistralClient(): Mistral {
  if (!mistral) {
    mistral = new Mistral({
      apiKey: process.env.MISTRAL || '',
    });
  }
  return mistral;
}
```

### 2. Enable Image Extraction in Mistral

**Problem**: Mistral OCR was only returning image locations (bounding boxes), not actual image data.

**Solution**: ([mistral-ocr.ts](lib/mistral-ocr.ts#L101))
```typescript
const response = await client.ocr.process({
  model: 'mistral-ocr-latest',
  document: {
    type: 'document_url',
    documentUrl: dataUrl,
  },
  includeImageBase64: true, // ← CRITICAL: Extract images as base64
});
```

### 3. Updated Type Definitions

```typescript
export interface MistralImageMetadata {
  id: string;
  topLeftX: number;
  topLeftY: number;
  bottomRightX: number;
  bottomRightY: number;
  imageBase64: string | null; // Now can contain actual data!
  imageAnnotation: any | null;
}
```

## 💰 Cost Estimation

### Mistral OCR
- **~$1 per 1000 pages**
- Much cheaper than GPT-4 Vision
- Extracts both text AND images

### Claude Vision (for analysis)
- **~$0.003-0.015 per image** (depends on image size and detail level)
- High quality analysis with structured output

**Example**: Analyzing a 75-page PDF with 48 graphics:
- Mistral OCR: ~$0.08
- Claude analysis (48 images): ~$0.15-0.72
- **Total: ~$0.23-0.80**

Much cheaper than page-by-page GPT-4 Vision OCR (~$15-20 for 75 pages)!

## 🎓 Integration with Nareo

The structured output is ready for integration into interactive revision cards:

1. **Coordinates are normalized [0,1]** - Easy to scale to any display size
2. **JSON format** - Direct TypeScript parsing
3. **Element types** - Map to SVG/React components
4. **Pedagogical annotations** - Ready for student tooltips
5. **Display recommendations** - SVG vs Mermaid vs original image

## 🐛 Troubleshooting

### "401 Unauthorized" from Mistral
- Ensure `MISTRAL` API key is in `.env.local`
- Check that dotenv loads BEFORE importing modules
- Lazy initialization should fix this

### "detached ArrayBuffer" errors
- Fixed by using Mistral's native image extraction
- No longer rendering PDF pages with pdfjs-dist

### Claude returns invalid JSON
- The prompt includes examples and strict formatting rules
- If needed, adjust `GRAPHIC_ANALYSIS_PROMPT` in [lib/image-analysis.ts](lib/image-analysis.ts)

## 📝 License

Part of the Nareo EdTech platform.
