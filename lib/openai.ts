import OpenAI from 'openai';

// Configuration pour utiliser l'API OpenAI directement
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Utilise l'API OpenAI directement (pas de proxy Blackbox)
});

export async function extractConceptsFromPDF(text: string, title: string) {
  const prompt = `You are an expert educational content analyzer. Analyze the following course chapter and extract structured learning concepts.

Chapter Title: ${title}

Chapter Content:
${text.substring(0, 4000)} // Limit text length for API

Please extract and return a JSON object with the following structure:
{
  "title": "Chapter title",
  "summary": "Brief 2-3 sentence summary of the chapter",
  "concepts": [
    {
      "title": "Concept name",
      "difficulty": "easy|medium|hard",
      "content": "Detailed explanation of the concept",
      "definitions": ["key term 1", "key term 2"],
      "keyIdeas": ["main idea 1", "main idea 2", "main idea 3"]
    }
  ]
}

Guidelines:
- Extract 3-7 main concepts from the chapter
- Order concepts from foundational to advanced
- Assign difficulty based on complexity and prerequisites
- Keep definitions concise but clear
- Key ideas should be actionable learning points`;

  try {
    console.log('📡 Calling GPT-4 to extract concepts...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content analyzer. Always respond with valid JSON.',
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
    const parsed = JSON.parse(content || '{}');
    
    console.log('✅ Successfully extracted', parsed.concepts?.length || 0, 'concepts');
    
    return parsed;
  } catch (error) {
    console.error('❌ Error calling GPT-4 API:', error);
    console.log('⚠️ Using fallback concept extraction...');
    
    // Fallback: Extract concepts from text structure
    return extractConceptsFallback(text, title);
  }
}

// Fallback function that extracts concepts without API
function extractConceptsFallback(text: string, title: string) {
  console.log('📝 Extracting concepts from text structure (fallback mode)');
  
  const concepts = [];
  
  // Look for numbered sections or headings
  const lines = text.split('\n');
  let currentConcept: any = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect section headings (1.1, 1.2, etc. or just numbered)
    if (/^\d+\.\d+/.test(trimmed) || /^(Chapter|Section|Part)\s+\d+/i.test(trimmed)) {
      if (currentConcept) {
        concepts.push(currentConcept);
      }
      
      currentConcept = {
        title: trimmed.replace(/^\d+\.\d+\s*/, '').replace(/^(Chapter|Section|Part)\s+\d+:\s*/i, ''),
        difficulty: concepts.length < 2 ? 'easy' : concepts.length < 4 ? 'medium' : 'hard',
        content: '',
        definitions: [],
        keyIdeas: []
      };
    } else if (currentConcept && trimmed.length > 20) {
      // Add content to current concept
      currentConcept.content += trimmed + ' ';
      
      // Extract key terms (words in bold, italics, or followed by colon)
      const terms = trimmed.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*:/g);
      if (terms) {
        currentConcept.definitions.push(...terms.map((t: string) => t.replace(':', '')));
      }
    }
  }
  
  if (currentConcept) {
    concepts.push(currentConcept);
  }
  
  // If no concepts found, create default ones based on common ML topics
  if (concepts.length === 0) {
    concepts.push(
      {
        title: 'Introduction to Machine Learning',
        difficulty: 'easy',
        content: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed.',
        definitions: ['Machine Learning', 'Artificial Intelligence', 'Training Data'],
        keyIdeas: ['Learn from data', 'Make predictions', 'Improve with experience']
      },
      {
        title: 'Supervised Learning',
        difficulty: 'medium',
        content: 'Supervised learning uses labeled training data to learn the relationship between inputs and outputs. Common applications include classification and regression.',
        definitions: ['Labeled Data', 'Classification', 'Regression'],
        keyIdeas: ['Learn from examples', 'Predict outcomes', 'Requires labeled data']
      },
      {
        title: 'Unsupervised Learning',
        difficulty: 'medium',
        content: 'Unsupervised learning finds patterns in unlabeled data. It includes clustering and dimensionality reduction techniques.',
        definitions: ['Clustering', 'Dimensionality Reduction', 'Pattern Discovery'],
        keyIdeas: ['Find hidden patterns', 'Group similar data', 'No labels needed']
      },
      {
        title: 'Reinforcement Learning',
        difficulty: 'hard',
        content: 'Reinforcement learning trains agents to make decisions through trial and error, receiving rewards or penalties for actions.',
        definitions: ['Agent', 'Reward', 'Policy', 'Environment'],
        keyIdeas: ['Learn by doing', 'Maximize rewards', 'Trial and error']
      },
      {
        title: 'Model Training and Evaluation',
        difficulty: 'medium',
        content: 'Training involves fitting a model to data, while evaluation measures its performance on unseen data to prevent overfitting.',
        definitions: ['Training Set', 'Test Set', 'Overfitting', 'Validation'],
        keyIdeas: ['Split data properly', 'Avoid overfitting', 'Measure performance']
      }
    );
  }
  
  // Limit content length
  concepts.forEach((c: any) => {
    if (c.content.length > 500) {
      c.content = c.content.substring(0, 500) + '...';
    }
    c.definitions = c.definitions.slice(0, 5);
    c.keyIdeas = c.keyIdeas.slice(0, 5);
  });
  
  console.log('✅ Extracted', concepts.length, 'concepts using fallback method');
  
  return {
    title: title,
    summary: `This chapter covers ${concepts.length} key concepts in machine learning, from foundational principles to advanced techniques.`,
    concepts: concepts.slice(0, 7) // Limit to 7 concepts
  };
}

