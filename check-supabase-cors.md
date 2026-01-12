# Fix pour les pages blanches du PDF

## Problème identifié

Les images échouent avec l'erreur **"Tainted canvases may not be exported"** parce que:

1. Les images viennent de Supabase Storage (domaine différent)
2. Pour des raisons de sécurité, le navigateur refuse de convertir en base64 des images cross-origin
3. Même avec `crossOrigin='anonymous'`, Supabase doit autoriser CORS

## Solution: Configurer CORS sur Supabase Storage

### Étape 1: Vérifier la configuration actuelle

Va dans Supabase Dashboard → Storage → `course-graphics` bucket → Settings

### Étape 2: Ajouter les headers CORS

Le bucket `course-graphics` doit avoir ces headers CORS:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: *
```

### Étape 3: Rendre le bucket public (si ce n'est pas déjà fait)

Storage → `course-graphics` → Make public

---

## Alternative si CORS ne peut pas être configuré

Si tu ne peux pas modifier les CORS de Supabase, il y a 2 solutions:

### Solution A: Proxy via l'API Next.js

Créer une route API qui télécharge l'image côté serveur et la renvoie:

```typescript
// app/api/proxy-image/route.ts
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url');
  const response = await fetch(url);
  const blob = await response.blob();
  return new Response(blob, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
```

### Solution B: Générer le PDF côté serveur

Au lieu de générer le PDF dans le navigateur, le faire côté serveur avec Puppeteer:

1. L'utilisateur clique sur "Télécharger"
2. Appel API → serveur Next.js
3. Puppeteer génère le PDF (pas de restrictions CORS)
4. Renvoie le PDF au client

---

## Quelle solution préfères-tu?

1. **Configurer CORS sur Supabase** (le plus simple, 2 minutes)
2. **Proxy API** (solution intermédiaire)
3. **PDF côté serveur** (solution robuste mais plus complexe)
