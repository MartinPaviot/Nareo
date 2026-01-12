# ✅ Checklist d'Intégration - Extraction d'Images

## 🎯 Objectif

Intégrer l'extraction et l'analyse automatique de graphiques pédagogiques dans le pipeline de traitement de documents.

## 📋 Étapes d'Implémentation

### Phase 1: Base de Données ✅ PRÊT

**Fichiers créés**:
- ✅ [database/migrations/026_course_graphics.sql](database/migrations/026_course_graphics.sql)

**Actions à faire**:

1. **Exécuter la migration sur Supabase**:
   ```bash
   # Option 1: Via Supabase Dashboard
   # - Aller dans SQL Editor
   # - Copier le contenu de 026_course_graphics.sql
   # - Exécuter

   # Option 2: Via CLI (si installé)
   supabase db push
   ```

2. **Vérifier le bucket storage**:
   ```sql
   -- Vérifier que le bucket existe
   SELECT id, name, public FROM storage.buckets WHERE id = 'course-graphics';

   -- Résultat attendu: 1 ligne avec id='course-graphics', public=true
   ```

3. **Vérifier les policies**:
   ```sql
   -- Policies sur la table
   SELECT tablename, policyname FROM pg_policies WHERE tablename = 'course_graphics';

   -- Policies sur le storage
   SELECT policyname FROM storage.policies WHERE bucket_id = 'course-graphics';
   ```

### Phase 2: Backend ✅ PRÊT

**Fichiers créés**:
- ✅ [lib/mistral-ocr.ts](lib/mistral-ocr.ts) - Extraction Mistral
- ✅ [lib/image-analysis.ts](lib/image-analysis.ts) - Analyse Claude
- ✅ [lib/svg-generator.ts](lib/svg-generator.ts) - Génération SVG
- ✅ [lib/pdf-ocr-server.ts](lib/pdf-ocr-server.ts) - Extraction d'images
- ✅ [lib/backend/graphics-processor.ts](lib/backend/graphics-processor.ts) - Processeur de graphiques

**Actions à faire**:

1. **Intégrer dans le pipeline** - Modifier `lib/backend/course-pipeline.ts`:

   ```typescript
   // Ajouter import
   import { processDocumentGraphics } from './graphics-processor';

   // Dans processCourseGenerationPipeline(), après extraction de texte:

   // NEW: Extract and analyze graphics from PDF
   if (ext === ".pdf") {
     try {
       logStep("Extracting and analyzing graphics", { courseId });

       const graphicsResult = await processDocumentGraphics(
         courseId,
         effectiveUserId,
         buffer,
         file.name || 'document.pdf'
       );

       logStep("Graphics processing complete", {
         totalImages: graphicsResult.totalImages,
         analyzed: graphicsResult.analyzed,
         stored: graphicsResult.stored
       });
     } catch (graphicsError: any) {
       // Don't fail the whole pipeline if graphics processing fails
       console.error('[pipeline] Graphics processing failed:', graphicsError.message);
       logStep("Graphics processing failed (continuing)", { error: graphicsError.message });
     }
   }
   ```

2. **Vérifier les variables d'environnement**:
   ```bash
   # Dans .env.local
   MISTRAL=your_mistral_api_key
   OPENAI_API_KEY=your_openai_key  # Pour Claude via OpenAI-compatible endpoint
   # OU
   CLAUDE_API_KEY=your_anthropic_key  # Si utilisation directe
   ```

3. **Tester avec un PDF**:
   ```bash
   # Upload un PDF via l'interface
   # Vérifier les logs pour voir:
   # - 🖼️ [Graphics Processor] Starting
   # - 📄 [Step 1/4] Extracting images
   # - 🔍 [Step 2/4] Analyzing graphics
   # - 💾 [Step 3/4] Uploading images
   # - 📊 [Graphics Processing Summary]
   ```

### Phase 3: API Routes (Optionnel) ⏳ À FAIRE

