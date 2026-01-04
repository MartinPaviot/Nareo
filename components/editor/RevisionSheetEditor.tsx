'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline } from '@tiptap/extension-underline';
import { TextColor } from './extensions/TextColor';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { markdownToHtml, htmlToMarkdown } from '@/lib/editor-utils';
import EditorToolbar from './EditorToolbar';
import 'katex/dist/katex.min.css';

interface RevisionSheetEditorProps {
  initialContent: string; // Markdown content
  onChange: (markdown: string) => void;
  courseId: string;
  isDark: boolean;
  placeholder?: string;
}

export default function RevisionSheetEditor({
  initialContent,
  onChange,
  courseId,
  isDark,
  placeholder = 'Commencez à écrire votre fiche de révision...',
}: RevisionSheetEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const editor = useEditor({
    immediatelyRender: false, // Avoid SSR hydration mismatch
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      MathExtension.configure({
        evaluation: false, // Don't evaluate math expressions
        katexOptions: {
          throwOnError: false,
          displayMode: false,
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Underline,
      TextColor,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'editor-table',
        },
      }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: markdownToHtml(initialContent),
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            handleImageUpload(file).then((url) => {
              if (url) {
                const { schema } = view.state;
                const coordinates = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                });
                if (coordinates) {
                  const node = schema.nodes.image.create({ src: url });
                  const transaction = view.state.tr.insert(coordinates.pos, node);
                  view.dispatch(transaction);
                }
              }
            });
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) {
                handleImageUpload(file).then((url) => {
                  if (url) {
                    const { schema } = view.state;
                    const node = schema.nodes.image.create({ src: url });
                    const transaction = view.state.tr.replaceSelectionWith(node);
                    view.dispatch(transaction);
                  }
                });
              }
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
    onCreate: () => {
      // Small delay to ensure styles are applied before showing
      setTimeout(() => setIsReady(true), 50);
    },
  });

  // Update content when initialContent changes externally
  useEffect(() => {
    if (editor && initialContent) {
      const currentHtml = editor.getHTML();
      const newHtml = markdownToHtml(initialContent);
      // Only update if content is actually different (avoid cursor jump)
      if (currentHtml !== newHtml && !editor.isFocused) {
        editor.commands.setContent(newHtml);
      }
    }
  }, [editor, initialContent]);

  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type');
      return null;
    }

    if (file.size > 5 * 1024 * 1024) {
      console.error('File too large');
      return null;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`/api/courses/${courseId}/note/image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Upload failed:', error);
        return null;
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    } finally {
      setUploading(false);
    }
  }, [courseId]);

  // Show loading state while editor initializes
  if (!isReady) {
    return (
      <div className={`rounded-xl border overflow-hidden ${
        isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
      }`}>
        <div className={`flex items-center justify-center h-[400px] sm:h-[500px] ${
          isDark ? 'bg-neutral-900' : 'bg-white'
        }`}>
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
    }`}>
      <EditorToolbar
        editor={editor}
        isDark={isDark}
        onImageUpload={handleImageUpload}
        uploading={uploading}
      />
      <div className={`relative ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
        {uploading && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10">
            <div className={`px-4 py-2 rounded-lg ${isDark ? 'bg-neutral-800' : 'bg-white'} shadow-lg`}>
              <span className={`text-sm ${isDark ? 'text-neutral-200' : 'text-gray-700'}`}>
                Upload en cours...
              </span>
            </div>
          </div>
        )}
        <div className={`tiptap-editor golden-note-content ${isDark ? 'dark-mode' : ''}`}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
