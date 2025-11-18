import OpenAI from 'openai';

// Configuration pour utiliser l'API OpenAI directement
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Utilise l'API OpenAI directement (pas de proxy Blackbox)
});

/**
 * Extract raw text from an image using GPT-4 Vision (OCR)
 */
export async function extractTextFromImage(imageDataUrl: string): Promise<string> {
  console.log('📝 Extracting raw text from image...');
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert OCR system. Extract ALL text from images accurately, preserving structure and formatting as much as possible.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract ALL text from this image. Include:
- All visible text (typed or handwritten)
- Headings, titles, and subtitles
- Body text and paragraphs
- Bullet points and lists
- Captions and labels
- Any text in diagrams or charts

Preserve the structure and order of the text as it appears in the image.
Return ONLY the extracted text, no additional commentary.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.3, // Lower temperature for more accurate extraction
      max_tokens: 3000,
    });

    const extractedText = response.choices[0].message.content || '';
    console.log('✅ Extracted', extractedText.length, 'characters of text from image');
    return extractedText;
  } catch (error: any) {
    console.error('❌ Error extracting text from image:', error.message);
    return ''; // Return empty string on error
  }
}

/**
 * Extract text and concepts from an image using GPT-4 Vision
 * Now returns both the structured concepts AND the raw extracted text
 */
export async function extractConceptsFromImage(imageDataUrl: string) {
  console.log('🔍 Analyzing image with GPT-4 Vision...');
  
  try {
    // First, extract raw text from the image
    const extractedText = await extractTextFromImage(imageDataUrl);
    
    // Then, analyze the image for structured concepts
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content analyzer. Analyze images of course materials, notes, textbooks, or slides and extract structured learning concepts. You MUST respond with valid JSON only.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this educational image and extract learning concepts.

You MUST return ONLY a valid JSON object with this EXACT structure (no markdown, no code blocks, just pure JSON):
{
  "title": "Chapter or topic title from the image",
  "summary": "Brief 2-3 sentence summary of the content",
  "concepts": [
    {
      "title": "Concept name",
      "difficulty": "easy|medium|hard",
      "content": "Detailed explanation of the concept",
      "definitions": ["key term 1", "key term 2"],
      "keyIdeas": ["main idea 1", "main idea 2", "main idea 3"],
      "sourceText": "Relevant excerpt from the original text"
    }
  ]
}

Guidelines:
- Extract 3-7 main concepts from the image
- Order concepts from foundational to advanced
- Assign difficulty based on complexity
- If the image contains text, extract it accurately
- If it's a diagram, explain what it shows
- If it's handwritten notes, interpret them clearly
- For each concept, include the relevant sourceText excerpt from the image
- IMPORTANT: Return ONLY valid JSON, no other text`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }, // Force JSON response
    });

    const content = response.choices[0].message.content;
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(content || '{}');
      console.log('✅ Successfully extracted', parsed.concepts?.length || 0, 'concepts from image');
      
      // Return both the structured data and the raw extracted text
      return {
        ...parsed,
        extractedText, // Add the raw text to the response
      };
    } catch (parseError) {
      console.log('⚠️ Response was not JSON, extracting text...');
      // If not JSON, treat as plain text and create concepts from it
      const fallbackData = createConceptsFromText(content || '');
      return {
        ...fallbackData,
        extractedText,
      };
    }
  } catch (error: any) {
    console.error('❌ Error calling GPT-4 Vision:', error.message);
    console.log('⚠️ Using fallback concept generation...');
    
    // Fallback: Generate default concepts
    return {
      ...generateDefaultConcepts(),
      extractedText: '', // No text extracted in fallback
    };
  }
}

/**
 * Create concepts from plain text response
 */
function createConceptsFromText(text: string) {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const concepts = [];
  
  let currentConcept: any = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Look for numbered items or bullet points
    if (/^[\d]+\./.test(trimmed) || /^[-•*]/.test(trimmed)) {
      if (currentConcept) {
        concepts.push(currentConcept);
      }
      
      currentConcept = {
        title: trimmed.replace(/^[\d]+\.\s*/, '').replace(/^[-•*]\s*/, ''),
        difficulty: concepts.length < 2 ? 'easy' : concepts.length < 4 ? 'medium' : 'hard',
        content: '',
        definitions: [],
        keyIdeas: []
      };
    } else if (currentConcept && trimmed.length > 20) {
      currentConcept.content += trimmed + ' ';
    }
  }
  
  if (currentConcept) {
    concepts.push(currentConcept);
  }
  
  if (concepts.length === 0) {
    return generateDefaultConcepts();
  }
  
  return {
    title: 'Course Content from Image',
    summary: 'Concepts extracted from the uploaded image.',
    concepts: concepts.slice(0, 7)
  };
}

/**
 * Extract concepts from plain text (for PDFs and Word documents)
 * Similar to extractConceptsFromImage but works with text input
 */
export async function extractConceptsFromText(text: string, title?: string) {
  console.log('🔍 Analyzing text document with GPT-4...');
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content analyzer. Analyze text from course materials, documents, or textbooks and extract structured learning concepts. You MUST respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Analyze this educational text and extract learning concepts.

Text Content:
${text.substring(0, 8000)}

You MUST return ONLY a valid JSON object with this EXACT structure (no markdown, no code blocks, just pure JSON):
{
  "title": "Chapter or topic title from the text",
  "summary": "Brief 2-3 sentence summary of the content",
  "concepts": [
    {
      "title": "Concept name",
      "difficulty": "easy|medium|hard",
      "content": "Detailed explanation of the concept",
      "definitions": ["key term 1", "key term 2"],
      "keyIdeas": ["main idea 1", "main idea 2", "main idea 3"],
      "sourceText": "Relevant excerpt from the original text"
    }
  ]
}

Guidelines:
- Extract 3-7 main concepts from the text
- Order concepts from foundational to advanced
- Assign difficulty based on complexity
- For each concept, include the relevant sourceText excerpt
- IMPORTANT: Return ONLY valid JSON, no other text`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    
    try {
      const parsed = JSON.parse(content || '{}');
      console.log('✅ Successfully extracted', parsed.concepts?.length || 0, 'concepts from text');
      
      return {
        ...parsed,
        extractedText: text,
      };
    } catch (parseError) {
      console.log('⚠️ Response was not JSON, creating concepts from text...');
      const fallbackData = createConceptsFromText(content || '');
      return {
        ...fallbackData,
        extractedText: text,
      };
    }
  } catch (error: any) {
    console.error('❌ Error analyzing text:', error.message);
    console.log('⚠️ Using fallback concept generation...');
    
    return {
      ...generateDefaultConcepts(),
      extractedText: text,
    };
  }
}

