'use client';

import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Undo,
  Redo,
  Quote,
  Code,
} from 'lucide-react';
import { useRef } from 'react';

interface EditorToolbarProps {
  editor: Editor | null;
  isDark: boolean;
  onImageUpload: (file: File) => Promise<string | null>;
  uploading?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  isDark: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, disabled, isDark, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 sm:p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        isActive
          ? isDark
            ? 'bg-orange-500/30 text-orange-400'
            : 'bg-orange-100 text-orange-600'
          : isDark
            ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider({ isDark }: { isDark: boolean }) {
  return (
    <div className={`w-px h-6 mx-1 ${isDark ? 'bg-neutral-700' : 'bg-gray-200'}`} />
  );
}

export default function EditorToolbar({ editor, isDark, onImageUpload, uploading }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await onImageUpload(file);
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-0.5 p-2 border-b ${
      isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'
    }`}>
      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        isDark={isDark}
        title="Annuler"
      >
        <Undo className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        isDark={isDark}
        title="Rétablir"
      >
        <Redo className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider isDark={isDark} />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        isDark={isDark}
        title="Titre 1"
      >
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        isDark={isDark}
        title="Titre 2"
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        isDark={isDark}
        title="Titre 3"
      >
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider isDark={isDark} />

      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        isDark={isDark}
        title="Gras"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        isDark={isDark}
        title="Italique"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        isDark={isDark}
        title="Code"
      >
        <Code className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider isDark={isDark} />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        isDark={isDark}
        title="Liste à puces"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        isDark={isDark}
        title="Liste numérotée"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        isDark={isDark}
        title="Citation"
      >
        <Quote className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider isDark={isDark} />

      {/* Image */}
      <ToolbarButton
        onClick={handleImageClick}
        disabled={uploading}
        isDark={isDark}
        title="Insérer une image"
      >
        <Image className="w-4 h-4" />
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
