# 🏗️ Architecture Diagnostic - Intégration Extraction d'Images

## 📊 État Actuel du Système

### 1. Pipeline de Traitement de Documents

**Flux actuel** ([lib/backend/course-pipeline.ts](lib/backend/course-pipeline.ts)):

```
User Upload
    ↓
queueCourseProcessing()
    ↓
Storage (Supabase bucket: courses_raw)
    ↓
processCourseGenerationPipeline()
    ↓
parsePDF/parseDocx/parseImage
    ↓
generateChapterStructureFromCourseText()
    ↓
Insert chapters + concepts → Supabase
    ↓
Status: "ready"
```

**Problème identifié**:
- ❌ Les **images/graphiques** extraits des PDFs **ne sont PAS stockés** ni analysés
- ❌ Pas de table pour stocker les métadonnées des images pédagogiques
- ❌ Pas de bucket Supabase dédié pour les images de cours

### 2. Storage Supabase Existant

**Buckets actuels**:
1. `courses_raw` - Documents originaux (PDFs, DOCX)
2. `note-images` - Images uploadées manuellement par les utilisateurs ([migration 009](database/migrations/009_note_images_storage.sql))

**Problème**:
- ❌ Pas de bucket pour images **extraites automatiquement** des PDFs
- ❌ Le bucket `note-images` est pour uploads manuels, pas extraction auto

### 3. Schéma de Base de Données

**Tables actuelles** ([database/aristochat-schema.sql](database/aristochat-schema.sql)):

```sql
courses
  ├── chapters
  │   ├── concepts
  │   └── questions
  └── quiz_attempts
```

**Problème**:
- ❌ Pas de table `course_images` ou `chapter_graphics`
- ❌ Pas de lien entre chapters et graphiques pédagogiques
- ❌ Métadonnées d'analyse Claude (type, éléments, coordonnées) non stockées

## 🎯 Solution Proposée

### A. Nouvelle Table: `course_graphics`

Stocke les images extraites + leurs analyses:

```sql
CREATE TABLE public.course_graphics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id),

  -- Image metadata
  page_number int NOT NULL,
  image_id text NOT NULL, -- From Mistral (e.g., "img-0.jpeg")
  storage_path text NOT NULL, -- Path in course-graphics bucket

  -- Analysis from Claude Vision
  graphic_type text CHECK (graphic_type IN (
    'courbe_offre_demande',
    'diagramme_flux',
    'organigramme',
    'tableau',
    'autre'
  )),
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  description text,

  -- Structured data
  elements jsonb, -- Array of GraphicElement with coords
  suggestions jsonb, -- DisplaySuggestions (affichage, annotations)

  -- Metadata
  width int,
  height int,
  file_size int,
  mime_type text DEFAULT 'image/jpeg',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_course_graphics_course ON public.course_graphics(course_id);
CREATE INDEX idx_course_graphics_chapter ON public.course_graphics(chapter_id);
CREATE INDEX idx_course_graphics_type ON public.course_graphics(graphic_type);
CREATE INDEX idx_course_graphics_page ON public.course_graphics(course_id, page_number);

-- RLS Policies
ALTER TABLE public.course_graphics ENABLE ROW LEVEL SECURITY;

-- Users can view graphics from their courses
CREATE POLICY "Users can view their course graphics"
ON public.course_graphics FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = course_graphics.course_id
    AND courses.is_public = true
  )
);

-- Service role can insert/update graphics
CREATE POLICY "Service role can manage course graphics"
ON public.course_graphics FOR ALL
USING (auth.jwt()->>'role' = 'service_role');
```

### B. Nouveau Bucket Storage: `course-graphics`

Pour stocker les images extraites:

```sql
-- Create storage bucket for extracted course graphics
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-graphics',
  'course-graphics',
  true, -- Public for easy access in revision cards
  10485760, -- 10MB limit (graphics can be large)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies

-- Service role can upload graphics
CREATE POLICY "Service role can upload course graphics"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-graphics'
  AND auth.jwt()->>'role' = 'service_role'
);

-- Service role can update graphics
CREATE POLICY "Service role can update course graphics"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-graphics'
  AND auth.jwt()->>'role' = 'service_role'
);

-- Service role can delete graphics
CREATE POLICY "Service role can delete course graphics"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-graphics'
  AND auth.jwt()->>'role' = 'service_role'
);

-- Anyone can view graphics (public bucket)
CREATE POLICY "Anyone can view course graphics"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-graphics');
```