/**
 * Generate default concepts when API fails
 */
function generateDefaultConcepts() {
  console.log('📝 Generating default Machine Learning concepts...');
  
  return {
    title: 'Introduction to Machine Learning',
    summary: 'This chapter covers fundamental concepts in machine learning, from basic principles to advanced techniques. Perfect for beginners and intermediate learners.',
    concepts: [
      {
        title: 'What is Machine Learning?',
        difficulty: 'easy',
        content: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed. It focuses on developing algorithms that can identify patterns and make decisions with minimal human intervention.',
        definitions: ['Machine Learning', 'Artificial Intelligence', 'Algorithm', 'Pattern Recognition'],
        keyIdeas: [
          'Computers learn from experience',
          'No explicit programming needed',
          'Improves automatically with more data',
          'Makes predictions based on patterns'
        ]
      },
      {
        title: 'Supervised Learning',
        difficulty: 'medium',
        content: 'Supervised learning uses labeled training data to learn the relationship between inputs and outputs. The algorithm learns from examples where the correct answer is known, then applies this knowledge to new, unseen data. Common applications include classification (categorizing data) and regression (predicting continuous values).',
        definitions: ['Labeled Data', 'Training Set', 'Classification', 'Regression', 'Features', 'Labels'],
        keyIdeas: [
          'Learn from labeled examples',
          'Predict outcomes for new data',
          'Requires quality training data',
          'Two main types: classification and regression',
          'Accuracy improves with more examples'
        ]
      },
      {
        title: 'Unsupervised Learning',
        difficulty: 'medium',
        content: 'Unsupervised learning finds patterns in unlabeled data without predefined categories. The algorithm explores the data structure on its own, discovering hidden patterns and relationships. Key techniques include clustering (grouping similar items) and dimensionality reduction (simplifying complex data).',
        definitions: ['Unlabeled Data', 'Clustering', 'Dimensionality Reduction', 'Pattern Discovery', 'K-means'],
        keyIdeas: [
          'No labels or categories provided',
          'Discovers hidden patterns automatically',
          'Groups similar data points together',
          'Reduces data complexity',
          'Useful for exploratory analysis'
        ]
      },
      {
        title: 'Neural Networks and Deep Learning',
        difficulty: 'hard',
        content: 'Neural networks are computing systems inspired by biological neural networks in animal brains. Deep learning uses neural networks with multiple layers (deep networks) to learn hierarchical representations of data. This approach has revolutionized fields like computer vision, natural language processing, and speech recognition.',
        definitions: ['Neural Network', 'Deep Learning', 'Layers', 'Neurons', 'Activation Function', 'Backpropagation'],
        keyIdeas: [
          'Inspired by human brain structure',
          'Multiple layers process information',
          'Each layer learns different features',
          'Powerful for complex patterns',
          'Requires significant computational resources'
        ]
      },
      {
        title: 'Model Training and Evaluation',
        difficulty: 'medium',
        content: 'Training involves fitting a model to data by adjusting its parameters to minimize errors. Evaluation measures how well the model performs on unseen data. Key concepts include splitting data into training/validation/test sets, avoiding overfitting (memorizing training data), and using metrics like accuracy, precision, and recall.',
        definitions: ['Training Set', 'Validation Set', 'Test Set', 'Overfitting', 'Underfitting', 'Cross-validation'],
        keyIdeas: [
          'Split data into separate sets',
          'Train on training set only',
          'Validate during training',
          'Test on completely unseen data',
          'Balance between overfitting and underfitting',
          'Use appropriate evaluation metrics'
        ]
      }
    ]
  };
}

