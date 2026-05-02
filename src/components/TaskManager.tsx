import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import {
  Plus,
  Trash2,
  CheckSquare,
  Layout,
  List as ListIcon,
  Share2,
  Pencil,
  X,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, TaskStatus, TaskPriority, EventType } from '../types';
import DatePicker from './DatePicker';

interface Props {
  initialSubjectId?: string;
}

const TaskManager = ({ initialSubjectId }: Props) => {
  const { tasks, subjects, supabaseUser, user, refreshAllData } = useAppContext();
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState(initialSubjectId ?? '');

  // New Task Form
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [subjectId, setSubjectId] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineStartTime, setDeadlineStartTime] = useState('08:00');
  const [deadlineEndTime, setDeadlineEndTime] = useState('09:00');
  const [deadlineEventType, setDeadlineEventType] = useState<EventType>(EventType.OTHER);

  // Edit Task State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [editSubjectId, setEditSubjectId] = useState('');
  const [editDeadlineDate, setEditDeadlineDate] = useState('');
  const [editDeadlineStartTime, setEditDeadlineStartTime] = useState('08:00');
  const [editDeadlineEndTime, setEditDeadlineEndTime] = useState('09:00');
  const [editDeadlineEventType, setEditDeadlineEventType] = useState<EventType>(EventType.OTHER);

  const filteredTasks = tasks.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSubject = !filterSubjectId || t.subject_id === filterSubjectId;
    return matchSearch && matchSubject;
  });

  const handleStartEdit = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditSubjectId(task.subject_id || '');
    if (task.deadline) {
      const d = new Date(task.deadline);
      const pad = (n: number) => n.toString().padStart(2, '0');
      setEditDeadlineDate(d.toISOString().slice(0, 10));
      setEditDeadlineStartTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      setEditDeadlineEndTime(`${pad(d.getHours() + 1)}:${pad(d.getMinutes())}`);
    } else {
      setEditDeadlineDate('');
      setEditDeadlineStartTime('08:00');
      setEditDeadlineEndTime('09:00');
    }
    setEditDeadlineEventType(EventType.OTHER);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle) return;
    try {
      const deadlineISO = editDeadlineDate
        ? new Date(`${editDeadlineDate}T${editDeadlineStartTime}`).toISOString()
        : null;
      await supabase.from('tasks').update({
        title: editTitle,
        priority: editPriority,
        subject_id: editSubjectId,
        deadline: deadlineISO,
      }).eq('id', editingTask.id);
      setEditingTask(null);
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.UPDATE, `tasks/${editingTask.id}`);
    }
  };

  const handleShareTask = async (task: Task) => {
    if (!supabaseUser || !user) return;
    try {
      await supabase.from('posts').insert({
        user_id: supabaseUser.id,
        user_name: user.name,
        user_email: user.email,
        content: `Tarefa concluída: ${task.title}. Mais uma meta batida! 🎯`,
        type: 'achievement',
        subject_id: task.subject_id || null,
        created_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        is_public: true,
        likes: []
      });
      alert('Compartilhado na comunidade!');
    } catch (err) {
      handleSupabaseError(err, OperationType.CREATE, 'posts');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !title || !subjectId) return;

    try {
      const hasDeadline = !!deadlineDate;
      const deadlineISO = hasDeadline
        ? new Date(`${deadlineDate}T${deadlineStartTime}`).toISOString()
        : null;

      const { data: taskData, error: taskError } = await supabase.from('tasks').insert({
        title,
        priority,
        status: TaskStatus.TODO,
        subject_id: subjectId,
        user_id: supabaseUser.id,
        deadline: deadlineISO,
        created_at: new Date().toISOString()
      }).select().single();

      if (taskError) throw taskError;

      if (hasDeadline && taskData) {
        const startISO = new Date(`${deadlineDate}T${deadlineStartTime}`).toISOString();
        const endISO = new Date(`${deadlineDate}T${deadlineEndTime}`).toISOString();
        await supabase.from('events').insert({
          title: `Tarefa: ${title}`,
          type: deadlineEventType,
          start: startISO,
          end: endISO,
          user_id: supabaseUser.id,
          subject_id: subjectId,
          task_id: taskData.id
        });
      }

      setTitle('');
      setDeadlineDate('');
      setDeadlineStartTime('08:00');
      setDeadlineEndTime('09:00');
      setDeadlineEventType(EventType.OTHER);
      setIsAdding(false);
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.CREATE, 'tasks');
    }
  };

  const updateStatus = async (id: string, status: TaskStatus) => {
    try {
      await supabase.from('tasks').update({ status }).eq('id', id);
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await supabase.from('tasks').delete().eq('id', id);
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const getPriorityColor = (p: TaskPriority) => {
    switch (p) {
      case TaskPriority.HIGH: return 'text-red-500 bg-red-50';
      case TaskPriority.MEDIUM: return 'text-orange-500 bg-orange-50';
      case TaskPriority.LOW: return 'text-blue-500 bg-blue-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const KanbanColumn = ({ status, label, color }: { status: TaskStatus, label: string, color: string }) => (
    <div className="flex-1 min-w-[300px] flex flex-col space-y-4">
      <div className={`p-4 rounded-2xl flex items-center justify-between border ${color}`}>
        <h3 className="font-bold text-sm uppercase tracking-wider">{label}</h3>
        <span className="text-xs font-bold px-2 py-1 bg-white/50 rounded-lg">
          {filteredTasks.filter(t => t.status === status).length}
        </span>
      </div>
      <div className="flex-1 space-y-4 min-h-[500px]">
        {filteredTasks.filter(t => t.status === status).map(task => (
          <motion.div
            layoutId={task.id}
            key={task.id}
            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-50 group hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-3">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </span>
              <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {task.status === TaskStatus.DONE && (
                  <button onClick={() => handleShareTask(task)} className="p-1 text-gray-300 hover:text-brand-primary">
                    <Share2 size={14} />
                  </button>
                )}
                <button onClick={() => handleStartEdit(task)} className="p-1 text-gray-300 hover:text-blue-500">
                  <Pencil size={14} />
                </button>
                <button onClick={() => deleteTask(task.id)} className="p-1 text-gray-300 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <h4 className="font-medium text-gray-900 mb-4">{task.title}</h4>
            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 rounded-full bg-brand-light flex items-center justify-center text-brand-primary">
                  <CheckSquare size={10} />
                </div>
                <span className="text-[10px] font-bold text-gray-400">
                  {subjects.find(s => s.id === task.subject_id)?.name || 'Geral'}
                </span>
              </div>
              <select
                value={task.status}
                onChange={(e) => updateStatus(task.id, e.target.value as TaskStatus)}
                className="text-[10px] font-bold bg-gray-50 p-1 rounded outline-none"
              >
                <option value={TaskStatus.TODO}>Mover para To Do</option>
                <option value={TaskStatus.IN_PROGRESS}>Mover para In Progress</option>
                <option value={TaskStatus.DONE}>Concluir</option>
              </select>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 h-full flex flex-col">
      {/* Edit Task Modal */}
      <AnimatePresence>
        {editingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setEditingTask(null); }}
          >
            <motion.form
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={handleUpdateTask}
              className="bg-white p-8 rounded-3xl shadow-2xl border border-blue-50 space-y-6 w-full max-w-2xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Editar Tarefa</h3>
                <button type="button" onClick={() => setEditingTask(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50">
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Tarefa</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-4 bg-gray-50 rounded-xl outline-none text-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Disciplina</label>
                  <select
                    value={editSubjectId}
                    onChange={(e) => setEditSubjectId(e.target.value)}
                    className="w-full p-4 bg-gray-50 rounded-xl outline-none text-sm"
                  >
                    <option value="">Geral</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Prioridade</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                    className="w-full p-4 bg-gray-50 rounded-xl outline-none text-sm"
                  >
                    <option value={TaskPriority.LOW}>Baixa</option>
                    <option value={TaskPriority.MEDIUM}>Média</option>
                    <option value={TaskPriority.HIGH}>Alta</option>
                  </select>
                </div>
                <div className="md:col-span-2 bg-brand-light border border-brand-accent rounded-2xl p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-brand-primary">
                    <Calendar size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Prazo / Agenda</span>
                    <span className="text-[10px] text-gray-400 font-normal normal-case">— opcional</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Data</label>
                      <DatePicker value={editDeadlineDate} onChange={setEditDeadlineDate} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Início</label>
                      <input
                        type="time"
                        value={editDeadlineStartTime}
                        onChange={(e) => setEditDeadlineStartTime(e.target.value)}
                        className="w-full p-3 bg-white border border-brand-accent rounded-xl outline-none text-sm focus:border-brand-primary transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Fim</label>
                      <input
                        type="time"
                        value={editDeadlineEndTime}
                        onChange={(e) => setEditDeadlineEndTime(e.target.value)}
                        className="w-full p-3 bg-white border border-brand-accent rounded-xl outline-none text-sm focus:border-brand-primary transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Tipo</label>
                      <select
                        value={editDeadlineEventType}
                        onChange={(e) => setEditDeadlineEventType(e.target.value as EventType)}
                        className="w-full p-3 bg-white border border-brand-accent rounded-xl outline-none text-sm focus:border-brand-primary transition-colors"
                      >
                        <option value={EventType.EXAM}>Prova</option>
                        <option value={EventType.CLASS}>Aula</option>
                        <option value={EventType.REVIEW}>Revisão</option>
                        <option value={EventType.OTHER}>Outro</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-4">
                <button type="button" onClick={() => setEditingTask(null)} className="px-8 py-3 text-gray-400 font-bold">Cancelar</button>
                <button type="submit" className="px-8 py-3 bg-blue-500 text-white rounded-xl font-bold">Salvar</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
            <CheckSquare size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Gerenciador de Tarefas</h2>
            <p className="text-sm text-gray-500">Mantenha sua rotina acadêmica sob controle.</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex bg-white p-1 rounded-xl border border-gray-100">
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-blue-50 text-blue-500' : 'text-gray-400'}`}
            >
              <ListIcon size={18} />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`p-2 rounded-lg transition-colors ${view === 'kanban' ? 'bg-blue-50 text-blue-500' : 'text-gray-400'}`}
            >
              <Layout size={18} />
            </button>
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus size={18} />
            <span>Adicionar</span>
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <input
            type="text"
            placeholder="Pesquisar tarefas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
          />
        </div>
        <select
          value={filterSubjectId}
          onChange={(e) => setFilterSubjectId(e.target.value)}
          className="px-5 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-gray-600 outline-none"
        >
          <option value="">Todas as Disciplinas</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* New Task Form */}
      {isAdding && (
        <motion.form
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleAddTask}
          className="bg-white p-8 rounded-3xl shadow-xl border border-blue-50 space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2 col-span-1 md:col-span-2 lg:col-span-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Tarefa</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Estudar Anatomia do Coração"
                className="w-full p-4 bg-gray-50 rounded-xl outline-none text-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Disciplina</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-xl outline-none text-sm"
                required
              >
                <option value="">Selecione...</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full p-4 bg-gray-50 rounded-xl outline-none text-sm"
              >
                <option value={TaskPriority.LOW}>Baixa</option>
                <option value={TaskPriority.MEDIUM}>Média</option>
                <option value={TaskPriority.HIGH}>Alta</option>
              </select>
            </div>
          </div>

          {/* Agenda section */}
          <div className="bg-brand-light border border-brand-accent rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-brand-primary">
                <Calendar size={14} />
                <span className="text-xs font-bold uppercase tracking-wider">Prazo / Agenda</span>
              </div>
              <span className="text-[10px] text-gray-400">opcional — só preencha se quiser adicionar à agenda</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Data</label>
                <DatePicker value={deadlineDate} onChange={setDeadlineDate} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Início</label>
                <input
                  type="time"
                  value={deadlineStartTime}
                  onChange={(e) => setDeadlineStartTime(e.target.value)}
                  className="w-full p-3 bg-white border border-brand-accent rounded-xl outline-none text-sm focus:border-brand-primary transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Fim</label>
                <input
                  type="time"
                  value={deadlineEndTime}
                  onChange={(e) => setDeadlineEndTime(e.target.value)}
                  className="w-full p-3 bg-white border border-brand-accent rounded-xl outline-none text-sm focus:border-brand-primary transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Tipo</label>
                <select
                  value={deadlineEventType}
                  onChange={(e) => setDeadlineEventType(e.target.value as EventType)}
                  className="w-full p-3 bg-white border border-brand-accent rounded-xl outline-none text-sm focus:border-brand-primary transition-colors"
                >
                  <option value={EventType.EXAM}>Prova</option>
                  <option value={EventType.CLASS}>Aula</option>
                  <option value={EventType.REVIEW}>Revisão</option>
                  <option value={EventType.OTHER}>Outro</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-4">
            <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-3 text-gray-400 font-bold">Cancelar</button>
            <button type="submit" className="px-8 py-3 bg-blue-500 text-white rounded-xl font-bold">Criar Tarefa</button>
          </div>
        </motion.form>
      )}

      {/* Main View */}
      <div className="flex-1 min-h-0 overflow-x-auto">
        {view === 'kanban' ? (
          <div className="flex space-x-8 min-w-max pb-8 h-full">
            <KanbanColumn status={TaskStatus.TODO} label="Para Fazer" color="border-gray-100 bg-gray-50/50 text-gray-500" />
            <KanbanColumn status={TaskStatus.IN_PROGRESS} label="Em Progresso" color="border-blue-100 bg-blue-50/50 text-blue-500" />
            <KanbanColumn status={TaskStatus.DONE} label="Concluído" color="border-green-100 bg-green-50/50 text-green-500" />
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  <th className="p-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="p-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Tarefa</th>
                  <th className="p-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Disciplina</th>
                  <th className="p-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Prioridade</th>
                  <th className="p-6 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => (
                  <tr key={task.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                    <td className="p-6">
                      <button
                        onClick={() => updateStatus(task.id, task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE)}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                          task.status === TaskStatus.DONE ? 'bg-green-500 border-green-500' : 'border-gray-200 hover:border-blue-500'
                        }`}
                      >
                        {task.status === TaskStatus.DONE && <CheckSquare size={14} className="text-white" />}
                      </button>
                    </td>
                    <td className="p-6">
                      <p className={`font-medium ${task.status === TaskStatus.DONE ? 'line-through text-gray-300' : 'text-gray-800'}`}>
                        {task.title}
                      </p>
                    </td>
                    <td className="p-6">
                      <span className="text-xs font-bold text-gray-400">
                        {subjects.find(s => s.id === task.subject_id)?.name || 'Geral'}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {task.status === TaskStatus.DONE && (
                          <button onClick={() => handleShareTask(task)} className="p-2 text-gray-300 hover:text-brand-primary transition-colors">
                            <Share2 size={16} />
                          </button>
                        )}
                        <button onClick={() => handleStartEdit(task)} className="p-2 text-gray-300 hover:text-blue-500 transition-colors">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => deleteTask(task.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskManager;
