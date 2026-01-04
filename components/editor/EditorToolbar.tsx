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
  Highlighter,
  Underline,
  Strikethrough,
  Palette,
  Table,
  Minus,
  Plus,
  Trash2,
  ChevronDown,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownToLine,
  Columns,
  Rows,
} from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

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
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      title={title}
      className={`p-1.5 sm:p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        isActive
          ? isDark
            ? 'bg-orange-500/30 text-orange-400 ring-2 ring-orange-500/50'
            : 'bg-orange-100 text-orange-600 ring-2 ring-orange-400/50'
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

const HIGHLIGHT_COLORS = [
  { name: 'Jaune', color: '#fef08a' },
  { name: 'Vert', color: '#bbf7d0' },
  { name: 'Bleu', color: '#bfdbfe' },
  { name: 'Rose', color: '#fbcfe8' },
  { name: 'Orange', color: '#fed7aa' },
];

const TEXT_COLORS = [
  { name: 'Défaut', color: null },
  { name: 'Rouge', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Vert', color: '#22c55e' },
  { name: 'Bleu', color: '#3b82f6' },
  { name: 'Violet', color: '#8b5cf6' },
];

interface ColorPickerProps {
  colors: { name: string; color: string | null }[];
  onSelect: (color: string | null) => void;
  isDark: boolean;
  isHighlight?: boolean;
}

function ColorPicker({ colors, onSelect, isDark, isHighlight }: ColorPickerProps) {
  return (
    <div className={`absolute top-full left-0 mt-1 p-2 rounded-lg shadow-lg border z-50 ${
      isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
    }`}>
      <div className="flex gap-1">
        {colors.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => onSelect(c.color)}
            title={c.name}
            className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
              c.color === null
                ? `${isDark ? 'bg-neutral-700 border-neutral-600' : 'bg-gray-100 border-gray-300'} flex items-center justify-center`
                : 'border-transparent'
            }`}
            style={c.color ? { backgroundColor: c.color } : undefined}
          >
            {c.color === null && (
              <span className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>×</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TableMenuProps {
  editor: Editor;
  isDark: boolean;
  onClose: () => void;
}

function TableMenu({ editor, isDark, onClose }: TableMenuProps) {
  const isInTable = editor.isActive('table');
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const maxRows = 6;
  const maxCols = 6;

  if (!isInTable) {
    // Grid selector for inserting new table
    return (
      <div
        className={`absolute top-full left-0 mt-1 p-3 rounded-lg shadow-lg border z-50 ${
          isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
        }`}
        onMouseLeave={() => setHoverCell(null)}
      >
        <div className={`text-xs mb-2 text-center ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
          {hoverCell ? `${hoverCell.row} × ${hoverCell.col}` : 'Sélectionner la taille'}
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${maxCols}, 1fr)` }}>
          {Array.from({ length: maxRows * maxCols }).map((_, index) => {
            const row = Math.floor(index / maxCols) + 1;
            const col = (index % maxCols) + 1;
            const isHighlighted = hoverCell && row <= hoverCell.row && col <= hoverCell.col;

            return (
              <button
                key={index}
                type="button"
                onMouseEnter={() => setHoverCell({ row, col })}
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: row, cols: col, withHeaderRow: true }).run();
                  onClose();
                }}
                className={`w-5 h-5 rounded-sm border transition-colors ${
                  isHighlighted
                    ? 'bg-orange-400 border-orange-500'
                    : isDark
                      ? 'bg-neutral-700 border-neutral-600 hover:bg-neutral-600'
                      : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Actions menu for existing table
  const MenuItem = ({ onClick, icon: Icon, label, variant = 'default' }: {
    onClick: () => void;
    icon: React.ElementType;
    label: string;
    variant?: 'default' | 'danger';
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-2 text-sm flex items-center gap-3 transition-colors ${
        variant === 'danger'
          ? `text-red-500 ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`
          : isDark
            ? 'text-neutral-200 hover:bg-neutral-700'
            : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className={`absolute top-full left-0 mt-1 py-1 rounded-lg shadow-lg border z-50 min-w-[200px] ${
      isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
    }`}>
      <MenuItem onClick={() => editor.chain().focus().addColumnAfter().run()} icon={Plus} label="Ajouter une colonne" />
      <MenuItem onClick={() => editor.chain().focus().addRowAfter().run()} icon={Plus} label="Ajouter une ligne" />

      <div className={`my-1 border-t ${isDark ? 'border-neutral-700' : 'border-gray-100'}`} />

      <MenuItem onClick={() => editor.chain().focus().deleteColumn().run()} icon={Columns} label="Supprimer la colonne" />
      <MenuItem onClick={() => editor.chain().focus().deleteRow().run()} icon={Rows} label="Supprimer la ligne" />

      <div className={`my-1 border-t ${isDark ? 'border-neutral-700' : 'border-gray-100'}`} />

      <MenuItem onClick={() => { editor.chain().focus().deleteTable().run(); onClose(); }} icon={Trash2} label="Supprimer le tableau" variant="danger" />
    </div>
  );
}

export default function EditorToolbar({ editor, isDark, onImageUpload, uploading }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);

  // Force re-render on selection/transaction changes (like Word behavior)
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const updateHandler = () => forceUpdate(n => n + 1);

    // Listen to selection and transaction events
    editor.on('selectionUpdate', updateHandler);
    editor.on('transaction', updateHandler);

    return () => {
      editor.off('selectionUpdate', updateHandler);
      editor.off('transaction', updateHandler);
    };
  }, [editor]);

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
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        isDark={isDark}
        title="Souligné"
      >
        <Underline className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        isDark={isDark}
        title="Barré"
      >
        <Strikethrough className="w-4 h-4" />
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

      {/* Highlight */}
      <div className="relative">
        <ToolbarButton
          onClick={() => setShowHighlightPicker(!showHighlightPicker)}
          isActive={editor.isActive('highlight')}
          isDark={isDark}
          title="Surligner"
        >
          <Highlighter className="w-4 h-4" />
        </ToolbarButton>
        {showHighlightPicker && (
          <ColorPicker
            colors={[{ name: 'Aucun', color: null }, ...HIGHLIGHT_COLORS]}
            onSelect={(color) => {
              if (color) {
                editor.chain().focus().toggleHighlight({ color }).run();
              } else {
                editor.chain().focus().unsetHighlight().run();
              }
              setShowHighlightPicker(false);
            }}
            isDark={isDark}
            isHighlight
          />
        )}
      </div>

      {/* Text color */}
      <div className="relative">
        <ToolbarButton
          onClick={() => setShowColorPicker(!showColorPicker)}
          isActive={editor.isActive('textColor')}
          isDark={isDark}
          title="Couleur du texte"
        >
          <Palette className="w-4 h-4" />
        </ToolbarButton>
        {showColorPicker && (
          <ColorPicker
            colors={TEXT_COLORS}
            onSelect={(color) => {
              if (color) {
                editor.chain().focus().setTextColor(color).run();
              } else {
                editor.chain().focus().unsetTextColor().run();
              }
              setShowColorPicker(false);
            }}
            isDark={isDark}
          />
        )}
      </div>

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

      {/* Table */}
      <div className="relative">
        <ToolbarButton
          onClick={() => setShowTableMenu(!showTableMenu)}
          isActive={editor.isActive('table')}
          isDark={isDark}
          title="Tableau"
        >
          <Table className="w-4 h-4" />
        </ToolbarButton>
        {showTableMenu && (
          <TableMenu
            editor={editor}
            isDark={isDark}
            onClose={() => setShowTableMenu(false)}
          />
        )}
      </div>

      {/* Horizontal rule */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        isDark={isDark}
        title="Ligne horizontale"
      >
        <Minus className="w-4 h-4" />
      </ToolbarButton>

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
