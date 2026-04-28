import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import {
  Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Download, Loader2,
} from 'lucide-react';

// Custom FontSize extension (no official TipTap package)
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: Record<string, any>) =>
            attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands(): any {
    return {
      setFontSize: (size: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

const COLORS = [
  { value: '#1a1a1a', label: 'Preto' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
];

const ToolbarBtn = ({
  active, onClick, title, children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    title={title}
    className={`p-1.5 rounded-lg transition-all ${
      active
        ? 'bg-brand-primary text-white shadow-sm'
        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
    }`}
  >
    {children}
  </button>
);

const Toolbar = ({ editor, onExportPDF, exporting }: { editor: Editor; onExportPDF: () => void; exporting?: boolean }) => (
  <div className="flex flex-wrap items-center gap-0.5 px-4 py-2 border-b border-gray-100 bg-gray-50/60 sticky top-0 z-10">
    {/* Bold / Italic / Underline */}
    <div className="flex items-center gap-0.5 pr-2 border-r border-gray-200 mr-1">
      <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)">
        <Bold size={15} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)">
        <Italic size={15} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado (Ctrl+U)">
        <UnderlineIcon size={15} />
      </ToolbarBtn>
    </div>

    {/* Font Size */}
    <div className="pr-2 border-r border-gray-200 mr-1">
      <select
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          if (e.target.value) (editor.chain().focus() as any).setFontSize(e.target.value).run();
          e.target.value = '';
        }}
        defaultValue=""
        className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer text-gray-600"
        style={{ height: '30px' }}
      >
        <option value="" disabled>Tam.</option>
        {FONT_SIZES.map(s => (
          <option key={s} value={s}>{s.replace('px', '')}</option>
        ))}
      </select>
    </div>

    {/* Colors */}
    <div className="flex items-center gap-1 pr-2 border-r border-gray-200 mr-1">
      {COLORS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(value).run(); }}
          title={label}
          style={{
            backgroundColor: value,
            width: '17px',
            height: '17px',
            borderRadius: '50%',
            border: editor.isActive('textStyle', { color: value }) ? '2px solid #374151' : '2px solid transparent',
            flexShrink: 0,
            transition: 'transform 0.15s',
          }}
          className="hover:scale-125 focus:outline-none"
        />
      ))}
    </div>

    {/* Alignment */}
    <div className="flex items-center gap-0.5 pr-2 border-r border-gray-200 mr-1">
      <ToolbarBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinhar à esquerda">
        <AlignLeft size={15} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centralizar">
        <AlignCenter size={15} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Alinhar à direita">
        <AlignRight size={15} />
      </ToolbarBtn>
    </div>

    {/* Lists */}
    <div className="flex items-center gap-0.5 pr-2 border-r border-gray-200 mr-1">
      <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista com marcadores">
        <List size={15} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
        <ListOrdered size={15} />
      </ToolbarBtn>
    </div>

    {/* Export PDF */}
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); if (!exporting) onExportPDF(); }}
      disabled={exporting}
      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      title="Exportar como PDF"
    >
      {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      {exporting ? 'Exportando...' : 'Exportar PDF'}
    </button>
  </div>
);

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  onExportPDF: () => void;
  exporting?: boolean;
}

const RichTextEditor = ({ content, onChange, onExportPDF, exporting }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: content || '<p></p>',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[420px] px-6 py-5 text-gray-700 leading-relaxed tiptap-editor',
      },
    },
  });

  // Sync content when the user switches to a different note
  useEffect(() => {
    if (editor && !editor.isDestroyed && content !== editor.getHTML()) {
      editor.commands.setContent(content || '<p></p>', false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <Toolbar editor={editor} onExportPDF={onExportPDF} exporting={exporting} />
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  );
};

export default RichTextEditor;
