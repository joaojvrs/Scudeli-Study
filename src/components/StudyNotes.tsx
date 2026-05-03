import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import {
  Plus, Search, Trash2, FileText, ChevronRight, ArrowLeft,
  Filter, AlertCircle, Loader2,
} from 'lucide-react';
import { motion } from 'motion/react';
import RichTextEditor from './RichTextEditor';
import TagPicker from './TagPicker';
import type { Note } from '../types';

const PDF_CONTENT_STYLES = `
  ul { list-style-type: disc !important;    padding-left: 22px !important; margin: 6px 0 10px !important; }
  ol { list-style-type: decimal !important; padding-left: 22px !important; margin: 6px 0 10px !important; }
  li { margin: 3px 0 !important; line-height: 1.7 !important; }
  li > p { margin: 0 !important; }
  p  { margin: 0 0 8px !important; }
  strong { font-weight: bold !important; }
  em { font-style: italic !important; }
  u  { text-decoration: underline !important; }
  s  { text-decoration: line-through !important; }
  img { max-width: 100%; border-radius: 8px !important; margin: 8px 0 !important; display: block !important; height: auto !important; }
  h1 { font-size: 22px !important; font-weight: 800 !important; color: #111827 !important; margin: 16px 0 6px !important; line-height: 1.25 !important; }
  h2 { font-size: 17px !important; font-weight: 700 !important; color: #1f2937 !important; margin: 13px 0 5px !important; line-height: 1.3 !important; }
  h3 { font-size: 15px !important; font-weight: 700 !important; color: #374151 !important; margin: 11px 0 4px !important; line-height: 1.35 !important; }
`;

interface StudyNotesProps {
  initialSubjectId?: string;
}

