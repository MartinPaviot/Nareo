/**
 * Mistral Chat Service
 *
 * Uses Mistral's chat API for quiz generation and other LLM tasks.
 * This replaces OpenAI for text generation while keeping OpenAI for vision/OCR.
 *
 * Models:
 * - mistral-large-latest: Best quality, similar to GPT-4
 * - mistral-small-latest: Fast and cheap, similar to GPT-4o-mini
 */

import { Mistral } from '@mistralai/mistralai';

// Initialize Mistral client
const mistral = new Mistral({
  apiKey: process.env.MISTRAL || '',
});

export { mistral };

// Model mapping for different tasks
export const MISTRAL_MODELS = {
  // High quality model for complex tasks
  large: 'mistral-large-latest',
  // Fast model for simpler tasks (cost-effective)
  small: 'mistral-small-latest',
  // OCR model
  ocr: 'mistral-ocr-latest',
} as const;

export type MistralModel = typeof MISTRAL_MODELS[keyof typeof MISTRAL_MODELS];

/**
 * Mistral chat completion with JSON response
 */
export async function mistralChatJSON<T = unknown>(options: {
  model: MistralModel;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const { model, systemPrompt, userPrompt, temperature = 0.3, maxTokens = 4000 } = options;

  if (!process.env.MISTRAL) {
    throw new Error('MISTRAL API key not configured');
  }

  const response = await mistral.chat.complete({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    maxTokens,
    responseFormat: { type: 'json_object' },
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content || typeof content !== 'string') {
    throw new Error('No content in Mistral response');
  }

  return JSON.parse(content) as T;
}

/**
 * Mistral chat completion with plain text response
 */
export async function mistralChatText(options: {
  model: MistralModel;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const { model, systemPrompt, userPrompt, temperature = 0.3, maxTokens = 4000 } = options;

  if (!process.env.MISTRAL) {
    throw new Error('MISTRAL API key not configured');
  }

  const response = await mistral.chat.complete({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    maxTokens,
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content || typeof content !== 'string') {
    throw new Error('No content in Mistral response');
  }

  return content;
}

/**
 * Check if Mistral API is available
 */
export function isMistralAvailable(): boolean {
  return !!process.env.MISTRAL;
}
