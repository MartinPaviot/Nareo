# 📚 Architecture Complète : Upload et Extraction de Texte

## 🎯 Vue d'Ensemble

Ce document explique en détail comment fonctionne le système d'upload, d'extraction de texte (PDF/DOCX/Images), la génération de questions, et toute l'architecture technique de A à Z.

---

## 📋 Table des Matières

1. [Flux Global du Processus](#1-flux-global-du-processus)
2. [Point d'Entrée : API Upload](#2-point-dentrée--api-upload)
3. [Extraction de Texte par Type de Fichier](#3-extraction-de-texte-par-type-de-fichier)
4. [Analyse IA et Extraction de Concepts](#4-analyse-ia-et-extraction-de-concepts)
5. [Génération des Questions](#5-génération-des-questions)
6. [Stockage et Persistance](#6-stockage-et-persistance)
7. [Architecture Technique Détaillée](#7-architecture-technique-détaillée)
8. [Sécurité et Isolation des Utilisateurs](#8-sécurité-et-isolation-des-utilisateurs)

---

## 1. Flux Global du Processus

```
┌─────────────────────────────────────────────────────────────────┐
│                    UTILISATEUR UPLOAD UN FICHIER                 │
│                  (PDF / DOCX / Image JPG/PNG/etc.)              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              API ROUTE: /api/upload (POST)                       │
│  • Authentification utilisateur (requireAuth)                    │
│  • Validation du type de fichier                                 │
│  • Conversion en Buffer                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────┴────────┐
                    │  Type de fichier │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    IMAGE     │    │     PDF      │    │    DOCX      │
│  (JPG/PNG)   │    │              │    │              │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                    │
       ▼                   ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ parseImage() │    │  parsePDF()  │    │ parseDocx()  │
│ → base64     │    │ → text       │    │ → text       │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                    │
       └───────────────────┼────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              ANALYSE IA (OpenAI GPT-4o)                          │
│  • extractConceptsFromImage() pour images                        │
│  • extractConceptsFromText() pour PDF/DOCX                       │
│  • Extraction de 3-7 concepts structurés                         │
│  • Retour JSON avec title, summary, concepts[]                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           CRÉATION DE 3 CHAPITRES (TOUJOURS)                    │
│  • Chapitre 1: Facile (easy)                                    │
│  • Chapitre 2: Moyen (medium)                                   │
│  • Chapitre 3: Difficile (hard)                                 │
│  • Distribution équitable des concepts                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│        GÉNÉRATION DE 5 QUESTIONS PAR CHAPITRE                    │
│  • Questions 1-3: QCM (A/B/C/D) - 10 points chacune            │
│  • Question 4: Réponse courte - 35 points                       │
│  • Question 5: Réflexion - 35 points                            │
│  • Total: 100 points par chapitre                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              TRADUCTION AUTOMATIQUE (FR/EN)                      │
│  • Titre du chapitre traduit                                    │
│  • Description traduite                                          │
│  • Stockage bilingue                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           STOCKAGE DANS SUPABASE (PostgreSQL)                    │
│  • Table: chapters (avec user_id pour isolation)                │
│  • Table: concepts (liés aux chapitres)                         │
│  • Table: chapter_progress (progression utilisateur)            │
│  • RLS (Row Level Security) activé                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  REDIRECTION VERS /learn/[chapterId]             │
│  • L'utilisateur commence le quiz                               │
│  • Questions affichées une par une                              │
│  • Feedback IA après chaque réponse                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Point d'Entrée : API Upload

### 📁 Fichier: `app/api/upload/route.ts`

### 🔐 Authentification

```typescript
const authResult = await requireAuth(request);
if (isErrorResponse(authResult)) {
  return authResult;
}
const { user } = authResult;
```

**Processus:**
1. Vérifie le token JWT dans les cookies
2. Valide l'utilisateur via Supabase Auth
3. Retourne l'objet `user` avec `user.id`
4. Toutes les données seront liées à cet utilisateur

### 📤 Réception du Fichier

```typescript
const formData = await request.formData();
const file = formData.get('file') as File;
```

**Informations extraites:**
- `file.name`: Nom du fichier
- `file.type`: Type MIME (image/jpeg, application/pdf, etc.)
- `file.size`: Taille en bytes

### ✅ Validation du Type

```typescript
const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const validDocumentTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword' // .doc
];
```

**Rejets:**
- Fichiers non supportés → Erreur 400
- Fichiers corrompus → Erreur 500

### 🔄 Conversion en Buffer

```typescript
const bytes = await file.arrayBuffer();
const buffer = Buffer.from(bytes);
```

**Pourquoi un Buffer?**
- Format universel pour manipuler les données binaires
- Compatible avec toutes les bibliothèques de parsing
- Permet la conversion en base64 pour les images

---

## 3. Extraction de Texte par Type de Fichier

### 🖼️ A. IMAGES (JPG, PNG, GIF, WebP)

#### Fichier: `lib/image-parser.ts`

**Étape 1: Détection du Type d'Image**

```typescript
function detectImageType(buffer: Buffer): string {
  const header = buffer.toString('hex', 0, 4);
  
  if (header.startsWith('ffd8ff')) return 'image/jpeg';
  if (header.startsWith('89504e47')) return 'image/png';
  if (header.startsWith('47494638')) return 'image/gif';
  if (header.startsWith('52494646')) return 'image/webp';
  
  return 'image/jpeg'; // Défaut
}
```

**Magic Numbers:**
- `ffd8ff`: JPEG
- `89504e47`: PNG (89 50 4E 47 = "‰PNG")
- `47494638`: GIF (47 49 46 38 = "GIF8")
- `52494646`: WebP (RIFF)

**Étape 2: Conversion en Base64**

```typescript
const base64Image = buffer.toString('base64');
const mimeType = detectImageType(buffer);
return `data:${mimeType};base64,${base64Image}`;
```

**Résultat:**
```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBD...
```

**Pourquoi Base64?**
- Format requis par l'API GPT-4 Vision
- Permet d'envoyer l'image directement dans la requête JSON
- Pas besoin d'héberger l'image sur un serveur

---

### 📄 B. PDF

#### Fichier: `lib/pdf-parser.ts`

**Bibliothèque utilisée:** `pdf2json`

**Étape 1: Parsing du PDF**

```typescript
const pdfParser = new PDFParser();

pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
  // Extraction du texte
});

pdfParser.parseBuffer(buffer);
```

**Étape 2: Extraction du Texte Page par Page**

```typescript
for (const page of pdfData.Pages) {
  for (const textItem of page.Texts) {
    for (const run of textItem.R) {
      if (run.T) {
        const decodedText = decodeURIComponent(run.T);
        extractedText += decodedText + ' ';
      }
    }
  }
  extractedText += '\n'; // Nouvelle ligne après chaque bloc
}
```

**Structure de pdfData:**
```javascript
{
  Pages: [
    {
      Texts: [
        {
          R: [
            { T: "Hello%20World" }, // Texte encodé en URI
            { T: "This%20is%20a%20test" }
          ]
        }
      ]
    }
  ]
}
```

**Étape 3: Nettoyage du Texte**

```typescript
function cleanPDFText(text: string): string {
  // Espaces multiples → espace unique
  let cleaned = text.replace(/[ \t]+/g, ' ');
  
  // Max 2 sauts de ligne consécutifs
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Supprimer les lignes vides
  const lines = cleaned.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
  
  return cleaned.trim();
}
```

**Étape 4: Extraction du Titre**

```typescript
function extractTitle(text: string, filename: string): string {
  const lines = text.split('\n').filter(line => line.length > 0);
  
  // Chercher une ligne qui ressemble à un titre
  for (const line of lines.slice(0, 5)) {
    if (line.length >= 10 && line.length <= 100 && /[a-zA-Z]/.test(line)) {
      // Éviter les numéros de page, dates, etc.
      if (!/^\d+$/.test(line) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line)) {
        return line;
      }
    }
  }
  
  // Fallback: nom du fichier sans extension
  return filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
}
```

**Gestion des Erreurs:**
- PDF crypté → Erreur
- PDF basé sur des images (scan) → Texte vide → Erreur
- PDF corrompu → Erreur de parsing

---

### 📝 C. DOCX (Word)

#### Fichier: `lib/document-parser.ts`

**Bibliothèque principale:** `mammoth`

**Étape 1: Extraction avec Mammoth**

```typescript
const mammoth = await import('mammoth');
const result = await mammoth.extractRawText({ buffer });
const text = result.value;
```

**Mammoth:**
- Convertit les fichiers .docx en texte brut
- Préserve la structure (paragraphes, listes)
- Ignore le formatage (gras, italique, couleurs)

**Étape 2: Fallback OpenAI (si Mammoth échoue)**

```typescript
if (text.trim().length < 100) {
  return await parseDocxWithOpenAI(buffer);
}
```

**Pourquoi un fallback?**
- Certains DOCX complexes ne sont pas bien parsés par Mammoth
- Documents avec beaucoup d'images ou de tableaux
- Fichiers corrompus ou mal formatés

**Étape 3: Parsing avec OpenAI (Fallback)**

```typescript
async function parseDocxWithOpenAI(buffer: Buffer): Promise<string> {
  const base64Doc = buffer.toString('base64');
  const docDataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Doc}`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Extract ALL text from documents accurately.'
      },
      {
        role: 'user',
        content: 'Extract ALL text from this Word document...'
      }
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });

  return response.choices[0].message.content || '';
}
```

**Note:** GPT-4o peut lire les fichiers DOCX directement via base64

**Étape 4: Nettoyage**

```typescript
function cleanDocumentText(text: string): string {
  // Espaces multiples → espace unique
  let cleaned = text.replace(/\s+/g, ' ');
  
  // Normaliser les sauts de ligne
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Supprimer les caractères de contrôle
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return cleaned.trim();
}
```

---

## 4. Analyse IA et Extraction de Concepts

### 📁 Fichier: `lib/openai-vision.ts`

### 🖼️ A. Pour les Images

**Fonction:** `extractConceptsFromImage(imageDataUrl: string)`

**Étape 1: Extraction OCR du Texte Brut**

```typescript
async function extractTextFromImage(imageDataUrl: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert OCR system. Extract ALL text from images accurately.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract ALL text from this image. Include headings, body text, bullet points, etc.'
          },
          {
            type: 'image_url',
            image_url: { url: imageDataUrl }
          }
        ]
      }
    ],
    temperature: 0.3,
    max_tokens: 3000,
  });

  return response.choices[0].message.content || '';
}
```

**Résultat:** Texte brut extrait de l'image

**Étape 2: Analyse Structurée des Concepts**

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: 'You are an expert educational content analyzer. You MUST respond with valid JSON only.'
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze this educational image and extract learning concepts.

Return ONLY a valid JSON object with this structure:
{
  "title": "Chapter title",
  "summary": "Brief summary",
  "concepts": [
    {
      "title": "Concept name",
      "difficulty": "easy|medium|hard",
      "content": "Detailed explanation",
      "definitions": ["term1", "term2"],
      "keyIdeas": ["idea1", "idea2"],
      "sourceText": "Relevant excerpt"
    }
  ]
}`
        },
        {
          type: 'image_url',
          image_url: { url: imageDataUrl }
        }
      ]
    }
  ],
  temperature: 0.7,
  max_tokens: 2000,
  response_format: { type: 'json_object' }, // Force JSON
});
```

**Résultat JSON:**
```json
{
  "title": "Introduction to Machine Learning",
  "summary": "This chapter covers fundamental ML concepts...",
  "concepts": [
    {
      "title": "What is Machine Learning?",
      "difficulty": "easy",
      "content": "Machine learning is a subset of AI...",
      "definitions": ["Machine Learning", "AI", "Algorithm"],
      "keyIdeas": [
        "Computers learn from experience",
        "No explicit programming needed"
      ],
      "sourceText": "Machine learning enables computers to learn..."
    }
  ],
  "extractedText": "Full OCR text from image..."
}
```

---

### 📄 B. Pour les PDF/DOCX

**Fonction:** `extractConceptsFromText(text: string, title?: string)`

**Processus similaire mais sans image:**

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: 'Analyze text from course materials and extract structured learning concepts.'
    },
    {
      role: 'user',
      content: `Analyze this educational text:

${text.substring(0, 8000)}

Return JSON with title, summary, and concepts array...`
    }
  ],
  temperature: 0.7,
  max_tokens: 2000,
  response_format: { type: 'json_object' },
});
```

**Limite de texte:** 8000 caractères (pour rester dans les limites de tokens)

---

### 🎯 C. Concepts par Défaut (Fallback)

Si l'API OpenAI échoue, des concepts par défaut sont générés:

```typescript
function generateDefaultConcepts() {
  return {
    title: 'Introduction to Machine Learning',
    summary: 'Fundamental ML concepts...',
    concepts: [
      {
        title: 'What is Machine Learning?',
        difficulty: 'easy',
        content: 'ML is a subset of AI...',
        definitions: ['Machine Learning', 'AI'],
        keyIdeas: ['Computers learn from experience']
      },
      // ... 4 autres concepts
    ]
  };
}
```

---

## 5. Génération des Questions

### 📁 Fichier: `lib/openai-vision.ts`

### 🎯 Fonction: `generateChapterQuestions()`

**Paramètres:**
- `chapterTitle`: Titre du chapitre
- `chapterContent`: Contenu des concepts
- `sourceText`: Texte original (PDF/Image)
- `language`: 'EN' ou 'FR'

**Structure des Questions:**

```typescript
{
  "questions": [
    // Questions 1-3: QCM (10 points chacune)
    {
      "questionNumber": 1,
      "type": "mcq",
      "phase": "mcq",
      "question": "What is the main purpose of...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "A",
      "points": 10
    },
    
    // Question 4: Réponse courte (35 points)
    {
      "questionNumber": 4,
      "type": "open",
      "phase": "short",
      "question": "Explain the concept in your own words...",
      "points": 35
    },
    
    // Question 5: Réflexion (35 points)
    {
      "questionNumber": 5,
      "type": "open",
      "phase": "reflective",
      "question": "How would you apply this concept to a real-world situation?",
      "points": 35
    }
  ]
}
```

**Prompt OpenAI:**

```typescript
const prompt = `Generate EXACTLY 5 questions for: ${chapterTitle}

Content: ${chapterContent}
Source: ${sourceText}

Questions 1-3: Multiple Choice (MCQ)
- 4 options (A, B, C, D)
- 10 points each

Question 4: Short Answer
- Explain concept in own words
- 35 points

Question 5: Reflective
- Real-world application
- 35 points

${language === 'FR' ? 'Generate ALL in French' : 'Generate ALL in English'}

Return JSON with questions array...`;
```

**Appel API:**

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: `Expert educational content creator. ${languageInstruction}`
    },
    {
      role: 'user',
      content: prompt
    }
  ],
  temperature: 0.7,
  response_format: { type: 'json_object' },
  max_tokens: 2000,
});
```