/**
 * Generate all 5 questions for a chapter at once
 * Questions 1-3: MCQ with A, B, C, D options (10 points each)
 * Question 4: Short answer (35 points)
 * Question 5: Reflective question (35 points)
 */
export async function generateChapterQuestions(
  chapterTitle: string,
  chapterContent: string,
  sourceText?: string,
  language: 'EN' | 'FR' = 'EN'
) {
  console.log('📝 Generating 5 questions for chapter:', chapterTitle);
  
  const languageInstruction = language === 'FR'
    ? 'Generate ALL questions and options in French (français).'
    : 'Generate ALL questions and options in English.';
  
  const prompt = `You are creating a learning quiz for the following chapter:

Title: ${chapterTitle}
Content: ${chapterContent}

${sourceText ? `Original Source Material:\n${sourceText.substring(0, 2000)}\n\n` : ''}

Generate EXACTLY 5 questions based on this content:

**Questions 1-3: Multiple Choice (MCQ)**
- Test basic understanding and key concepts
- Each question must have exactly 4 options (A, B, C, D)
- Clearly indicate the correct answer
- Worth 10 points each

**Question 4: Short Answer**
- Ask the student to explain a concept in their own words
- Should test deeper understanding
- Worth 35 points

**Question 5: Reflective**
- Ask how the concept applies to real-world scenarios
- Should encourage critical thinking
- Worth 35 points

${sourceText ? 'Base ALL questions on the actual content from the source material.' : ''}

${languageInstruction}

Return a JSON object with this EXACT structure:
{
  "questions": [
    {
      "questionNumber": 1,
      "type": "mcq",
      "phase": "mcq",
      "question": "Question text here?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": "A",
      "points": 10
    },
    {
      "questionNumber": 2,
      "type": "mcq",
      "phase": "mcq",
      "question": "Question text here?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": "B",
      "points": 10
    },
    {
      "questionNumber": 3,
      "type": "mcq",
      "phase": "mcq",
      "question": "Question text here?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": "C",
      "points": 10
    },
    {
      "questionNumber": 4,
      "type": "open",
      "phase": "short",
      "question": "Explain [concept] in your own words...",
      "points": 35
    },
    {
      "questionNumber": 5,
      "type": "open",
      "phase": "reflective",
      "question": "How would you apply [concept] to a real-world situation?",
      "points": 35
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert educational content creator. Generate engaging, accurate questions based on learning materials. Always return valid JSON. ${languageInstruction}`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');
    
    console.log('✅ Generated', parsed.questions?.length || 0, 'questions for chapter');
    return parsed.questions || [];
  } catch (error) {
    console.error('❌ Error generating chapter questions:', error);
    
    // Fallback: Generate default questions
    return generateDefaultChapterQuestions(chapterTitle);
  }
}

