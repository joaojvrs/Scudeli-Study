import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import {
  Plus, Search, Trash2, FileText, ChevronRight, ArrowLeft, Filter,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Printer, RotateCcw, RotateCw,
} from 'lucide-react';
import { motion } from 'motion/react';
import TagPicker from './TagPicker';
import type { Note, Subject } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  { label: 'Padrão', value: '' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Palatino', value: 'Palatino Linotype, serif' },
  { label: 'Courier', value: 'Courier New, monospace' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
];

const FONT_SIZES = [
  { label: '10', value: '10px' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '28', value: '28px' },
  { label: '32', value: '32px' },
  { label: '36', value: '36px' },
  { label: '48', value: '48px' },
];

const TEXT_COLORS = [
  { label: 'Preto', value: '#111827' },
  { label: 'Cinza escuro', value: '#374151' },
  { label: 'Cinza', value: '#9CA3AF' },
  { label: 'Vermelho', value: '#EF4444' },
  { label: 'Laranja', value: '#F97316' },
  { label: 'Amarelo', value: '#EAB308' },
  { label: 'Verde', value: '#22C55E' },
  { label: 'Azul', value: '#3B82F6' },
  { label: 'Roxo', value: '#A855F7' },
  { label: 'Rosa', value: '#EC4899' },
  { label: 'Branco', value: '#FFFFFF' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Amarelo', value: '#FEF08A' },
  { label: 'Laranja', value: '#FED7AA' },
  { label: 'Verde', value: '#BBF7D0' },
  { label: 'Azul', value: '#BFDBFE' },
  { label: 'Roxo', value: '#E9D5FF' },
  { label: 'Rosa', value: '#FECADA' },
  { label: 'Ciano', value: '#A5F3FC' },
  { label: 'Cinza', value: '#E2E8F0' },
];

// ─── Editor CSS ────────────────────────────────────────────────────────────────

const EDITOR_CSS = `
  .scudeli-editor [contenteditable] {
    outline: none;
    min-height: 520px;
    line-height: 1.85;
    color: #374151;
    caret-color: #f97316;
    word-break: break-word;
  }
  .scudeli-editor [contenteditable]:empty::before {
    content: 'Comece a escrever sua nota aqui...';
    color: #d1d5db;
    pointer-events: none;
  }
  .scudeli-editor [contenteditable] h1 { font-size: 2rem; font-weight: 900; color: #111827; margin: 1.25rem 0 0.5rem; line-height: 1.2; }
  .scudeli-editor [contenteditable] h2 { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 1rem 0 0.4rem; line-height: 1.3; }
  .scudeli-editor [contenteditable] h3 { font-size: 1.25rem; font-weight: 600; color: #374151; margin: 0.75rem 0 0.3rem; line-height: 1.4; }
  .scudeli-editor [contenteditable] p { margin-bottom: 0.4rem; }
  .scudeli-editor [contenteditable] ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.5rem; }
  .scudeli-editor [contenteditable] ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.5rem; }
  .scudeli-editor [contenteditable] li { margin-bottom: 0.2rem; }
  .scudeli-editor [contenteditable] blockquote {
    border-left: 4px solid #f97316;
    padding-left: 1rem;
    color: #6b7280;
    font-style: italic;
    margin: 0.75rem 0;
  }
  .scudeli-editor [contenteditable] code {
    background-color: #f1f5f9;
    padding: 0.1em 0.4em;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.875em;
    color: #e11d48;
  }
  .scudeli-editor [contenteditable] pre {
    background-color: #1e293b;
    color: #e2e8f0;
    padding: 1rem 1.25rem;
    border-radius: 0.75rem;
    margin: 0.75rem 0;
    overflow-x: auto;
  }
  .scudeli-editor [contenteditable] hr { border: none; border-top: 2px solid #f3f4f6; margin: 1.5rem 0; }
  .scudeli-editor [contenteditable] *::selection { background-color: #fed7aa; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();

// ─── NoteEditor ───────────────────────────────────────────────────────────────

interface NoteEditorProps {
  note: Note;
  subjects: Subject[];
  onBack: () => void;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

interface ToolbarState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  justifyLeft: boolean;
  justifyCenter: boolean;
  justifyRight: boolean;
  justifyFull: boolean;
  unorderedList: boolean;
  orderedList: boolean;
  heading: string;
}

const DEFAULT_TOOLBAR: ToolbarState = {
  bold: false, italic: false, underline: false, strikethrough: false,
  justifyLeft: true, justifyCenter: false, justifyRight: false, justifyFull: false,
  unorderedList: false, orderedList: false, heading: '',
};

const NoteEditor = ({ note, subjects, onBack, onUpdate, onDelete }: NoteEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const highlightPickerRef = useRef<HTMLDivElement>(null);

  const [localTitle, setLocalTitle] = useState(note.title);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [toolbar, setToolbar] = useState<ToolbarState>(DEFAULT_TOOLBAR);

  // Initialize editor content once on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = note.content || '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (colorPickerRef.current && !colorPickerRef.current.contains(t)) setShowColorPicker(false);
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(t)) setShowHighlightPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const scheduleSave = useCallback((id: string, updates: Record<string, unknown>) => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onUpdate(id, updates);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  }, [onUpdate]);

  const syncContent = useCallback(() => {
    if (editorRef.current) {
      scheduleSave(note.id, { content: editorRef.current.innerHTML });
    }
  }, [note.id, scheduleSave]);

  const handleTitleChange = (val: string) => {
    setLocalTitle(val);
    setSaveStatus('saving');
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      onUpdate(note.id, { title: val });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  };

  // Save & restore selection so toolbar dropdowns don't lose the range
  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreRange = () => {
    const sel = window.getSelection();
    const range = savedRangeRef.current;
    if (sel && range) {
      editorRef.current?.focus();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  // Execute a document command, preserving focus
  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value ?? '');
    updateToolbar();
    syncContent();
  };

  // Apply pixel-based font size via span wrapping
  const applyFontSize = (size: string) => {
    editorRef.current?.focus();
    // Use fontSize=7 as a marker, then replace with span
    document.execCommand('fontSize', false, '7');
    const el = editorRef.current;
    if (!el) return;
    el.querySelectorAll('font[size="7"]').forEach(font => {
      const span = document.createElement('span');
      span.style.fontSize = size;
      span.innerHTML = (font as HTMLElement).innerHTML;
      font.parentNode?.replaceChild(span, font);
    });
    updateToolbar();
    syncContent();
  };

  // Apply font family
  const applyFontFamily = (family: string) => {
    restoreRange();
    if (!family) {
      // Remove font-family by wrapping in span with inherit
      document.execCommand('fontName', false, 'inherit');
    } else {
      document.execCommand('fontName', false, family);
    }
    updateToolbar();
    syncContent();
  };

  // Apply heading or paragraph
  const applyHeading = (value: string) => {
    restoreRange();
    const tag = value === '' ? 'p' : value;
    document.execCommand('formatBlock', false, tag);
    updateToolbar();
    syncContent();
  };

  // Apply text color (restores selection first)
  const applyColor = (color: string) => {
    restoreRange();
    document.execCommand('foreColor', false, color);
    setShowColorPicker(false);
    syncContent();
  };

  // Apply highlight color (restores selection first)
  const applyHighlight = (color: string) => {
    restoreRange();
    try {
      document.execCommand('hiliteColor', false, color);
    } catch {
      document.execCommand('backColor', false, color);
    }
    setShowHighlightPicker(false);
    syncContent();
  };

  const removeHighlight = () => {
    restoreRange();
    try {
      document.execCommand('hiliteColor', false, 'transparent');
    } catch {
      document.execCommand('backColor', false, 'transparent');
    }
    setShowHighlightPicker(false);
    syncContent();
  };

  const updateToolbar = () => {
    try {
      setToolbar({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikethrough: document.queryCommandState('strikeThrough'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        justifyFull: document.queryCommandState('justifyFull'),
        unorderedList: document.queryCommandState('insertUnorderedList'),
        orderedList: document.queryCommandState('insertOrderedList'),
        heading: document.queryCommandValue('formatBlock').toLowerCase(),
      });
    } catch { /* noop */ }
  };

  const exportToPDF = () => {
    const content = editorRef.current?.innerHTML || '';
    const subject = subjects.find(s => s.id === note.subject_id)?.name || 'Geral';
    const date = new Date(note.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`<!DOCTYPE html><html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${localTitle}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; padding: 48px 64px; line-height: 1.8; color: #1f2937; background: white; max-width: 860px; margin: 0 auto; font-size: 16px; }
    .header { margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 3px solid #f97316; }
    .note-title { font-size: 2.5rem; font-weight: 900; color: #111827; margin-bottom: 0.75rem; line-height: 1.1; font-family: Arial, sans-serif; }
    .note-meta { display: flex; gap: 1rem; align-items: center; }
    .subject { background: #fff7ed; color: #f97316; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-family: Arial, sans-serif; }
    .date { color: #9ca3af; font-size: 0.8rem; font-family: Arial, sans-serif; }
    .content { margin-top: 2rem; }
    h1 { font-size: 1.875rem; font-weight: 900; color: #111827; margin: 1.5rem 0 0.5rem; }
    h2 { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 1.25rem 0 0.4rem; }
    h3 { font-size: 1.25rem; font-weight: 600; color: #374151; margin: 1rem 0 0.3rem; }
    p { margin-bottom: 0.6rem; }
    ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
    ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
    li { margin-bottom: 0.25rem; }
    blockquote { border-left: 4px solid #f97316; padding-left: 1rem; color: #6b7280; font-style: italic; margin: 1rem 0; }
    code { background: #f1f5f9; padding: 0.15em 0.4em; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 0.875em; color: #e11d48; }
    pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 8px; margin: 0.75rem 0; overflow-x: auto; }
    pre code { background: none; color: inherit; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    u { text-decoration: underline; }
    s { text-decoration: line-through; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
    @media print { body { padding: 24px 32px; } @page { margin: 1.5cm; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="note-title">${localTitle}</div>
    <div class="note-meta">
      <span class="subject">${subject}</span>
      <span class="date">${date}</span>
    </div>
  </div>
  <div class="content">${content}</div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  // ─── Toolbar helpers ───────────────────────────────────────────────────────

  const Btn = ({
    onAction, active = false, title, children, disabled = false,
  }: {
    onAction: () => void; active?: boolean; title: string;
    children: React.ReactNode; disabled?: boolean;
  }) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onAction(); }}
      className={`p-1.5 rounded-lg transition-all select-none ${
        active
          ? 'bg-orange-100 text-orange-600'
          : disabled
          ? 'text-gray-200 cursor-not-allowed'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );

  const Sep = () => <span className="w-px h-5 bg-gray-200 mx-0.5 shrink-0 self-center" />;

  const headingValue = toolbar.heading === 'h1' ? 'h1' : toolbar.heading === 'h2' ? 'h2' : toolbar.heading === 'h3' ? 'h3' : '';

  return (
    <div className="h-full flex flex-col gap-4">
      <style>{EDITOR_CSS}</style>

      {/* Header */}
      <header className="flex items-center justify-between flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-orange-500 font-semibold text-sm transition-colors"
        >
          <ArrowLeft size={18} />
          <span>Voltar</span>
        </button>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {saveStatus === 'saving' && (
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">Salvando…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Salvo ✓</span>
          )}

          <select
            value={note.subject_id}
            onChange={(e) => onUpdate(note.id, { subject_id: e.target.value })}
            className="bg-white px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-100 outline-none shadow-sm text-gray-600"
          >
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <button
            type="button"
            onClick={exportToPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-500 rounded-xl text-xs font-bold transition-colors"
          >
            <Printer size={13} />
            <span>Exportar PDF</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(note.id)}
            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      {/* Editor card */}
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-50 flex flex-col min-h-0 overflow-hidden">

        {/* Title + Tags */}
        <div className="px-8 pt-7 pb-5 border-b border-gray-50 shrink-0">
          <input
            type="text"
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full text-3xl font-black text-gray-900 border-none outline-none placeholder:text-gray-200 mb-4"
            placeholder="Título da nota"
          />
          <div>
            <label className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2 block">Tags</label>
            <TagPicker
              selectedTags={note.tags || []}
              onChange={(tags) => onUpdate(note.id, { tags })}
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/70 flex items-center flex-wrap gap-1 shrink-0">

          {/* Undo / Redo */}
          <Btn onAction={() => exec('undo')} title="Desfazer (Ctrl+Z)">
            <RotateCcw size={14} />
          </Btn>
          <Btn onAction={() => exec('redo')} title="Refazer (Ctrl+Y)">
            <RotateCw size={14} />
          </Btn>

          <Sep />

          {/* Heading */}
          <select
            value={headingValue}
            onMouseDown={saveRange}
            onChange={(e) => applyHeading(e.target.value)}
            className="h-7 px-2 rounded-lg text-[11px] font-bold text-gray-600 bg-white border border-gray-100 outline-none cursor-pointer"
          >
            <option value="">Normal</option>
            <option value="h1">Título 1</option>
            <option value="h2">Título 2</option>
            <option value="h3">Título 3</option>
          </select>

          {/* Font Family */}
          <select
            onMouseDown={saveRange}
            onChange={(e) => applyFontFamily(e.target.value)}
            className="h-7 px-2 rounded-lg text-[11px] font-bold text-gray-600 bg-white border border-gray-100 outline-none cursor-pointer max-w-[100px]"
          >
            {FONT_FAMILIES.map(f => (
              <option key={f.label} value={f.value}>{f.label}</option>
            ))}
          </select>

          {/* Font Size */}
          <select
            onMouseDown={saveRange}
            onChange={(e) => { if (e.target.value) applyFontSize(e.target.value); }}
            className="h-7 w-16 px-2 rounded-lg text-[11px] font-bold text-gray-600 bg-white border border-gray-100 outline-none cursor-pointer"
          >
            <option value="">Tam</option>
            {FONT_SIZES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <Sep />

          {/* Bold */}
          <Btn onAction={() => exec('bold')} active={toolbar.bold} title="Negrito (Ctrl+B)">
            <Bold size={14} />
          </Btn>
          {/* Italic */}
          <Btn onAction={() => exec('italic')} active={toolbar.italic} title="Itálico (Ctrl+I)">
            <Italic size={14} />
          </Btn>
          {/* Underline */}
          <Btn onAction={() => exec('underline')} active={toolbar.underline} title="Sublinhado (Ctrl+U)">
            <UnderlineIcon size={14} />
          </Btn>
          {/* Strikethrough */}
          <Btn onAction={() => exec('strikeThrough')} active={toolbar.strikethrough} title="Tachado">
            <Strikethrough size={14} />
          </Btn>

          <Sep />

          {/* Text Color */}
          <div ref={colorPickerRef} className="relative">
            <button
              type="button"
              title="Cor do texto"
              onMouseDown={(e) => { e.preventDefault(); saveRange(); setShowColorPicker(v => !v); setShowHighlightPicker(false); }}
              className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg hover:bg-gray-100 transition-colors select-none"
            >
              <span className="text-[13px] font-black text-gray-700 leading-none">A</span>
              <span className="w-4 h-1 rounded-full bg-gray-700" />
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 w-48">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Cor do Texto</p>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {TEXT_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onMouseDown={(e) => { e.preventDefault(); applyColor(c.value); }}
                      className="w-7 h-7 rounded-lg border-2 border-gray-100 hover:scale-110 transition-transform hover:border-orange-300"
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); restoreRange(); exec('removeFormat'); setShowColorPicker(false); }}
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-600 w-full text-left mt-1"
                >
                  ✕ Remover cor
                </button>
              </div>
            )}
          </div>

          {/* Highlight Color */}
          <div ref={highlightPickerRef} className="relative">
            <button
              type="button"
              title="Destaque (marca-texto)"
              onMouseDown={(e) => { e.preventDefault(); saveRange(); setShowHighlightPicker(v => !v); setShowColorPicker(false); }}
              className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg hover:bg-gray-100 transition-colors select-none"
            >
              <span
                className="text-[13px] font-black text-gray-700 leading-none px-0.5"
                style={{ background: 'linear-gradient(to bottom, transparent 45%, #fef08a 45%)' }}
              >
                A
              </span>
              <span className="w-4 h-1 rounded-full" style={{ backgroundColor: '#fef08a' }} />
            </button>
            {showHighlightPicker && (
              <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 w-44">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Destaque</p>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {HIGHLIGHT_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onMouseDown={(e) => { e.preventDefault(); applyHighlight(c.value); }}
                      className="w-7 h-7 rounded-lg border-2 border-gray-100 hover:scale-110 transition-transform hover:border-orange-300"
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); removeHighlight(); }}
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-600 w-full text-left mt-1"
                >
                  ✕ Remover destaque
                </button>
              </div>
            )}
          </div>

          <Sep />

          {/* Alignment */}
          <Btn onAction={() => exec('justifyLeft')} active={toolbar.justifyLeft} title="Alinhar à esquerda">
            <AlignLeft size={14} />
          </Btn>
          <Btn onAction={() => exec('justifyCenter')} active={toolbar.justifyCenter} title="Centralizar">
            <AlignCenter size={14} />
          </Btn>
          <Btn onAction={() => exec('justifyRight')} active={toolbar.justifyRight} title="Alinhar à direita">
            <AlignRight size={14} />
          </Btn>
          <Btn onAction={() => exec('justifyFull')} active={toolbar.justifyFull} title="Justificar">
            <AlignJustify size={14} />
          </Btn>

          <Sep />

          {/* Lists + Blockquote */}
          <Btn onAction={() => exec('insertUnorderedList')} active={toolbar.unorderedList} title="Lista de tópicos">
            <List size={14} />
          </Btn>
          <Btn onAction={() => exec('insertOrderedList')} active={toolbar.orderedList} title="Lista numerada">
            <ListOrdered size={14} />
          </Btn>
          <Btn
            onAction={() => {
              const sel = window.getSelection();
              const block = sel?.anchorNode?.parentElement?.closest('blockquote');
              if (block) {
                exec('formatBlock', 'p');
              } else {
                exec('formatBlock', 'blockquote');
              }
            }}
            title="Citação / Destaque"
          >
            <Quote size={14} />
          </Btn>

          <Sep />

          {/* Horizontal rule */}
          <button
            type="button"
            title="Linha divisória"
            onMouseDown={(e) => { e.preventDefault(); exec('insertHorizontalRule'); }}
            className="px-2 py-1 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-gray-100 transition-colors select-none"
          >
            ──
          </button>
        </div>

        {/* Editor Content */}
        <div
          className="scudeli-editor flex-1 overflow-y-auto px-8 py-6 cursor-text"
          onClick={() => editorRef.current?.focus()}
        >
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncContent}
            onKeyUp={updateToolbar}
            onMouseUp={updateToolbar}
            onFocus={updateToolbar}
            onPaste={(e) => {
              // Paste as plain text to avoid style pollution
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              document.execCommand('insertText', false, text);
            }}
            className="focus:outline-none min-h-[520px] leading-relaxed text-gray-700"
          />
        </div>
      </div>
    </div>
  );
};

// ─── Main StudyNotes Component ─────────────────────────────────────────────────

const StudyNotes = () => {
  const { notes, subjects, session } = useAppContext();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  const filteredNotes = notes.filter(n => {
    const matchSubject = selectedSubject === 'all' || n.subject_id === selectedSubject;
    const plain = stripHtml(n.content);
    const matchSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        plain.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTags = filterTags.length === 0 || filterTags.every(t => n.tags?.includes(t));
    return matchSubject && matchSearch && matchTags;
  });

  const handleCreateNote = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('notes').insert({
      title: 'Nova Nota',
      content: '',
      subject_id: subjects[0]?.id || 'default',
      user_id: session.user.id,
      updated_at: new Date().toISOString(),
    }).select().single();
    if (error) { handleSupabaseError(error, OperationType.CREATE, 'notes'); return; }
    if (data) setSelectedNoteId(data.id);
  };

  const handleUpdateNote = async (id: string, updates: Record<string, unknown>) => {
    const { error } = await supabase.from('notes').update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) handleSupabaseError(error, OperationType.UPDATE, `notes/${id}`);
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Deseja excluir esta nota?')) return;
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) { handleSupabaseError(error, OperationType.DELETE, `notes/${id}`); return; }
    if (selectedNoteId === id) setSelectedNoteId(null);
  };

  if (selectedNoteId && selectedNote) {
    return (
      <NoteEditor
        key={selectedNoteId}
        note={selectedNote}
        subjects={subjects}
        onBack={() => setSelectedNoteId(null)}
        onUpdate={handleUpdateNote}
        onDelete={handleDeleteNote}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Suas Notas</h2>
            <p className="text-sm text-gray-500">Editor rico com fontes, cores e exportação PDF.</p>
          </div>
        </div>
        <button
          onClick={handleCreateNote}
          className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95"
        >
          <Plus size={18} />
          <span>Nova Nota</span>
        </button>
      </header>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm outline-none shadow-sm focus:ring-4 focus:ring-orange-500/5 transition-all"
            />
          </div>
          <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${selectedSubject === 'all' ? 'bg-orange-50 text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Tudo
            </button>
            {subjects.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSubject(s.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${selectedSubject === s.id ? 'bg-orange-50 text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <Filter size={15} className="text-gray-400 shrink-0" />
          <div className="flex-1">
            <TagPicker selectedTags={filterTags} onChange={setFilterTags} />
          </div>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredNotes.map(note => (
          <motion.div
            key={note.id}
            whileHover={{ y: -4 }}
            onClick={() => setSelectedNoteId(note.id)}
            className="group bg-white p-6 rounded-3xl border border-gray-50 shadow-sm hover:shadow-xl transition-all cursor-pointer"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-orange-50 text-orange-500 rounded-xl">
                <FileText size={16} />
              </div>
              <span className="text-[10px] font-bold text-gray-400">
                {new Date(note.updated_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2 truncate">{note.title}</h3>
            <p className="text-xs text-gray-500 line-clamp-3 mb-4 leading-relaxed">
              {stripHtml(note.content) || 'Sem conteúdo ainda...'}
            </p>
            <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
                {subjects.find(s => s.id === note.subject_id)?.name || 'Geral'}
              </span>
              <ChevronRight size={14} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
            </div>
          </motion.div>
        ))}

        {filteredNotes.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <FileText className="text-gray-200 mb-4" size={48} />
            <p className="text-gray-400 text-sm">Nenhuma nota encontrada. Crie sua primeira nota!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyNotes;
