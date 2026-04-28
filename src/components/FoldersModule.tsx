/**
 * FoldersModule — Hierarchical folder system (adjacency list)
 *
 * Data model:
 *   Subject.parent_id (nullable UUID, FK → subjects.id ON DELETE SET NULL)
 *   null = root folder.
 *
 * Item membership:
 *   item.subject_id === folder.id  — direct link only, never duplicated.
 *
 * Content aggregation:
 *   When "Incluir subpastas" is on, items from all descendant folders are
 *   collected via BFS and shown together. Toggle is per-session, defaults on.
 *
 * Tree traversal:
 *   All traversal is in-memory (BFS) on the flat subjects[] already in context.
 *   No recursive SQL queries. Safe for arbitrary nesting depth.
 *
 * DB migration required (run once in Supabase SQL Editor):
 *   ALTER TABLE subjects
 *     ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES subjects(id) ON DELETE SET NULL;
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import {
  Folder, FolderOpen, FolderPlus, Plus, Trash2, FileText, Brain, CheckSquare,
  BookOpen, HelpCircle, Calendar, ExternalLink, Clock, ArrowLeft,
  AlertCircle, ChevronRight, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Note, Flashcard, Task, Material, Question, Event, Subject } from '../types';
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

// ── Tree helpers (pure, BFS — safe for arbitrary depth) ───────────────────────

function getChildren(parentId: string | null, subjects: Subject[]): Subject[] {
  return subjects.filter(s => (s.parent_id ?? null) === parentId);
}

// Returns [subjectId, ...all descendant IDs] via BFS — no recursion.
function getDescendantIds(subjectId: string, subjects: Subject[]): string[] {
  const result: string[] = [];
  const queue = [subjectId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    subjects.filter(s => s.parent_id === current).forEach(s => queue.push(s.id));
  }
  return result;
}

// Returns ancestors ordered root → parent (not including the subject itself).
// Uses a visited-set to guard against accidental cycles.
function getAncestors(subjectId: string, subjects: Subject[]): Subject[] {
  const ancestors: Subject[] = [];
  let currentId: string | null | undefined = subjectId;
  const visited = new Set<string>();
  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const node = subjects.find(s => s.id === currentId);
    if (!node?.parent_id) break;
    const parent = subjects.find(s => s.id === node.parent_id);
    if (!parent) break;
    ancestors.unshift(parent);
    currentId = parent.id;
  }
  return ancestors;
}

// ── TreeNode ──────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  subject: Subject;
  allSubjects: Subject[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  directCountMap: Map<string, number>;
  depth: number;
}

const TreeNode = ({
  subject, allSubjects, selectedId, expandedIds, onSelect, onToggleExpand, directCountMap, depth,
}: TreeNodeProps) => {
  const children    = getChildren(subject.id, allSubjects);
  const hasChildren = children.length > 0;
  const isExpanded  = expandedIds.has(subject.id);
  const isSelected  = selectedId === subject.id;
  const count       = directCountMap.get(subject.id) ?? 0;

  return (
    <div>
      <div
        onClick={() => onSelect(subject.id)}
        className={`flex items-center gap-1.5 py-2 pr-2 rounded-xl cursor-pointer transition-all select-none ${
          isSelected ? 'bg-white shadow-sm border border-gray-100' : 'hover:bg-white/70'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <button
          type="button"
          className="w-4 h-4 shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          onClick={hasChildren ? (e) => { e.stopPropagation(); onToggleExpand(subject.id); } : undefined}
        >
          {hasChildren
            ? (isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />)
            : null}
        </button>
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: subject.color }}
        >
          {isSelected ? <FolderOpen size={11} /> : <Folder size={11} />}
        </div>
        <span className={`flex-1 text-sm font-bold text-left truncate ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
          {subject.name}
        </span>
        {count > 0 && (
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
            isSelected ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-100 text-gray-400'
          }`}>
            {count}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && children.map(child => (
        <TreeNode
          key={child.id}
          subject={child}
          allSubjects={allSubjects}
          selectedId={selectedId}
          expandedIds={expandedIds}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          directCountMap={directCountMap}
          depth={depth + 1}
        />
      ))}
    </div>
  );
};

// ── Create Folder Modal ───────────────────────────────────────────────────────

interface CreateModalProps {
  parentName?: string;
  newName: string;
  setNewName: (v: string) => void;
  newColor: string;
  setNewColor: (v: string) => void;
  creating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const CreateFolderModal = ({
  parentName, newName, setNewName, newColor, setNewColor, creating, onSubmit, onCancel,
}: CreateModalProps) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/10 backdrop-blur-[2px]"
    onClick={onCancel}
  >
    <motion.form
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      onClick={(e) => e.stopPropagation()}
      onSubmit={onSubmit}
      className="bg-white rounded-3xl p-8 border border-brand-light shadow-2xl w-full max-w-md space-y-5"
    >
      <p className="text-xs font-black uppercase tracking-widest text-gray-400">
        {parentName ? `Nova subpasta em "${parentName}"` : 'Nova pasta raiz'}
      </p>
      <input
        autoFocus
        type="text"
        value={newName}
        onChange={e => setNewName(e.target.value)}
        placeholder="Ex: Anatomia, Cabeça e Pescoço..."
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
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={creating}
          className="flex-1 py-3 bg-brand-primary text-white rounded-xl text-sm font-bold disabled:opacity-60"
        >
          {creating ? 'Criando...' : 'Criar'}
        </button>
      </div>
    </motion.form>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

const FoldersModule = ({ onNavigate }: FoldersModuleProps) => {
  const {
    subjects, notes, flashcards, tasks, materials, questions, events, supabaseUser, refreshAllData,
  } = useAppContext();

  const [selectedFolder, setSelectedFolder]   = useState<string | null>(null);
  const [activeTab, setActiveTab]             = useState<TabKey>('notes');
  const [showCreate, setShowCreate]           = useState(false);
  const [createParentId, setCreateParentId]   = useState<string | null>(null);
  const [newName, setNewName]                 = useState('');
  const [newColor, setNewColor]               = useState(COLORS[0]);
  const [creating, setCreating]               = useState(false);
  const [deletingIds, setDeletingIds]         = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [aggregated, setAggregated]           = useState(true);

  // Subjects minus any optimistically-deleted ones
  const visibleSubjects = useMemo(
    () => subjects.filter(s => !deletingIds.includes(s.id)),
    [subjects, deletingIds],
  );

  // Auto-expand the path to selectedFolder in the sidebar tree
  useEffect(() => {
    if (!selectedFolder) return;
    const ancestors = getAncestors(selectedFolder, visibleSubjects);
    setExpandedFolders(prev => {
      const next = new Set(prev);
      ancestors.forEach(a => next.add(a.id));
      next.add(selectedFolder);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolder]);

  const rootFolders = useMemo(() => getChildren(null, visibleSubjects), [visibleSubjects]);

  // All IDs in the selected folder's subtree (self + descendants via BFS)
  const selectedDescendantIds = useMemo(
    () => selectedFolder ? getDescendantIds(selectedFolder, visibleSubjects) : [],
    [selectedFolder, visibleSubjects],
  );

  // IDs to match for content queries (depends on aggregation toggle)
  const activeSubjectIdSet = useMemo(
    () => aggregated
      ? new Set(selectedDescendantIds)
      : new Set(selectedFolder ? [selectedFolder] : []),
    [aggregated, selectedDescendantIds, selectedFolder],
  );

  // Per-folder direct item count (for sidebar tree badges)
  const directCountMap = useMemo(() => {
    const map = new Map<string, number>();
    visibleSubjects.forEach(s => {
      const m = (sid: string | null) => sid === s.id;
      map.set(s.id,
        notes.filter(n => m(n.subject_id)).length +
        flashcards.filter(c => m(c.subject_id)).length +
        tasks.filter(t => m(t.subject_id)).length +
        materials.filter(mt => m(mt.subject_id)).length +
        questions.filter(q => m(q.subject_id)).length +
        events.filter(e => m(e.subject_id)).length,
      );
    });
    return map;
  }, [visibleSubjects, notes, flashcards, tasks, materials, questions, events]);

  // Root-folder overview stats — aggregate counts from all descendants
  const rootFolderStats = useMemo(() =>
    rootFolders.map(s => {
      const descSet = new Set(getDescendantIds(s.id, visibleSubjects));
      const isIn    = (sid: string | null) => sid != null && descSet.has(sid);
      const counts  = {
        notes:      notes.filter(n => isIn(n.subject_id)).length,
        flashcards: flashcards.filter(c => isIn(c.subject_id)).length,
        tasks:      tasks.filter(t => isIn(t.subject_id)).length,
        materials:  materials.filter(mt => isIn(mt.subject_id)).length,
        questions:  questions.filter(q => isIn(q.subject_id)).length,
        events:     events.filter(e => isIn(e.subject_id)).length,
      };
      return {
        ...s,
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        subfolderCount: getChildren(s.id, visibleSubjects).length,
      };
    }),
    [rootFolders, visibleSubjects, notes, flashcards, tasks, materials, questions, events],
  );

  // Items inside the selected folder (respecting aggregation)
  const folderItems = useMemo(() => {
    if (!selectedFolder) return null;
    const isIn = (sid: string | null) => sid != null && activeSubjectIdSet.has(sid);
    return {
      notes:      notes.filter(n => isIn(n.subject_id)),
      flashcards: flashcards.filter(c => isIn(c.subject_id)),
      tasks:      tasks.filter(t => isIn(t.subject_id)),
      materials:  materials.filter(mt => isIn(mt.subject_id)),
      questions:  questions.filter(q => isIn(q.subject_id)),
      events:     events.filter(e => isIn(e.subject_id)),
    };
  }, [selectedFolder, activeSubjectIdSet, notes, flashcards, tasks, materials, questions, events]);

  const subfolders    = useMemo(() => selectedFolder ? getChildren(selectedFolder, visibleSubjects) : [],     [selectedFolder, visibleSubjects]);
  const breadcrumb    = useMemo(() => selectedFolder ? getAncestors(selectedFolder, visibleSubjects) : [],    [selectedFolder, visibleSubjects]);
  const activeSubject = useMemo(() => selectedFolder ? (visibleSubjects.find(s => s.id === selectedFolder) ?? null) : null, [selectedFolder, visibleSubjects]);

  // Items with no valid folder (null or orphaned subject_id)
  const unorganized = useMemo(() => {
    const validIds  = new Set(visibleSubjects.map(s => s.id));
    const isOrphaned = (sid: string | null) => !sid || !validIds.has(sid);
    const n = notes.filter(i => isOrphaned(i.subject_id)).length;
    const f = flashcards.filter(i => isOrphaned(i.subject_id)).length;
    const t = tasks.filter(i => isOrphaned(i.subject_id)).length;
    const m = materials.filter(i => isOrphaned(i.subject_id)).length;
    const q = questions.filter(i => isOrphaned(i.subject_id)).length;
    const e = events.filter(i => isOrphaned(i.subject_id)).length;
    return { notes: n, flashcards: f, tasks: t, materials: m, questions: q, events: e, total: n + f + t + m + q + e };
  }, [visibleSubjects, notes, flashcards, tasks, materials, questions, events]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !newName.trim() || creating) return;
    setCreating(true);
    try {
      const { data } = await supabase
        .from('subjects')
        .insert({ name: newName.trim(), color: newColor, user_id: supabaseUser.id, parent_id: createParentId })
        .select()
        .single();
      setNewName('');
      setShowCreate(false);
      await refreshAllData();
      if (data) {
        setSelectedFolder(data.id);
        setExpandedFolders(prev => {
          const next = new Set(prev);
          if (createParentId) next.add(createParentId);
          next.add(data.id);
          return next;
        });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const childCount = getChildren(id, visibleSubjects).length;
    const msg = childCount > 0
      ? `Esta pasta tem ${childCount} subpasta(s). Ao excluir, elas se tornarão pastas raiz. Os itens vinculados não serão deletados. Continuar?`
      : 'Excluir esta pasta? Os itens vinculados não serão deletados, apenas desvinculados.';
    if (!confirm(msg)) return;
    setDeletingIds(prev => [...prev, id]);
    if (selectedFolder === id) setSelectedFolder(null);
    await supabase.from('subjects').delete().eq('id', id);
    await refreshAllData();
    setDeletingIds(prev => prev.filter(i => i !== id));
  };

  const toggleExpand = useCallback((id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const openCreate = (parentId: string | null) => {
    setCreateParentId(parentId);
    setNewName('');
    setNewColor(COLORS[0]);
    setShowCreate(true);
  };

  const createModalParentName = createParentId
    ? visibleSubjects.find(s => s.id === createParentId)?.name
    : undefined;

  // ── A) OVERVIEW: no folder selected ──────────────────────────────────────

  if (!selectedFolder) {
    return (
      <div className="space-y-8">
        <AnimatePresence>
          {showCreate && (
            <CreateFolderModal
              parentName={createModalParentName}
              newName={newName} setNewName={setNewName}
              newColor={newColor} setNewColor={setNewColor}
              creating={creating}
              onSubmit={handleCreate}
              onCancel={() => setShowCreate(false)}
            />
          )}
        </AnimatePresence>

        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-light rounded-2xl flex items-center justify-center text-brand-primary">
              <Folder size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Pastas</h2>
              <p className="text-sm text-gray-400">Organização hierárquica de todo o seu estudo.</p>
            </div>
          </div>
          <button
            onClick={() => openCreate(null)}
            className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl font-bold shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={18} />
            Nova Pasta
          </button>
        </header>

        {rootFolderStats.length === 0 ? (
          <div className="py-24 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <Folder size={48} className="text-gray-200 mb-4" />
            <p className="text-sm text-gray-400 max-w-xs">
              Ainda não há pastas. Crie uma pasta para organizar seus estudos em hierarquias.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {rootFolderStats.map(s => (
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
                <p className="text-xs text-gray-400 mb-4">
                  {s.total} {s.total === 1 ? 'item' : 'itens'}
                  {s.subfolderCount > 0 && (
                    <span className="ml-2 text-brand-primary font-bold">
                      {s.subfolderCount} subpasta{s.subfolderCount > 1 ? 's' : ''}
                    </span>
                  )}
                </p>

                <div className="flex flex-wrap gap-2">
                  {TABS.filter(t => s.counts[t.key] > 0).map(t => {
                    const style = TAB_STYLE[t.key];
                    const Icon  = style.icon;
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

        {unorganized.total > 0 && (
          <div className="flex items-start gap-3 p-5 bg-amber-50 border border-amber-100 rounded-2xl">
            <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                {unorganized.total} {unorganized.total === 1 ? 'item sem pasta' : 'itens sem pasta'}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Estes itens não estão vinculados a nenhuma pasta e aparecem apenas nos módulos originais.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                {TABS.filter(t => unorganized[t.key] > 0).map(t => {
                  const style = TAB_STYLE[t.key];
                  const Icon  = style.icon;
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

  const tabItems   = folderItems[activeTab];
  const totalItems = Object.values(folderItems).reduce((a, b) => a + b.length, 0);

  return (
    <div className="flex h-full gap-6 overflow-hidden">
      <AnimatePresence>
        {showCreate && (
          <CreateFolderModal
            parentName={createModalParentName}
            newName={newName} setNewName={setNewName}
            newColor={newColor} setNewColor={setNewColor}
            creating={creating}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Left sidebar: full tree ──────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col gap-1 overflow-y-auto pb-4">
        <button
          onClick={() => setSelectedFolder(null)}
          className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-gray-400 hover:text-brand-primary transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          Todas as Pastas
        </button>

        {rootFolders.map(s => (
          <TreeNode
            key={s.id}
            subject={s}
            allSubjects={visibleSubjects}
            selectedId={selectedFolder}
            expandedIds={expandedFolders}
            onSelect={id => { setSelectedFolder(id); setActiveTab('notes'); }}
            onToggleExpand={toggleExpand}
            directCountMap={directCountMap}
            depth={0}
          />
        ))}

        <button
          onClick={() => openCreate(null)}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-brand-primary hover:bg-white/70 transition-all mt-2"
        >
          <Plus size={14} />
          Nova Pasta Raiz
        </button>
      </aside>

      {/* ── Right panel ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 gap-4 overflow-hidden">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs font-bold text-gray-400 shrink-0 flex-wrap">
          <button onClick={() => setSelectedFolder(null)} className="hover:text-brand-primary transition-colors">
            Pastas
          </button>
          {breadcrumb.map(ancestor => (
            <React.Fragment key={ancestor.id}>
              <ChevronRight size={11} className="text-gray-300" />
              <button
                onClick={() => { setSelectedFolder(ancestor.id); setActiveTab('notes'); }}
                className="hover:text-brand-primary transition-colors"
              >
                {ancestor.name}
              </button>
            </React.Fragment>
          ))}
          <ChevronRight size={11} className="text-gray-300" />
          <span className="text-gray-900">{activeSubject.name}</span>
        </nav>

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
                {totalItems} {totalItems === 1 ? 'item' : 'itens'}
                {aggregated && subfolders.length > 0 && ' (incluindo subpastas)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openCreate(activeSubject.id)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-light text-brand-primary rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all"
            >
              <FolderPlus size={14} />
              Nova Subpasta
            </button>
            <button
              onClick={() => handleDelete(activeSubject.id)}
              className="p-2 text-gray-300 hover:text-red-500 transition-colors"
              title="Excluir pasta"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Subfolders chip row */}
        {subfolders.length > 0 && (
          <div className="shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
              Subpastas ({subfolders.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {subfolders.map(sf => {
                const sfDescSet = new Set(getDescendantIds(sf.id, visibleSubjects));
                const isIn      = (sid: string | null) => sid != null && sfDescSet.has(sid);
                const sfTotal   =
                  notes.filter(n => isIn(n.subject_id)).length +
                  flashcards.filter(c => isIn(c.subject_id)).length +
                  tasks.filter(t => isIn(t.subject_id)).length +
                  materials.filter(mt => isIn(mt.subject_id)).length +
                  questions.filter(q => isIn(q.subject_id)).length +
                  events.filter(e => isIn(e.subject_id)).length;
                const sfChildren = getChildren(sf.id, visibleSubjects).length;
                return (
                  <button
                    key={sf.id}
                    onClick={() => { setSelectedFolder(sf.id); setActiveTab('notes'); }}
                    className="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all"
                  >
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: sf.color }}
                    >
                      <Folder size={13} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-800 leading-none">{sf.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                        {sfTotal} itens{sfChildren > 0 && ` · ${sfChildren} subpastas`}
                      </p>
                    </div>
                    <ChevronRight size={13} className="text-gray-300 ml-0.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Aggregation toggle (only visible when there are subfolders) */}
        {subfolders.length > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setAggregated(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                aggregated
                  ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'
                  : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
                aggregated ? 'border-brand-primary bg-brand-primary' : 'border-gray-300'
              }`}>
                {aggregated && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
              </span>
              Incluir subpastas
            </button>
            <span className="text-xs text-gray-400">
              {aggregated
                ? 'Mostrando itens desta pasta e de todas as subpastas'
                : 'Mostrando apenas itens diretos desta pasta'}
            </span>
          </div>
        )}

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

        {/* Content list */}
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
        Nenhum item deste tipo está na pasta "{folderName}" (nem nas subpastas).
        Abra o módulo e associe itens a esta pasta.
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
