'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  children: string;
  className?: string;
}

/**
 * Renders text with LaTeX math formulas using KaTeX.
 * Supports inline math ($...$) and block math ($$...$$).
 *
 * Use this for quiz questions and options that may contain formulas.
 */
export default function MathText({ children, className = '' }: MathTextProps) {
  // Check if text contains any math notation
  const hasMath = children.includes('$') || children.includes('\\');

  // If no math, just render as plain text for performance
  if (!hasMath) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={`math-text-inline ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Render paragraphs as spans to keep inline
          p: ({ children }) => <span>{children}</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
}
