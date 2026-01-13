'use client';

import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Loader2, Download, Copy, Check, RotateCcw, Pencil, X, Save, UserPlus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCoursesRefresh } from '@/contexts/CoursesRefreshContext';
import GenerationLoadingScreen from './GenerationLoadingScreen';
import StreamingMarkdownView from './StreamingMarkdownView';
import GenerationProgress from './GenerationProgress';
import PersonnalisationScreen from './PersonnalisationScreen';
import { PersonnalisationConfig } from '@/types/personnalisation';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import '@/styles/golden-note.css';

// Lazy load the WYSIWYG editor to reduce initial bundle size
const RevisionSheetEditor = lazy(() => import('@/components/editor/RevisionSheetEditor'));

interface APlusNoteViewProps {
  courseId: string;
  courseTitle: string;
  courseStatus?: string; // 'pending' | 'processing' | 'ready' | 'failed'
  onModalStateChange?: (isOpen: boolean) => void;
}

interface ParsedNote {
  title: string;
  topics: string[];
  content: string;
}

interface NoteStatus {
  status: 'pending' | 'generating' | 'ready' | 'failed';
  progress: number;
  currentStep: string | null;
  sectionIndex: number | null;
  totalSections: number | null;
  errorMessage: string | null;
  hasContent: boolean;
  content: string | null;
  partialContent: string | null;
}

// Map step keys to translation keys for note generation
const STEP_TO_TRANSLATION_KEY: Record<string, string> = {
  'starting': 'gen_step_analyzing_structure',
  'analyzing_document': 'gen_step_analyzing_structure',
  'extracting_chapter': 'gen_step_transcribing_sections',
  'verifying_content': 'gen_step_verifying_completeness',
  'generating_content': 'gen_step_transcribing_sections',
  'generating_glossary': 'gen_step_generating_glossary',
  'finalizing': 'gen_step_saving_note',
  'complete': 'gen_step_saving_note',
};

// Helper to translate progress messages
function getProgressMessage(
  step: string | null,
  translate: (key: string) => string,
  sectionIndex?: number | null,
  totalSections?: number | null
): string {
  if (!step) return translate('gen_step_analyzing_structure');

  const translationKey = STEP_TO_TRANSLATION_KEY[step];
  if (translationKey) {
    let translated = translate(translationKey);
    // Replace placeholders if we're transcribing sections
    if (step === 'extracting_chapter' && sectionIndex && totalSections) {
      translated = translate('aplus_note_progress_transcribing')
        .replace('{current}', sectionIndex.toString())
        .replace('{total}', totalSections.toString());
    }
    return translated;
  }

  return translate('gen_step_analyzing_structure');
}

