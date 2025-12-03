import OpenAI from 'openai';
import {
  withRetry,
  withCircuitBreaker,
  openaiCircuitBreaker,
  llmLogger,
  LLM_CONFIG,
  generateContextualConcepts,
} from './llm';

// Configuration pour utiliser l'API OpenAI directement
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractConceptsFromPDF(text: string, title: string) {
  const logContext = llmLogger.createContext('extractConceptsFromPDF', LLM_CONFIG.models.primary);

  const truncatedText = text.substring(0, LLM_CONFIG.truncation.chapterText);

  const prompt = `You are an expert educational content analyzer. Analyze the following course chapter and extract structured learning concepts.

Chapter Title: ${title}

Chapter Content:
${truncatedText}

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

    const response = await withCircuitBreaker(
      openaiCircuitBreaker,
      () => withRetry(
        async () => {
          const result = await openai.chat.completions.create({
            model: LLM_CONFIG.models.primary,
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
            temperature: LLM_CONFIG.temperatures.extraction,
            response_format: { type: 'json_object' },
            max_tokens: LLM_CONFIG.maxTokens.conceptExtraction,
          });
          return result;
        },
        { maxRetries: 3 }
      ),
      // Fallback if circuit is open
      async () => {
        logContext.setFallbackUsed();
        return null;
      }
    );

    if (!response) {
      // Circuit was open, use fallback
      console.log('⚠️ Circuit breaker open, using contextual fallback...');
      const fallback = generateContextualConcepts(text, title);
      logContext.setFallbackUsed().success();
      return fallback;
    }

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');

    // Log token usage
    if (response.usage) {
      logContext.setTokens(response.usage);
    }

    console.log('✅ Successfully extracted', parsed.concepts?.length || 0, 'concepts');
    logContext.success();

    return parsed;
  } catch (error: any) {
    console.error('❌ Error calling GPT-4 API:', error);
    console.log('⚠️ Using contextual fallback concept extraction...');

    logContext.setFallbackUsed().failure(error, error?.status);

    // Use contextual fallback instead of generic ML content
    return generateContextualConcepts(text, title);
  }
}

export async function generateQuizQuestion(
  concept: string,
  phase: 1 | 2 | 3,
  previousQuestions: string[] = []
) {
  const logContext = llmLogger.createContext('generateQuizQuestion', LLM_CONFIG.models.primary);

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
    const response = await withRetry(
      async () => {
        const result = await openai.chat.completions.create({
          model: LLM_CONFIG.models.primary,
          messages: [
            {
              role: 'system',
              content: 'You are Nareo, a friendly AI tutor. Generate engaging educational questions.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: LLM_CONFIG.temperatures.questionGeneration,
          response_format: { type: 'json_object' },
          max_tokens: LLM_CONFIG.maxTokens.questionGeneration,
        });
        return result;
      },
      { maxRetries: 2 }
    );

    const content = response.choices[0].message.content;

    if (response.usage) {
      logContext.setTokens(response.usage);
    }
    logContext.success();

    return JSON.parse(content || '{}');
  } catch (error: any) {
    console.error('Error generating question:', error);
    logContext.setFallbackUsed().failure(error, error?.status);

    // Fallback questions based on concept
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
  const logContext = llmLogger.createContext('evaluateAnswer', LLM_CONFIG.models.evaluation);

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
    const response = await withRetry(
      async () => {
        const result = await openai.chat.completions.create({
          model: LLM_CONFIG.models.evaluation,
          messages: [
            {
              role: 'system',
              content: 'You are Nareo, a supportive AI tutor. Provide encouraging yet honest feedback.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: LLM_CONFIG.temperatures.evaluation,
          response_format: { type: 'json_object' },
          max_tokens: LLM_CONFIG.maxTokens.evaluation,
        });
        return result;
      },
      { maxRetries: 2 }
    );

    const content = response.choices[0].message.content;

    if (response.usage) {
      logContext.setTokens(response.usage);
    }
    logContext.success();

    return JSON.parse(content || '{}');
  } catch (error: any) {
    console.error('Error evaluating answer:', error);
    logContext.setFallbackUsed().failure(error, error?.status);

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

export async function generateNareoResponse(
  context: string,
  userMessage: string,
  phase: 1 | 2 | 3
) {
  const logContext = llmLogger.createContext('generateNareoResponse', LLM_CONFIG.models.primary);

  try {
    const response = await withRetry(
      async () => {
        const result = await openai.chat.completions.create({
          model: LLM_CONFIG.models.primary,
          messages: [
            {
              role: 'system',
              content: `You are Nareo, a friendly graduation-hat cat mascot who helps students learn. You are:
- Encouraging and supportive
- Clear and concise
- Patient with mistakes
- Enthusiastic about learning
- Use emojis occasionally to be friendly
Current learning phase: ${phase} (${phase === 1 ? 'MCQ warm-up' : phase === 2 ? 'Short answer' : 'Reflective thinking'})`,
            },
            {
              role: 'user',
              content: `Context: ${context}\n\nStudent says: ${userMessage}\n\nRespond as Nareo:`,
            },
          ],
          temperature: LLM_CONFIG.temperatures.conversation,
          max_tokens: LLM_CONFIG.maxTokens.conversation,
        });
        return result;
      },
      { maxRetries: 2 }
    );

    if (response.usage) {
      logContext.setTokens(response.usage);
    }
    logContext.success();

    return response.choices[0].message.content || '';
  } catch (error: any) {
    console.error('Error generating Nareo response:', error);
    logContext.setFallbackUsed().failure(error, error?.status);
    return "I'm here to help! Let's work through this together. 🐱📚";
  }
}