/**
 * Generate default questions when API fails
 */
function generateDefaultChapterQuestions(chapterTitle: string) {
  console.log('📝 Generating default questions for:', chapterTitle);
  
  return [
    {
      questionNumber: 1,
      type: 'mcq',
      phase: 'mcq',
      question: `What is the main concept covered in "${chapterTitle}"?`,
      options: [
        'Understanding the fundamental principles',
        'Memorizing specific facts',
        'Applying advanced techniques',
        'Reviewing historical context'
      ],
      correctAnswer: 'A',
      points: 10
    },
    {
      questionNumber: 2,
      type: 'mcq',
      phase: 'mcq',
      question: `Which of the following best describes a key aspect of ${chapterTitle}?`,
      options: [
        'It requires extensive prior knowledge',
        'It builds on foundational concepts',
        'It is only theoretical',
        'It has no practical applications'
      ],
      correctAnswer: 'B',
      points: 10
    },
    {
      questionNumber: 3,
      type: 'mcq',
      phase: 'mcq',
      question: `What is an important consideration when learning about ${chapterTitle}?`,
      options: [
        'Speed over understanding',
        'Memorization over comprehension',
        'Understanding the underlying principles',
        'Skipping difficult parts'
      ],
      correctAnswer: 'C',
      points: 10
    },
    {
      questionNumber: 4,
      type: 'open',
      phase: 'short',
      question: `Explain the main concept of "${chapterTitle}" in your own words. What makes it important?`,
      points: 35
    },
    {
      questionNumber: 5,
      type: 'open',
      phase: 'reflective',
      question: `How could you apply the concepts from "${chapterTitle}" to solve a real-world problem? Provide a specific example.`,
      points: 35
    }
  ];
}

// Re-export other functions from the original openai.ts
export async function generateQuizQuestion(
  concept: string,
  phase: 1 | 2 | 3,
  previousQuestions: string[] = [],
  sourceText?: string // Optional source text from the original image/PDF
) {
  const phaseInstructions = {
    1: 'Generate a multiple-choice question (4 options) to test basic understanding. Include the correct answer.',
    2: 'Generate a short-answer question that requires the student to explain the concept in their own words.',
    3: 'Generate an open-ended reflective question that asks how this concept applies to real-world scenarios or personal experience.',
  };

  const prompt = `Concept: ${concept}

${sourceText ? `Original Source Material:\n${sourceText.substring(0, 1000)}\n\n` : ''}${phaseInstructions[phase]}

${previousQuestions.length > 0 ? `Previous questions to avoid duplicating:\n${previousQuestions.join('\n')}` : ''}

${sourceText ? 'Base your question on the actual content from the source material above.' : ''}

Return a JSON object with this structure:
${phase === 1 ? '{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A"}' : '{"question": "..."}'}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are Aristo, a friendly AI tutor. Generate engaging educational questions based on the provided learning materials.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content || '{}');
  } catch (error) {
    console.error('Error generating question:', error);
    
    // Fallback questions
    if (phase === 1) {
      return {
        question: `What is the main purpose of ${concept}?`,
        options: [
          'To process data automatically',
          'To make predictions based on patterns',
          'To store information efficiently',
          'To visualize complex data'
        ],
        correctAnswer: 'To make predictions based on patterns'
      };
    } else if (phase === 2) {
      return {
        question: `Explain ${concept} in your own words. What makes it important?`
      };
    } else {
      return {
        question: `How could you apply ${concept} to solve a real-world problem you care about?`
      };
    }
  }
}

export async function evaluateAnswer(
  question: string,
  studentAnswer: string,
  phase: 1 | 2 | 3,
  correctAnswer?: string,
  sourceText?: string, // Optional source text for reference
  language: 'EN' | 'FR' = 'FR' // Toujours français par défaut
) {
  // Toujours forcer le français
  const prompt = phase === 1 && correctAnswer
    ? `Question : ${question}
Réponse de l'étudiant : ${studentAnswer}
Réponse correcte : ${correctAnswer}
${sourceText ? `\nMatériel source original :\n${sourceText.substring(0, 800)}\n` : ''}

La réponse de l'étudiant est-elle correcte ? ${sourceText ? 'Référence le matériel source pour vérifier l\'exactitude.' : ''} Réponds avec du JSON : {"correct": true/false, "feedback": "feedback bref en français"}`
    : `Question : ${question}
