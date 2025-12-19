'use client';

import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Download, Copy, Check, Sparkles, RotateCcw, Pencil, X, Save, UserPlus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import GenerationLoadingScreen from './GenerationLoadingScreen';
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
}

interface ParsedNote {
  title: string;
  topics: string[];
  content: string;
}

// Helper to translate progress messages from API
function translateProgressMessage(message: string, translate: (key: string) => string): string {
  if (!message) return '';

  // Map API messages to translation keys
  if (message.includes('Analyzing document structure')) {
    return translate('aplus_note_progress_analyzing');
  }
  if (message.includes('Transcribing section') || message.includes('Transcribing')) {
    // Extract numbers from "Transcribing section 3/6..." or "Transcribing 6 sections..."
    const sectionMatch = message.match(/(\d+)\/(\d+)/);
    if (sectionMatch) {
      return translate('aplus_note_progress_transcribing')
        .replace('{current}', sectionMatch[1])
        .replace('{total}', sectionMatch[2]);
    }
    const countMatch = message.match(/Transcribing (\d+) sections/);
    if (countMatch) {
      return translate('aplus_note_progress_transcribing')
        .replace('{current}', '1')
        .replace('{total}', countMatch[1]);
    }
    return translate('aplus_note_progress_generating');
  }
  if (message.includes('Generating glossary')) {
    return translate('aplus_note_progress_glossary');
  }
  if (message.includes('Generating note')) {
    return translate('aplus_note_progress_generating');
  }
  if (message.includes('Saving note')) {
    return translate('aplus_note_progress_saving');
  }

  // Fallback: return as-is if no match
  return message;
}

