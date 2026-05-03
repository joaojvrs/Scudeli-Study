import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer, ReactNodeViewProps } from '@tiptap/react';
import { Editor, Extension, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import {
  Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Download, Loader2, ImagePlus,
} from 'lucide-react';

const FontFamily = Extension.create({
  name: 'fontFamily',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontFamily: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontFamily || null,
          renderHTML: (attrs: Record<string, any>) =>
            attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily}` } : {},
        },
      },
    }];
  },
  addCommands(): any {
    return {
      setFontFamily: (family: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontFamily: family }).run(),
      unsetFontFamily: () => ({ chain }: any) =>
        chain().setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run(),
    };
  },
});

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

// Tab  → demote heading level (H1→H2→H3); Shift-Tab → promote.
// Enter keeps same heading level (default Tiptap), so multiple items at the
// same level flow naturally. Tab/Shift-Tab navigate the hierarchy while typing.
// Also supports Markdown shortcuts: # + space → H1, ## → H2, ### → H3.
const HeadingBehavior = Extension.create({
  name: 'headingBehavior',
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        for (let level = 1; level <= 3; level++) {
          if (editor.isActive('heading', { level })) {
            if (level < 3) editor.chain().focus().toggleHeading({ level: (level + 1) as 2 | 3 }).run();
            return true;
          }
        }
        return false;
      },
      'Shift-Tab': ({ editor }) => {
        for (let level = 1; level <= 3; level++) {
          if (editor.isActive('heading', { level })) {
            if (level > 1) editor.chain().focus().toggleHeading({ level: (level - 1) as 1 | 2 }).run();
            return true;
          }
        }
        return false;
      },
    };
  },
});

const HANDLE_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 10,
  height: 28,
  background: '#3b82f6',
  border: '2px solid #fff',
  borderRadius: 4,
  zIndex: 10,
  cursor: 'ew-resize',
};

const ResizableImageView = ({ node, updateAttributes, selected }: ReactNodeViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { src, alt, width } = node.attrs as { src: string; alt: string; width: number | null };

  const startResize = useCallback((e: React.MouseEvent, dir: 'e' | 'w') => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = containerRef.current?.getBoundingClientRect().width ?? (width as number | null) ?? 300;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const next = Math.max(60, Math.round(dir === 'e' ? startW + delta : startW - delta));
      updateAttributes({ width: next });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [updateAttributes, width]);

  return (
    <NodeViewWrapper>
      <div
        ref={containerRef}
        contentEditable={false}
        style={{
          display: 'inline-block',
          position: 'relative',
          width: width ? `${width}px` : 'auto',
          maxWidth: '100%',
          lineHeight: 0,
          userSelect: 'none',
          margin: '8px 0',
        }}
      >
        <img
          src={src}
          alt={alt || ''}
          draggable={false}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            borderRadius: 8,
            outline: selected ? '2px solid #3b82f6' : 'none',
            outlineOffset: 2,
          }}
        />
        {selected && (
          <>
            <div
              style={{ ...HANDLE_STYLE, left: -5, top: '50%', transform: 'translateY(-50%)' }}
              onMouseDown={(e) => startResize(e, 'w')}
            />
            <div
              style={{ ...HANDLE_STYLE, right: -5, top: '50%', transform: 'translateY(-50%)' }}
              onMouseDown={(e) => startResize(e, 'e')}
            />
            <div
              style={{
                position: 'absolute',
                right: -5,
                bottom: -5,
                width: 12,
                height: 12,
                background: '#3b82f6',
                border: '2px solid #fff',
                borderRadius: '50%',
                cursor: 'nwse-resize',
                zIndex: 10,
              }}
              onMouseDown={(e) => startResize(e, 'e')}
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
};

const ImageNode = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const m = (el.getAttribute('style') || '').match(/width:\s*(\d+)px/);
          return m ? parseInt(m[1]) : null;
        },
        renderHTML: (attrs: Record<string, any>) =>
          attrs.width ? { style: `width:${attrs.width}px` } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'img[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const { width, ...rest } = HTMLAttributes;
    return ['img', mergeAttributes(rest, {
      style: `display:block;max-width:100%;border-radius:8px;margin:8px 0;${width ? `width:${width}px;` : ''}`,
    })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
  addCommands(): any {
    return {
      setImage: (options: { src: string; alt?: string }) =>
        ({ commands }: any) => commands.insertContent({ type: this.name, attrs: options }),
    };
  },
});

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

const FONT_FAMILIES = [
  { value: 'Inter, sans-serif',             label: 'Inter' },
  { value: 'Arial, sans-serif',             label: 'Arial' },
  { value: 'Verdana, sans-serif',           label: 'Verdana' },
  { value: 'Georgia, serif',               label: 'Georgia' },
  { value: '"Times New Roman", serif',     label: 'Times New Roman' },
  { value: '"Courier New", monospace',     label: 'Courier New' },
  { value: '"Trebuchet MS", sans-serif',   label: 'Trebuchet MS' },
];

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

const BLOCK_TYPES = [
  { value: 'paragraph', label: 'Parágrafo' },
  { value: 'h1',        label: 'Título 1' },
  { value: 'h2',        label: '↳ Subtítulo 2' },
  { value: 'h3',        label: '  ↳ Subtítulo 3' },
];

const Toolbar = ({
  editor, onExportPDF, exporting, onImageClick, imageUploading,
  currentFontFamily, currentFontSize, currentBlockType,
}: {
  editor: Editor;
  onExportPDF: () => void;
  exporting?: boolean;
  onImageClick?: () => void;
  imageUploading?: boolean;
  currentFontFamily: string;
  currentFontSize: string;
  currentBlockType: string;
}) => (
  <div className="flex flex-wrap items-center gap-0.5 px-4 py-2 border-b border-gray-100 bg-gray-50/60 shrink-0">
    <div className="pr-2 border-r border-gray-200 mr-1">
      <select
        onMouseDown={(e) => e.stopPropagation()}
        value={currentBlockType}
        title="Estilo do parágrafo (Enter = mesmo nível · Tab = subtópico · Shift+Tab = promover · # + espaço = Título 1)"
        onChange={(e) => {
          const val = e.target.value;
          if (val === 'paragraph') (editor.chain().focus() as any).setParagraph().run();
          else (editor.chain().focus() as any).toggleHeading({ level: parseInt(val.replace('h', '')) }).run();
        }}
        className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer text-gray-600 font-medium"
        style={{ height: '30px', minWidth: '118px' }}
      >
        {BLOCK_TYPES.map(b => (
          <option key={b.value} value={b.value}>{b.label}</option>
        ))}
      </select>
    </div>

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

    <div className="pr-2 border-r border-gray-200 mr-1">
      <select
        onMouseDown={(e) => e.stopPropagation()}
        value={currentFontFamily}
        onChange={(e) => {
          if (e.target.value) (editor.chain().focus() as any).setFontFamily(e.target.value).run();
        }}
        className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer text-gray-600"
        style={{ height: '30px', maxWidth: '130px', fontFamily: currentFontFamily || undefined }}
      >
        <option value="">Fonte</option>
        {FONT_FAMILIES.map(f => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
        ))}
      </select>
    </div>

    <div className="pr-2 border-r border-gray-200 mr-1">
      <select
        onMouseDown={(e) => e.stopPropagation()}
        value={currentFontSize}
        onChange={(e) => {
          if (e.target.value) (editor.chain().focus() as any).setFontSize(e.target.value).run();
        }}
        className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer text-gray-600"
        style={{ height: '30px' }}
      >
        <option value="">Tam.</option>
        {FONT_SIZES.map(s => (
          <option key={s} value={s}>{s.replace('px', '')}</option>
        ))}
      </select>
    </div>

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

    <div className="flex items-center gap-0.5 pr-2 border-r border-gray-200 mr-1">
      <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista com marcadores">
        <List size={15} />
      </ToolbarBtn>
      <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
        <ListOrdered size={15} />
      </ToolbarBtn>
    </div>

    {onImageClick && (
      <div className="pr-2 border-r border-gray-200 mr-1">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); if (!imageUploading) onImageClick(); }}
          disabled={imageUploading}
          title="Inserir imagem"
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all disabled:opacity-50"
        >
          {imageUploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
        </button>
      </div>
    )}

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
  onImageUpload?: (file: File) => Promise<string>;
}

const RichTextEditor = ({ content, onChange, onExportPDF, exporting, onImageUpload }: RichTextEditorProps) => {
  const [imageUploading, setImageUploading] = useState(false);
  const [currentFontFamily, setCurrentFontFamily] = useState('');
  const [currentFontSize, setCurrentFontSize] = useState('');
  const [currentBlockType, setCurrentBlockType] = useState('paragraph');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncTextStyle = (ed: Editor) => {
    setCurrentFontFamily(ed.getAttributes('textStyle').fontFamily ?? '');
    setCurrentFontSize(ed.getAttributes('textStyle').fontSize ?? '');
    if (ed.isActive('heading', { level: 1 })) setCurrentBlockType('h1');
    else if (ed.isActive('heading', { level: 2 })) setCurrentBlockType('h2');
    else if (ed.isActive('heading', { level: 3 })) setCurrentBlockType('h3');
    else setCurrentBlockType('paragraph');
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
      FontFamily,
      HeadingBehavior,
      ImageNode,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: content || '<p></p>',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      syncTextStyle(editor);
    },
    onSelectionUpdate: ({ editor }: { editor: Editor }) => {
      syncTextStyle(editor);
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[420px] px-6 py-5 text-gray-700 leading-relaxed tiptap-editor',
        spellcheck: 'true',
        lang: 'pt-BR',
      },
    },
  });

  // Force spellcheck + lang directly on the DOM element — editorProps may be
  // ignored by some Tiptap versions for non-standard attributes.
  useEffect(() => {
    if (!editor) return;
    const el = editor.view?.dom as HTMLElement | undefined;
    if (el) {
      el.setAttribute('spellcheck', 'true');
      el.setAttribute('lang', 'pt-BR');
    }
  }, [editor]);

  useEffect(() => {
    if (editor && !editor.isDestroyed && content !== editor.getHTML()) {
      editor.commands.setContent(content || '<p></p>', { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const handleImageFile = async (file: File) => {
    if (!onImageUpload || !editor) return;
    setImageUploading(true);
    try {
      const url = await onImageUpload(file);
      (editor.chain().focus() as any).setImage({ src: url, alt: file.name }).run();
    } catch (err) {
      console.error('Erro ao inserir imagem:', err);
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm">
      <Toolbar
        editor={editor}
        onExportPDF={onExportPDF}
        exporting={exporting}
        onImageClick={onImageUpload ? () => fileInputRef.current?.click() : undefined}
        imageUploading={imageUploading}
        currentFontFamily={currentFontFamily}
        currentFontSize={currentFontSize}
        currentBlockType={currentBlockType}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFile(file);
        }}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