### C. Intégration dans le Pipeline

**Nouveau flux** (à implémenter dans `course-pipeline.ts`):

```typescript
async function processCourseGenerationPipeline(courseId: string) {
  // ... existing code ...

  // NEW STEP: Extract and analyze images
  if (ext === ".pdf") {
    logStep("Extracting images from PDF", { courseId });

    // 1. Extract images with Mistral OCR
    const images = await extractImagesFromPDF(buffer, file.name);

    // 2. Analyze graphics with Claude Vision (limit to important ones)
    const analyses = await analyzeGraphicsBatch(
      images.slice(0, 20) // Limit cost, analyze top 20
    );

    // 3. Upload images to Supabase Storage
    for (const img of images) {
      const storagePath = `${userId}/${courseId}/${img.imageId}.jpg`;

      await admin.storage
        .from('course-graphics')
        .upload(storagePath, img.imageBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      // 4. Store metadata in database
      const analysis = analyses.get(img.imageId);

      await admin.from('course_graphics').insert({
        course_id: courseId,
        user_id: userId,
        page_number: img.pageNum,
        image_id: img.imageId,
        storage_path: storagePath,
        graphic_type: analysis?.type || 'autre',
        confidence: analysis?.confidence || 0,
        description: analysis?.description || '',
        elements: analysis?.elements || [],
        suggestions: analysis?.suggestions || {},
        width: img.width,
        height: img.height,
        file_size: img.imageBuffer.length,
      });
    }

    logStep("Images extracted and analyzed", {
      totalImages: images.length,
      analyzed: analyses.size
    });
  }

  // ... rest of pipeline ...
}
```

### D. API pour Récupérer les Graphiques

**Nouvelle route API**: `/api/courses/[courseId]/graphics`

```typescript
// app/api/courses/[courseId]/graphics/route.ts

import { getServiceSupabase } from '@/lib/supabase-server';

export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  const admin = getServiceSupabase();

  const { data: graphics, error } = await admin
    .from('course_graphics')
    .select('*')
    .eq('course_id', params.courseId)
    .order('page_number', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Add public URLs for images
  const graphicsWithUrls = graphics.map(g => ({
    ...g,
    imageUrl: admin.storage
      .from('course-graphics')
      .getPublicUrl(g.storage_path).data.publicUrl,
  }));

  return Response.json({ graphics: graphicsWithUrls });
}
```

## 📋 Plan d'Implémentation

### Phase 1: Base de Données (1 migration)

✅ Fichier à créer: `database/migrations/026_course_graphics.sql`

```sql
-- Combined migration for graphics support

-- 1. Create course_graphics table
CREATE TABLE public.course_graphics (...);

-- 2. Create storage bucket
INSERT INTO storage.buckets (...);

-- 3. Add RLS policies (table + storage)
CREATE POLICY ...
```

### Phase 2: Backend (2 fichiers)

✅ Fichier à créer: `lib/backend/graphics-processor.ts`

```typescript
/**
 * Extract and analyze graphics from course documents
 */
export async function processDocumentGraphics(
  courseId: string,
  userId: string,
  buffer: Buffer,
  filename: string
): Promise<{ totalImages: number; analyzed: number }> {
  // Use existing functions from lib/pdf-ocr-server.ts
  // and lib/image-analysis.ts
}
```

✅ Modifier: `lib/backend/course-pipeline.ts`

```typescript
// Add graphics processing step after text extraction
if (ext === ".pdf") {
  const graphicsResult = await processDocumentGraphics(
    courseId,
    effectiveUserId,
    buffer,
    file.name
  );
}
```

### Phase 3: API Routes (1 fichier)

✅ Fichier à créer: `app/api/courses/[courseId]/graphics/route.ts`

```typescript
export async function GET(...) // Fetch graphics for course
export async function POST(...) // Manually trigger re-analysis
```

### Phase 4: Frontend (selon besoin)

✅ Composant: `components/course/GraphicsViewer.tsx`

```typescript
// Display annotated graphics in revision cards
// Uses SVG overlays from lib/svg-generator.ts
```

## 💰 Considérations de Coût

### Par Document (75 pages, 48 images typiques)

**Mistral OCR**:
- Extraction: ~$0.08 (une fois par document)

**Claude Vision**:
- Analyse de 20 images: ~$0.10-0.30
- Total par document: ~$0.18-0.38

**Supabase Storage**:
- 48 images × ~100KB = 4.8MB
- Gratuit jusqu'à 1GB
- Coût marginal: négligeable

