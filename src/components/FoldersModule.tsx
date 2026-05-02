/**
 * FoldersModule — Hierarchical folder system (Windows-style)
 *
 * Requires: ALTER TABLE subjects ADD COLUMN parent_id UUID REFERENCES subjects(id);
 *
 * Architecture:
 *  - Folders = subjects with optional parent_id
 *  - Items link to a folder via subject_id (direct, NOT inherited from parent)
 *  - Navigation via pathStack (breadcrumb)
 *  - Full CRUD: create, rename (inline), delete, move (modal picker)
 *  - Items can be moved between folders via "Mover" button
 */

import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import {
  Folder, FolderOpen, Plus, Trash2, FileText, Brain, CheckSquare,
  BookOpen, HelpCircle, Calendar, ExternalLink, Clock, AlertCircle,
  ChevronRight, Edit2, Check, X, Home, Move,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Note, Flashcard, Task, Material, Question, Event, Subject } from '../types';
import { TaskStatus } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

type TabKey = 'notes' | 'flashcards' | 'tasks' | 'materials' | 'questions' | 'events';

interface FoldersModuleProps {
  onNavigate: (tab: string, subjectId?: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

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
  tasks:      { active: 'bg-blue-50 text-blue-500',     pill: 'bg-blue-100 text-blue-600',     icon: CheckSquare },
  materials:  { active: 'bg-green-50 text-green-600',   pill: 'bg-green-100 text-green-700',   icon: BookOpen    },
  questions:  { active: 'bg-red-50 text-red-500',       pill: 'bg-red-100 text-red-600',       icon: HelpCircle  },
  events:     { active: 'bg-teal-50 text-teal-600',     pill: 'bg-teal-100 text-teal-700',     icon: Calendar    },
};

const TABLE_MAP: Record<TabKey, string> = {
  notes: 'notes', flashcards: 'flashcards', tasks: 'tasks',
  materials: 'materials', questions: 'questions', events: 'events',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function isInFolder(subjectId: string | null | undefined, folderId: string): boolean {
  return subjectId != null && subjectId === folderId;
}

function getDescendantIds(folderId: string, all: Subject[]): string[] {
  const children = all.filter(s => s.parent_id === folderId);
  return children.flatMap(c => [c.id, ...getDescendantIds(c.id, all)]);
}

// ── Folder Picker Modal ────────────────────────────────────────────────────────

const FolderPickerNode: React.FC<{
  parentId: string | null;
  subjects: Subject[];
  excludeIds: string[];
  onSelect: (id: string | null) => void;
  depth: number;
}> = ({ parentId, subjects, excludeIds, onSelect, depth }) => {
  const children = subjects.filter(
    s => (s.parent_id ?? null) === parentId && !excludeIds.includes(s.id)
  );
  if (children.length === 0) return null;
  return (
    <>
      {children.map(s => (
        <div key={s.id}>
          <button
            onClick={() => onSelect(s.id)}
            style={{ paddingLeft: depth * 16 + 8 }}
            className="w-full flex items-center gap-3 py-2.5 pr-3 hover:bg-gray-50 rounded-xl transition-colors text-left"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: s.color }}
            >
              <Folder size={13} />
            </div>
            <span className="text-sm font-bold text-gray-700 truncate">{s.name}</span>
          </button>
          <FolderPickerNode
            parentId={s.id}
            subjects={subjects}
            excludeIds={excludeIds}
            onSelect={onSelect}
            depth={depth + 1}
          />
        </div>
      ))}
    </>
  );
};

const FolderPickerModal: React.FC<{
  title: string;
  subjects: Subject[];
  excludeIds: string[];
  onSelect: (id: string | null) => void;
  onClose: () => void;
}> = ({ title, subjects, excludeIds, onSelect, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="bg-white rounded-[28px] w-full max-w-sm shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between p-6 border-b border-gray-100">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors"
        >
          <X size={14} className="text-gray-500" />
        </button>
      </div>
      <div className="p-3 max-h-[55vh] overflow-y-auto space-y-0.5">
        <button
          onClick={() => onSelect(null)}
          className="w-full flex items-center gap-3 py-2.5 px-3 hover:bg-gray-50 rounded-xl transition-colors text-left"
        >
          <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
            <Home size={13} className="text-gray-500" />
          </div>
          <span className="text-sm font-bold text-gray-700">Raiz (sem pasta-mãe)</span>
        </button>
        <FolderPickerNode
          parentId={null}
          subjects={subjects}
          excludeIds={excludeIds}
          onSelect={onSelect}
          depth={0}
        />
        {subjects.filter(s => !excludeIds.includes(s.id)).length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8 italic">Nenhuma pasta disponível.</p>
        )}
      </div>
    </motion.div>
  </motion.div>
);

