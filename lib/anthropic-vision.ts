/**
 * Anthropic Vision Client
 *
 * Client for Claude Vision API to analyze pedagogical graphics.
 * Used as an alternative to OpenAI GPT-4o for image analysis.
 */

import Anthropic from '@anthropic-ai/sdk';

// Lazy-initialized client to ensure env vars are loaded
let _anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }
    _anthropicClient = new Anthropic({ apiKey });
  }
  return _anthropicClient;
}

// Export a proxy that lazily initializes the client
export const anthropic = {
  get messages() {
    return getAnthropicClient().messages;
  },
};

// Model options for vision tasks
export const ANTHROPIC_VISION_MODELS = {
  // Best quality/price ratio for complex tasks
  sonnet: 'claude-sonnet-4-20250514',
  // Good balance: better than haiku3, cheaper than sonnet ($0.80/$4.00 per 1M tokens)
  haiku35: 'claude-3-5-haiku-latest',
  // Fastest and cheapest ($0.25/$1.25 per 1M tokens)
  haiku: 'claude-3-haiku-20240307',
} as const;

export type AnthropicVisionModel = keyof typeof ANTHROPIC_VISION_MODELS;
