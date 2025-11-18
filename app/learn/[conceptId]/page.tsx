'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useChatMemory } from '@/hooks/useChatMemory';
import ChatBubble from '@/components/chat/ChatBubble';
import QuickActionButtons from '@/components/chat/QuickActionButtons';
import VoiceInput from '@/components/chat/VoiceInput';
import ChapterSidebar from '@/components/layout/ChapterSidebar';
import TopBarActions from '@/components/layout/TopBarActions';
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

  // 🆕 Hook de mémoire persistante du chat
  const {
    messages,
    addMessage,
    isLoading: isLoadingMemory,
    error: memoryError
  } = useChatMemory({
    userId: user?.id,
    chapterId,
    enabled: !!user && !!chapterId,
  });
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
  const previousChapterIdRef = useRef<string>(chapterId);

  // Initialize and reload when chapterId changes
  useEffect(() => {
    // Reset refs when chapter changes
    if (previousChapterIdRef.current !== chapterId) {
      console.log('🔄 Chapter changed, resetting state');
      isInitializedRef.current = false;
      questionLoadedRef.current.clear();
      previousChapterIdRef.current = chapterId;
    }

    // ✅ ATTENDRE que la mémoire soit chargée AVANT d'initialiser le chapitre
    // Ceci évite le race condition où loadChapterData() s'exécute avant que
    // useChatMemory ait fini de charger l'historique depuis Supabase
    if (!isInitializedRef.current && !isLoadingMemory) {
      console.log('🚀 Initializing chapter:', chapterId, '(memory loaded, messages count:', messages.length, ')');
      isInitializedRef.current = true;
      loadChapterData();
    }

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up chapter:', chapterId);
    };
  }, [chapterId, isLoadingMemory, messages.length]);

  // Track language changes
  useEffect(() => {
    if (previousLanguageRef.current !== currentLanguage) {
      console.log('🌍 Language changed from', previousLanguageRef.current, 'to', currentLanguage);
      previousLanguageRef.current = currentLanguage;

      // Re-translate current question if needed
      if (currentQuestion) {
        translateQuestionObject(currentQuestion, currentLanguage)
          .then(translatedQuestion => {
            setCurrentQuestion(translatedQuestion);
          })
          .catch(error => {
            console.error('⚠️ Error translating question:', error);
          });
      }
    }
  }, [currentLanguage, currentQuestion]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChapterData = async () => {
    try {
      console.log('📚 Loading chapter data for:', chapterId);

      // Fetch all chapters for sidebar
      const chaptersResponse = await fetch('/api/chapters');
      if (chaptersResponse.ok) {
        const chaptersData = await chaptersResponse.json();
        console.log('📊 chaptersData from /api/chapters:', chaptersData);
        setChapters(chaptersData.chapters || []);
        setChapterProgress(chaptersData.progress || []);
      }

      // Fetch current chapter
      const response = await fetch(`/api/chapters/${chapterId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chapter');
      }

      const chapter = await response.json();

      // Validate chapter data
      if (!chapter || !chapter.questions || chapter.questions.length === 0) {
        console.error('❌ Invalid chapter data:', chapter);
        await addMessage({
          role: 'assistant',
          content: '❌ Désolé, je ne peux pas charger ce chapitre. Les données sont manquantes ou invalides.',
          aristoState: 'confused',
        });
        return;
      }

      console.log('✅ Chapter loaded:', chapter.title, 'with', chapter.questions.length, 'questions');
      setCurrentChapter(chapter);

      // Get progress to determine current question
      let startQuestionNumber = 1;
      const progressResponse = await fetch(`/api/chapters/${chapterId}/progress`);
      if (progressResponse.ok) {
        const progress = await progressResponse.json();
        startQuestionNumber = progress.currentQuestion || 1;
        setCurrentQuestionNumber(startQuestionNumber);
        console.log('📈 Progress loaded, starting at question:', startQuestionNumber);
      }

      // ✅ LOGIQUE CORRIGÉE : Vérifier l'historique ET la progression
      const hasHistory = messages.length > 0;
      
      // Vérifier si l'introduction est déjà dans l'historique
      const hasIntroduction = messages.some(msg =>
        msg.role === 'assistant' &&
        (msg.content.includes('Bonjour ! Je suis Aristo') || msg.content.includes('Bienvenue dans le chapitre'))
      );

      if (!hasHistory && startQuestionNumber === 1) {
        // 🆕 NOUVELLE SESSION: Aucun historique ET première question
        console.log('🎉 New session (no history, question 1), adding greeting and first question');
        const localizedTitle = getLocalizedChapterTitle(chapter, currentLanguage);

        await addMessage({
          role: 'assistant',
          content: `👋 Bonjour ! Je suis Aristo, votre assistant d'apprentissage.\n\n📚 Bienvenue dans le chapitre **${localizedTitle}** !\n\nCe chapitre contient 5 questions pour tester votre compréhension. Chaque question ne peut être répondue qu'une seule fois. Je vous donnerai un feedback pédagogique après chaque réponse, puis nous passerons à la question suivante.\n\n**🎯 Points par question :**\n• Questions 1-3 (QCM) : 10 points chacune\n• Questions 4-5 (Réponse courte/Réflexive) : 35 points chacune\n\n**📝 Important :** Une seule tentative par question. Réfléchissez bien avant de répondre !\n\n✨ Commençons !`,
          aristoState: 'happy',
        });

        // Charger la première question immédiatement après
        setTimeout(() => {
          console.log('⏰ Loading first question');
          loadQuestion(1, chapter);
        }, 1500);
      } else if (hasHistory) {
        // 🔄 REPRISE DE SESSION: Historique de chat existant (REFRESH ou NAVIGATION)
        console.log('✅ Chat history exists, resuming session (REFRESH detected)');
        console.log('📊 Progress indicates current question:', startQuestionNumber);
        console.log('💬 Chat contains', messages.length, 'messages');
        console.log('🔍 Has introduction:', hasIntroduction);

        // ✅ NE JAMAIS recharger l'introduction lors d'un refresh
        // Simplement restaurer l'état de la question courante
        
        // Vérifier si la question courante est DÉJÀ dans l'historique
        const currentQuestionAlreadyInHistory = messages.some(msg =>
          msg.role === 'assistant' &&
          msg.content.includes(`Question ${startQuestionNumber}`)
        );

        if (currentQuestionAlreadyInHistory) {
          console.log(`✅ Question ${startQuestionNumber} déjà présente dans l'historique, pas de rechargement`);

          // Restaurer la question courante depuis les données du chapitre
          const question = chapter.questions.find((q: any) => q.questionNumber === startQuestionNumber);
          if (question) {
            setCurrentQuestion(question);
            console.log('✅ Restored current question:', question.questionNumber, question.type);
          }

          // Vérifier si l'utilisateur a déjà répondu à cette question
          const questionMessageIndex = messages.findIndex(msg =>
            msg.role === 'assistant' &&
            msg.content.includes(`Question ${startQuestionNumber}`)
          );

          const hasUserResponseAfterQuestion = messages.slice(questionMessageIndex + 1).some(
            msg => msg.role === 'user'
          );

          if (hasUserResponseAfterQuestion) {
            console.log(`✅ L'utilisateur a déjà répondu à Question ${startQuestionNumber}, en attente du feedback ou de la question suivante`);
          } else {
            console.log(`⏳ Question ${startQuestionNumber} affichée, en attente de la réponse de l'utilisateur`);
          }

        } else {
          // La question courante n'est PAS dans l'historique
          // C'est le seul cas où on doit la charger
          console.log(`📝 Question ${startQuestionNumber} non trouvée dans l'historique, chargement...`);

          const question = chapter.questions.find((q: any) => q.questionNumber === startQuestionNumber);
          if (question) {
            // ✅ IMPORTANT : Marquer la question comme déjà chargée AVANT de la charger
            // pour éviter les doubles chargements
            const questionKey = `${chapter.id}-${question.id}`;
            if (!questionLoadedRef.current.has(questionKey)) {
              setCurrentQuestion(question);
              setTimeout(() => {
                loadQuestion(startQuestionNumber, chapter);
              }, 500);
            } else {
              console.log(`⚠️ Question ${startQuestionNumber} déjà marquée comme chargée, skip`);
              setCurrentQuestion(question);
            }
          }
        }
      } else {
        // Cas rare : pas d'historique mais pas à la question 1
        // Cela peut arriver si la progression a été sauvegardée mais l'historique perdu
        console.log('⚠️ No history but not at question 1, loading current question without intro');
        const question = chapter.questions.find((q: any) => q.questionNumber === startQuestionNumber);
        if (question) {
          // ✅ Vérifier aussi ici pour éviter les doubles chargements
          const questionKey = `${chapter.id}-${question.id}`;
          if (!questionLoadedRef.current.has(questionKey)) {
            setCurrentQuestion(question);
            setTimeout(() => {
              loadQuestion(startQuestionNumber, chapter);
            }, 500);
          } else {
            console.log(`⚠️ Question ${startQuestionNumber} déjà marquée comme chargée, skip`);
            setCurrentQuestion(question);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error loading chapter:', error);
      await addMessage({
        role: 'assistant',
        content: '❌ Une erreur est survenue lors du chargement du chapitre. Veuillez réessayer.',
        aristoState: 'confused',
      });
    }
  };

  const loadQuestion = async (questionNumber: number, chapterData?: ChapterData) => {
    const chapter = chapterData || currentChapter;

    console.log('🔍 loadQuestion called with:', questionNumber);
    console.log('📊 chapter:', chapter?.title);
    console.log('📝 questions available:', chapter?.questions?.length);
    console.log('💬 messages in history:', messages.length);
    
    // Valider les données du chapitre
    if (!chapter) {
      console.error('❌ No chapter data available');
      await addMessage({
        role: 'assistant',
        content: '❌ Impossible de charger la question. Les données du chapitre sont manquantes.',
        aristoState: 'confused',
      });
      return;
    }

    if (!chapter.questions || chapter.questions.length === 0) {
      console.error('❌ No questions available in chapter');
      await addMessage({
        role: 'assistant',
        content: '❌ Ce chapitre ne contient aucune question.',
        aristoState: 'confused',
      });
      return;
    }

    let question = chapter.questions.find(q => q.questionNumber === questionNumber);
    if (!question) {
      console.error('❌ Question not found:', questionNumber);
      console.log('Available questions:', chapter.questions.map(q => q.questionNumber));
      await addMessage({
        role: 'assistant',
        content: `❌ Question ${questionNumber} introuvable dans ce chapitre.`,
        aristoState: 'confused',
      });
      return;
    }

    // Create unique key for this question
    const questionKey = `${chapter.id}-${question.id}`;

    // ✅ Check if this exact question was already loaded to prevent duplicates
    if (questionLoadedRef.current.has(questionKey)) {
      console.log('⚠️ Question already loaded (in ref), skipping:', questionKey);
      return;
    }

    // ✅ ALSO check if this question is already in the chat history
    const questionAlreadyInHistory = messages.some(msg =>
      msg.role === 'assistant' &&
      (msg.content.includes(question!.question) || msg.content.includes(`Question ${questionNumber}`))
    );

    if (questionAlreadyInHistory) {
      console.log('⚠️ Question already in chat history, skipping:', questionNumber);
      // Still mark as loaded to prevent future attempts
      questionLoadedRef.current.add(questionKey);
      return;
    }

    console.log('✅ Found question:', question.id, question.type, '- not yet asked');

    // Mark this question as loaded BEFORE setting state
    questionLoadedRef.current.add(questionKey);
    
    // Translate question if needed
    try {
      question = await translateQuestionObject(question, currentLanguage);
    } catch (error) {
      console.error('⚠️ Error translating question:', error);
      // Continue with original question if translation fails
    }
    
    setCurrentQuestion(question);
    setCurrentQuestionNumber(questionNumber);

    // Also update currentChapter if it was passed
    if (chapterData && !currentChapter) {
      setCurrentChapter(chapterData);
    }

    // Formater le message de la question
    let questionContent = `**Question ${questionNumber} :** ${question.question}`;

    if (question.type === 'mcq' && question.options) {
      questionContent += '\n\n';
      questionContent += question.options.map((opt, idx) =>
        `${String.fromCharCode(65 + idx)}) ${opt}`
      ).join('\n');
      questionContent += `\n\n💡 Tapez la lettre de votre réponse (A, B, C ou D)`;
    }

    console.log('✅ Question loaded successfully, adding to messages');
    await addMessage({
      role: 'assistant',
      content: questionContent,
      aristoState: 'asking',
    });
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

    const userAnswer = inputValue;
    setInputValue('');

    // ✅ Vérifier qu'il y a bien une question en cours
    if (!currentQuestion) {
      console.log('❌ No current question set');
      return;
    }

    // ✅ BLOQUER LES RÉPONSES MULTIPLES À LA MÊME QUESTION
    // Vérifier si cette question a déjà une réponse enregistrée dans la progression
    const progress = chapterProgress.find(p => p.chapterId === chapterId);
    const questionAlreadyAnswered = progress?.answers?.some(
      (a: any) => a.questionNumber === currentQuestion.questionNumber
    );

    if (questionAlreadyAnswered) {
      console.log('⚠️ Question already answered, blocking duplicate response');
      await addMessage({
        role: 'assistant',
        content: `⚠️ Vous avez déjà répondu à la Question ${currentQuestion.questionNumber}. Une seule tentative est autorisée par question. Passons à la suite !`,
        aristoState: 'confused',
      });
      // Charger la question suivante
      const nextQuestionNumber = currentQuestion.questionNumber + 1;
      if (nextQuestionNumber <= 5) {
        setTimeout(() => {
          loadQuestion(nextQuestionNumber);
        }, 2000);
      }
      return;
    }

    console.log('✅ Proceeding with answer evaluation');
    setIsLoading(true);

    // Ajouter le message de l'utilisateur
    await addMessage({
      role: 'user',
      content: userAnswer,
    });

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
          language: 'FR', // Toujours forcer le français
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
      await addMessage({
        role: 'assistant',
        content: data.feedback,
        aristoState: data.correct ? 'happy' : 'confused',
      });

      // Update progress display
      if (data.progress) {
        setChapterProgress(prev => {
          const updated = prev.filter(p => p.chapterId !== chapterId);
          return [...updated, data.progress];
        });
      }

      // ✅ Après feedback, charger directement la question suivante
      // Pas de message intermédiaire "Prêt pour la suite"

      if (currentQuestionNumber >= 5) {
        // Chapitre terminé - afficher le message de félicitations
        setTimeout(async () => {
          await addMessage({
            role: 'assistant',
            content: `🎉 Félicitations ! Vous avez terminé ce chapitre !\n\n📊 Votre score : ${data.progress?.score || 0} points\n\n${
              chapters.length > 1
                ? '➡️ Passez au chapitre suivant pour continuer votre apprentissage !'
                : '✅ Vous avez terminé tous les chapitres disponibles !'
            }`,
            aristoState: 'success',
          });
        }, 2000);
      } else {
        // Charger automatiquement la question suivante après un court délai
        console.log('✅ Answer processed. Loading next question:', currentQuestionNumber + 1);
        setTimeout(() => {
          loadQuestion(currentQuestionNumber + 1);
        }, 2000);
      }
    } catch (error) {
      console.error('Error evaluating answer:', error);
      await addMessage({
        role: 'assistant',
        content: '❌ Une erreur est survenue lors de l\'évaluation de votre réponse. Veuillez réessayer.',
        aristoState: 'confused',
      });
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
      setIsLoading(true);

      // Add user message
      await addMessage({
        role: 'user',
        content: message,
      });

      try {
        // Appeler l'IA pour obtenir de l'aide sur la question actuelle
        const response = await fetch('/api/chat/help', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: actionId,
            question: currentQuestion.question,
            chapterTitle: currentChapter?.title || '',
            language: 'FR', // Toujours forcer le français
            correctAnswer: currentQuestion.correctAnswer, // Pour les QCM
            questionType: currentQuestion.type, // mcq ou open
          }),
        });

        if (response.ok) {
          const data = await response.json();
          await addMessage({
            role: 'assistant',
            content: data.help,
            aristoState: 'happy',
          });
        } else {
          throw new Error('Failed to get help');
        }
      } catch (error) {
        console.error('Error handling quick action:', error);
        await addMessage({
          role: 'assistant',
          content: '💡 Bien sûr, je peux vous aider avec cette question ! N\'hésitez pas à me demander si quelque chose n\'est pas clair.',
          aristoState: 'happy',
        });
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
      router.push(`/learn/${newChapterId}`);
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
              {translate('learn_question')} {currentQuestionNumber}: {phaseInfo.name} • {translate('learn_score')}: {
                chapterProgress.find(p => p.chapterId === chapterId)?.score || 0
              } {translate('learn_pts')}
            </p>
          </div>
          
          {/* Right: Mascot + Action Buttons */}
          <div className="flex items-center gap-3 ml-4">
            {/* Mascot Avatar */}
            <img
              src="/chat/mascotte.png"
              alt="Aristo mascot"
              width={48}
              height={48}
              className="rounded-full object-cover shadow-lg"
            />
            
            {/* Language Toggle + Sign Out */}
            <TopBarActions />
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
