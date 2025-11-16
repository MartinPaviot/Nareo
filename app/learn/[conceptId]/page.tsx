'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ChatBubble from '@/components/chat/ChatBubble';
import QuickActionButtons from '@/components/chat/QuickActionButtons';
import VoiceInput from '@/components/chat/VoiceInput';
import ChapterSidebar from '@/components/layout/ChapterSidebar';
import SignOutButton from '@/components/layout/SignOutButton';
import LanguageToggle from '@/components/layout/LanguageToggle';
import PointsAnimation from '@/components/chat/PointsAnimation';
import { ChatMessage } from '@/types/chat.types';
import { ChapterData, ChapterProgress, ChapterQuestion, getPhaseForQuestion } from '@/types/concept.types';
import { generateId } from '@/lib/utils';
import { 
  getApiLanguage, 
  translateQuestionObject, 
  translateMessageBatch,
  translateText,
  getLocalizedChapterTitle 
} from '@/lib/content-translator';

export default function LearnChapterPage({ params }: { params: Promise<{ conceptId: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
  const { translate, currentLanguage } = useLanguage();
  const { conceptId } = use(params);
  // In the new system, conceptId is actually the chapterId
  const chapterId = conceptId;
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [chapterProgress, setChapterProgress] = useState<ChapterProgress[]>([]);
  const [currentChapter, setCurrentChapter] = useState<ChapterData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<ChapterQuestion | null>(null);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const questionLoadedRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef<boolean>(false);
  const previousLanguageRef = useRef<string>(currentLanguage);

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      loadChapterData();
    }
  }, [chapterId]);

  // Handle language changes - re-translate all content
  useEffect(() => {
    const handleLanguageChange = async () => {
      // Skip if language hasn't actually changed
      if (previousLanguageRef.current === currentLanguage) {
        return;
      }

      console.log('🌍 Language changed from', previousLanguageRef.current, 'to', currentLanguage);
      previousLanguageRef.current = currentLanguage;

      // Skip if no messages to translate
      if (messages.length === 0) {
        return;
      }

      setIsTranslating(true);

      try {
        // Translate all existing messages
        const translatedMessages = await translateMessageBatch(messages, currentLanguage);
        setMessages(translatedMessages);

        // Re-translate current question if one is loaded
        if (currentQuestion) {
          const translatedQuestion = await translateQuestionObject(currentQuestion, currentLanguage);
          setCurrentQuestion(translatedQuestion);

          // Update the question message in the chat
          const questionMessageIndex = messages.findIndex(
            msg => msg.role === 'assistant' && msg.aristoState === 'asking'
          );

          if (questionMessageIndex !== -1) {
            // Rebuild the question message with translated content
            let questionContent = `**${translate('learn_question')} ${currentQuestionNumber}:** ${translatedQuestion.question}`;
            
            if (translatedQuestion.type === 'mcq' && translatedQuestion.options) {
              questionContent += '\n\n';
              questionContent += translatedQuestion.options.map((opt, idx) => 
                `${String.fromCharCode(65 + idx)}) ${opt}`
              ).join('\n');
              questionContent += `\n\n_${translate('chat_type_hint')}_`;
            }

            const updatedMessages = [...translatedMessages];
            updatedMessages[questionMessageIndex] = {
              ...updatedMessages[questionMessageIndex],
              content: questionContent,
            };
            setMessages(updatedMessages);
          }
        }
      } catch (error) {
        console.error('Error translating content on language change:', error);
      } finally {
        setIsTranslating(false);
      }
    };

    handleLanguageChange();
  }, [currentLanguage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-save session periodically
  useEffect(() => {
    const interval = setInterval(() => {
      saveSession();
    }, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [user, chapterId, currentQuestionNumber, messages]);

  // Save session on unmount
  useEffect(() => {
    return () => {
      saveSession();
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChapterData = async () => {
    try {
      // Fetch all chapters for sidebar
      const chaptersResponse = await fetch('/api/chapters');
      if (chaptersResponse.ok) {
        const chaptersData = await chaptersResponse.json();
        setChapters(chaptersData.chapters || []);
        setChapterProgress(chaptersData.progress || []);
      }

      // Fetch current chapter
      const response = await fetch(`/api/chapters/${chapterId}`);
      if (!response.ok) throw new Error('Failed to fetch chapter');
      
      const chapter = await response.json();
      setCurrentChapter(chapter);

      // Get progress for this chapter
      let startQuestionNumber = 1;
      const progressResponse = await fetch(`/api/chapters/${chapterId}/progress`);
      if (progressResponse.ok) {
        const progress = await progressResponse.json();
        startQuestionNumber = progress.currentQuestion || 1;
        setCurrentQuestionNumber(startQuestionNumber);
      }

      // Add initial greeting only if starting from question 1
      if (startQuestionNumber === 1) {
        const localizedTitle = getLocalizedChapterTitle(chapter, currentLanguage);
        const greeting: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `${translate('chat_greeting')}\n\n${translate('chat_intro', { title: localizedTitle })}\n\n${translate('chat_intro_mcq')}\n${translate('chat_intro_short')}\n${translate('chat_intro_reflective')}\n\n${translate('chat_ready')}`,
          timestamp: new Date(),
          aristoState: 'happy',
        };
        setMessages([greeting]);

        // Load first question - pass chapter directly
        setTimeout(() => loadQuestion(1, chapter), 1500);
      } else {
        // If resuming, load the current question immediately
        loadQuestion(startQuestionNumber, chapter);
      }
    } catch (error) {
      console.error('Error loading chapter:', error);
    }
  };

  const loadQuestion = async (questionNumber: number, chapterData?: ChapterData) => {
    const chapter = chapterData || currentChapter;
    
    console.log('🔍 loadQuestion called with:', questionNumber);
    console.log('📊 chapter:', chapter?.title);
    console.log('📝 questions available:', chapter?.questions?.length);
    
    if (!chapter || !chapter.questions) {
      console.error('❌ No chapter or questions available');
      return;
    }

    let question = chapter.questions.find(q => q.questionNumber === questionNumber);
    if (!question) {
      console.error('❌ Question not found:', questionNumber);
      console.log('Available questions:', chapter.questions.map(q => q.questionNumber));
      return;
    }

    // Create unique key for this question
    const questionKey = `${chapter.id}-${question.id}`;
    
    // Check if this exact question was already loaded to prevent duplicates
    if (questionLoadedRef.current.has(questionKey)) {
      console.log('⚠️ Question already loaded, skipping:', questionKey);
      return;
    }

    console.log('✅ Found question:', question.id, question.type);
    
    // Mark this question as loaded BEFORE setting state
    questionLoadedRef.current.add(questionKey);
    
    // Translate question if needed
    try {
      question = await translateQuestionObject(question, currentLanguage);
    } catch (error) {
      console.error('Error translating question:', error);
      // Continue with original question if translation fails
    }
    
    setCurrentQuestion(question);
    setCurrentQuestionNumber(questionNumber);
    
    // Also update currentChapter if it was passed
    if (chapterData && !currentChapter) {
      setCurrentChapter(chapterData);
    }

    // Format question message based on type
    let questionContent = `**${translate('learn_question')} ${questionNumber}:** ${question.question}`;
    
    if (question.type === 'mcq' && question.options) {
      questionContent += '\n\n';
      questionContent += question.options.map((opt, idx) => 
        `${String.fromCharCode(65 + idx)}) ${opt}`
      ).join('\n');
      questionContent += `\n\n_${translate('chat_type_hint')}_`;
    }

    const questionMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: questionContent,
      timestamp: new Date(),
      aristoState: 'asking',
    };
    
    setMessages(prev => [...prev, questionMessage]);
  };

  const handleSendMessage = async () => {
    console.log('🚀 handleSendMessage called');
    console.log('📝 inputValue:', inputValue);
    console.log('⏳ isLoading:', isLoading);
    console.log('❓ currentQuestion:', currentQuestion?.id);
    
    if (!inputValue.trim()) {
      console.log('❌ Empty input');
      return;
    }
    
    if (isLoading) {
      console.log('❌ Already loading');
      return;
    }
    
    if (!currentQuestion) {
      console.log('❌ No current question');
      return;
    }
    
    console.log('✅ Proceeding with submission');

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userAnswer = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: chapterId,
          questionId: currentQuestion.id,
          questionNumber: currentQuestion.questionNumber,
          questionType: currentQuestion.type,
          answer: userAnswer,
          correctAnswer: currentQuestion.correctAnswer,
          language: getApiLanguage(currentLanguage),
        }),
      });

      if (!response.ok) throw new Error('Failed to evaluate answer');
      
      const data = await response.json();
      
      // Show points animation if correct and points earned
      if (data.correct && data.score > 0) {
        setPointsEarned(data.score);
        setShowPointsAnimation(true);
      }
      
      // Add Aristo's feedback
      const feedbackMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.feedback,
        timestamp: new Date(),
        aristoState: data.correct ? 'happy' : 'confused',
      };
      
      setMessages(prev => [...prev, feedbackMessage]);

      // Update progress display
      if (data.progress) {
        setChapterProgress(prev => {
          const updated = prev.filter(p => p.chapterId !== chapterId);
          return [...updated, data.progress];
        });
      }

      // Move to next question or complete chapter
      if (currentQuestionNumber < 5) {
        // Don't reset the ref - just load next question
        setTimeout(() => {
          loadQuestion(currentQuestionNumber + 1);
        }, 2000);
      } else {
        // Chapter complete
        setTimeout(() => {
          const completeMessage: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `${translate('chat_complete')}\n\n${translate('chat_your_score', { score: String(data.progress?.score || 0) })}\n\n${
              chapters.length > 1 
                ? translate('chat_next_chapter')
                : translate('chat_all_done')
            }`,
            timestamp: new Date(),
            aristoState: 'success',
          };
          setMessages(prev => [...prev, completeMessage]);
        }, 2000);
      }
    } catch (error) {
      console.error('Error evaluating answer:', error);
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: translate('chat_error'),
        timestamp: new Date(),
        aristoState: 'confused',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (actionId: string) => {
    const actionMessages = {
      clarify: translate('quick_clarify'),
      simplify: translate('quick_simplify'),
      example: translate('quick_example'),
    };

    const message = actionMessages[actionId as keyof typeof actionMessages];
    if (message && !isLoading && currentQuestion) {
      // Submit directly instead of just filling the input
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Call AI to get intelligent help based on the current question
        const response = await fetch('/api/chat/help', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: actionId,
            question: currentQuestion.question,
            chapterTitle: currentChapter?.title || '',
            language: getApiLanguage(currentLanguage),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const helpMessage: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: data.help,
            timestamp: new Date(),
            aristoState: 'happy',
          };
          setMessages(prev => [...prev, helpMessage]);
        } else {
          throw new Error('Failed to get help');
        }
      } catch (error) {
        console.error('Error handling quick action:', error);
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: translate('chat_help'),
          timestamp: new Date(),
          aristoState: 'happy',
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setInputValue(text);
  };

  const handleChapterClick = (newChapterId: string) => {
    if (newChapterId !== chapterId) {
      // Save current session before navigating
      saveSession();
      router.push(`/learn/${newChapterId}`);
    }
  };

  const saveSession = async () => {
    if (!user?.id || !chapterId) return;

    try {
      await fetch('/api/sessions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          chapterId: chapterId,
          currentQuestion: currentQuestionNumber,
          chatMessages: messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            aristoState: msg.aristoState,
          })),
          sessionState: currentQuestionNumber >= 5 ? 'completed' : 'active',
        }),
      });
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const phaseInfo = getPhaseForQuestion(currentQuestionNumber);

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Points Animation Overlay */}
      {showPointsAnimation && (
        <PointsAnimation
          points={pointsEarned}
          onComplete={() => setShowPointsAnimation(false)}
        />
      )}
      
      {/* Sidebar */}
      <ChapterSidebar
        chapters={chapters}
        chapterProgress={chapterProgress}
        currentChapterId={chapterId}
        onChapterClick={handleChapterClick}
        onHomeClick={() => {
          saveSession();
          router.push('/dashboard');
        }}
        onCollapseChange={setIsSidebarCollapsed}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 h-16 px-6 flex items-center justify-between">
          {/* Left: Chapter Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">
              {currentChapter ? getLocalizedChapterTitle(currentChapter, currentLanguage) : translate('loading')}
            </h1>
            <p className="text-xs text-gray-600">
              {translate('learn_question')} {currentQuestionNumber <= 3 ? 1 : currentQuestionNumber === 4 ? 2 : 3}: {phaseInfo.name} • {translate('learn_score')}: {
                chapterProgress.find(p => p.chapterId === chapterId)?.score || 0
              } {translate('learn_pts')}
            </p>
          </div>
          
          {/* Right: Sign Out + Mascot + Language Toggle */}
          <div className="flex items-center gap-3 ml-4">
            {/* Sign Out Button */}
            <SignOutButton />
            
            {/* Mascot Avatar */}
            <img
              src="/chat/mascotte.png"
              alt="Aristo mascot"
              width={48}
              height={48}
              className="rounded-full object-cover shadow-lg"
            />
            
            {/* Language Toggle */}
            <LanguageToggle />
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto">
            {isTranslating && (
              <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                <p className="text-sm text-blue-700">
                  {currentLanguage === 'fr' ? 'Traduction en cours...' : 'Translating...'}
                </p>
              </div>
            )}
            
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            
            {isLoading && (
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
                  <p className="text-sm text-gray-600">{translate('learn_thinking')}</p>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="max-w-4xl mx-auto">
            {/* Quick Actions */}
            <div className="mb-3">
              <QuickActionButtons
                onAction={handleQuickAction}
                disabled={isLoading}
              />
            </div>

            {/* Input Field */}
            <div className="flex items-end gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  currentQuestion?.type === 'mcq' 
                    ? translate('learn_placeholder_mcq')
                    : translate('learn_placeholder_text')
                }
                disabled={isLoading}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              
              <VoiceInput
                onTranscript={handleVoiceTranscript}
                disabled={isLoading}
              />
              
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="p-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
