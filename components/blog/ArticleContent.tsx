'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '@/contexts/ThemeContext';

interface ArticleContentProps {
  content: string;
}

export default function ArticleContent({ content }: ArticleContentProps) {
  const { isDark } = useTheme();

  return (
    <article
      className={`prose prose-lg max-w-none ${
        isDark
          ? 'prose-invert prose-headings:text-neutral-100 prose-p:text-neutral-300 prose-strong:text-neutral-100 prose-a:text-orange-400 hover:prose-a:text-orange-300 prose-blockquote:border-orange-500 prose-blockquote:text-neutral-400 prose-code:text-orange-400 prose-code:bg-neutral-800 prose-pre:bg-neutral-800 prose-li:text-neutral-300 prose-th:text-neutral-200 prose-td:text-neutral-300'
          : 'prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-a:text-orange-600 hover:prose-a:text-orange-500 prose-blockquote:border-orange-500 prose-blockquote:text-gray-600 prose-code:text-orange-600 prose-code:bg-orange-50 prose-pre:bg-gray-100 prose-li:text-gray-700 prose-th:text-gray-900 prose-td:text-gray-700'
      }`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom heading styles
          h1: ({ children }) => (
            <h1 className="text-3xl sm:text-4xl font-bold mt-8 mb-4">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl sm:text-3xl font-bold mt-8 mb-4">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl sm:text-2xl font-semibold mt-6 mb-3">{children}</h3>
          ),
          // Custom blockquote with orange accent
          blockquote: ({ children }) => (
            <blockquote className={`border-l-4 pl-4 py-2 my-6 ${
              isDark
                ? 'border-orange-500 bg-neutral-800/50'
                : 'border-orange-500 bg-orange-50'
            } rounded-r-lg`}>
              {children}
            </blockquote>
          ),
          // Custom table styling
          table: ({ children }) => (
            <div className="overflow-x-auto my-6">
              <table className={`min-w-full border-collapse ${
                isDark ? 'border-neutral-700' : 'border-gray-200'
              }`}>
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className={`px-4 py-3 text-left font-semibold border ${
              isDark
                ? 'bg-neutral-800 border-neutral-700'
                : 'bg-gray-100 border-gray-200'
            }`}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`px-4 py-3 border ${
              isDark ? 'border-neutral-700' : 'border-gray-200'
            }`}>
              {children}
            </td>
          ),
          // Code blocks
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className={`px-1.5 py-0.5 rounded text-sm ${
                    isDark
                      ? 'bg-neutral-800 text-orange-400'
                      : 'bg-orange-50 text-orange-600'
                  }`}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className={`p-4 rounded-xl overflow-x-auto ${
              isDark ? 'bg-neutral-800' : 'bg-gray-100'
            }`}>
              {children}
            </pre>
          ),
          // Horizontal rule
          hr: () => (
            <hr className={`my-8 border-t-2 ${
              isDark ? 'border-neutral-800' : 'border-gray-200'
            }`} />
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-6 space-y-2 my-4">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-6 space-y-2 my-4">
              {children}
            </ol>
          ),
          // Links with hover effect
          a: ({ href, children }) => (
            <a
              href={href}
              className={`underline decoration-2 underline-offset-2 transition-colors ${
                isDark
                  ? 'text-orange-400 hover:text-orange-300 decoration-orange-400/50 hover:decoration-orange-300'
                  : 'text-orange-600 hover:text-orange-500 decoration-orange-600/50 hover:decoration-orange-500'
              }`}
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          // Emphasis
          em: ({ children }) => (
            <em className={isDark ? 'text-neutral-200' : 'text-gray-800'}>
              {children}
            </em>
          ),
          strong: ({ children }) => (
            <strong className={`font-bold ${
              isDark ? 'text-neutral-100' : 'text-gray-900'
            }`}>
              {children}
            </strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