**Ajout des IDs:**

```typescript
const questionsWithChapterId: ChapterQuestion[] = questions.map((q: any) => ({
  ...q,
  id: generateId(), // UUID unique
  chapterId: chapterId,
}));
```

---

## 6. Stockage et Persistance

### 📁 Fichier: `lib/memory-store.ts`

### 🗄️ Base de Données: Supabase (PostgreSQL)

### A. Table: `chapters`

**Structure:**
```sql
CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  summary TEXT,
  english_title TEXT,
  english_description TEXT,
  french_title TEXT,
  french_description TEXT,
  pdf_text TEXT,
  extracted_text TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  order_index INTEGER DEFAULT 0,
  questions JSONB, -- Array de questions
  source_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Insertion:**

```typescript
await memoryStore.addChapter({
  id: chapterId,
  title: chapterTitle,
  summary: chapterSummary,
  englishTitle: chapterTitle,
  englishDescription: chapterSummary,
  frenchTitle: frenchTitle,
  frenchDescription: frenchSummary,
  pdfText: '',
  extractedText: extractedData.extractedText,
  difficulty: 'easy', // ou 'medium', 'hard'
  orderIndex: 0,
  questions: questionsWithChapterId,
  sourceText: chapterSourceText,
  createdAt: new Date(),
}, user.id);
```

**Requête Supabase:**

```typescript
const { error } = await serverClient
  .from('chapters')
  .upsert({
    id: chapter.id,
    user_id: resolvedUserId,
    title: chapter.title,
    // ... autres champs
    questions: chapter.questions, // JSONB
  });