// ── Sidebar Tree Item (recursive) ──────────────────────────────────────────────

interface TreeItemProps {
  subject: Subject;
  depth: number;
  currentFolderId: string | null;
  allSubjects: Subject[];
  statsMap: Record<string, number>;
  onSelect: (id: string) => void;
  onStartRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onStartMove: (id: string) => void;
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onRenameSubmit: (id: string) => void;
  onRenameCancel: () => void;
}

const TreeItem: React.FC<TreeItemProps> = ({
  subject, depth, currentFolderId, allSubjects, statsMap, onSelect,
  onStartRename, onDelete, onStartMove,
  renamingId, renameValue, setRenameValue, onRenameSubmit, onRenameCancel,
}) => {
  const [expanded, setExpanded] = useState(true);
  const children = allSubjects.filter(s => s.parent_id === subject.id);
  const isActive = currentFolderId === subject.id;
  const isRenaming = renamingId === subject.id;

  return (
    <div>
      <div
        style={{ paddingLeft: depth * 12 }}
        className={`group flex items-center gap-1 rounded-xl py-1.5 pr-1.5 transition-all ${isActive ? 'bg-white shadow-sm border border-gray-100' : 'hover:bg-white/70'}`}
      >
        {/* Expand toggle */}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className={`shrink-0 w-5 h-5 flex items-center justify-center ${children.length === 0 ? 'opacity-0 pointer-events-none' : ''}`}
        >
          <ChevronRight
            size={11}
            className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </button>

        {/* Name / rename input */}
        {isRenaming ? (
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onRenameSubmit(subject.id);
                if (e.key === 'Escape') onRenameCancel();
              }}
              className="flex-1 px-2 py-0.5 text-xs font-bold bg-gray-50 border border-brand-primary/40 rounded-lg outline-none min-w-0"
            />
            <button onClick={() => onRenameSubmit(subject.id)} className="text-green-500 hover:text-green-600 shrink-0">
              <Check size={12} />
            </button>
            <button onClick={onRenameCancel} className="text-gray-400 hover:text-red-500 shrink-0">
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onSelect(subject.id)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: subject.color }}
            >
              {isActive ? <FolderOpen size={10} /> : <Folder size={10} />}
            </div>
            <span className={`text-xs font-bold truncate ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
              {subject.name}
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${isActive ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-100 text-gray-400'}`}>
              {statsMap[subject.id] ?? 0}
            </span>
          </button>
        )}

        {/* Actions (hover) */}
        {!isRenaming && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onStartRename(subject.id, subject.name); }}
              title="Renomear"
              className="p-1 text-gray-300 hover:text-brand-primary rounded transition-colors"
            >
              <Edit2 size={10} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onStartMove(subject.id); }}
              title="Mover"
              className="p-1 text-gray-300 hover:text-blue-500 rounded transition-colors"
            >
              <Move size={10} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(subject.id); }}
              title="Excluir"
              className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Recursive children */}
      {expanded && children.length > 0 && (
        <div>
          {children.map(child => (
            <TreeItem
              key={child.id}
              subject={child}
              depth={depth + 1}
              currentFolderId={currentFolderId}
              allSubjects={allSubjects}
              statsMap={statsMap}
              onSelect={onSelect}
              onStartRename={onStartRename}
              onDelete={onDelete}
              onStartMove={onStartMove}
              renamingId={renamingId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const FoldersModule = ({ onNavigate }: FoldersModuleProps) => {
  const {
    subjects, notes, flashcards, tasks, materials, questions, events,
    supabaseUser, refreshAllData,
  } = useAppContext();

  // Navigation
  const [pathStack, setPathStack] = useState<string[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>('notes');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  // Rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Move
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
  const [movingItem, setMovingItem] = useState<{ type: TabKey; id: string } | null>(null);

  // Derived navigation
  const currentFolderId = pathStack.length > 0 ? pathStack[pathStack.length - 1] : null;
  const currentFolder = currentFolderId ? subjects.find(s => s.id === currentFolderId) ?? null : null;

  const visibleSubjects = useMemo(
    () => subjects.filter(s => !deletingIds.includes(s.id)),
    [subjects, deletingIds]
  );

  const rootSubjects = useMemo(
    () => visibleSubjects.filter(s => !s.parent_id),
    [visibleSubjects]
  );

  const currentSubfolders = useMemo(
    () => visibleSubjects.filter(s => (s.parent_id ?? null) === currentFolderId),
    [visibleSubjects, currentFolderId]
  );

  // Item stats per folder (direct items only)
  const statsMap = useMemo(() => {
    const map: Record<string, number> = {};
    visibleSubjects.forEach(s => {
      map[s.id] =
        notes.filter(i => isInFolder(i.subject_id, s.id)).length +
        flashcards.filter(i => isInFolder(i.subject_id, s.id)).length +
        tasks.filter(i => isInFolder(i.subject_id, s.id)).length +
        materials.filter(i => isInFolder(i.subject_id, s.id)).length +
        questions.filter(i => isInFolder(i.subject_id, s.id)).length +
        events.filter(i => isInFolder(i.subject_id, s.id)).length;
    });
    return map;
  }, [visibleSubjects, notes, flashcards, tasks, materials, questions, events]);

  // Current folder tab counts
  const tabCounts = useMemo((): Record<TabKey, number> | null => {
    if (!currentFolderId) return null;
    return {
      notes:      notes.filter(i => isInFolder(i.subject_id, currentFolderId)).length,
      flashcards: flashcards.filter(i => isInFolder(i.subject_id, currentFolderId)).length,
      tasks:      tasks.filter(i => isInFolder(i.subject_id, currentFolderId)).length,
      materials:  materials.filter(i => isInFolder(i.subject_id, currentFolderId)).length,
      questions:  questions.filter(i => isInFolder(i.subject_id, currentFolderId)).length,
      events:     events.filter(i => isInFolder(i.subject_id, currentFolderId)).length,
    };
  }, [currentFolderId, notes, flashcards, tasks, materials, questions, events]);

  // Items for active tab in current folder
  const tabItems = useMemo(() => {
    if (!currentFolderId) return [];
    const pool: Record<TabKey, any[]> = { notes, flashcards, tasks, materials, questions, events };
    return pool[activeTab].filter((i: any) => isInFolder(i.subject_id, currentFolderId));
  }, [currentFolderId, activeTab, notes, flashcards, tasks, materials, questions, events]);

  // Breadcrumb
  const breadcrumb = useMemo(
    () => pathStack.map(id => ({ id, name: subjects.find(s => s.id === id)?.name ?? '…' })),
    [pathStack, subjects]
  );

  // Unorganized items (no subject_id)
  const unorganized = useMemo(() => {
    const n = notes.filter(i => !i.subject_id).length;
    const f = flashcards.filter(i => !i.subject_id).length;
    const t = tasks.filter(i => !i.subject_id).length;
    const m = materials.filter(i => !i.subject_id).length;
    const q = questions.filter(i => !i.subject_id).length;
    const e = events.filter(i => !i.subject_id).length;
    return { notes: n, flashcards: f, tasks: t, materials: m, questions: q, events: e, total: n + f + t + m + q + e };
  }, [notes, flashcards, tasks, materials, questions, events]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const openFolder = (id: string) => {
    setPathStack(prev => [...prev, id]);
    setActiveTab('notes');
    setShowCreate(false);
  };

  const goToRoot = () => { setPathStack([]); };

  const goToBreadcrumb = (idx: number) => {
    setPathStack(prev => prev.slice(0, idx + 1));
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !newName.trim() || creating) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('subjects').insert({
        name: newName.trim(),
        color: newColor,
        user_id: supabaseUser.id,
        parent_id: currentFolderId ?? null,
      });
      if (error) {
        if (error.message?.includes('parent_id')) {
          alert(
            'Para usar subpastas, adicione a coluna no Supabase:\n\n' +
            'ALTER TABLE subjects ADD COLUMN parent_id UUID REFERENCES subjects(id);'
          );
        }
        throw error;
      }
      setNewName('');
      setShowCreate(false);
      await refreshAllData();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (visibleSubjects.some(s => s.parent_id === id)) {
      alert('Esta pasta contém subpastas. Exclua ou mova-as primeiro.');
      return;
    }
    if (!confirm('Excluir esta pasta? Os itens vinculados não serão deletados, apenas desvinculados.')) return;
    setDeletingIds(prev => [...prev, id]);
    if (currentFolderId === id) setPathStack(prev => prev.slice(0, -1));
    await supabase.from('subjects').delete().eq('id', id);
    await refreshAllData();
    setDeletingIds(prev => prev.filter(i => i !== id));
  };

  const handleRenameSubmit = async (id: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    await supabase.from('subjects').update({ name: renameValue.trim() }).eq('id', id);
    await refreshAllData();
    setRenamingId(null);
  };

  const handleMoveFolder = async (newParentId: string | null) => {
    if (!movingFolderId) return;
    await supabase.from('subjects').update({ parent_id: newParentId }).eq('id', movingFolderId);
    // If we moved the current folder or an ancestor, go home
    if (movingFolderId === currentFolderId || pathStack.includes(movingFolderId)) goToRoot();
    await refreshAllData();
    setMovingFolderId(null);
  };

  const handleMoveItem = async (newSubjectId: string | null) => {
    if (!movingItem) return;
    await supabase
      .from(TABLE_MAP[movingItem.type])
      .update({ subject_id: newSubjectId })
      .eq('id', movingItem.id);
    await refreshAllData();
    setMovingItem(null);
  };

  // Excluded IDs for move folder picker
  const moveFolderExclude = movingFolderId
    ? [movingFolderId, ...getDescendantIds(movingFolderId, visibleSubjects)]
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full gap-5 overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 flex flex-col bg-white rounded-[24px] border border-gray-100 shadow-sm p-3 overflow-y-auto">
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pastas</span>
          <button
            onClick={() => { goToRoot(); setShowCreate(true); }}
            title="Nova pasta"
            className="w-6 h-6 bg-brand-light rounded-lg flex items-center justify-center text-brand-primary hover:bg-brand-primary hover:text-white transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Root */}
        <button
          onClick={goToRoot}
          className={`flex items-center gap-2 px-2.5 py-2 rounded-xl mb-1 transition-all ${!currentFolderId ? 'bg-brand-light text-brand-primary' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Home size={13} />
          <span className="text-xs font-bold flex-1 text-left">Todas as Pastas</span>
          <span className="text-[9px] font-black px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-full">
            {visibleSubjects.length}
          </span>
        </button>

        <div className="h-px bg-gray-100 mb-2" />

        {/* Recursive tree */}
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {rootSubjects.map(s => (
            <TreeItem
              key={s.id}
              subject={s}
              depth={0}
              currentFolderId={currentFolderId}
              allSubjects={visibleSubjects}
              statsMap={statsMap}
              onSelect={openFolder}
              onStartRename={(id, name) => { setRenamingId(id); setRenameValue(name); }}
              onDelete={handleDelete}
              onStartMove={id => setMovingFolderId(id)}
              renamingId={renamingId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              onRenameSubmit={handleRenameSubmit}
              onRenameCancel={() => setRenamingId(null)}
            />
          ))}
          {rootSubjects.length === 0 && (
            <p className="text-xs text-gray-300 text-center py-8 italic">Nenhuma pasta ainda</p>
          )}
        </div>
      </aside>

      {/* ── Main Area ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 gap-4 overflow-hidden">

        {/* Breadcrumb + Actions */}
        <div className="flex items-center justify-between gap-3 shrink-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 min-w-0 overflow-x-auto">
            <button
              onClick={goToRoot}
              className={`flex items-center gap-1.5 text-xs font-bold shrink-0 px-2.5 py-1.5 rounded-xl transition-colors ${!currentFolderId ? 'text-brand-primary bg-brand-light' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
            >
              <Home size={13} />
              <span>Pastas</span>
            </button>
            {breadcrumb.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight size={12} className="text-gray-300 shrink-0" />
                <button
                  onClick={() => goToBreadcrumb(idx)}
                  className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shrink-0 max-w-[140px] truncate ${idx === breadcrumb.length - 1 ? 'text-gray-900 bg-gray-100' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </nav>

          {/* Folder-level actions */}
          <div className="flex items-center gap-2 shrink-0">
            {currentFolder && (
              <>
                {renamingId === currentFolder.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameSubmit(currentFolder.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-white border border-brand-primary/40 rounded-xl outline-none w-36"
                    />
                    <button onClick={() => handleRenameSubmit(currentFolder.id)} className="p-1.5 bg-green-50 text-green-500 rounded-xl hover:bg-green-100 transition-colors">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setRenamingId(null)} className="p-1.5 bg-gray-100 text-gray-400 rounded-xl hover:bg-gray-200 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setRenamingId(currentFolder.id); setRenameValue(currentFolder.name); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-brand-primary px-3 py-2 bg-white rounded-xl border border-gray-100 hover:border-brand-primary/30 transition-all"
                  >
                    <Edit2 size={12} />
                    Renomear
                  </button>
                )}
                <button
                  onClick={() => setMovingFolderId(currentFolder.id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-500 px-3 py-2 bg-white rounded-xl border border-gray-100 hover:border-blue-200 transition-all"
                >
                  <Move size={12} />
                  Mover
                </button>
                <button
                  onClick={() => handleDelete(currentFolder.id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-red-500 px-3 py-2 bg-white rounded-xl border border-gray-100 hover:border-red-200 transition-all"
                >
                  <Trash2 size={12} />
                  Excluir
                </button>
              </>
            )}
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={14} />
              Nova Pasta
            </button>
          </div>
        </div>

        {/* Create Form */}
        <AnimatePresence>
          {showCreate && (
            <motion.form
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleCreate}
              className="bg-white rounded-2xl p-6 border border-brand-light shadow-lg max-w-md space-y-4 shrink-0"
            >
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                Nova pasta{currentFolder ? ` dentro de "${currentFolder.name}"` : ' na raiz'}
              </p>
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Anatomia, Farmacologia..."
                className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand-primary/30"
                required
              />
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`w-8 h-8 rounded-full border-4 transition-all ${newColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-bold disabled:opacity-60"
                >
                  {creating ? 'Criando…' : 'Criar Pasta'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">

          {/* Subfolders grid */}
          {currentSubfolders.length > 0 && (
            <section className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">
                {currentFolderId ? 'Subpastas' : 'Pastas'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {currentSubfolders.map(s => {
                  const isRenamingCard = renamingId === s.id;
                  const childCount = visibleSubjects.filter(c => c.parent_id === s.id).length;
                  return (
                    <motion.div
                      key={s.id}
                      whileHover={{ y: -3 }}
                      className="group bg-white p-5 rounded-2xl border border-gray-50 shadow-sm hover:shadow-lg transition-all cursor-pointer relative"
                      onClick={() => !isRenamingCard && openFolder(s.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
                          style={{ backgroundColor: s.color, boxShadow: `0 6px 16px -4px ${s.color}60` }}
                        >
                          <FolderOpen size={18} />
                        </div>
                        <div
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => { setRenamingId(s.id); setRenameValue(s.name); }}
                            title="Renomear"
                            className="p-1.5 text-gray-300 hover:text-brand-primary rounded-lg transition-colors"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => setMovingFolderId(s.id)}
                            title="Mover"
                            className="p-1.5 text-gray-300 hover:text-blue-500 rounded-lg transition-colors"
                          >
                            <Move size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            title="Excluir"
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {isRenamingCard ? (
                        <div onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameSubmit(s.id);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            className="w-full px-2 py-1 text-xs font-bold bg-gray-50 border border-brand-primary/30 rounded-lg outline-none"
                          />
                          <div className="flex gap-1 mt-2">
                            <button onClick={() => handleRenameSubmit(s.id)} className="flex-1 py-1 bg-brand-primary text-white rounded-lg text-[10px] font-black">
                              Salvar
                            </button>
                            <button onClick={() => setRenamingId(null)} className="flex-1 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-black">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h4 className="font-bold text-gray-900 text-sm truncate">{s.name}</h4>
                          <p className="text-xs text-gray-400 mt-0.5">{statsMap[s.id] ?? 0} itens diretos</p>
                          {childCount > 0 && (
                            <p className="text-[10px] text-gray-300 font-bold mt-0.5">
                              {childCount} subpasta{childCount > 1 ? 's' : ''}
                            </p>
                          )}
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Items tabs (only inside a folder) */}
          {currentFolderId && tabCounts && (
            <section className="space-y-4">
              <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                {TABS.map(({ key, label }) => {
                  const count = tabCounts[key];
                  const style = TAB_STYLE[key];
                  const Icon = style.icon;
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${isActive ? style.active : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                    >
                      <Icon size={13} />
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

              <div className="space-y-2">
                {tabItems.length === 0 ? (
                  <EmptyTab
                    tabKey={activeTab}
                    folderName={currentFolder?.name ?? ''}
                    onNavigate={() => onNavigate(TABS.find(t => t.key === activeTab)!.moduleTab, currentFolderId)}
                  />
                ) : (
                  <>
                    {tabItems.map((item: any) => (
                      <ContentRow
                        key={item.id}
                        tabKey={activeTab}
                        item={item}
                        onGo={() => onNavigate(TABS.find(t => t.key === activeTab)!.moduleTab, currentFolderId)}
                        onMove={() => setMovingItem({ type: activeTab, id: item.id })}
                      />
                    ))}
                    <div className="flex justify-end pt-1 pb-4">
                      <button
                        onClick={() => onNavigate(TABS.find(t => t.key === activeTab)!.moduleTab, currentFolderId)}
                        className="text-xs font-bold text-gray-400 hover:text-brand-primary transition-colors flex items-center gap-1.5"
                      >
                        Abrir módulo completo
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Root empty state */}
          {!currentFolderId && currentSubfolders.length === 0 && (
            <div className="py-24 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
              <Folder size={48} className="text-gray-200 mb-4" />
              <p className="text-sm text-gray-400 max-w-xs">
                Ainda não há pastas. Clique em "Nova Pasta" para criar sua estrutura hierárquica de estudos.
              </p>
            </div>
          )}

          {/* Unorganized banner (root only) */}
          {!currentFolderId && unorganized.total > 0 && (
            <div className="flex items-start gap-3 p-5 bg-amber-50 border border-amber-100 rounded-2xl">
              <AlertCircle size={17} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-800">
                  {unorganized.total} {unorganized.total === 1 ? 'item sem pasta' : 'itens sem pasta'}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Estes itens não estão vinculados a nenhuma pasta. Acesse o módulo correspondente para organizá-los.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {TABS.filter(t => unorganized[t.key as keyof typeof unorganized] as number > 0).map(t => {
                    const style = TAB_STYLE[t.key];
                    const Icon = style.icon;
                    return (
                      <button
                        key={t.key}
                        onClick={() => onNavigate(t.moduleTab)}
                        className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full ${style.pill} hover:scale-105 transition-transform`}
                      >
                        <Icon size={10} />
                        {unorganized[t.key as keyof typeof unorganized] as number} em {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {movingFolderId && (
          <FolderPickerModal
            title={`Mover "${visibleSubjects.find(s => s.id === movingFolderId)?.name ?? 'pasta'}" para…`}
            subjects={visibleSubjects}
            excludeIds={moveFolderExclude}
            onSelect={handleMoveFolder}
            onClose={() => setMovingFolderId(null)}
          />
        )}
        {movingItem && (
          <FolderPickerModal
            title="Mover item para…"
            subjects={visibleSubjects}
            excludeIds={[]}
            onSelect={handleMoveItem}
            onClose={() => setMovingItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── EmptyTab ───────────────────────────────────────────────────────────────────

const EmptyTab = ({
  tabKey, folderName, onNavigate,
}: { tabKey: TabKey; folderName: string; onNavigate: () => void }) => {
  const style = TAB_STYLE[tabKey];
  const Icon = style.icon;
  return (
    <div className="py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={24} className="text-gray-200" />
      </div>
      <p className="text-sm font-bold text-gray-500 mb-1">Nenhum item vinculado</p>
      <p className="text-xs text-gray-400 mb-5 max-w-xs">
        Nenhum item está vinculado à pasta "{folderName}". Abra o módulo e associe itens a esta pasta.
      </p>
      <button
        onClick={onNavigate}
        className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-primary/20"
      >
        <ExternalLink size={12} />
        Ir para o módulo
      </button>
    </div>
  );
};

// ── ContentRow ─────────────────────────────────────────────────────────────────

const ContentRow = ({
  tabKey, item, onGo, onMove,
}: { tabKey: TabKey; item: any; onGo: () => void; onMove: () => void }) => {
  switch (tabKey) {
    case 'notes':      return <NoteRow      item={item as Note}      onGo={onGo} onMove={onMove} />;
    case 'flashcards': return <FlashcardRow item={item as Flashcard} onGo={onGo} onMove={onMove} />;
    case 'tasks':      return <TaskRow      item={item as Task}      onGo={onGo} onMove={onMove} />;
    case 'materials':  return <MaterialRow  item={item as Material}  onGo={onGo} onMove={onMove} />;
    case 'questions':  return <QuestionRow  item={item as Question}  onGo={onGo} onMove={onMove} />;
    case 'events':     return <EventRow     item={item as Event}     onGo={onGo} onMove={onMove} />;
    default:           return null;
  }
};

const RowShell = ({ children, onGo, onMove, hoverColor }: {
  children: React.ReactNode; onGo: () => void; onMove: () => void; hoverColor: string;
}) => (
  <div className="flex items-start justify-between gap-3 bg-white p-5 rounded-2xl border border-gray-50 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-start gap-4 min-w-0 flex-1">{children}</div>
    <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={onMove} title="Mover para outra pasta" className="p-1.5 text-gray-200 hover:text-blue-500 transition-colors">
        <Move size={14} />
      </button>
      <button onClick={onGo} title="Abrir no módulo" className={`p-1.5 text-gray-200 transition-colors ${hoverColor}`}>
        <ExternalLink size={14} />
      </button>
    </div>
  </div>
);

const NoteRow = ({ item, onGo, onMove }: { item: Note; onGo: () => void; onMove: () => void }) => (
  <RowShell onGo={onGo} onMove={onMove} hoverColor="hover:text-orange-500">
    <div className="mt-0.5 p-2 bg-orange-50 rounded-xl shrink-0"><FileText size={15} className="text-orange-500" /></div>
    <div className="min-w-0">
      <p className="font-bold text-gray-900 truncate">{item.title}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        {new Date(item.updated_at).toLocaleDateString('pt-BR')}
        {(item.tags ?? []).length > 0 && (
          <span className="ml-2 text-brand-primary">
            {item.tags.slice(0, 2).map((t: string) => `#${t}`).join(' ')}
            {item.tags.length > 2 && ` +${item.tags.length - 2}`}
          </span>
        )}
      </p>
    </div>
  </RowShell>
);

const FlashcardRow = ({ item, onGo, onMove }: { item: Flashcard; onGo: () => void; onMove: () => void }) => (
  <RowShell onGo={onGo} onMove={onMove} hoverColor="hover:text-purple-500">
    <div className="mt-0.5 p-2 bg-purple-50 rounded-xl shrink-0"><Brain size={15} className="text-purple-500" /></div>
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
const STATUS_LABEL: Record<string, string> = { todo: 'A fazer', 'in-progress': 'Em progresso', done: 'Concluído' };

const TaskRow = ({ item, onGo, onMove }: { item: Task; onGo: () => void; onMove: () => void }) => (
  <RowShell onGo={onGo} onMove={onMove} hoverColor="hover:text-blue-500">
    <div className="mt-0.5 p-2 bg-blue-50 rounded-xl shrink-0"><CheckSquare size={15} className="text-blue-500" /></div>
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

const MaterialRow = ({ item, onGo, onMove }: { item: Material; onGo: () => void; onMove: () => void }) => (
  <RowShell onGo={onGo} onMove={onMove} hoverColor="hover:text-green-600">
    <div className="mt-0.5 p-2 bg-green-50 rounded-xl shrink-0"><BookOpen size={15} className="text-green-600" /></div>
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

const QuestionRow = ({ item, onGo, onMove }: { item: Question; onGo: () => void; onMove: () => void }) => (
  <RowShell onGo={onGo} onMove={onMove} hoverColor="hover:text-red-500">
    <div className="mt-0.5 p-2 bg-red-50 rounded-xl shrink-0"><HelpCircle size={15} className="text-red-500" /></div>
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

const EventRow = ({ item, onGo, onMove }: { item: Event; onGo: () => void; onMove: () => void }) => (
  <RowShell onGo={onGo} onMove={onMove} hoverColor="hover:text-teal-600">
    <div className="mt-0.5 p-2 bg-teal-50 rounded-xl shrink-0"><Calendar size={15} className="text-teal-600" /></div>
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
