import showdown from 'showdown';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

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

// Add GFM support (tables, strikethrough, etc.)
turndownService.use(gfm);

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
 * Converts $...$ and $$...$$ to TipTap math extension format
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // Pre-process: protect LaTeX math blocks from showdown conversion
  let processed = markdown;
  const mathBlocks: { latex: string; display: boolean }[] = [];

  // Replace display math ($$...$$) with placeholders
  processed = processed.replace(/\$\$([^$]+)\$\$/g, (_match, content) => {
    mathBlocks.push({ latex: content.trim(), display: true });
    return `MATHBLOCKPLACEHOLDER${mathBlocks.length - 1}ENDMATHBLOCK`;
  });

  // Replace inline math ($...$) with placeholders - be careful not to match $$
  processed = processed.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_match, content) => {
    mathBlocks.push({ latex: content.trim(), display: false });
    return `MATHBLOCKPLACEHOLDER${mathBlocks.length - 1}ENDMATHBLOCK`;
  });

  // Pre-process: Normalize line endings only
  processed = processed.replace(/\r\n/g, '\n');

  // Convert Markdown to HTML
  let html = showdownConverter.makeHtml(processed);

  // Transform tables to TipTap-compatible format
  // TipTap expects cell content to be in <p> tags and doesn't use thead/tbody
  html = transformTablesForTipTap(html);

  // Restore math blocks as TipTap math extension HTML nodes
  mathBlocks.forEach((block, index) => {
    const placeholder = `MATHBLOCKPLACEHOLDER${index}ENDMATHBLOCK`;
    // Create HTML that TipTap math extension can parse
    // The extension looks for: <span data-type="inlineMath" data-latex="...">
    const delimiter = block.display ? '$$' : '$';
    const mathHtml = `<span data-type="inlineMath" data-latex="${escapeHtmlAttr(block.latex)}" data-display="${block.display ? 'yes' : 'no'}">${delimiter}${escapeHtml(block.latex)}${delimiter}</span>`;
    html = html.split(placeholder).join(mathHtml);
  });

  return html;
}

// Helper to escape HTML attributes
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper to escape HTML content
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Transform HTML tables to TipTap-compatible format
 * - Removes thead/tbody wrappers (TipTap doesn't use them)
 * - Wraps cell content in <p> tags (TipTap expects block content)
 */
function transformTablesForTipTap(html: string): string {
  // Remove thead and tbody tags but keep their content
  html = html.replace(/<thead>/gi, '');
  html = html.replace(/<\/thead>/gi, '');
  html = html.replace(/<tbody>/gi, '');
  html = html.replace(/<\/tbody>/gi, '');

  // Wrap th content in <p> tags if not already wrapped
  // Use [\s\S]*? to match across newlines (non-greedy)
  html = html.replace(/<th([^>]*)>([\s\S]*?)<\/th>/gi, (_match, attrs, content) => {
    const trimmed = content.trim();
    // Check if content is already wrapped in a block element
    if (trimmed.startsWith('<p>') || trimmed.startsWith('<h') || trimmed.startsWith('<ul>') || trimmed.startsWith('<ol>')) {
      return `<th${attrs}>${content}</th>`;
    }
    return `<th${attrs}><p>${trimmed}</p></th>`;
  });

  // Wrap td content in <p> tags if not already wrapped
  // Use [\s\S]*? to match across newlines (non-greedy)
  html = html.replace(/<td([^>]*)>([\s\S]*?)<\/td>/gi, (_match, attrs, content) => {
    const trimmed = content.trim();
    // Check if content is already wrapped in a block element
    if (trimmed.startsWith('<p>') || trimmed.startsWith('<h') || trimmed.startsWith('<ul>') || trimmed.startsWith('<ol>')) {
      return `<td${attrs}>${content}</td>`;
    }
    return `<td${attrs}><p>${trimmed}</p></td>`;
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
  replacement: (_content, node) => {
    const element = node as HTMLElement;
    // Get the original LaTeX from data attribute
    const latex = element.getAttribute('data-latex') || '';
    const isDisplay = element.getAttribute('data-display') === 'yes';

    // Return with appropriate delimiters
    if (isDisplay) {
      return `$$${latex}$$`;
    }
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
    return `MATHBLOCKPLACEHOLDER${mathBlocks.length - 1}ENDMATHBLOCK`;
  });

  // Inline math
  processed = processed.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_match, content) => {
    mathBlocks.push(`$${content}$`);
    return `MATHBLOCKPLACEHOLDER${mathBlocks.length - 1}ENDMATHBLOCK`;
  });

  // Convert HTML to Markdown
  let markdown = turndownService.turndown(processed);

  // Restore math blocks
  mathBlocks.forEach((block, index) => {
    const placeholder = `MATHBLOCKPLACEHOLDER${index}ENDMATHBLOCK`;
    markdown = markdown.split(placeholder).join(block);
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