```

---

### B. Table: `concepts`

**Structure:**
```sql
CREATE TABLE concepts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  order_index INTEGER DEFAULT 0,
  source_text TEXT
);
```

**Insertion:**

```typescript
await memoryStore.addConcept({
  id: generateId(),
  chapterId: chapterId,
  title: concept.title,
  description: concept.content,
  difficulty: concept.difficulty,
  orderIndex: index,
  sourceText: concept.sourceText,
}, user.id);
```

---

### C. Table: `chapter_progress`

**Structure:**
```sql
CREATE TABLE chapter_progress (
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  current_question INTEGER DEFAULT 1,
  questions_answered INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  answers JSONB DEFAULT '[]',
  PRIMARY KEY (chapter_id, user_id)
);
```

**Initialisation:**

```typescript
await memoryStore.initializeChapterProgress(chapterId, user.id);
```

**Mise à jour après chaque réponse:**

```typescript
await memoryStore.addChapterAnswer(
  chapterId,
  questionId,
  questionNumber,
  answer,
  correct,
  score,
  feedback,
  user.id
);
```

---

## 7. Architecture Technique Détaillée

### 🏗️ Stack Technologique

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  • Next.js 14 (App Router)                                  │
│  • React 18                                                  │
│  • TypeScript                                                │
│  • Tailwind CSS                                              │
│  • Supabase Client (Browser)                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP/HTTPS
                         │
┌────────────────────────▼────────────────────────────────────┐
│                     API ROUTES (Next.js)                     │
│  • /api/upload (POST)                                       │
│  • /api/chapters/[id] (GET)                                 │
│  • /api/chat/question (POST)                                │
│  • /api/chat/evaluate (POST)                                │
│  • Authentication via requireAuth()                          │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   PARSERS    │  │   OPENAI     │  │   SUPABASE   │
│              │  │              │  │              │
│ • pdf-parser │  │ • GPT-4o     │  │ • PostgreSQL │
│ • image-     │  │ • Vision API │  │ • Auth       │
│   parser     │  │ • Chat API   │  │ • Storage    │
│ • document-  │  │              │  │ • RLS        │
│   parser     │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

### 📦 Dépendances Principales

**package.json:**
```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "openai": "^4.x",
    "@supabase/supabase-js": "^2.x",
    "pdf2json": "^3.x",
    "mammoth": "^1.x"
  }
}
```

---

### 🔄 Flux de Données Complet

```
USER UPLOADS FILE
       ↓
