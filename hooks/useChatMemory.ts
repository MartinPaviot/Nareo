import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage } from '@/types/chat.types';
import { generateId } from '@/lib/utils';

interface UseChatMemoryOptions {
  userId: string | null | undefined;
  chapterId: string;
  enabled?: boolean;
}

interface UseChatMemoryReturn {
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<void>;
  clearMessages: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook pour gérer la mémoire persistante du chat avec Supabase
 *
 * Fonctionnalités:
 * - Chargement automatique de l'historique au montage
 * - Sauvegarde en temps réel de chaque message
 * - Isolation par cours (chapter_id)
 * - Synchronisation en temps réel via Supabase Realtime
 * - Gestion optimisée des états
 */
export function useChatMemory({
  userId,
  chapterId,
  enabled = true,
}: UseChatMemoryOptions): UseChatMemoryReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isInitializedRef = useRef(false);

  /**
   * Charge l'historique complet des messages depuis Supabase via API
   */
  const loadMessages = useCallback(async () => {
    if (!userId || !chapterId || !enabled) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('💬 Loading chat history for chapter:', chapterId);
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/chat/messages?userId=${encodeURIComponent(userId)}&chapterId=${encodeURIComponent(chapterId)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load chat history');
      }

      const { messages: data } = await response.json();

      // ✅ Convertir les données Supabase en ChatMessage
      // row.message_id = custom TEXT ID from frontend
      // row.id = UUID auto-généré par Supabase
      const loadedMessages: ChatMessage[] = (data || []).map((row: any) => ({
        id: row.message_id || row.id,  // ✅ Use message_id as ChatMessage.id
        role: row.sender as 'user' | 'assistant',
        content: row.content,
        timestamp: new Date(row.created_at),  // ✅ Use created_at instead of timestamp
      }));

      console.log(`✅ Loaded ${loadedMessages.length} messages from memory`);
      setMessages(loadedMessages);
    } catch (err) {
      console.error('❌ Error loading chat history:', err);
      setError(err as Error);
      setMessages([]); // Continuer avec un tableau vide en cas d'erreur
    } finally {
      setIsLoading(false);
      isInitializedRef.current = true;
    }
  }, [userId, chapterId, enabled]);

  /**
   * Ajoute un nouveau message au chat et le sauvegarde immédiatement via API
   */
  const addMessage = useCallback(
    async (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      if (!userId || !chapterId) {
        console.warn('Cannot add message: userId or chapterId is missing');
        return;
      }

      const newMessage: ChatMessage = {
        ...message,
        id: generateId(),
        timestamp: new Date(),
      };

      // Optimistic update: ajouter le message localement immédiatement
      setMessages((prev) => [...prev, newMessage]);

      try {
        // ✅ Sauvegarder via API
        const response = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            chapterId,
            message: {
              id: newMessage.id,        // ✅ Sera stocké dans message_id (TEXT)
              role: newMessage.role,    // ✅ Sera stocké dans sender (TEXT)
              content: newMessage.content,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ Error saving message to Supabase:', errorData);
          throw new Error(
            errorData.details || errorData.error || 'Failed to save message'
          );
        }

        const result = await response.json();
        console.log('✅ Message saved to Supabase:', {
          message_id: newMessage.id,
          db_id: result.message?.id
        });
      } catch (err) {
        console.error('❌ Error saving message:', err);
        setError(err as Error);
        // Ne pas retirer le message de l'UI, l'optimistic update reste
      }
    },
    [userId, chapterId]
  );

  /**
   * Efface tous les messages du chat pour ce cours via API
   */
  const clearMessages = useCallback(async () => {
    if (!userId || !chapterId) {
      return;
    }

    try {
      const response = await fetch(
        `/api/chat/messages?userId=${encodeURIComponent(userId)}&chapterId=${encodeURIComponent(chapterId)}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear messages');
      }

      setMessages([]);
      console.log('✅ Chat history cleared for chapter:', chapterId);
    } catch (err) {
      console.error('❌ Error clearing chat history:', err);
      setError(err as Error);
    }
  }, [userId, chapterId]);

  /**
   * Charge l'historique au montage du composant
   */
  useEffect(() => {
    if (!isInitializedRef.current) {
      loadMessages();
    }
  }, [loadMessages]);

  /**
   * Réinitialise quand le chapitre change
   */
  useEffect(() => {
    if (isInitializedRef.current) {
      console.log('🔄 Chapter changed, reloading messages');
      isInitializedRef.current = false;
      setMessages([]);
      loadMessages();
    }
  }, [chapterId, loadMessages]);

  /**
   * Note: Realtime synchronization temporairement désactivée
   * Les messages sont rechargés au changement de chapitre
   * Pour une vraie synchronisation temps réel, implémenter WebSocket ou polling
   */

  return {
    messages,
    addMessage,
    clearMessages,
    isLoading,
    error,
  };
}