const StudyNotes = ({ initialSubjectId }: StudyNotesProps = {}) => {
  const { notes, subjects, supabaseUser, refreshAllData } = useAppContext();

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [pendingNote, setPendingNote]         = useState<Note | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubjectId ?? 'all');
  const [searchTerm, setSearchTerm]           = useState('');
  const [filterTags, setFilterTags]           = useState<string[]>([]);
  const [creating, setCreating]               = useState(false);
  const [createError, setCreateError]         = useState<string | null>(null);
  const [exporting, setExporting]             = useState(false);

  // Local-controlled state for the note being edited.
  // Decoupled from the async context so every keystroke/tag change is instant.
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags]   = useState<string[]>([]);

  const saveTimeoutRef      = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleTimeoutRef     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveStatusTimerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Tracks latest content value so we can flush it synchronously on navigate-back
  const latestContentRef    = useRef<string>('');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Priority: context (authoritative once loaded) → pendingNote (optimistic)
  const selectedNote = selectedNoteId
    ? (notes.find(n => n.id === selectedNoteId) ?? (pendingNote?.id === selectedNoteId ? pendingNote : null))
    : null;

  // Sync local editable fields ONLY when the note identity changes (not on every context refresh)
  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditTags(selectedNote.tags ?? []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNote?.id]);

  // Drop pending once context has loaded the real record
  useEffect(() => {
    if (pendingNote && notes.find(n => n.id === pendingNote.id)) {
      setPendingNote(null);
    }
  }, [notes, pendingNote]);

  const filteredNotes = notes.filter(n => {
    const matchSubject = selectedSubject === 'all' || n.subject_id === selectedSubject;
    const matchSearch  =
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTags = filterTags.length === 0 || filterTags.every(t => n.tags?.includes(t));
    return matchSubject && matchSearch && matchTags;
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleCreateNote = async () => {
    if (!supabaseUser || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: 'Nova Nota',
          content: '<p></p>',
          subject_id: selectedSubject !== 'all' ? selectedSubject : null,
          user_id: supabaseUser.id,
          tags: [],
          updated_at: now,
          created_at: now,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setPendingNote(data as Note);
        setSelectedNoteId(data.id);
        refreshAllData();
      }
    } catch (err: any) {
      setCreateError(err.message ?? 'Erro ao criar nota.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateNote = useCallback(async (id: string, updates: Record<string, any>) => {
    setSaveStatus('saving');
    try {
      await supabase.from('notes').update({
        ...updates,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      setSaveStatus('saved');
      clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      handleSupabaseError(err, OperationType.UPDATE, `notes/${id}`);
      setSaveStatus('idle');
    }
  }, []);

  // Instant local update + debounced Supabase save
  const handleTitleChange = useCallback((value: string) => {
    setEditTitle(value);
    clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(() => {
      if (selectedNoteId) handleUpdateNote(selectedNoteId, { title: value });
    }, 400);
  }, [selectedNoteId, handleUpdateNote]);

  // Instant local update + immediate Supabase save (tags are discrete actions)
  const handleTagsChange = useCallback((newTags: string[]) => {
    setEditTags(newTags);
    if (selectedNoteId) handleUpdateNote(selectedNoteId, { tags: newTags });
  }, [selectedNoteId, handleUpdateNote]);

  const handleContentChange = useCallback((id: string, html: string) => {
    latestContentRef.current = html;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleUpdateNote(id, { content: html });
    }, 600);
  }, [handleUpdateNote]);

  const handleGoBack = useCallback(async () => {
    if (!selectedNoteId) { setSelectedNoteId(null); return; }
    clearTimeout(titleTimeoutRef.current);
    clearTimeout(saveTimeoutRef.current);
    const updates: Record<string, any> = {};
    if (editTitle !== selectedNote?.title) updates.title = editTitle;
    if (latestContentRef.current && latestContentRef.current !== selectedNote?.content) {
      updates.content = latestContentRef.current;
    }
    if (Object.keys(updates).length > 0) await handleUpdateNote(selectedNoteId, updates);
    latestContentRef.current = '';
    setSelectedNoteId(null);
  }, [selectedNoteId, editTitle, selectedNote, handleUpdateNote]);

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Deseja excluir esta nota?')) return;
    try {
      await supabase.from('notes').delete().eq('id', id);
      if (selectedNoteId === id) setSelectedNoteId(null);
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.DELETE, `notes/${id}`);
    }
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────
  // Uses html2pdf.js → html2canvas → jsPDF pipeline.
  // NO window.print(), NO browser dialog → no injected URL/date/headers.
  // The element is appended to document.body in normal flow (not off-screen) so
  // html2canvas can capture it correctly.
  const handleNoteImageUpload = async (file: File): Promise<string> => {
    if (!supabaseUser) throw new Error('Usuário não autenticado.');
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `note-images/${supabaseUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('materials').upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('materials').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleExportPDF = async () => {
    if (!selectedNote || exporting) return;
    setExporting(true);

    // Use current local title so the PDF reflects unsaved title changes too
    const title = editTitle || selectedNote.title;

    const el = document.createElement('div');
    el.style.cssText = [
      'width:740px',
      'background:#ffffff',
      'padding:40px 50px',
      'font-family:Georgia,"Times New Roman",serif',
      'font-size:14px',
      'color:#1f2937',
      'line-height:1.85',
      'box-sizing:border-box',
    ].join(';');

    const titleEl = document.createElement('h1');
    titleEl.style.cssText = [
      'font-size:22px',
      'font-weight:bold',
      'color:#111827',
      'border-bottom:2px solid #e5e7eb',
      'padding-bottom:12px',
      'margin:0 0 22px',
      'font-family:inherit',
      'line-height:1.3',
    ].join(';');
    titleEl.textContent = title;

    const contentEl = document.createElement('div');
    contentEl.innerHTML = selectedNote.content;

    // Convert all external images to base64 so html2canvas doesn't hit CORS.
    await Promise.all(
      Array.from(contentEl.querySelectorAll<HTMLImageElement>('img')).map(async (img) => {
        if (!img.src || img.src.startsWith('data:')) return;
        try {
          const res  = await fetch(img.src, { mode: 'cors', cache: 'force-cache' });
          const blob = await res.blob();
          img.src = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror  = reject;
            reader.readAsDataURL(blob);
          });
        } catch {
          // keep original src — html2canvas useCORS will try as fallback
        }
      })
    );

    el.appendChild(titleEl);
    el.appendChild(contentEl);
    document.body.appendChild(el);

    try {
      const html2pdf = (await import('html2pdf.js')).default;

      await html2pdf()
        .set({
          margin:   [12, 14, 12, 14],
          filename: `${title}.pdf`,
          image:    { type: 'jpeg', quality: 0.97 },
          html2canvas: {
            scale:       2,
            useCORS:     true,
            logging:     false,
            windowWidth: 740,
            // onclone removes Tailwind (oklch) stylesheets from the cloned document
            // and injects minimal PDF-safe CSS into <head>.
            onclone: (clonedDoc: Document) => {
              clonedDoc
                .querySelectorAll('link[rel="stylesheet"]')
                .forEach(node => node.remove());
              clonedDoc.querySelectorAll('style').forEach(node => {
                if (node.textContent?.includes('oklch')) node.remove();
              });
              const s = clonedDoc.createElement('style');
              s.textContent = PDF_CONTENT_STYLES;
              clonedDoc.head.appendChild(s);
            },
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .save();
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
    } finally {
      if (document.body.contains(el)) document.body.removeChild(el);
      setExporting(false);
    }
  };

  // ── Note editing view ──────────────────────────────────────────────────────
  if (selectedNoteId && selectedNote) {
    return (
      <div className="h-full flex flex-col space-y-4">
        <header className="flex items-center justify-between shrink-0">
          <button
            onClick={handleGoBack}
            className="flex items-center space-x-2 text-gray-500 hover:text-brand-primary font-medium"
          >
            <ArrowLeft size={20} />
            <span>Voltar para Notas</span>
          </button>
          <div className="flex items-center space-x-3">
            {saveStatus === 'saving' && (
              <span className="flex items-center space-x-1 text-xs text-gray-400 font-medium">
                <Loader2 size={13} className="animate-spin" />
                <span>Salvando...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-green-500 font-bold">Salvo ✓</span>
            )}
            <select
              value={selectedNote.subject_id ?? ''}
              onChange={(e) =>
                handleUpdateNote(selectedNote.id, { subject_id: e.target.value || null })
              }
              className="bg-white px-4 py-2 rounded-xl text-xs font-bold border border-gray-100 outline-none"
            >
              <option value="">Sem Disciplina</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={() => handleDeleteNote(selectedNote.id)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </header>

        {/* Title + Tags — driven by local state, not stale context */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 space-y-3 shrink-0">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full text-2xl font-bold text-gray-900 border-none outline-none placeholder:text-gray-200"
            placeholder="Título da Nota"
          />
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">
              Tags
            </label>
            <TagPicker
              selectedTags={editTags}
              onChange={handleTagsChange}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <RichTextEditor
            content={selectedNote.content}
            onChange={(html) => handleContentChange(selectedNote.id, html)}
            onExportPDF={handleExportPDF}
            exporting={exporting}
            onImageUpload={handleNoteImageUpload}
          />
        </div>
      </div>
    );
  }

  // ── Notes list view ────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Suas Notas</h2>
            <p className="text-sm text-gray-500">Editor rico com exportação em PDF.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {createError && (
            <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium bg-red-50 px-3 py-2 rounded-xl border border-red-100">
              <AlertCircle size={13} />
              {createError}
            </span>
          )}
          <button
            onClick={handleCreateNote}
            disabled={creating}
            className="flex items-center space-x-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            <span>{creating ? 'Criando...' : 'Nova Nota'}</span>
          </button>
        </div>
      </header>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar em todas as notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm outline-none shadow-sm focus:ring-4 focus:ring-brand-primary/5 transition-all"
            />
          </div>
          <div className="flex flex-wrap bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
            <button
              onClick={() => setSelectedSubject('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${selectedSubject === 'all' ? 'bg-orange-50 text-orange-500' : 'text-gray-400'}`}
            >
              Tudo
            </button>
            {subjects.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSubject(s.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${selectedSubject === s.id ? 'bg-orange-50 text-orange-500' : 'text-gray-400'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <Filter size={16} className="text-gray-400 ml-2 shrink-0" />
          <div className="flex-1">
            <TagPicker selectedTags={filterTags} onChange={setFilterTags} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredNotes.map(note => {
          const subject = subjects.find(s => s.id === note.subject_id);
          return (
            <motion.div
              key={note.id}
              whileHover={{ y: -4 }}
              onClick={() => setSelectedNoteId(note.id)}
              className="group bg-white p-6 rounded-3xl border border-gray-50 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col"
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
              <p className="text-xs text-gray-500 line-clamp-3 mb-4 leading-relaxed flex-1">
                {note.content.replace(/<[^>]*>/g, '') || 'Sem conteúdo ainda...'}
              </p>
              <div className="pt-3 border-t border-gray-50 flex items-end justify-between gap-2">
                <div className="flex flex-col gap-1.5 min-w-0">
                  {subject && (
                    <span
                      className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full w-fit"
                      style={{
                        backgroundColor: subject.color ? `${subject.color}18` : '#FFF7ED',
                        color: subject.color || '#F97316',
                      }}
                    >
                      {subject.name}
                    </span>
                  )}
                  {(note.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {note.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[9px] font-bold bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">
                          #{tag}
                        </span>
                      ))}
                      {note.tags.length > 2 && (
                        <span className="text-[9px] font-bold text-gray-300">+{note.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-orange-500 transition-colors shrink-0" />
              </div>
            </motion.div>
          );
        })}

        {filteredNotes.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <FileText className="text-gray-200 mb-4" size={48} />
            <p className="text-gray-400 text-sm">Nenhuma nota encontrada. Crie sua primeira nota agora!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyNotes;