[Frontend: Upload Component]
       ↓
POST /api/upload
       ↓
[Authentication Check]
       ↓
[File Validation]
       ↓
[Convert to Buffer]
       ↓
┌──────┴──────┐
│ File Type?  │
└──────┬──────┘
       │
   ┌───┴───┬───────┬───────┐
   │       │       │       │
 IMAGE    PDF    DOCX    OTHER
   │       │       │       │
   ▼       ▼       ▼       ▼
parseImage parsePDF parseDocx ERROR
   │       │       │
   └───┬───┴───┬───┘
       │       │
       ▼       ▼
  base64    text
       │       │
       └───┬───┘
           │
           ▼
[OpenAI Analysis]
  • extractConceptsFromImage()
  • extractConceptsFromText()
           │
           ▼
[Structured Concepts JSON]
  • title
  • summary
  • concepts[]
  • extractedText
           │
           ▼
[Create 3 Chapters]
  • Easy
  • Medium
  • Hard
           │
           ▼
[Generate 5 Questions per Chapter]
  • 3 MCQ (10 pts each)
  • 1 Short (35 pts)
  • 1 Reflective (35 pts)
           │
           ▼
[Translate to French]
  • Title
  • Description
           │
           ▼
[Store in Supabase]
  • chapters table
  • concepts table
  • chapter_progress table
           │
           ▼
