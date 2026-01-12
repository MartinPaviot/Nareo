'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import '@/styles/golden-note.css';

interface StreamingMarkdownViewProps {
  /** The content being streamed (accumulates over time) */
  content: string;
  /** Whether streaming is currently active */
  isStreaming: boolean;
  /** Show blinking cursor at the end */
  showCursor?: boolean;
  /** Scroll to bottom as content appears */
  autoScroll?: boolean;
  /** Container class name */
  className?: string;
  /** Maximum height (enables scrolling) */
  maxHeight?: string;
}

/**
 * Component that renders Markdown content with streaming support.
 * Shows a blinking cursor at the end during streaming and
 * handles partial LaTeX gracefully.
 */
export default function StreamingMarkdownView({
  content,
  isStreaming,
  showCursor = true,
  autoScroll = true,
  className = '',
  maxHeight,
}: StreamingMarkdownViewProps) {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldShowCursor, setShouldShowCursor] = useState(true);

  // Blink the cursor
  useEffect(() => {
    if (!isStreaming || !showCursor) {
      setShouldShowCursor(false);
      return;
    }

    const interval = setInterval(() => {
      setShouldShowCursor(prev => !prev);
    }, 530);

    return () => clearInterval(interval);
  }, [isStreaming, showCursor]);

  // Auto-scroll to bottom as content grows
  useEffect(() => {
    if (autoScroll && containerRef.current && isStreaming) {
      const container = containerRef.current;
      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [content, autoScroll, isStreaming]);

  // Process content to handle incomplete LaTeX blocks
  const processedContent = useMemo(() => {
    if (!content) return '';

    let processed = content;

    // Check for incomplete LaTeX blocks (odd number of $$ or $)
    const blockLatexCount = (processed.match(/\$\$/g) || []).length;
    const inlineLatexCount = (processed.match(/(?<!\$)\$(?!\$)/g) || []).length;

    // If we have an unclosed block LaTeX, add a placeholder and closing
    if (blockLatexCount % 2 !== 0) {
      // Find the last $$ and add a closing one
      const lastIndex = processed.lastIndexOf('$$');
      if (lastIndex !== -1) {
        const partialFormula = processed.slice(lastIndex + 2);
        // Add ellipsis and close the block
        processed = processed.slice(0, lastIndex + 2) + partialFormula + '\\cdots$$';
      }
    }

    // If we have an unclosed inline LaTeX, close it
    if (inlineLatexCount % 2 !== 0) {
      const lastIndex = processed.lastIndexOf('$');
      if (lastIndex !== -1) {
        const afterDollar = processed.slice(lastIndex + 1);
        // Only close if there's actual content (not just whitespace)
        if (afterDollar.trim().length > 0 && !afterDollar.includes('\n')) {
          processed = processed + '\\cdots$';
        }
      }
    }

    return processed;
  }, [content]);

  // Container styles
  const containerStyles: React.CSSProperties = {
    ...(maxHeight ? { maxHeight, overflowY: 'auto' as const } : {}),
  };

  return (
    <div
      ref={containerRef}
      className={`golden-note-content relative ${className}`}
      style={containerStyles}
    >
      {/* Markdown content */}
      <div className="streaming-markdown-wrapper">
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
          components={{
            // Custom heading renderer for proper styling
            h1: ({ children }) => (
              <h1 className={`text-2xl font-bold mb-4 mt-6 first:mt-0 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className={`text-xl font-semibold mb-3 mt-5 ${isDark ? 'text-neutral-100' : 'text-gray-800'}`}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className={`text-lg font-semibold mb-2 mt-4 ${isDark ? 'text-neutral-200' : 'text-gray-700'}`}>
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className={`mb-3 leading-relaxed ${isDark ? 'text-neutral-300' : 'text-gray-600'}`}>
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className={`list-disc list-inside mb-3 space-y-1 ${isDark ? 'text-neutral-300' : 'text-gray-600'}`}>
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className={`list-decimal list-inside mb-3 space-y-1 ${isDark ? 'text-neutral-300' : 'text-gray-600'}`}>
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="leading-relaxed">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className={`font-semibold ${isDark ? 'text-neutral-100' : 'text-gray-800'}`}>
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="italic">{children}</em>
            ),
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-');
              if (isBlock) {
                return (
                  <code className={`block p-3 rounded-lg text-sm font-mono overflow-x-auto ${
                    isDark ? 'bg-neutral-800 text-neutral-200' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {children}
                  </code>
                );
              }
              return (
                <code className={`px-1.5 py-0.5 rounded text-sm font-mono ${
                  isDark ? 'bg-neutral-800 text-orange-300' : 'bg-orange-50 text-orange-700'
                }`}>
                  {children}
                </code>
              );
            },
            blockquote: ({ children }) => (
              <blockquote className={`border-l-4 pl-4 py-1 my-3 italic ${
                isDark ? 'border-orange-500/50 text-neutral-400' : 'border-orange-300 text-gray-500'
              }`}>
                {children}
              </blockquote>
            ),
            hr: () => (
              <hr className={`my-6 border-t ${isDark ? 'border-neutral-700' : 'border-gray-200'}`} />
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-4">
                <table className={`min-w-full divide-y ${isDark ? 'divide-neutral-700' : 'divide-gray-200'}`}>
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className={`px-3 py-2 text-left text-sm font-semibold ${
                isDark ? 'bg-neutral-800 text-neutral-200' : 'bg-gray-50 text-gray-700'
              }`}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className={`px-3 py-2 text-sm ${
                isDark ? 'text-neutral-300 border-neutral-700' : 'text-gray-600 border-gray-100'
              } border-b`}>
                {children}
              </td>
            ),
            // Image component with error handling for streaming content
            // Uses span instead of figure to avoid hydration errors when inside <p>
            img: ({ src, alt }) => {
              const srcString = typeof src === 'string' ? src : '';
              return (
                <span className="block my-6">
                  <img
                    src={srcString}
                    alt={alt || 'Figure'}
                    className={`w-full max-w-2xl mx-auto rounded-xl shadow-lg border ${
                      isDark ? 'border-neutral-700' : 'border-gray-200'
                    }`}
                    loading="lazy"
                    onError={(e) => {
                      // Hide broken images (e.g., #loading placeholders)
                      const target = e.currentTarget;
                      if (srcString.includes('#loading') || srcString.includes('graphic')) {
                        target.style.display = 'none';
                      }
                    }}
                  />
                  {alt && alt !== 'Figure' && (
                    <span className={`block text-center text-sm mt-2 ${
                      isDark ? 'text-neutral-400' : 'text-gray-500'
                    }`}>
                      {alt}
                    </span>
                  )}
                </span>
              );
            },
          }}
        >
          {processedContent}
        </ReactMarkdown>

        {/* Blinking cursor */}
        {isStreaming && showCursor && (
          <span
            className={`inline-block w-0.5 h-5 ml-0.5 align-middle transition-opacity duration-100 ${
              shouldShowCursor ? 'opacity-100' : 'opacity-0'
            } ${isDark ? 'bg-orange-400' : 'bg-orange-500'}`}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Gradient fade at bottom during streaming */}
      {isStreaming && maxHeight && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-12 pointer-events-none ${
            isDark
              ? 'bg-gradient-to-t from-neutral-900 to-transparent'
              : 'bg-gradient-to-t from-white to-transparent'
          }`}
        />
      )}
    </div>
  );
}
