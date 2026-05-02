import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import {
  Plus,
  Trash2,
  BookOpen,
  Layers,
  ChevronRight,
  X,
  BrainCircuit,
  FileText,
  CheckSquare,
  Play,
  Clock,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = [
  '#ff85a1', '#ff9a85', '#ffc785', '#85ffc7', '#85d3ff', '#a185ff', '#ff85ef', '#71717a'
];

interface Props {
  onNavigate?: (tab: string, subjectId?: string) => void;
}

const SubjectsModule = ({ onNavigate }: Props) => {
  const { subjects, tasks, notes, flashcards, supabaseUser } = useAppContext();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [hubSubjectId, setHubSubjectId] = useState<string | null>(null);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !name) return;
    try {
      await supabase.from('subjects').insert({
        name,
        color,
        user_id: supabaseUser.id,
        created_at: new Date().toISOString()
      });
      setName('');
      setIsAdding(false);
    } catch (err) {
      handleSupabaseError(err, OperationType.CREATE, 'subjects');
    }
  };

  const getStats = (subjectId: string) => ({
    tasks: tasks.filter(t => t.subject_id === subjectId).length,
    notes: notes.filter(n => n.subject_id === subjectId).length,
    cards: flashcards.filter(c => c.subject_id === subjectId).length
  });

  const hubSubject = subjects.find(s => s.id === hubSubjectId);
  const hubNotes = hubSubjectId ? notes.filter(n => n.subject_id === hubSubjectId) : [];
  const hubCards = hubSubjectId ? flashcards.filter(c => c.subject_id === hubSubjectId) : [];
  const hubTasks = hubSubjectId ? tasks.filter(t => t.subject_id === hubSubjectId) : [];
  const hubDueCards = hubCards.filter(c => new Date(c.next_review || 0) <= new Date());
  const hubPendingTasks = hubTasks.filter(t => t.status !== 'done');

  const navigate = (tab: string) => {
    setHubSubjectId(null);
    onNavigate?.(tab, hubSubjectId ?? undefined);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
            <Layers size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Disciplinas</h2>
            <p className="text-sm text-gray-500">Organize seus conteúdos por matéria.</p>
          </div>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center space-x-2 px-6 py-3 bg-brand-primary text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95"
        >
          <Plus size={18} />
          <span>Nova Disciplina</span>
        </button>
      </header>

      {isAdding && (
        <motion.form
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleAddSubject}
          className="bg-white p-8 rounded-3xl shadow-xl border border-brand-light space-y-6 max-w-2xl"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nome da Disciplina</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Anatomia Sistêmica"
                className="w-full p-4 bg-brand-bg rounded-2xl outline-none text-gray-900 font-medium"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cor de Identificação</label>
              <div className="flex flex-wrap gap-3 p-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-10 h-10 rounded-full border-4 transition-all ${color === c ? 'border-white ring-2 ring-brand-primary scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-4 pt-4">
            <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-3 text-gray-400 font-bold">Cancelar</button>
            <button type="submit" className="px-8 py-3 bg-brand-primary text-white rounded-xl font-bold transition-transform active:scale-95">Criar Disciplina</button>
          </div>
        </motion.form>
      )}

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map(subject => {
          const stats = getStats(subject.id);
          return (
            <motion.div
              layoutId={subject.id}
              key={subject.id}
              className="bg-white p-8 rounded-3xl border border-gray-50 shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg"
                  style={{ backgroundColor: subject.color, boxShadow: `0 10px 15px -3px ${subject.color}30` }}
                >
                  <BookOpen size={28} />
                </div>
                <button
                  onClick={() => supabase.from('subjects').delete().eq('id', subject.id)}
                  className="p-2 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-6 truncate">{subject.name}</h3>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-brand-bg rounded-2xl text-center">
                  <p className="text-lg font-bold text-gray-900">{stats.cards}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Cards</p>
                </div>
                <div className="p-3 bg-brand-bg rounded-2xl text-center">
                  <p className="text-lg font-bold text-gray-900">{stats.notes}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Notas</p>
                </div>
                <div className="p-3 bg-brand-bg rounded-2xl text-center">
                  <p className="text-lg font-bold text-gray-900">{stats.tasks}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Tarefas</p>
                </div>
              </div>

              <button
                onClick={() => setHubSubjectId(subject.id)}
                className="w-full mt-6 py-3 bg-brand-bg rounded-xl text-gray-400 font-bold text-xs hover:bg-brand-light hover:text-brand-primary transition-all flex items-center justify-center space-x-2"
              >
                <span>Acessar Hub Completo</span>
                <ChevronRight size={14} />
              </button>
            </motion.div>
          );
        })}

        {subjects.length === 0 && !isAdding && (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
            <Layers className="text-gray-200 mb-4" size={56} />
            <p className="text-gray-400 text-sm max-w-xs">Organize seus estudos criando disciplinas para agrupar notas, flashcards e tarefas.</p>
          </div>
        )}
      </div>

      {/* Hub Modal */}
      <AnimatePresence>
        {hubSubjectId && hubSubject && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHubSubjectId(null)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ type: 'spring', damping: 26, stiffness: 200 }}
              className="fixed right-0 top-0 h-full z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div
                className="p-8 pb-6 flex items-start justify-between"
                style={{ borderBottom: `3px solid ${hubSubject.color}` }}
              >
                <div className="flex items-center space-x-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg"
                    style={{ backgroundColor: hubSubject.color }}
                  >
                    <BookOpen size={28} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Hub da Disciplina</p>
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{hubSubject.name}</h3>
                  </div>
                </div>
                <button
                  onClick={() => setHubSubjectId(null)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8">

                {/* Flashcards Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-gray-900">
                      <BrainCircuit size={18} style={{ color: hubSubject.color }} />
                      <h4 className="font-black text-sm uppercase tracking-widest">Flashcards</h4>
                    </div>
                    <button
                      onClick={() => navigate('flashcards')}
                      className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1 hover:text-brand-primary transition-colors text-gray-400"
                    >
                      Ver todos <ChevronRight size={12} />
                    </button>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-5 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-3xl font-black text-gray-900">{hubCards.length}</p>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">cards no total</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-3xl font-black" style={{ color: hubDueCards.length > 0 ? hubSubject.color : '#9ca3af' }}>
                        {hubDueCards.length}
                      </p>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">para revisar</p>
                    </div>
                  </div>

                  {hubDueCards.length > 0 && (
                    <button
                      onClick={() => navigate('flashcards')}
                      className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-2 text-white transition-all hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: hubSubject.color }}
                    >
                      <Play size={14} fill="currentColor" />
                      <span>Treinar agora ({hubDueCards.length})</span>
                    </button>
                  )}
                </section>

                <div className="border-t border-gray-100" />

                {/* Notes Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-gray-900">
                      <FileText size={18} style={{ color: hubSubject.color }} />
                      <h4 className="font-black text-sm uppercase tracking-widest">Resumos</h4>
                    </div>
                    <button
                      onClick={() => navigate('notes')}
                      className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1 hover:text-brand-primary transition-colors text-gray-400"
                    >
                      Ver todos <ChevronRight size={12} />
                    </button>
                  </div>

                  {hubNotes.length === 0 ? (
                    <p className="text-sm text-gray-400 font-medium py-2">Nenhum resumo nesta disciplina ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {hubNotes.slice(0, 4).map(note => (
                        <button
                          key={note.id}
                          onClick={() => navigate('notes')}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-brand-light/40 transition-all group/note"
                        >
                          <span className="text-sm font-bold text-gray-700 truncate text-left group-hover/note:text-brand-primary transition-colors">
                            {note.title || 'Sem título'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide shrink-0 ml-4">
                            {new Date(note.updated_at).toLocaleDateString('pt-BR')}
                          </span>
                        </button>
                      ))}
                      {hubNotes.length > 4 && (
                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest text-center py-1">
                          +{hubNotes.length - 4} outros resumos
                        </p>
                      )}
                    </div>
                  )}
                </section>

                <div className="border-t border-gray-100" />

                {/* Tasks Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-gray-900">
                      <CheckSquare size={18} style={{ color: hubSubject.color }} />
                      <h4 className="font-black text-sm uppercase tracking-widest">Tarefas</h4>
                    </div>
                    <button
                      onClick={() => navigate('tasks')}
                      className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1 hover:text-brand-primary transition-colors text-gray-400"
                    >
                      Ver todas <ChevronRight size={12} />
                    </button>
                  </div>

                  {hubPendingTasks.length === 0 ? (
                    <p className="text-sm text-gray-400 font-medium py-2">
                      {hubTasks.length > 0 ? 'Todas as tarefas concluídas!' : 'Nenhuma tarefa nesta disciplina ainda.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {hubPendingTasks.slice(0, 5).map(task => (
                        <button
                          key={task.id}
                          onClick={() => navigate('tasks')}
                          className="w-full flex items-center space-x-3 p-4 bg-gray-50 rounded-2xl hover:bg-brand-light/40 transition-all group/task text-left"
                        >
                          <div className={`shrink-0 w-2 h-2 rounded-full ${
                            task.priority === 'high' ? 'bg-red-400' :
                            task.priority === 'medium' ? 'bg-orange-400' : 'bg-green-400'
                          }`} />
                          <span className="text-sm font-bold text-gray-700 truncate group-hover/task:text-brand-primary transition-colors">
                            {task.title}
                          </span>
                          {task.deadline && (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wide ml-auto">
                              <Clock size={10} />
                              {new Date(task.deadline).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </button>
                      ))}
                      {hubPendingTasks.length > 5 && (
                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest text-center py-1">
                          +{hubPendingTasks.length - 5} outras tarefas
                        </p>
                      )}
                    </div>
                  )}
                </section>
              </div>

              {/* Footer quick-nav */}
              <div className="p-6 border-t border-gray-100 grid grid-cols-3 gap-3">
                <button
                  onClick={() => navigate('flashcards')}
                  className="flex flex-col items-center space-y-1 py-4 rounded-2xl bg-gray-50 hover:bg-brand-light hover:text-brand-primary transition-all text-gray-500"
                >
                  <BrainCircuit size={20} />
                  <span className="text-[10px] font-black uppercase tracking-wide">Flashcards</span>
                </button>
                <button
                  onClick={() => navigate('notes')}
                  className="flex flex-col items-center space-y-1 py-4 rounded-2xl bg-gray-50 hover:bg-brand-light hover:text-brand-primary transition-all text-gray-500"
                >
                  <FileText size={20} />
                  <span className="text-[10px] font-black uppercase tracking-wide">Resumos</span>
                </button>
                <button
                  onClick={() => navigate('tasks')}
                  className="flex flex-col items-center space-y-1 py-4 rounded-2xl bg-gray-50 hover:bg-brand-light hover:text-brand-primary transition-all text-gray-500"
                >
                  <CheckSquare size={20} />
                  <span className="text-[10px] font-black uppercase tracking-wide">Tarefas</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubjectsModule;
