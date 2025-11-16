# 🔧 Fix pour l'Upload de PDF

## Problème Identifié

L'erreur `parse is not a function` indique que pdf-parse ne s'importe pas correctement dans l'environnement Next.js.

## Solutions

### Solution 1: Utiliser require() (Déjà Appliquée)

Le fichier `lib/pdf-parser.ts` a été modifié pour utiliser `require()` au lieu d'`import`.

**Testez maintenant**: Essayez d'uploader un PDF à nouveau.

---

### Solution 2: Si l'erreur persiste - Installer les dépendances natives

pdf-parse nécessite canvas qui a des dépendances natives. Installez-les:

```bash
npm install canvas --legacy-peer-deps
```

---

### Solution 3: Alternative sans pdf-parse

Si pdf-parse continue de poser problème, nous pouvons utiliser une alternative:

#### Option A: pdfjs-dist (Recommandé)

```bash
npm install pdfjs-dist
```

Puis modifier `lib/pdf-parser.ts`:

```typescript
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
    
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    });
    
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file.');
  }
}
```

#### Option B: Utiliser une API externe

Si les bibliothèques locales posent problème, utilisez une API:

```typescript
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // Utiliser l'API Blackbox pour extraire le texte
    const base64 = buffer.toString('base64');
    
    const response = await fetch('https://api.blackbox.ai/v1/pdf/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({ pdf: base64 })
    });
    
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file.');
  }
}
```

---

### Solution 4: Simplifier pour les Tests

Pour tester immédiatement sans PDF, créez un mock:

```typescript
export async function parsePDF(buffer: Buffer): Promise<string> {
  // Mock pour tests - retourne du texte exemple
  return `
Introduction to Machine Learning

Chapter 1: Fundamentals

Machine learning is a subset of artificial intelligence that enables computers to learn from data.

Key Concepts:
- Supervised Learning
- Unsupervised Learning  
- Reinforcement Learning

Applications include image recognition, natural language processing, and recommendation systems.
  `.trim();
}
```

---

## Test Rapide

Après avoir appliqué une solution, testez avec:

1. Ouvrir http://localhost:3000
2. Uploader n'importe quel PDF
3. Vérifier la console du terminal pour les erreurs

---

## Logs à Vérifier

Dans le terminal, vous devriez voir:
- ✅ `Parsing PDF...` - Début du parsing
- ✅ `Extracted X characters` - Texte extrait
- ✅ `Calling GPT-4...` - Extraction de concepts
- ❌ `Error parsing PDF:` - Erreur à investiguer

---

## Quelle Solution Choisir?

1. **Essayez d'abord**: La solution avec `require()` (déjà appliquée)
2. **Si ça ne marche pas**: Installez canvas
3. **Si toujours pas**: Utilisez pdfjs-dist
4. **Pour tester rapidement**: Utilisez le mock

---

## Besoin d'Aide?

Partagez l'erreur complète du terminal et nous trouverons la solution!