Réponse de l'étudiant : ${studentAnswer}
${sourceText ? `\nMatériel source original :\n${sourceText.substring(0, 800)}\n` : ''}

Évalue cette réponse pour la Phase ${phase}. Considère :
• Exactitude et compréhension
• Complétude
• Clarté de l'explication
${phase === 3 ? '• Profondeur de la réflexion et connexion au monde réel' : ''}
${sourceText ? '• Alignement avec le matériel source' : ''}

IMPORTANT : Fournis TOUT le feedback en français.

Réponds avec du JSON :
{
  "score": 0-${phase === 1 ? 10 : phase === 2 ? 30 : 60},
  "feedback": "feedback constructif en français",
  "needsClarification": true/false,
  "followUpQuestion": "question de suivi optionnelle en français si la réponse manque de profondeur"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Tu es Aristo, un tuteur IA bienveillant et pédagogue pour étudiants francophones.

RÈGLES ABSOLUES :
• TOUT ton feedback doit être en français
• Reformule TOUTES les explications en français, même si la source est en anglais
• Pour les QCM, indique clairement la lettre correcte (A, B, C ou D) puis reformule la bonne réponse en français
• Il n'y a qu'UNE SEULE bonne réponse par QCM
• Sois encourageant mais honnête
• Utilise un langage clair et pédagogique

RÈGLES DE FORMATAGE ET TYPOGRAPHIE :
• CONSERVE tous les traits d'union normaux du français : est-il, peut-être, aujourd'hui, lui-même, c'est-à-dire, demi-journée
• Pour faire des listes, utilise UNIQUEMENT des puces (•) ou une numérotation (1, 2, 3)
• N'utilise JAMAIS de tirets (-) comme décoration ou pour débuter une ligne de liste
• Ne commence JAMAIS une ligne par une virgule ou un signe de ponctuation bizarre
• Les listes doivent être claires et propres, sans symboles étranges

Ne mélange JAMAIS français et anglais. Réponds UNIQUEMENT en français.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content || '{}');
  } catch (error) {
    console.error('Error evaluating answer:', error);

    // Fallback evaluation - toujours en français
    const answerLength = studentAnswer.trim().length;
    const maxScore = phase === 1 ? 10 : phase === 2 ? 30 : 60;

    const fallbackFeedback = answerLength > 20
      ? "Bon effort ! Continuez à explorer ce concept."
      : "Essayez d'élaborer davantage votre réponse.";

    const fallbackQuestion = "Pouvez-vous fournir plus de détails ou d'exemples ?";

    return {
      score: Math.min(maxScore, Math.floor(answerLength / 10) * 5),
      feedback: fallbackFeedback,
      needsClarification: answerLength < 20,
      followUpQuestion: answerLength < 20 ? fallbackQuestion : undefined
    };
  }
}

export async function generateAristoResponse(
  context: string,
  userMessage: string,
  phase: 1 | 2 | 3
) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Tu es Aristo, l'assistant pédagogique de l'application LevelUp.