[Initialize Progress]
  • current_question: 1
  • questions_answered: 0
  • score: 0
  • completed: false
           │
           ▼
[Return Response]
  • chapterId (first chapter)
  • title
  • chapters[] (3 chapters)
  • totalQuestions (15)
           │
           ▼
[Redirect to /learn/[chapterId]]
```

---

## 8. Sécurité et Isolation des Utilisateurs

### 🔐 A. Authentification

**Fichier:** `lib/api-auth.ts`

```typescript
export async function requireAuth(request: NextRequest) {
  const serverClient = await createSupabaseServerClient();
  
  const { data: { user }, error } = await serverClient.auth.getUser();
  
  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return { user };
}
```

**Processus:**
1. Lit le cookie de session Supabase
2. Vérifie le JWT token
3. Retourne l'utilisateur ou erreur 401

---

### 🛡️ B. Row Level Security (RLS)

**Toutes les tables ont des politiques RLS:**

```sql
-- Politique pour la table chapters
CREATE POLICY "Users can only see their own chapters"
ON chapters FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own chapters"
ON chapters FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own chapters"
ON chapters FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own chapters"
ON chapters FOR DELETE
USING (auth.uid() = user_id);
```

**Avantages:**
- Isolation automatique au niveau de la base de données
- Impossible d'accéder aux données d'un autre utilisateur
- Même si le code a un bug, RLS protège

---

### 🔑 C. User ID Propagation

**Dans memory-store.ts:**

```typescript
private async getUserId(providedUserId?: string): Promise<string | null> {
  // Si fourni directement (depuis API route), l'utiliser
  if (providedUserId) {
    return providedUserId;
  }

  // Sinon, essayer SSR client
  const serverClient = await createSupabaseServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  
  if (user?.id) {
    return user.id;
  }

  // Fallback: client browser
  const { data: { user: browserUser } } = await supabase.auth.getUser();
  return browserUser?.id || null;
}
```

**Toutes les opérations incluent le user_id:**

```typescript
await memoryStore.addChapter(chapter, user.id);
await memoryStore.addConcept(concept, user.id);
await memoryStore.initializeChapterProgress(chapterId, user.id);
```

---

## 9. Évaluation des Réponses et Feedback IA

### 📁 Fichier: `lib/openai-vision.ts`

### 🎯 Fonction: `evaluateAnswer()`

**Paramètres:**
- `question`: La question posée
- `studentAnswer`: Réponse de l'étudiant
- `phase`: 1 (QCM), 2 (Court), 3 (Réflexion)
- `correctAnswer`: Réponse correcte (pour QCM)
- `sourceText`: Texte source pour vérification
- `language`: 'EN' ou 'FR'

### A. Évaluation QCM (Phase 1)

```typescript
if (phase === 1 && correctAnswer) {
  const prompt = `Question : ${question}
Réponse de l'étudiant : ${studentAnswer}
Réponse correcte : ${correctAnswer}

La réponse est-elle correcte ?
Réponds avec du JSON : 
{
  "correct": true/false, 
  "feedback": "feedback bref en français"
}`;
}
```

**Réponse attendue:**
```json
{
  "correct": true,
  "feedback": "✅ Correct ! La réponse A est bien la bonne. Le machine learning permet aux ordinateurs d'apprendre à partir de données sans être explicitement programmés."
}
```

ou

```json
{
  "correct": false,
  "feedback": "❌ Incorrect. La bonne réponse est A. Le machine learning se concentre sur l'apprentissage à partir de données, pas sur la programmation explicite."
}
```

---

### B. Évaluation Réponse Courte (Phase 2)

```typescript
const prompt = `Question : ${question}
Réponse de l'étudiant : ${studentAnswer}

Évalue cette réponse pour la Phase 2. Considère :
• Exactitude et compréhension
• Complétude
• Clarté de l'explication

Réponds avec du JSON :
{
  "score": 0-30,
  "feedback": "feedback constructif en français",
  "needsClarification": true/false,
  "followUpQuestion": "question de suivi optionnelle"
}`;
```

**Exemple de réponse:**
```json
{
  "score": 25,
  "feedback": "Bonne explication ! Tu as bien compris que le machine learning permet aux ordinateurs d'apprendre à partir de données. Pour améliorer ta réponse, tu pourrais mentionner les différents types d'apprentissage (supervisé, non supervisé).",
  "needsClarification": false,
  "followUpQuestion": null
}
```

---

### C. Évaluation Réflexion (Phase 3)

```typescript
const prompt = `Question : ${question}
Réponse de l'étudiant : ${studentAnswer}

Évalue cette réponse pour la Phase 3. Considère :
• Exactitude et compréhension
• Complétude
• Clarté de l'explication
• Profondeur de la réflexion et connexion au monde réel

Réponds avec du JSON :
{
  "score": 0-60,
  "feedback": "feedback constructif en français",
  "needsClarification": true/false,
  "followUpQuestion": "question de suivi optionnelle"
}`;
```

**Exemple de réponse:**
```json
{
  "score": 50,
  "feedback": "Excellente réflexion ! Tu as bien identifié une application concrète du machine learning dans la recommandation de contenu. Ta réponse montre une bonne compréhension de comment l'algorithme apprend des préférences des utilisateurs. Pour aller plus loin, tu pourrais discuter des défis éthiques liés à ces systèmes de recommandation.",
  "needsClarification": false,
  "followUpQuestion": null
}
```

---

### 🤖 D. Règles du Tuteur IA (Aristo)

**System Prompt complet:**

```typescript
const systemPrompt = `Tu es Aristo, l'assistant pédagogique de LevelUp.

RÈGLE ABSOLUE : Tu ne fais RIEN par toi-même. Tu suis strictement l'état envoyé par le backend.

Le backend t'envoie :
• chapterId, chapterTitle
• currentQuestionIndex (0 pour la première)
• totalQuestions
• isFirstVisit (booléen)
• hasExistingHistory (booléen)
• chapterCompleted (booléen)
• questionType (QCM, Court, Réflexion)
• questionText et choices éventuelles
• lastUserAnswer et isCorrect éventuel

1) INTRODUCTION DU CHAPITRE

Message d'introduction (UNIQUEMENT si currentQuestionIndex == 0 ET isFirstVisit == true) :

👋 Bonjour ! Je suis Aristo, votre assistant d'apprentissage.

📚 Bienvenue dans le chapitre [TITRE] !

Ce chapitre contient 5 questions. Chaque question ne peut être répondue qu'une seule fois.

🎯 Points par question :
• Questions 1-3 (QCM) : 10 points chacune
• Questions 4-5 (Réponse courte/Réflexive) : 35 points chacune

📝 Important : Une seule tentative par question !

✨ Commençons !

2) AFFICHAGE DES QUESTIONS

Pour un QCM :

Question X : [intitulé]

A) …
B) …
C) …
D) …

💡 Tapez la lettre de votre réponse (A, B, C ou D)

3) CORRECTION

Si isCorrect == true :
• Félicite brièvement
• Explique pourquoi c'est correct
• Laisse le backend envoyer la question suivante

Si isCorrect == false :
• Explique que c'est incorrect
• Donne la bonne réponse avec explication
• La question est terminée

4) REPRISE APRÈS REFRESH

Quand hasExistingHistory == true :
• Ne réaffiche PAS l'introduction
• Ne réaffiche PAS les questions précédentes
• Continue à partir de la dernière question

5) FIN DU CHAPITRE

Quand chapterCompleted == true :
• Message de félicitations
• Indique le score
• Invite à passer au chapitre suivant`;
```

---

## 10. Exemples Concrets de Flux

### 📸 Exemple 1: Upload d'une Image (Screenshot de Notes)

**1. Utilisateur upload une image de notes manuscrites**

```
Fichier: notes_ml.jpg (2.3 MB)
Type: image/jpeg
```

**2. API reçoit le fichier**

```typescript
POST /api/upload
Content-Type: multipart/form-data