export default function APlusNoteView({ courseId, courseTitle, courseStatus, onModalStateChange }: APlusNoteViewProps) {
  const router = useRouter();
  const { translate } = useLanguage();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { triggerRefresh } = useCoursesRefresh();
  const [noteContent, setNoteContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteStatus, setNoteStatus] = useState<NoteStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showPersonnalisation, setShowPersonnalisation] = useState(false);
  const [lastConfig, setLastConfig] = useState<PersonnalisationConfig | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track if we're regenerating (had content before, now generating new)
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);

  // SSE streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamStep, setStreamStep] = useState<string | null>(null);
  const [streamSectionIndex, setStreamSectionIndex] = useState<number | null>(null);
  const [streamTotalSections, setStreamTotalSections] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Derived state - use streaming state when streaming, otherwise use polling state
  const isGenerating = isStreaming || noteStatus?.status === 'generating';
  const generationProgress = isStreaming ? streamProgress : (noteStatus?.progress ?? 0);
  const sectionIndex = isStreaming ? streamSectionIndex : noteStatus?.sectionIndex;
  const totalSections = isStreaming ? streamTotalSections : noteStatus?.totalSections;
  const currentStep = isStreaming ? streamStep : noteStatus?.currentStep;
  const partialContent = isStreaming ? streamingContent : noteStatus?.partialContent;

  // Parse the note content to extract title, topics, and main content
  const parsedNote = useMemo((): ParsedNote | null => {
    if (!noteContent) return null;

    let title = courseTitle;
    let topics: string[] = [];
    let content = noteContent;

    // Extract title from first H1
    const titleMatch = noteContent.match(/^#\s*✦?\s*A\+ Note\s*(?:for|pour|für|:)?\s*(.+?)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      content = content.replace(titleMatch[0], '').trim();
    }

    // Extract topics
    const topicsLineMatch = content.match(/\*\*(?:Course|Cours|Kurs):\*\*.*?\|\s*\*\*(?:Topics|Sujets|Themen):\*\*\s*(.+?)$/m);
    if (topicsLineMatch) {
      const topicsStr = topicsLineMatch[1];
      const backtickTopics = topicsStr.match(/`([^`]+)`/g);
      if (backtickTopics) {
        topics = backtickTopics.map(t => t.replace(/`/g, ''));
      }
      content = content.replace(topicsLineMatch[0], '').trim();
    }

    if (topics.length === 0) {
      const standaloneTopics = content.match(/^`([^`]+)`\s*`([^`]+)`/m);
      if (standaloneTopics) {
        const allTopics = content.match(/`([^`]+)`/g);
        if (allTopics && allTopics.length <= 5) {
          topics = allTopics.map(t => t.replace(/`/g, ''));
        }
      }
    }

    return { title, topics, content };
  }, [noteContent, courseTitle]);

  // Fetch note and status
  const fetchNoteStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/courses/${courseId}/note/status`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data: NoteStatus = await response.json();
        setNoteStatus(data);

        // If ready and has content, update note content
        if (data.status === 'ready' && data.content) {
          setNoteContent(data.content);
          // Clear regeneration state
          setIsRegenerating(false);
          setPreviousContent(null);
          triggerRefresh();
        }

        // If failed, set error and restore previous content if regenerating
        if (data.status === 'failed') {
          if (data.errorMessage) {
            setError(data.errorMessage);
          }
          // Restore previous content on failure
          if (previousContent) {
            setNoteContent(previousContent);
            setIsRegenerating(false);
            setPreviousContent(null);
          }
        }

        return data;
      }
    } catch (err) {
      console.error('Error fetching note status:', err);
    }
    return null;
  }, [courseId, triggerRefresh, previousContent]);

  // Initial fetch
  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      try {
        // First try to get existing note
        const noteResponse = await fetch(`/api/courses/${courseId}/note`, {
          credentials: 'include',
        });

        if (noteResponse.ok) {
          const data = await noteResponse.json();
          if (data.content) {
            setNoteContent(data.content);
          }
          if (data.config) {
            setLastConfig(data.config as PersonnalisationConfig);
          }
        }

        // Then get status
        await fetchNoteStatus();
      } catch (err) {
        console.error('Error fetching note:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();
  }, [courseId, fetchNoteStatus]);

  // Polling when generating (only if NOT using SSE streaming)
  useEffect(() => {
    // Don't poll if we're using SSE streaming
    if (isStreaming) return;
    // Only poll if noteStatus indicates generating (not our local isGenerating which includes streaming)
    if (noteStatus?.status !== 'generating') return;

    console.log('[APlusNote] Starting poll for note generation status (fallback mode)');

    const pollInterval = setInterval(async () => {
      const status = await fetchNoteStatus();
      if (status && (status.status === 'ready' || status.status === 'failed')) {
        console.log('[APlusNote] Generation complete, stopping poll');
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      console.log('[APlusNote] Stopping poll');
      clearInterval(pollInterval);
    };
  }, [isStreaming, noteStatus?.status, fetchNoteStatus]);

  // Cleanup event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Block body scroll when modal is open
  useEffect(() => {
    const isModalOpen = showSignupModal || showPersonnalisation;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    onModalStateChange?.(isModalOpen);
    return () => {
      document.body.style.overflow = '';
    };
  }, [showSignupModal, showPersonnalisation, onModalStateChange]);

  // Show personnalisation screen before regenerating (requires account)
  const handleShowPersonnalisation = () => {
    if (!user) {
      setShowSignupModal(true);
      return;
    }
    setShowPersonnalisation(true);
  };

  // Handle copy - requires account
  const handleCopyWithAuth = async () => {
    if (!user) {
      setShowSignupModal(true);
      return;
    }
    handleCopy();
  };

  // Handle download - requires account
  const handleDownloadWithAuth = async () => {
    if (!user) {
      setShowSignupModal(true);
      return;
    }
    handleDownload();
  };

  // Handle edit - requires account
  const handleEditWithAuth = () => {
    if (!user) {
      setShowSignupModal(true);
      return;
    }
    handleEdit();
  };

  const handleGenerate = async (config?: PersonnalisationConfig) => {
    // Hide personnalisation screen
    setShowPersonnalisation(false);

    // Save config for next regeneration
    if (config) {
      setLastConfig(config);
    }

    // If we have existing content, save it and mark as regenerating
    if (noteContent) {
      setPreviousContent(noteContent);
      setIsRegenerating(true);
    }

    setError(null);

    // Clean up any existing event source
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Reset streaming state
    setStreamingContent('');
    setStreamProgress(0);
    setStreamStep('starting');
    setStreamSectionIndex(null);
    setStreamTotalSections(null);
    setIsStreaming(true);

    try {
      // Use SSE streaming endpoint
      const response = await fetch(`/api/courses/${courseId}/note/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start note generation');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Read the SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (eventType) {
                case 'content':
                  fullContent += data.text;
                  setStreamingContent(fullContent);
                  break;

                case 'progress':
                  setStreamProgress(data.progress || 0);
                  if (data.step) setStreamStep(data.step);
                  if (data.sectionIndex !== undefined) setStreamSectionIndex(data.sectionIndex);
                  if (data.totalSections !== undefined) setStreamTotalSections(data.totalSections);
                  break;

                case 'complete':
                  console.log('[APlusNote] Stream complete');
                  setNoteContent(fullContent);
                  setIsStreaming(false);
                  setIsRegenerating(false);
                  setPreviousContent(null);
                  setStreamingContent('');
                  triggerRefresh();
                  break;

                case 'error':
                  throw new Error(data.message || 'Generation failed');
              }
            } catch (parseErr) {
              // Ignore JSON parse errors for incomplete data
              if (eventType === 'error' || eventType === 'complete') {
                console.error('Failed to parse SSE data:', parseErr);
              }
            }
            eventType = '';
          }
        }
      }

    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsStreaming(false);
      // On error, restore previous content if we were regenerating
      if (previousContent) {
        setNoteContent(previousContent);
        setIsRegenerating(false);
        setPreviousContent(null);
      }
    }
  };

  const handleCopy = async () => {
    if (!contentRef.current || !parsedNote) return;
    try {
      const htmlContent = contentRef.current.innerHTML;
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([noteContent || ''], { type: 'text/plain' });

      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      });

      await navigator.clipboard.write([clipboardItem]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Rich copy failed, falling back to plain text:', err);
      try {
        await navigator.clipboard.writeText(noteContent || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy:', fallbackErr);
      }
    }
  };

  const handleEdit = () => {
    if (noteContent) {
      setEditContent(noteContent);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/note`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to save note');
      }

      setNoteContent(editContent);
      setIsEditing(false);
      setEditContent('');
    } catch (err) {
      console.error('Error saving note:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!contentRef.current || !parsedNote) return;

    setDownloading(true);

    try {
      const { generatePDFWithTextLayer } = await import('@/lib/pdf-with-text-layer');
      const filename = `${courseTitle.replace(/[^a-z0-9]/gi, '_')}_Study_Sheet.pdf`;

      await generatePDFWithTextLayer(contentRef.current, filename, { margin: 15, scale: 2 });
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-2xl border shadow-sm p-8 text-center transition-colors ${
        isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
      }`}>
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
        <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>{translate('loading')}</p>
      </div>
    );
  }

  // Course still processing (text extraction) - show waiting message
  if (courseStatus === 'pending' || courseStatus === 'processing') {
    return <GenerationLoadingScreen type="extraction" />;
  }

  // Note is being generated - show progress with professional hydration
  if (isGenerating) {
    const hasPartialContent = partialContent && partialContent.trim().length > 0;
    const showPreviousAsBackground = isRegenerating && previousContent;

    // Parse previous content for display
    const previousParsed = showPreviousAsBackground ? (() => {
      let content = previousContent;
      const titleMatch = previousContent.match(/^#\s*✦?\s*A\+ Note\s*(?:for|pour|für|:)?\s*(.+?)$/m);
      if (titleMatch) {
        content = content.replace(titleMatch[0], '').trim();
      }
      return { content };
    })() : null;

    // Calculate min height based on previous content to prevent layout shift
    const minContentHeight = showPreviousAsBackground ? 'auto' : '400px';

    // Show progress bar separately only when we have content (previous or streaming)
    const showSeparateProgressBar = showPreviousAsBackground || (partialContent && partialContent.trim().length > 0);

    return (
      <div className="space-y-4">
        {/* Progress bar at top - only when we have content below */}
        {showSeparateProgressBar && (
          <div className={`rounded-2xl border shadow-sm p-4 transition-colors ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
          }`}>
            <GenerationProgress
              type="note"
              progress={generationProgress}
              message={getProgressMessage(currentStep ?? null, translate, sectionIndex, totalSections)}
              itemsGenerated={sectionIndex ?? undefined}
              totalItems={totalSections ?? undefined}
            />
          </div>
        )}

        {/* Content area with hydration */}
        <div className={`rounded-2xl border shadow-sm overflow-hidden transition-colors relative ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
        }`} style={{ minHeight: minContentHeight }}>

          {/* LAYER 1: Previous content as background (hydration) */}
          {showPreviousAsBackground && !hasPartialContent && (
            <>
              {/* Semi-transparent overlay */}
              <div className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-300 ${
                isDark ? 'bg-neutral-900/70' : 'bg-white/70'
              }`}>
                {/* Centered loading indicator */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`px-6 py-4 rounded-2xl shadow-lg backdrop-blur-sm ${
                    isDark ? 'bg-neutral-800/90 border border-neutral-700' : 'bg-white/90 border border-gray-200'
                  }`}>
                    <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto mb-2" />
                    <p className={`text-sm font-medium ${isDark ? 'text-neutral-300' : 'text-gray-600'}`}>
                      {translate('aplus_note_regenerating') || 'Regenerating your sheet...'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Previous content - visible but dimmed */}
              <div className="p-4 sm:p-6 md:p-8 transition-opacity duration-300 opacity-40">
                <div className={`golden-note-content ${isDark ? 'dark-mode' : ''}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {previousParsed?.content || ''}
                  </ReactMarkdown>
                </div>
              </div>
            </>
          )}

          {/* LAYER 2: New streaming content (appears on top) */}
          {hasPartialContent && (
            <div className="p-4 sm:p-6 md:p-8 animate-fadeIn">
              <StreamingMarkdownView
                content={partialContent}
                isStreaming={true}
                showCursor={true}
                autoScroll={true}
                maxHeight="none"
              />
            </div>
          )}

          {/* LAYER 3: Empty state - first generation (no previous content) */}
          {!showPreviousAsBackground && !hasPartialContent && (
            <div className="p-4 sm:p-6 md:p-8">
              <GenerationLoadingScreen
                type="note"
                compact={true}
                progress={generationProgress}
                progressMessage={getProgressMessage(currentStep ?? null, translate, sectionIndex, totalSections)}
                itemsGenerated={sectionIndex ?? undefined}
                totalItems={totalSections ?? undefined}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // No note yet - show personnalisation screen directly
  if (!noteContent || !parsedNote) {
    return (
      <>
        {error && (
          <div
            className="rounded-xl p-3 mb-4 text-sm border"
            style={{
              backgroundColor: isDark ? 'rgba(217, 26, 28, 0.15)' : '#fff6f3',
              borderColor: isDark ? 'rgba(217, 26, 28, 0.3)' : 'rgba(217, 26, 28, 0.3)',
              color: isDark ? '#e94446' : '#d91a1c'
            }}
          >
            <span>{error}</span>
          </div>
        )}

        <PersonnalisationScreen
          fileName={courseTitle}
          onGenerate={handleGenerate}
          isGenerating={false}
        />

        {/* Signup Modal */}
        {showSignupModal && createPortal(
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[9999]">
            <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
              isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
            }`}>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDark ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <UserPlus className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {translate('signup_to_continue_title')}
              </h3>
              <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                {translate('signup_to_continue_description')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignupModal(false)}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                    isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {translate('cancel')}
                </button>
                <button
                  onClick={() => router.push('/auth/signup')}
                  className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
                >
                  {translate('auth_signup_button')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // Show the note with structured header
  return (
    <>
      {/* Signup Modal */}
      {showSignupModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[9999]">
          <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isDark ? 'bg-orange-500/20' : 'bg-orange-100'
            }`}>
              <UserPlus className="w-7 h-7 text-orange-500" />
            </div>
            <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
              {translate('signup_to_continue_title')}
            </h3>
            <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {translate('signup_to_continue_description')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignupModal(false)}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {translate('cancel')}
              </button>
              <button
                onClick={() => router.push('/auth/signup')}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                {translate('auth_signup_button')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Personnalisation Modal for regeneration */}
      {showPersonnalisation && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowPersonnalisation(false)}
          />
          <div className="relative max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <PersonnalisationScreen
              fileName={courseTitle}
              onGenerate={handleGenerate}
              onCancel={() => setShowPersonnalisation(false)}
              isGenerating={false}
              initialConfig={lastConfig ?? undefined}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Action bar - above the content */}
      <div className="flex items-center justify-end gap-1 mb-4">
        <button
          onClick={handleCopyWithAuth}
          className={`p-2 rounded-lg transition-colors ${
            isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
          title={translate('copy')}
        >
          {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
        </button>
        <button
          onClick={handleDownloadWithAuth}
          disabled={downloading}
          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
            isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
          title={translate('download')}
        >
          {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
        </button>
        <button
          onClick={handleEditWithAuth}
          disabled={isEditing}
          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
            isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
          title={translate('edit')}
        >
          <Pencil className="w-5 h-5" />
        </button>
        <button
          onClick={handleShowPersonnalisation}
          disabled={isEditing}
          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
            isDark ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/20' : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
          }`}
          title={translate('regenerate')}
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Note content */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden transition-colors ${
        isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
      }`}>
        <div className="p-4 sm:p-6 md:p-8">
          {isEditing ? (
            <div className="space-y-3 sm:space-y-4">
              {/* Edit toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className={`text-xs sm:text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  {translate('aplus_note_edit_wysiwyg_hint')}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
                      isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    <X className="w-4 h-4" />
                    {translate('cancel')}
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {translate('save')}
                  </button>
                </div>
              </div>
              {/* WYSIWYG Editor */}
              <Suspense fallback={
                <div className={`flex items-center justify-center h-[400px] sm:h-[500px] rounded-xl border ${
                  isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'
                }`}>
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              }>
                <RevisionSheetEditor
                  initialContent={editContent}
                  onChange={setEditContent}
                  courseId={courseId}
                  isDark={isDark}
                  placeholder={translate('aplus_note_editor_placeholder')}
                />
              </Suspense>
            </div>
          ) : (
            <div ref={contentRef} className={`golden-note-content ${isDark ? 'dark-mode' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  h1: ({children}) => <h1 className={`text-2xl font-bold mt-0 mb-6 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>{children}</h1>,
                  h2: ({children}) => <h2 className={`text-xl font-bold mt-8 mb-4 pb-2 border-b-2 ${isDark ? 'text-neutral-50 border-neutral-700' : 'text-gray-900 border-gray-200'}`}>{children}</h2>,
                  h3: ({children}) => <h3 className={`text-lg font-semibold mt-6 mb-3 ${isDark ? 'text-neutral-100' : 'text-gray-800'}`}>{children}</h3>,
                  p: ({children, node}) => {
                    const hasImage = node?.children?.some((child: any) =>
                      child.tagName === 'img' ||
                      (child.type === 'element' && child.tagName === 'img')
                    );

                    if (hasImage) {
                      return <div className={`my-3 leading-relaxed ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>{children}</div>;
                    }
                    return <p className={`my-3 leading-relaxed ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>{children}</p>;
                  },
                  ul: ({children}) => <ul>{children}</ul>,
                  ol: ({children}) => <ol>{children}</ol>,
                  li: ({children}) => <li>{children}</li>,
                  strong: ({children}) => <strong className={`font-semibold ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>{children}</strong>,
                  em: ({children}) => <em className={`italic ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>{children}</em>,
                  blockquote: ({children}) => <blockquote className={`border-l-4 border-orange-500 px-4 py-3 my-4 rounded-r-lg ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>{children}</blockquote>,
                  code: ({children, className}) => {
                    const isInline = !className;
                    return isInline
                      ? <code className={`px-1.5 py-0.5 rounded text-sm font-medium ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'}`}>{children}</code>
                      : <code className={className}>{children}</code>;
                  },
                  pre: ({children}) => <pre className={`rounded-lg p-4 overflow-x-auto my-4 ${isDark ? 'bg-neutral-800 border border-neutral-700' : 'bg-gray-50 border border-gray-200'}`}>{children}</pre>,
                  img: ({src, alt}) => (
                    <figure className="my-6 block">
                      <img
                        src={src}
                        alt={alt || 'Figure'}
                        className={`w-full max-w-2xl mx-auto rounded-xl shadow-lg border ${isDark ? 'border-neutral-700' : 'border-gray-200'}`}
                        loading="lazy"
                      />
                      {alt && (
                        <figcaption className={`text-center text-sm mt-2 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                          {alt}
                        </figcaption>
                      )}
                    </figure>
                  ),
                  hr: () => (
                    <hr className={`my-6 border-t ${isDark ? 'border-neutral-700' : 'border-gray-200'}`} />
                  ),
                }}
              >
                {parsedNote.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
