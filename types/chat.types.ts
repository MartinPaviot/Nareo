export type NareoState =
  | 'reading'      // Processing.png
  | 'asking'       // Talking.png
  | 'listening'    // mascotte.png
  | 'happy'        // Happy.png
  | 'confused'     // Disappointed.png
  | 'success';     // adcdebda.png (trophy)

/** @deprecated Use NareoState instead */
export type AristoState = NareoState;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  aristoState?: AristoState;
}

export interface ChatContext {
  conceptId: string;
  phase: 1 | 2 | 3;
  messages: ChatMessage[];
  currentQuestion?: string;
  awaitingAnswer: boolean;
}

export const NAREO_STATES: Record<NareoState, string> = {
  reading: '/mascot/mascotte.png',
  asking: '/mascot/mascotte.png',
  listening: '/mascot/mascotte.png',
  happy: '/mascot/mascotte.png',
  confused: '/mascot/mascotte.png',
  success: '/mascot/mascotte.png',
};

export const QUICK_ACTIONS = [
  { id: 'clarify', label: "I don't get it", icon: '❓' },
  { id: 'simplify', label: 'Simplify', icon: '💡' },
  { id: 'example', label: 'Give example', icon: '📝' },
];