{
  file: [Binary data]
}
```

**3. Conversion en base64**

```typescript
const buffer = Buffer.from(await file.arrayBuffer());
const base64 = buffer.toString('base64');
const dataUrl = `data:image/jpeg;base64,${base64}`;
```

**4. Extraction OCR**

```
Texte extrait:
"Machine Learning
- Supervised Learning: Uses labeled data
- Unsupervised Learning: Finds patterns in unlabeled data
- Neural Networks: Inspired by human brain
- Deep Learning: Multiple layers of neural networks"
```

**5. Analyse IA**

```json
{
  "title": "Introduction to Machine Learning",
  "summary": "Overview of ML types and neural networks",
  "concepts": [
    {
      "title": "Supervised Learning",
      "difficulty": "easy",
      "content": "Uses labeled training data...",
      "sourceText": "Supervised Learning: Uses labeled data"
    },
    {
      "title": "Unsupervised Learning",
      "difficulty": "medium",
      "content": "Finds patterns in unlabeled data...",
      "sourceText": "Unsupervised Learning: Finds patterns..."
    },
    {
      "title": "Neural Networks",
      "difficulty": "hard",
      "content": "Computing systems inspired by brain...",
      "sourceText": "Neural Networks: Inspired by human brain"
    }
  ]
}
```

**6. Création de 3 chapitres**

```
Chapitre 1 (Easy): "Supervised Learning"
- 5 questions générées
- Difficulté: Facile