**Stratégies d'optimisation**:
1. ✅ **Limiter l'analyse** à 20 images les plus pertinentes par document
2. ✅ **Cache les résultats** - ne ré-analyser que si document modifié
3. ✅ **Analyse progressive** - analyser plus d'images on-demand
4. ✅ **Détection intelligente** - skip images non-pédagogiques (logos, photos)

## 🚀 Avantages de cette Architecture

### 1. Séparation des Préoccupations
- ✅ Storage séparé (`course-graphics` vs `note-images`)
- ✅ Table dédiée avec métadonnées structurées
- ✅ RLS policies pour sécurité

### 2. Performance
- ✅ Images stockées et servies via CDN Supabase
- ✅ Métadonnées en JSON pour queries rapides
- ✅ Index sur `course_id`, `chapter_id`, `page_number`

### 3. Flexibilité
- ✅ `elements` JSONB permet évolution du schéma
- ✅ Liaison optionnelle avec `chapter_id` (peut être null)
- ✅ Support multi-formats (JPEG, PNG, WebP)

### 4. Intégration Frontend
- ✅ API REST simple (`/api/courses/[id]/graphics`)
- ✅ URLs publiques pour affichage direct
- ✅ Coordonnées normalisées pour SVG overlays

## 🔒 Sécurité

### RLS (Row Level Security)
- ✅ Users ne peuvent voir que leurs graphiques ou ceux publics
- ✅ Service role a tous les droits (pour processing)
- ✅ Storage policies cohérentes avec table policies

### Isolation
- ✅ Graphiques stockés dans `userId/courseId/` structure
- ✅ Pas de collision de noms (UUID + image_id)
- ✅ Suppression en cascade si course deleted

## 📊 Requêtes Utiles

### Récupérer graphiques d'un chapitre

```sql
SELECT
  cg.*,
  c.title as chapter_title
FROM course_graphics cg
LEFT JOIN chapters c ON c.id = cg.chapter_id
WHERE cg.course_id = $courseId
  AND cg.chapter_id = $chapterId
ORDER BY cg.page_number;
```

### Statistiques par type de graphique

```sql
SELECT
  c.title as course_title,
  cg.graphic_type,
  COUNT(*) as count,
  AVG(cg.confidence) as avg_confidence
FROM course_graphics cg
JOIN courses c ON c.id = cg.course_id
WHERE c.user_id = $userId
GROUP BY c.id, c.title, cg.graphic_type
ORDER BY count DESC;
```

### Graphiques haute confidence pour révision

```sql
SELECT *
FROM course_graphics
WHERE course_id = $courseId
  AND confidence >= 0.9
  AND graphic_type IN ('courbe_offre_demande', 'diagramme_flux')
ORDER BY page_number;
```

## ✅ Checklist d'Implémentation

### Obligatoire (MVP)
- [ ] Créer migration `026_course_graphics.sql`
- [ ] Exécuter migration sur Supabase
- [ ] Créer bucket `course-graphics` dans Supabase Dashboard
- [ ] Implémenter `lib/backend/graphics-processor.ts`
- [ ] Modifier `course-pipeline.ts` pour appeler graphics processor
- [ ] Créer API route `/api/courses/[courseId]/graphics`
- [ ] Tester avec IntroEco-02.pdf

### Optionnel (Améliorations)
- [ ] Associer graphiques aux chapitres (via page matching)
- [ ] Frontend: GraphicsViewer component
- [ ] Analyse on-demand (si trop d'images)
- [ ] Re-analyse si document mis à jour
- [ ] Export graphiques annotés en SVG
- [ ] Intégration avec fiches de révision

## 🎯 Conclusion

**État actuel**: ❌ Pas d'infrastructure pour graphiques

**Après intégration**: ✅ Pipeline complet
- Extraction automatique (Mistral)
- Analyse intelligente (Claude)
- Stockage sécurisé (Supabase)
- API REST pour frontend
- Métadonnées structurées pour fiches de révision

**Effort estimé**:
- Backend: ~4-6 heures
- Migration + tests: ~1-2 heures
- Frontend (optionnel): ~3-4 heures
- **Total MVP**: ~5-8 heures

**Impact**:
- 🎓 Fiches de révision beaucoup plus riches
- 📊 Graphiques annotés automatiquement
- 🚀 Expérience utilisateur premium
- 💰 Coût marginal minime (~$0.20-0.40 par document)
