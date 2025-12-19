import showdown from 'showdown';
import TurndownService from 'turndown';

// Configure Showdown for Markdown → HTML conversion
// Settings aligned with ReactMarkdown + remarkGfm behavior
const showdownConverter = new showdown.Converter({
  tables: true,
  tasklists: true,
  strikethrough: true,
  ghCodeBlocks: true,
  emoji: false, // ReactMarkdown doesn't convert emoji by default
  underline: false, // Not standard markdown
  simpleLineBreaks: false, // Match ReactMarkdown behavior - requires double newline for paragraphs
  openLinksInNewWindow: false,
  backslashEscapesHTMLTags: false,
  headerLevelStart: 1,
  parseImgDimensions: true,
  simplifiedAutoLink: false, // ReactMarkdown requires explicit link syntax
  literalMidWordUnderscores: true,
  ghCompatibleHeaderId: true,
  disableForced4SpacesIndentedSublists: true, // Allow 2-space indentation for sublists like GFM
});

// Configure Turndown for HTML → Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});

// Add custom rules for better conversion
turndownService.addRule('strikethrough', {
  filter: ['del', 's'] as const,
  replacement: (content) => `~~${content}~~`,
});

// Handle images with alt text
turndownService.addRule('images', {
  filter: 'img',
  replacement: (_content, node) => {
    const img = node as HTMLImageElement;
    const alt = img.getAttribute('alt') || '';
    const src = img.getAttribute('src') || '';
    const title = img.getAttribute('title');
    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },
});

/**
 * Convert Markdown content to HTML
 * The @aarkue/tiptap-math-extension recognizes $...$ syntax directly
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // Pre-process: protect LaTeX math blocks from showdown conversion
  let processed = markdown;
  const mathBlocks: string[] = [];

  // Replace display math ($$...$$) with placeholders
  processed = processed.replace(/\$\$([^$]+)\$\$/g, (_match, content) => {
    mathBlocks.push(`$$${content.trim()}$$`);
    return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
  });

  // Replace inline math ($...$) with placeholders - be careful not to match $$
  processed = processed.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_match, content) => {
    mathBlocks.push(`$${content.trim()}$`);
    return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
  });

  // Pre-process: Normalize line endings only
  processed = processed.replace(/\r\n/g, '\n');

  // Convert Markdown to HTML
  let html = showdownConverter.makeHtml(processed);

  // Restore math blocks - the extension will render them
  mathBlocks.forEach((block, index) => {
    html = html.replace(`%%MATH_BLOCK_${index}%%`, block);
  });

  return html;
}

// Add rule to handle math nodes from tiptap-math-extension
turndownService.addRule('tiptapMath', {
  filter: (node) => {
    return node.nodeName === 'SPAN' &&
           (node.getAttribute('data-type') === 'inlineMath' ||
            node.classList?.contains('tiptap-math') ||
            node.classList?.contains('katex'));
  },
  replacement: (content, node) => {
    // Try to get the original LaTeX from data attribute or text content
    const latex = (node as HTMLElement).getAttribute('data-latex') ||
                  (node as HTMLElement).textContent || content;
    // If it already has $, return as-is, otherwise wrap
    if (latex.startsWith('$')) return latex;
    return `$${latex}$`;
  },
});

/**
 * Convert HTML content to Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let processed = html;
  const mathBlocks: string[] = [];

  // Preserve any remaining raw $...$ or $$...$$ in text
  // Display math
  processed = processed.replace(/\$\$([^$]+)\$\$/g, (_match, content) => {
    mathBlocks.push(`$$${content}$$`);
    return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
  });

  // Inline math
  processed = processed.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_match, content) => {
    mathBlocks.push(`$${content}$`);
    return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
  });

  // Convert HTML to Markdown
  let markdown = turndownService.turndown(processed);

  // Restore math blocks
  mathBlocks.forEach((block, index) => {
    markdown = markdown.replace(`%%MATH_BLOCK_${index}%%`, block);
  });

  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  return markdown;
}

/**
 * Sanitize HTML content for safe rendering
 * Removes potentially dangerous elements while preserving formatting
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Remove script tags and event handlers
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '');

  return sanitized;
}