Chapitre 2 (Medium): "Unsupervised Learning"
- 5 questions générées
- Difficulté: Moyen

Chapitre 3 (Hard): "Neural Networks"
- 5 questions générées
- Difficulté: Difficile
```

**7. Stockage Supabase**

```sql
INSERT INTO chapters (id, user_id, title, questions, ...)
VALUES ('ch_123', 'user_456', 'Supervised Learning', [...], ...);

INSERT INTO chapter_progress (chapter_id, user_id, current_question, ...)
VALUES ('ch_123', 'user_456', 1, ...);
```

**8. Redirection**

```
→ /learn/ch_123
```

---

### 📄 Exemple 2: Upload d'un PDF (Cours Universitaire)

**1. Utilisateur upload un PDF**

```
Fichier: cours_ml.pdf (5.8 MB, 45 pages)
Type: application/pdf
```

**2. Parsing PDF**

```typescript
const text = await parsePDF(buffer);

// Résultat:
"Introduction to Machine Learning
Chapter 1: Fundamentals
Machine learning is a branch of artificial intelligence...
[8000+ caractères de texte]"
```

**3. Extraction du titre**

```typescript
const title = extractPDFTitle(text, 'cours_ml.pdf');
// → "Introduction to Machine Learning"
```

**4. Analyse IA (limité à 8000 caractères)**

```typescript
const extractedData = await extractConceptsFromText(
  text.substring(0, 8000),
  title
);
```

**5. Génération de 3 chapitres avec questions**

```
Total: 15 questions (5 par chapitre)
Score maximum: 300 points (100 par chapitre)
```

---

### 🎓 Exemple 3: Session d'Apprentissage Complète

**1. Utilisateur commence le chapitre**

```
GET /learn/ch_123
```

**2. Aristo affiche l'introduction**

```
👋 Bonjour ! Je suis Aristo...
📚 Bienvenue dans le chapitre "Supervised Learning" !
...
✨ Commençons !
```

**3. Question 1 (QCM)**

```
Question 1 : What is supervised learning?

A) Learning without labels
B) Learning with labeled training data
C) Learning by trial and error
D) Learning from unlabeled data

💡 Tapez la lettre de votre réponse (A, B, C ou D)
```

**4. Utilisateur répond "B"**

```
POST /api/chat/evaluate
{
  "chapterId": "ch_123",
  "questionNumber": 1,
  "answer": "B"
}
```

**5. Évaluation IA**

```json
{
  "correct": true,
  "score": 10,
  "feedback": "✅ Correct ! La réponse B est bien la bonne. Le supervised learning utilise des données d'entraînement étiquetées pour apprendre la relation entre les entrées et les sorties."
}
```

**6. Mise à jour de la progression**

```sql
UPDATE chapter_progress
SET 
  current_question = 2,
  questions_answered = 1,
  score = 10,
  answers = answers || '[{"questionId": "q1", "answer": "B", "correct": true, "score": 10}]'
WHERE chapter_id = 'ch_123' AND user_id = 'user_456';
```

**7. Question 2 affichée automatiquement**

```
Question 2 : Which algorithm is commonly used in supervised learning?
...
```

**8. Après 5 questions → Chapitre terminé**

```
🎉 Félicitations ! Vous avez terminé le chapitre !

📊 Votre score : 85/100