**Fichier à créer**: `app/api/courses/[courseId]/graphics/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const admin = getServiceSupabase();

  // Fetch all graphics for course
  const { data: graphics, error } = await admin
    .from('course_graphics')
    .select('*')
    .eq('course_id', params.courseId)
    .order('page_number', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Add public URLs
  const graphicsWithUrls = graphics?.map(g => ({
    ...g,
    imageUrl: admin.storage
      .from('course-graphics')
      .getPublicUrl(g.storage_path).data.publicUrl,
  })) || [];

  return Response.json({ graphics: graphicsWithUrls });
}

// POST: Trigger re-analysis of graphics
export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const { reanalyzeGraphics } = await import('@/lib/backend/graphics-processor');

  try {
    const count = await reanalyzeGraphics(params.courseId);
    return Response.json({
      success: true,
      reanalyzed: count
    });
  } catch (error: any) {
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
}
```

### Phase 4: Frontend (Optionnel) ⏳ À FAIRE

**Composant à créer**: `components/course/GraphicsViewer.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Graphic {
  id: string;
  page_number: number;
  image_id: string;
  imageUrl: string;
  graphic_type: string;
  confidence: number;
  description: string;
  elements: any[];
  suggestions: {
    affichage: 'SVG' | 'Mermaid' | 'image_originale';
    annotations: string[];
  };
}

export function GraphicsViewer({ courseId }: { courseId: string }) {
  const [graphics, setGraphics] = useState<Graphic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/courses/${courseId}/graphics`)
      .then(res => res.json())
      .then(data => {
        setGraphics(data.graphics || []);
        setLoading(false);
      });
  }, [courseId]);

  if (loading) return <div>Chargement des graphiques...</div>;
  if (graphics.length === 0) return <div>Aucun graphique trouvé</div>;

  return (
    <div className="grid gap-4">
      {graphics.map(g => (
        <div key={g.id} className="border rounded-lg p-4">
          <div className="mb-2">
            <span className="badge">{g.graphic_type}</span>
            <span className="ml-2 text-sm text-gray-600">
              Page {g.page_number} • Confidence: {(g.confidence * 100).toFixed(0)}%
            </span>
          </div>

          <p className="text-sm text-gray-700 mb-3">{g.description}</p>

          <Image
            src={g.imageUrl}
            alt={g.description}
            width={600}
            height={400}
            className="rounded"
          />

          {g.suggestions.annotations.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold">💡 Annotations:</p>
              <ul className="text-sm text-gray-600 list-disc pl-5">
                {g.suggestions.annotations.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Utilisation**:
```typescript
// Dans votre page de cours
import { GraphicsViewer } from '@/components/course/GraphicsViewer';

export default function CoursePage({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* ... existing course content ... */}

      <section>
        <h2>Graphiques Pédagogiques</h2>
        <GraphicsViewer courseId={params.id} />
      </section>
    </div>
  );
}
```

## 🧪 Tests

### Test 1: Extraction Basique

```bash
# Tester l'extraction sans analyse
npx tsx test-mistral-images.ts "./public/Test/IntroEco-02.pdf"

# Résultat attendu:
# ✅ Extracted 48 images from Mistral OCR result
# 💾 Saving images to: test-output/mistral-direct
```

### Test 2: Pipeline Complet (Extraction + Analyse)

```bash
# Tester avec 5 images
npx tsx test-complete-pipeline.ts "./public/Test/IntroEco-02.pdf" 5

# Résultat attendu:
# ✅ Extracted 48 images from PDF
# ✅ Batch analysis complete: 5/5 graphics analyzed
# 💾 Saving 5 images
# 📋 Summary saved to: _summary.json
```

### Test 3: Génération HTML

```bash
npx tsx test-generate-html.ts

# Résultat attendu:
# ✅ Generated 5 annotated HTML files
# 📂 Output directory: test-output/annotated-html
```

### Test 4: Upload via Interface

1. Uploader `IntroEco-02.pdf` via l'interface
2. Vérifier les logs du serveur pour:
   ```
   [pipeline] Extracting and analyzing graphics
   🖼️ [Graphics Processor] Starting
   📄 [Step 1/4] Extracting images with Mistral OCR
      Found 48 images
   🔍 [Step 2/4] Analyzing graphics with Claude Vision
      Analyzed 20/20 graphics
   💾 [Step 3/4] Uploading images to Supabase Storage
      ✅ Uploaded img-0.jpeg (page 3)
      ...
   📊 [Graphics Processing Summary]
      Total images found: 48
      Analyzed with Claude: 20
      Stored in database: 18
   ```

3. Vérifier dans Supabase:
   ```sql
   SELECT
     course_id,
     COUNT(*) as graphics_count,
     graphic_type,
     AVG(confidence) as avg_confidence
   FROM course_graphics
   GROUP BY course_id, graphic_type;
   ```

### Test 5: API Route

```bash
# Test GET endpoint
curl http://localhost:3000/api/courses/{courseId}/graphics

# Résultat attendu:
{
  "graphics": [
    {
      "id": "uuid",
      "page_number": 3,
      "graphic_type": "courbe_offre_demande",
      "confidence": 0.95,
      "description": "Courbe d'offre et de demande...",
      "imageUrl": "https://..."
    },
    ...
  ]
}
```

## 📊 Métriques de Succès

### Performance
- ✅ Extraction complète: < 30 secondes pour 75 pages
- ✅ Analyse Claude: ~1 seconde par image
- ✅ Upload Storage: < 1 seconde par image

### Qualité
- ✅ Taux de détection: > 90% des graphiques trouvés
- ✅ Confidence moyenne: > 85%
- ✅ Taux d'erreur: < 5%

### Coût
- ✅ Mistral OCR: ~$0.08 par document 75 pages
- ✅ Claude analyse (20 images): ~$0.10-0.30
- ✅ Total par document: ~$0.20-0.40

## 🐛 Troubleshooting

### Erreur: "MISTRAL API key not configured"

**Solution**:
```bash
# Vérifier .env.local
echo $MISTRAL

# Si vide, ajouter:
MISTRAL=your_api_key_here
```

### Erreur: "Bucket 'course-graphics' not found"

**Solution**:
```sql
-- Vérifier dans Supabase SQL Editor
SELECT * FROM storage.buckets WHERE id = 'course-graphics';

-- Si vide, créer manuellement:
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-graphics', 'course-graphics', true);
```

### Erreur: "Permission denied for table course_graphics"

**Solution**:
```sql
-- Vérifier RLS policies
SELECT * FROM pg_policies WHERE tablename = 'course_graphics';

-- Vérifier service role
SELECT auth.jwt()->>'role'; -- Doit retourner 'service_role'
```

### Images extraites mais analyses échouent

**Solution**:
- Vérifier OPENAI_API_KEY ou CLAUDE_API_KEY
- Vérifier rate limits API
- Réduire `maxImagesToAnalyze` dans graphics-processor.ts

## ✅ Checklist Finale

**Base de données**:
- [ ] Migration 026 exécutée sur Supabase
- [ ] Bucket `course-graphics` créé
- [ ] Table `course_graphics` existe
- [ ] Policies RLS actives

**Backend**:
- [ ] Variables d'env configurées (MISTRAL, OPENAI_API_KEY)
- [ ] `course-pipeline.ts` modifié avec appel à `processDocumentGraphics()`
- [ ] Tests de base réussis (test-complete-pipeline.ts)

**API** (Optionnel):
- [ ] Route `/api/courses/[courseId]/graphics` créée
- [ ] Tests API réussis

**Frontend** (Optionnel):
- [ ] Composant GraphicsViewer créé
- [ ] Intégré dans page de cours

## 🚀 Déploiement

### Environnement de Dev
1. Exécuter migration sur projet Supabase dev
2. Tester avec documents réels
3. Vérifier logs et métriques

### Environnement de Production
1. Backup base de données avant migration
2. Exécuter migration 026
3. Déployer nouveau code backend
4. Monitorer premiers uploads
5. Vérifier coûts API (Mistral + Claude)

## 📖 Documentation Utile

- [ARCHITECTURE-DIAGNOSTIC.md](ARCHITECTURE-DIAGNOSTIC.md) - Analyse complète de l'architecture
- [IMAGE-EXTRACTION-README.md](IMAGE-EXTRACTION-README.md) - Guide d'utilisation du pipeline
- [lib/image-analysis.ts](lib/image-analysis.ts) - API d'analyse Claude
- [lib/backend/graphics-processor.ts](lib/backend/graphics-processor.ts) - Processeur de graphiques

## 💡 Prochaines Améliorations

**Court terme**:
- [ ] Associer graphiques aux chapitres (via matching de pages)
- [ ] Filtrer images non-pédagogiques (logos, photos)
- [ ] Dashboard admin pour statistiques graphiques

**Long terme**:
- [ ] Annotations interactives sur graphiques (SVG overlay)
- [ ] Génération de questions à partir des graphiques
- [ ] Export graphiques en SVG pour impression
- [ ] Support multi-langues pour analyses