export default function APlusNoteView({ courseId, courseTitle, courseStatus }: APlusNoteViewProps) {
  const router = useRouter();
  const { translate } = useLanguage();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [noteContent, setNoteContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Parse the note content to extract title, topics, and main content
  const parsedNote = useMemo((): ParsedNote | null => {
    if (!noteContent) return null;

    let title = courseTitle;
    let topics: string[] = [];
    let content = noteContent;

    // Extract title from first H1 (handles "for", "pour", "für", or ":")
    const titleMatch = noteContent.match(/^#\s*✦?\s*A\+ Note\s*(?:for|pour|für|:)?\s*(.+?)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      // Remove the title line from content
      content = content.replace(titleMatch[0], '').trim();
    }

    // Extract topics from the Course/Topics line or backtick tags (handles multiple languages)
    const topicsLineMatch = content.match(/\*\*(?:Course|Cours|Kurs):\*\*.*?\|\s*\*\*(?:Topics|Sujets|Themen):\*\*\s*(.+?)$/m);
    if (topicsLineMatch) {
      const topicsStr = topicsLineMatch[1];
      // Extract backtick-wrapped topics
      const backtickTopics = topicsStr.match(/`([^`]+)`/g);
      if (backtickTopics) {
        topics = backtickTopics.map(t => t.replace(/`/g, ''));
      }
      // Remove the topics line from content
      content = content.replace(topicsLineMatch[0], '').trim();
    }

    // Also try to extract standalone topics if not found in the line above
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

  // Check if note already exists
  useEffect(() => {
    const fetchNote = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/courses/${courseId}/note`);
        if (response.ok) {
          const data = await response.json();
          if (data.content) {
            setNoteContent(data.content);
          }
        }
      } catch (err) {
        console.error('Error fetching note:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [courseId]);

  const handleGenerate = async () => {
    // Check if user is logged in
    if (!user) {
      setShowSignupModal(true);
      return;
    }

    setGenerating(true);
    setGenerationProgress(0);
    setGenerationMessage('Starting...');
    setError(null);

    try {
      const response = await fetch(`/api/courses/${courseId}/note/generate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate note');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                setGenerationProgress(data.progress || 0);
                setGenerationMessage(data.message || '');
              } else if (data.type === 'complete') {
                setNoteContent(data.content);
                setGenerationProgress(100);
                setGenerationMessage('');
              } else if (data.type === 'error') {
                throw new Error(data.message || 'Generation failed');
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete messages
              if (parseError instanceof SyntaxError) continue;
              throw parseError;
            }
          }
        }
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating(false);
      setGenerationProgress(0);
      setGenerationMessage('');
    }
  };

  const handleCopy = async () => {
    if (!contentRef.current || !parsedNote) return;
    try {
      // Get the HTML content for rich text paste (Word, Google Docs, etc.)
      const htmlContent = contentRef.current.innerHTML;

      // Create a blob with HTML content
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([noteContent || ''], { type: 'text/plain' });

      // Use ClipboardItem API for rich text copy
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      });

      await navigator.clipboard.write([clipboardItem]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback to plain text if ClipboardItem not supported
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
      // html2pdf.js now uses html2canvas-pro (via webpack alias) which supports lab() colors
      const html2pdf = (await import('html2pdf.js')).default;

      // Clone the content for PDF generation
      const element = contentRef.current.cloneNode(true) as HTMLElement;

      // Force light mode styles for PDF export (remove dark-mode class)
      element.classList.remove('dark-mode');
      // Apply light mode background
      element.style.backgroundColor = '#ffffff';
      element.style.color = '#374151';

      // Add title to the PDF content
      const titleElement = document.createElement('h1');
      titleElement.textContent = `✦ ${translate('aplus_note_title')} ${translate('aplus_note_for')} ${parsedNote.title}`;
      titleElement.style.fontSize = '24px';
      titleElement.style.fontWeight = 'bold';
      titleElement.style.marginBottom = '16px';
      titleElement.style.color = '#111827';
      element.insertBefore(titleElement, element.firstChild);

      const opt = {
        margin: [15, 15, 15, 15] as [number, number, number, number],
        filename: `${courseTitle.replace(/[^a-z0-9]/gi, '_')}_Study_Sheet.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: {
          unit: 'mm' as const,
          format: 'a4' as const,
          orientation: 'portrait' as const
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setDownloading(false);

      // Cleanup any leftover html2pdf elements that might block interactions
      setTimeout(() => {
        document.querySelectorAll('.html2pdf__overlay, .html2pdf__container').forEach(el => el.remove());
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
      }, 200);
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

  // Course still processing (text extraction) - show waiting message with mascot
  if (courseStatus === 'pending' || courseStatus === 'processing') {
    return <GenerationLoadingScreen type="extraction" />;
  }

  // No note yet - show generate button
  if (!noteContent || !parsedNote) {
    return (
      <>
        <div className={`rounded-2xl border shadow-sm p-8 text-center transition-colors ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
        }`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isDark ? 'bg-orange-500/20' : 'bg-orange-100'
          }`}>
            <Sparkles className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
            {translate('aplus_note_title')}
          </h3>
          <p className={`text-sm mb-6 max-w-md mx-auto ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
            {translate('aplus_note_description')}
          </p>

          {error && (
            <div className={`rounded-xl p-3 mb-4 text-sm flex items-center justify-between ${
              isDark ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <span>{error}</span>
              <button
                onClick={handleGenerate}
                className={`ml-3 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  isDark ? 'bg-red-500/30 hover:bg-red-500/40 text-red-400' : 'bg-red-100 hover:bg-red-200 text-red-700'
                }`}
              >
                {translate('retry') || 'Retry'}
              </button>
            </div>
          )}

          {generating ? (
            <GenerationLoadingScreen
              type="note"
              compact
              progress={generationProgress}
              progressMessage={translateProgressMessage(generationMessage, translate)}
            />
          ) : (
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              {translate('aplus_note_generate')}
            </button>
          )}
        </div>

        {/* Signup Modal */}
        {showSignupModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
              isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
            }`}>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDark ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <UserPlus className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {translate('aplus_note_signup_title')}
              </h3>
              <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                {translate('aplus_note_signup_description')}
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
          </div>
        )}
      </>
    );
  }

  // Show the note with structured header
  return (
    <>
      {/* Floating toast notification for regeneration progress */}
      {generating && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`rounded-2xl shadow-2xl border p-4 w-72 ${
            isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isDark ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                  {translate('aplus_note_regenerating')}
                </p>
                <p className={`text-xs truncate mb-2 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  {translateProgressMessage(generationMessage, translate) || translate('aplus_note_please_wait')}
                </p>
                <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-100'}`}>
                  <div
                    className="bg-orange-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                <p className={`text-xs mt-1 text-right ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>{generationProgress}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`rounded-2xl border shadow-sm overflow-hidden transition-colors ${
        isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
      }`}>

      {/* Header */}
      <div className={`border-b p-4 sm:p-6 ${isDark ? 'border-neutral-800' : 'border-gray-100'}`}>
        {/* Title */}
        <h1 className={`text-lg sm:text-2xl font-bold mb-3 sm:mb-4 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
          ✦ {translate('aplus_note_title')} {translate('aplus_note_for')} {parsedNote.title}
        </h1>

        {/* Action buttons - wrap on mobile */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <button
            onClick={handleCopy}
            disabled={generating}
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors disabled:opacity-50 ${
              isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span className="hidden xs:inline">{translate('copy')}</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || generating}
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors disabled:opacity-50 ${
              isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden xs:inline">{translate('download')}</span>
          </button>
          <button
            onClick={handleEdit}
            disabled={isEditing || generating}
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors disabled:opacity-50 ${
              isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden xs:inline">{translate('edit')}</span>
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || isEditing}
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors disabled:opacity-50 ${
              isDark ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/20' : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
            }`}
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span className="hidden xs:inline">{translate('regenerate')}</span>
          </button>
        </div>

        {/* Topics */}
        {parsedNote.topics.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex flex-wrap gap-1.5">
              {parsedNote.topics.map((topic, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-orange-500 text-white text-xs font-medium rounded-full"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Note content */}
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
                // Custom paragraph that handles images properly to avoid hydration errors
                // In HTML, <figure> cannot be inside <p>, so we detect images and use <div> instead
                p: ({children, node}) => {
                  // Check if any child is an image element
                  const hasImage = node?.children?.some((child: any) =>
                    child.tagName === 'img' ||
                    (child.type === 'element' && child.tagName === 'img')
                  );

                  if (hasImage) {
                    // Use div instead of p when containing images to avoid hydration errors
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
                // Render images as standalone figures, not inside paragraphs
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