✨ Passez au chapitre suivant pour continuer votre apprentissage !
```

---

## 11. Gestion des Erreurs et Cas Limites

### ⚠️ A. Erreurs Courantes

**1. Fichier trop volumineux**

```typescript
if (file.size > 10 * 1024 * 1024) { // 10 MB
  return NextResponse.json(
    { error: 'File too large. Maximum size: 10 MB' },
    { status: 400 }
  );
}
```

**2. PDF crypté ou protégé**

```typescript
try {
  const text = await parsePDF(buffer);
  if (!text || text.length < 100) {
    throw new Error('Unable to extract text from PDF');
  }
} catch (error) {
  return NextResponse.json(
    { error: 'PDF is encrypted or contains no extractable text' },
    { status: 400 }
  );
}
```

**3. API OpenAI en panne**

```typescript
try {
  const concepts = await extractConceptsFromText(text);
} catch (error) {
  console.error('OpenAI API error:', error);
  // Utiliser les concepts par défaut
  const concepts = generateDefaultConcepts();
}
```

**4. Utilisateur non authentifié**

```typescript
const authResult = await requireAuth(request);
if (isErrorResponse(authResult)) {
  return NextResponse.json(
    { error: 'Please log in to upload files' },
    { status: 401 }
  );
}
```

---

### 🔄 B. Retry Logic

**Pour les appels OpenAI:**

```typescript
async function callOpenAIWithRetry(prompt: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await openai.chat.completions.create({...});
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

## 12. Performance et Optimisations

### ⚡ A. Optimisations Actuelles

**1. Streaming des réponses**

```typescript
// Les réponses du chatbot sont streamées en temps réel
const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  stream: true,
});
```

**2. Mise en cache des traductions**

```typescript
// Les traductions sont stockées dans Supabase
await memoryStore.setTranslation(key, value);
const cached = await memoryStore.getTranslation(key);
```

**3. Indexation de la base de données**

```sql
CREATE INDEX idx_chapters_user_id ON chapters(user_id);
CREATE INDEX idx_concepts_chapter_id ON concepts(chapter_id);
CREATE INDEX idx_chapter_progress_user_id ON chapter_progress(user_id);
```

---

### 📊 B. Métriques de Performance

**Temps moyens:**
- Upload + Parsing PDF: 2-5 secondes
- Upload + Parsing Image: 3-7 secondes
- Analyse IA (concepts): 5-10 secondes
- Génération questions (5): 3-5 secondes
- Traduction (titre + description): 2-3 secondes

**Total pour un upload complet: 15-30 secondes**

---

## 13. Diagramme de Séquence Complet

```
Utilisateur    Frontend    API Upload    Parsers    OpenAI    Supabase
    │              │            │           │          │          │
    │─Upload File─>│            │           │          │          │
    │              │            │           │          │          │
    │              │─POST /api/upload──────>│          │          │
    │              │            │           │          │          │
    │              │            │─requireAuth()────────│──────────>│
    │              │            │           │          │          │
    │              │            │<─────────────────────│──────────│
    │              │            │  {user}   │          │          │
    │              │            │           │          │          │
    │              │            │─Validate File        │          │
    │              │            │           │          │          │
    │              │            │─Convert to Buffer    │          │
    │              │            │           │          │          │
    │              │            │─parsePDF()─>         │          │
    │              │            │           │          │          │
    │              │            │<──text────│          │          │
    │              │            │           │          │          │
    │              │            │─extractConceptsFromText()───────>│
    │              │            │           │          │          │
    │              │            │<─────────────────────│          │
    │              │            │  {concepts}          │          │
    │              │            │           │          │          │
    │              │            │─Create 3 Chapters    │          │
    │              │            │           │          │          │
    │              │            │─generateChapterQuestions()──────>│
    │              │            │           │          │          │
    │              │            │<─────────────────────│          │
    │              │            │  {questions}         │          │
    │              │            │           │          │          │
    │              │            │─Translate to French──│──────────>│
    │              │            │           │          │          │
    │              │            │<─────────────────────│          │
    │              │            │  {translations}      │          │
    │              │            │           │          │          │
    │              │            │─memoryStore.addChapter()────────>│
    │              │            │           │          │          │
    │              │            │<─────────────────────│──────────│
    │              │            │  Success             │          │
    │              │            │           │          │          │
    │              │<─Response──│           │          │          │
    │              │  {chapterId}          │          │          │
    │              │            │           │          │          │
    │<─Redirect────│            │           │          │          │
    │ /learn/[id]  │            │           │          │          │
```

---

## 14. Conclusion

### ✅ Points Clés

1. **Upload Flexible**: Support de PDF, DOCX, et images
2. **Extraction Intelligente**: OCR pour images, parsing natif pour documents
3. **Analyse IA Avancée**: GPT-4o pour extraire des concepts structurés
4. **Génération Automatique**: 15 questions (3 chapitres × 5 questions)
5. **Multilingue**: Support EN/FR avec traduction automatique
6. **Sécurité Robuste**: RLS, authentification, isolation utilisateur
7. **Feedback Pédagogique**: IA tuteur (Aristo) pour guider l'apprentissage

### 🚀 Technologies Utilisées

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Next.js API Routes
- **IA**: OpenAI GPT-4o (Vision + Chat)
- **Base de Données**: Supabase (PostgreSQL)
- **Parsing**: pdf2json, mammoth
- **Authentification**: Supabase Auth
- **Sécurité**: Row Level Security (RLS)

### 📈 Flux de Données Résumé

```
Upload → Parse → Analyze → Generate → Translate → Store → Learn
```

Chaque étape est optimisée pour la performance et la fiabilité, avec des fallbacks en cas d'erreur.

---

**Document créé le:** 2024
**Dernière mise à jour:** 2024
**Version:** 1.0