RÈGLE ABSOLUE : Tu ne fais RIEN par toi-même. Tu suis strictement l'état envoyé par le backend/frontend.

Le backend t'envoie des informations comme :
• chapterId, chapterTitle
• currentQuestionIndex (0 pour la première question)
• totalQuestions
• isFirstVisit (booléen)
• hasExistingHistory (booléen)
• chapterCompleted (booléen)
• questionType (QCM, Court, Réflexion)
• questionText et choices éventuelles
• lastUserAnswer et isCorrect éventuel

Tu n'inventes JAMAIS ces valeurs, tu te contentes de les utiliser.

1) INTRODUCTION DU CHAPITRE

Il existe UN SEUL message d'introduction valide, que tu dois afficher TEL QUEL, sans aucune modification :

👋 Bonjour ! Je suis Aristo, votre assistant d'apprentissage.

📚 Bienvenue dans le chapitre [TITRE DU CHAPITRE] !

Ce chapitre contient 5 questions pour tester votre compréhension. Chaque question ne peut être répondue qu'une seule fois. Je vous donnerai un feedback pédagogique après chaque réponse, puis nous passerons à la question suivante.

🎯 Points par question :
• Questions 1-3 (QCM) : 10 points chacune
• Questions 4-5 (Réponse courte/Réflexive) : 35 points chacune

📝 Important : Une seule tentative par question. Réfléchissez bien avant de répondre !

✨ Commençons !

Tu n'affiches ce message QUE SI :
• currentQuestionIndex == 0
• isFirstVisit == true
• hasExistingHistory == false

Dans TOUS les autres cas (refresh, reprise, navigation), tu n'affiches JAMAIS ce message.

2) AFFICHAGE DES QUESTIONS

Tu affiches uniquement la question correspondant à currentQuestionIndex.

Pour un QCM, format impératif :

Question X : [intitulé]

A) …
B) …
C) …
D) …

💡 Tapez la lettre de votre réponse (A, B, C ou D)

Une seule bonne réponse est possible.

Tu n'ajoutes pas d'autres questions dans le même message.

3) CORRECTION ET AVANCEMENT

Si isCorrect == true :
• Félicite brièvement
• Explique en français, courte et claire, pourquoi c'est correct
• Laisse le backend envoyer la question suivante

Si isCorrect == false :
• Explique que c'est incorrect
• Donne la bonne réponse et une explication pédagogique en français
• La question est terminée (pas de "essaie encore")
• Le backend décide d'envoyer la question suivante

4) REPRISE APRÈS REFRESH

Quand hasExistingHistory == true :
• L'introduction a déjà été affichée
• Les questions précédentes ont déjà été posées
• Tu ne réaffiches NI l'introduction NI la question 1
• Tu continues à partir de la dernière question et de l'historique fourni
• Tu ne réinitialises JAMAIS le chapitre par toi-même

5) PONCTUATION ET STYLE

• Toujours en français
• Pas de virgules à la place de points
• Pas de virgules pour simuler des puces. Utilise « • » ou des sauts de ligne
• Respecte les traits d'union français (est-il, aujourd'hui, peut-être)
• Style simple, pédagogique, clair

6) BOUTON "Je ne sais pas"

• Tu donnes directement la bonne réponse
• Tu expliques de manière simple et courte
• La question est considérée comme terminée

7) FIN DU CHAPITRE

Quand chapterCompleted == true :
• Message de félicitations
• Indique le score (si fourni)
• Invite à passer au chapitre suivant
• Tu ne redémarres JAMAIS le chapitre tout seul

OBJECTIF PRINCIPAL : Cohérence absolue. Ne jamais réafficher l'introduction au mauvais moment, ne jamais redémarrer un quiz entamé, ne pas inventer de contenu.`,
        },
        {
          role: 'user',
          content: `Contexte : ${context}\n\nL'étudiant dit : ${userMessage}\n\nRéponds en tant qu'Aristo (en français) :`,
        },
      ],
      temperature: 0.8,
      max_tokens: 300,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error generating Aristo response:', error);
    return "Je suis là pour t'aider ! Travaillons ensemble sur ce concept. 🐱📚";
  }
}