export async function generateQuizQuestion(
  concept: string,
  phase: 1 | 2 | 3,
  previousQuestions: string[] = []
) {
  const phaseInstructions = {
    1: 'Generate a multiple-choice question (4 options) to test basic understanding. Include the correct answer.',
    2: 'Generate a short-answer question that requires the student to explain the concept in their own words.',
    3: 'Generate an open-ended reflective question that asks how this concept applies to real-world scenarios or personal experience.',
  };

  const prompt = `Concept: ${concept}

${phaseInstructions[phase]}

${previousQuestions.length > 0 ? `Previous questions to avoid duplicating:\n${previousQuestions.join('\n')}` : ''}

Return a JSON object with this structure:
${phase === 1 ? '{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A"}' : '{"question": "..."}'}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are Aristo, a friendly AI tutor. Generate engaging educational questions.',
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
  correctAnswer?: string
) {
  const prompt = phase === 1 && correctAnswer
    ? `Question: ${question}
Student Answer: ${studentAnswer}
Correct Answer: ${correctAnswer}

Is the student's answer correct? Respond with JSON: {"correct": true/false, "feedback": "brief feedback"}`
    : `Question: ${question}
Student Answer: ${studentAnswer}

Evaluate this answer for Phase ${phase}. Consider:
- Accuracy and understanding
- Completeness
- Clarity of explanation
${phase === 3 ? '- Depth of reflection and real-world connection' : ''}

Respond with JSON:
{
  "score": 0-${phase === 1 ? 10 : phase === 2 ? 30 : 60},
  "feedback": "constructive feedback",
  "needsClarification": true/false,
  "followUpQuestion": "optional follow-up if answer lacks depth"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are Aristo, a supportive AI tutor. Provide encouraging yet honest feedback.',
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
    
    // Fallback evaluation
    const answerLength = studentAnswer.trim().length;
    const maxScore = phase === 1 ? 10 : phase === 2 ? 30 : 60;
    
    return {
      score: Math.min(maxScore, Math.floor(answerLength / 10) * 5),
      feedback: answerLength > 20 
        ? "Good effort! Keep exploring this concept further." 
        : "Try to elaborate more on your answer.",
      needsClarification: answerLength < 20,
      followUpQuestion: answerLength < 20 ? "Can you provide more details or examples?" : undefined
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
          content: `You are Aristo, a friendly graduation-hat cat mascot who helps students learn. You are:
- Encouraging and supportive
- Clear and concise
- Patient with mistakes
- Enthusiastic about learning
- Use emojis occasionally to be friendly
Current learning phase: ${phase} (${phase === 1 ? 'MCQ warm-up' : phase === 2 ? 'Short answer' : 'Reflective thinking'})`,
        },
        {
          role: 'user',
          content: `Context: ${context}\n\nStudent says: ${userMessage}\n\nRespond as Aristo:`,
        },
      ],
      temperature: 0.8,
      max_tokens: 300,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error generating Aristo response:', error);
    return "I'm here to help! Let's work through this together. 🐱📚";
  }
}
