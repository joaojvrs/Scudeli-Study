/**
 * FoldersModule
 *
 * Architecture:
 *  - A "folder" is a Subject (subject_id).
 *  - An item belongs to a folder ONLY if item.subject_id === folder.id  (explicit, never inferred).
 *  - Items with subject_id = null are NOT in any folder.
 *    They remain visible only inside their native module.
 *  - "Sem pasta" is an informational stat, not a browsable folder.
 *
 * Default state  →  overview grid of folder cards (one per subject).
 * Selected state →  two-panel: sidebar list + tabbed content strictly
 *                   filtered by item.subject_id === selectedFolder.
 */

import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import {
  Folder, FolderOpen, Plus, Trash2, FileText, Brain, CheckSquare,
  BookOpen, HelpCircle, Calendar, ExternalLink, Clock, ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Note, Flashcard, Task, Material, Question, Event } from '../types';
import { TaskStatus } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = 'notes' | 'flashcards' | 'tasks' | 'materials' | 'questions' | 'events';

interface FoldersModuleProps {
  onNavigate: (tab: string, subjectId?: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = [
  '#ff85a1', '#ff9a85', '#ffc785', '#85ffc7', '#85d3ff', '#a185ff', '#ff85ef', '#71717a',
];

const TABS: { key: TabKey; label: string; moduleTab: string }[] = [
  { key: 'notes',      label: 'Resumos',    moduleTab: 'notes'      },
  { key: 'flashcards', label: 'Flashcards', moduleTab: 'flashcards' },
  { key: 'tasks',      label: 'Tarefas',    moduleTab: 'tasks'      },
  { key: 'materials',  label: 'Materiais',  moduleTab: 'materials'  },
  { key: 'questions',  label: 'Questões',   moduleTab: 'questions'  },
  { key: 'events',     label: 'Agenda',     moduleTab: 'calendar'   },
];

const TAB_STYLE: Record<TabKey, { active: string; pill: string; icon: React.ElementType }> = {
  notes:      { active: 'bg-orange-50 text-orange-500', pill: 'bg-orange-100 text-orange-600', icon: FileText    },
  flashcards: { active: 'bg-purple-50 text-purple-500', pill: 'bg-purple-100 text-purple-600', icon: Brain       },
  tasks:      { active: 'bg-blue-50   text-blue-500',   pill: 'bg-blue-100   text-blue-600',   icon: CheckSquare },
  materials:  { active: 'bg-green-50  text-green-600',  pill: 'bg-green-100  text-green-700',  icon: BookOpen    },
  questions:  { active: 'bg-red-50    text-red-500',    pill: 'bg-red-100    text-red-600',    icon: HelpCircle  },
  events:     { active: 'bg-teal-50   text-teal-600',   pill: 'bg-teal-100   text-teal-700',   icon: Calendar    },
};

// ── The one invariant: membership requires an exact, non-null match ───────────

function isInFolder(subjectId: string | null | undefined, folderId: string): boolean {
  // Null / undefined subject_id → item is NOT in any folder.
  // "Sem pasta" is not browsable — it is informational only.
  return subjectId != null && subjectId === folderId;
}

// ── Main Component ─────────────────────────────────────────────────────────────

const FoldersModule = ({ onNavigate }: FoldersModuleProps) => {
  const {
    subjects, notes, flashcards, tasks, materials, questions, events, supabaseUser, refreshAllData,
  } = useAppContext();

  // null = overview; string = a specific subject id
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [activeTab, setActiveTab]           = useState<TabKey>('notes');
  const [showCreate, setShowCreate]         = useState(false);
  const [newName, setNewName]               = useState('');
  const [newColor, setNewColor]             = useState(COLORS[0]);
  const [creating, setCreating]             = useState(false);

  // ── Per-folder item counts (for overview cards and sidebar badges) ──────────
  // Uses isInFolder — null subject_id items are NEVER counted inside a folder.

  const folderStats = useMemo(() =>
    subjects.map(s => ({
      ...s,
      counts: {
        notes:      notes.filter(n => isInFolder(n.subject_id, s.id)).length,
        flashcards: flashcards.filter(c => isInFolder(c.subject_id, s.id)).length,
        tasks:      tasks.filter(t => isInFolder(t.subject_id, s.id)).length,
        materials:  materials.filter(m => isInFolder(m.subject_id, s.id)).length,
        questions:  questions.filter(q => isInFolder(q.subject_id, s.id)).length,
        events:     events.filter(e => isInFolder(e.subject_id, s.id)).length,
      },
    })).map(s => ({ ...s, total: Object.values(s.counts).reduce((a, b) => a + b, 0) })),
    [subjects, notes, flashcards, tasks, materials, questions, events],
  );

  // Unorganized items — informational only, not a folder
  const unorganized = useMemo(() => {
    const n = notes.filter(i => !i.subject_id).length;
    const f = flashcards.filter(i => !i.subject_id).length;
    const t = tasks.filter(i => !i.subject_id).length;
    const m = materials.filter(i => !i.subject_id).length;
    const q = questions.filter(i => !i.subject_id).length;
    const e = events.filter(i => !i.subject_id).length;
    return { notes: n, flashcards: f, tasks: t, materials: m, questions: q, events: e, total: n + f + t + m + q + e };
  }, [notes, flashcards, tasks, materials, questions, events]);

  // Items inside the currently selected folder — strict filter
  const folderItems = useMemo(() => {
    if (!selectedFolder) return null;
    return {
      notes:      notes.filter(n => isInFolder(n.subject_id, selectedFolder)),
      flashcards: flashcards.filter(c => isInFolder(c.subject_id, selectedFolder)),
      tasks:      tasks.filter(t => isInFolder(t.subject_id, selectedFolder)),
      materials:  materials.filter(m => isInFolder(m.subject_id, selectedFolder)),
      questions:  questions.filter(q => isInFolder(q.subject_id, selectedFolder)),
      events:     events.filter(e => isInFolder(e.subject_id, selectedFolder)),
    };
  }, [selectedFolder, notes, flashcards, tasks, materials, questions, events]);

  // ── Subject CRUD ──────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !newName.trim() || creating) return;
    setCreating(true);
    try {
      const { data } = await supabase
        .from('subjects')
        .insert({ name: newName.trim(), color: newColor, user_id: supabaseUser.id })
        .select()
        .single();
      setNewName('');
      setShowCreate(false);
      await refreshAllData();
      if (data) setSelectedFolder(data.id);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta pasta? Os itens vinculados não serão deletados, apenas desvinculados da pasta.')) return;
    await supabase.from('subjects').delete().eq('id', id);
    if (selectedFolder === id) setSelectedFolder(null);
    await refreshAllData();
  };

  // ── Derived values for the selected folder ────────────────────────────────

  const activeSubject = selectedFolder
    ? subjects.find(s => s.id === selectedFolder) ?? null
    : null;

  const activeStats = selectedFolder
    ? folderStats.find(s => s.id === selectedFolder) ?? null
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  // ── A) OVERVIEW: no folder selected ──────────────────────────────────────
  if (!selectedFolder) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-light rounded-2xl flex items-center justify-center text-brand-primary">
              <Folder size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Pastas</h2>
              <p className="text-sm text-gray-400">
                Cada pasta agrupa itens explicitamente vinculados a ela.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl font-bold shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={18} />
            Nova Pasta
          </button>
        </header>

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.form
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              onSubmit={handleCreate}
              className="bg-white rounded-3xl p-8 border border-brand-light shadow-xl max-w-lg space-y-5"
            >
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Nova pasta</p>
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Anatomia, Bioquímica..."
                className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none"
                required
              />
              <div className="flex gap-3 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`w-9 h-9 rounded-full border-4 transition-all ${newColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-3 bg-brand-primary text-white rounded-xl text-sm font-bold disabled:opacity-60">
                  {creating ? 'Criando...' : 'Criar Pasta'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Folder grid */}
        {folderStats.length === 0 ? (
          <div className="py-24 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <Folder size={48} className="text-gray-200 mb-4" />
            <p className="text-sm text-gray-400 max-w-xs">
              Ainda não há pastas. Crie uma pasta e vincule seus estudos a ela para organizar tudo em um lugar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {folderStats.map(s => (
              <motion.div
                key={s.id}
                whileHover={{ y: -4 }}
                onClick={() => setSelectedFolder(s.id)}
                className="group bg-white p-7 rounded-3xl border border-gray-50 shadow-sm hover:shadow-xl transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                    style={{ backgroundColor: s.color, boxShadow: `0 8px 20px -4px ${s.color}50` }}
                  >
                    <FolderOpen size={22} />
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
                    className="p-2 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <h3 className="font-bold text-gray-900 text-lg mb-1 truncate">{s.name}</h3>
                <p className="text-xs text-gray-400 mb-5">
                  {s.total} {s.total === 1 ? 'item' : 'itens'} vinculados
                </p>

                {/* Mini type breakdown */}
                <div className="flex flex-wrap gap-2">
                  {TABS.filter(t => s.counts[t.key] > 0).map(t => {
                    const style = TAB_STYLE[t.key];
                    const Icon = style.icon;
                    return (
                      <span key={t.key} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${style.pill}`}>
                        <Icon size={10} />
                        {s.counts[t.key]}
                      </span>
                    );
                  })}
                  {s.total === 0 && (
                    <span className="text-[10px] text-gray-300 font-bold">Sem itens ainda</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Unorganized informational banner — NOT a folder */}
        {unorganized.total > 0 && (
          <div className="flex items-start gap-3 p-5 bg-amber-50 border border-amber-100 rounded-2xl">
            <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                {unorganized.total} {unorganized.total === 1 ? 'item sem pasta' : 'itens sem pasta'}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Estes itens não estão vinculados a nenhuma pasta e só aparecem nos seus módulos originais.
                Abra o módulo correspondente para vinculá-los a uma pasta.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                {TABS.filter(t => unorganized[t.key] > 0).map(t => {
                  const style = TAB_STYLE[t.key];
                  const Icon = style.icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => onNavigate(t.moduleTab)}
                      className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full ${style.pill} hover:scale-105 transition-transform`}
                    >
                      <Icon size={10} />
                      {unorganized[t.key]} em {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── B) FOLDER VIEW: a specific folder is selected ─────────────────────────
  if (!folderItems || !activeSubject) return null;

  const tabItems = folderItems[activeTab];

  return (
    <div className="flex h-full gap-6 overflow-hidden">

      {/* ── Left sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 flex flex-col gap-1 overflow-y-auto">
        {/* Back to overview */}
        <button
          onClick={() => setSelectedFolder(null)}
          className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-gray-400 hover:text-brand-primary transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          Todas as Pastas
        </button>

        {subjects.map(s => {
          const stat = folderStats.find(f => f.id === s.id);
          const isActive = selectedFolder === s.id;
          return (
            <button
              key={s.id}
              onClick={() => { setSelectedFolder(s.id); setActiveTab('notes'); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive ? 'bg-white shadow-sm border border-gray-100' : 'hover:bg-white/70'
              }`}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: s.color }}
              >
                {isActive ? <FolderOpen size={14} /> : <Folder size={14} />}
              </div>
              <span className={`flex-1 text-sm font-bold text-left truncate ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                {s.name}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                isActive ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-100 text-gray-400'
              }`}>
                {stat?.total ?? 0}
              </span>
            </button>
          );
        })}

        {/* + Nova Pasta shortcut */}
        <button
          onClick={() => { setSelectedFolder(null); setShowCreate(true); }}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-brand-primary hover:bg-white/70 transition-all mt-2"
        >
          <Plus size={16} />
          Nova Pasta
        </button>
      </aside>

      {/* ── Right panel ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 gap-5 overflow-hidden">

        {/* Folder header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
              style={{ backgroundColor: activeSubject.color, boxShadow: `0 8px 20px -4px ${activeSubject.color}50` }}
            >
              <FolderOpen size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight leading-none">
                {activeSubject.name}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {activeStats?.total ?? 0} {(activeStats?.total ?? 0) === 1 ? 'item vinculado' : 'itens vinculados'}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDelete(activeSubject.id)}
            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
            title="Excluir pasta"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto shrink-0">
          {TABS.map(({ key, label }) => {
            const count    = folderItems[key].length;
            const style    = TAB_STYLE[key];
            const Icon     = style.icon;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive ? style.active : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
                {count > 0 && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isActive ? style.pill : 'bg-gray-100 text-gray-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {tabItems.length === 0 ? (
            <EmptyTab
              tabKey={activeTab}
              folderName={activeSubject.name}
              onNavigate={() => onNavigate(TABS.find(t => t.key === activeTab)!.moduleTab, activeSubject.id)}
            />
          ) : (
            <>
              {tabItems.map((item: any) => (
                <ContentRow
                  key={item.id}
                  tabKey={activeTab}
                  item={item}
                  onGo={() => onNavigate(TABS.find(t => t.key === activeTab)!.moduleTab, activeSubject.id)}
                />
              ))}
              <div className="flex justify-end pt-1 pb-4">
                <button
                  onClick={() => onNavigate(TABS.find(t => t.key === activeTab)!.moduleTab, activeSubject.id)}
                  className="text-xs font-bold text-gray-400 hover:text-brand-primary transition-colors flex items-center gap-1.5"
                >
                  Abrir módulo completo
                  <ExternalLink size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── EmptyTab ──────────────────────────────────────────────────────────────────

const EmptyTab = ({
  tabKey, folderName, onNavigate,
}: { tabKey: TabKey; folderName: string; onNavigate: () => void }) => {
  const style = TAB_STYLE[tabKey];
  const Icon  = style.icon;
  return (
    <div className="py-24 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={28} className="text-gray-200" />
      </div>
      <p className="text-sm font-bold text-gray-500 mb-1">Nenhum item vinculado</p>
      <p className="text-xs text-gray-400 mb-5 max-w-xs">
        Nenhum item deste tipo está vinculado à pasta "{folderName}".
        Abra o módulo e associe os itens a esta pasta.
      </p>
      <button
        onClick={onNavigate}
        className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-primary/20"
      >
        <ExternalLink size={13} />
        Ir para o módulo
      </button>
    </div>
  );
};

// ── ContentRow ────────────────────────────────────────────────────────────────

const ContentRow = ({
  tabKey, item, onGo,
}: { tabKey: TabKey; item: any; onGo: () => void }) => {
  switch (tabKey) {
    case 'notes':      return <NoteRow      item={item as Note}      onGo={onGo} />;
    case 'flashcards': return <FlashcardRow item={item as Flashcard} onGo={onGo} />;
    case 'tasks':      return <TaskRow      item={item as Task}      onGo={onGo} />;
    case 'materials':  return <MaterialRow  item={item as Material}  onGo={onGo} />;
    case 'questions':  return <QuestionRow  item={item as Question}  onGo={onGo} />;
    case 'events':     return <EventRow     item={item as Event}     onGo={onGo} />;
    default:           return null;
  }
};

// ── Row Components ─────────────────────────────────────────────────────────────

const RowShell = ({ children, onGo, hoverColor }: {
  children: React.ReactNode; onGo: () => void; hoverColor: string;
}) => (
  <div className="flex items-start justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-50 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-start gap-4 min-w-0 flex-1">{children}</div>
    <button
      onClick={onGo}
      title="Abrir no módulo"
      className={`shrink-0 p-2 text-gray-200 transition-colors opacity-0 group-hover:opacity-100 ${hoverColor}`}
    >
      <ExternalLink size={15} />
    </button>
  </div>
);

const NoteRow = ({ item, onGo }: { item: Note; onGo: () => void }) => (
  <RowShell onGo={onGo} hoverColor="hover:text-orange-500">
    <div className="mt-0.5 p-2 bg-orange-50 rounded-xl shrink-0"><FileText size={16} className="text-orange-500" /></div>
    <div className="min-w-0">
      <p className="font-bold text-gray-900 truncate">{item.title}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        {new Date(item.updated_at).toLocaleDateString('pt-BR')}
        {(item.tags ?? []).length > 0 && (
          <span className="ml-2 text-brand-primary">
            {item.tags.slice(0, 2).map(t => `#${t}`).join(' ')}
            {item.tags.length > 2 && ` +${item.tags.length - 2}`}
          </span>
        )}
      </p>
    </div>
  </RowShell>
);

const FlashcardRow = ({ item, onGo }: { item: Flashcard; onGo: () => void }) => (
  <RowShell onGo={onGo} hoverColor="hover:text-purple-500">
    <div className="mt-0.5 p-2 bg-purple-50 rounded-xl shrink-0"><Brain size={16} className="text-purple-500" /></div>
    <div className="min-w-0">
      <p className="font-bold text-gray-900 line-clamp-2 text-sm">{item.front}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        {item.repetitions} revisões · EF {item.easiness.toFixed(1)} ·{' '}
        {new Date(item.next_review) <= new Date()
          ? <span className="text-brand-primary font-bold">Para revisar</span>
          : `próx. ${new Date(item.next_review).toLocaleDateString('pt-BR')}`}
      </p>
    </div>
  </RowShell>
);

const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-blue-50 text-blue-500', medium: 'bg-orange-50 text-orange-500', high: 'bg-red-50 text-red-500',
};
const PRIORITY_LABEL: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const STATUS_LABEL: Record<string, string> = {
  todo: 'A fazer', 'in-progress': 'Em progresso', done: 'Concluído',
};

const TaskRow = ({ item, onGo }: { item: Task; onGo: () => void }) => (
  <RowShell onGo={onGo} hoverColor="hover:text-blue-500">
    <div className="mt-0.5 p-2 bg-blue-50 rounded-xl shrink-0"><CheckSquare size={16} className="text-blue-500" /></div>
    <div className="min-w-0">
      <p className={`font-bold text-gray-900 truncate ${item.status === TaskStatus.DONE ? 'line-through text-gray-400' : ''}`}>
        {item.title}
      </p>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${PRIORITY_COLOR[item.priority] ?? 'bg-gray-50 text-gray-400'}`}>
          {PRIORITY_LABEL[item.priority] ?? item.priority}
        </span>
        <span className="text-[10px] font-bold text-gray-400 uppercase">{STATUS_LABEL[item.status] ?? item.status}</span>
        {item.deadline && (
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock size={10} />{new Date(item.deadline).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  </RowShell>
);

const MATERIAL_TYPE: Record<string, string> = { pdf: 'PDF', docx: 'DOCX', image: 'Imagem' };

const MaterialRow = ({ item, onGo }: { item: Material; onGo: () => void }) => (
  <RowShell onGo={onGo} hoverColor="hover:text-green-600">
    <div className="mt-0.5 p-2 bg-green-50 rounded-xl shrink-0"><BookOpen size={16} className="text-green-600" /></div>
    <div className="min-w-0">
      <p className="font-bold text-gray-900 truncate">{item.title}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        {MATERIAL_TYPE[item.type] ?? item.type} · {new Date(item.created_at).toLocaleDateString('pt-BR')}
        {item.summary && <span className="ml-2 text-green-500 font-bold">Com resumo</span>}
      </p>
    </div>
  </RowShell>
);

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'bg-green-50 text-green-600', medium: 'bg-orange-50 text-orange-500', hard: 'bg-red-50 text-red-500',
};
const DIFFICULTY_LABEL: Record<string, string> = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' };

const QuestionRow = ({ item, onGo }: { item: Question; onGo: () => void }) => (
  <RowShell onGo={onGo} hoverColor="hover:text-red-500">
    <div className="mt-0.5 p-2 bg-red-50 rounded-xl shrink-0"><HelpCircle size={16} className="text-red-500" /></div>
    <div className="min-w-0">
      <p className="font-bold text-gray-900 line-clamp-2 text-sm">{item.text}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${DIFFICULTY_COLOR[item.difficulty] ?? 'bg-gray-50 text-gray-400'}`}>
          {DIFFICULTY_LABEL[item.difficulty] ?? item.difficulty}
        </span>
        {item.source === 'ai' && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-500 uppercase">IA</span>
        )}
      </div>
    </div>
  </RowShell>
);

const EVENT_COLOR: Record<string, string> = {
  exam: 'bg-red-50 text-red-500', class: 'bg-blue-50 text-blue-500',
  review: 'bg-purple-50 text-purple-500', other: 'bg-gray-50 text-gray-500',
};
const EVENT_LABEL: Record<string, string> = { exam: 'Prova', class: 'Aula', review: 'Revisão', other: 'Outro' };

const EventRow = ({ item, onGo }: { item: Event; onGo: () => void }) => (
  <RowShell onGo={onGo} hoverColor="hover:text-teal-600">
    <div className="mt-0.5 p-2 bg-teal-50 rounded-xl shrink-0"><Calendar size={16} className="text-teal-600" /></div>
    <div className="min-w-0">
      <p className="font-bold text-gray-900 truncate">{item.title}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${EVENT_COLOR[item.type] ?? 'bg-gray-50 text-gray-400'}`}>
          {EVENT_LABEL[item.type] ?? item.type}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(item.start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>
    </div>
  </RowShell>
);

export default FoldersModule;
