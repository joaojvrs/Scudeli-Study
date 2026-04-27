import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  Trash2, 
  CheckSquare, 
  Clock,
  Layout,
  List as ListIcon,
  Flag,
  Calendar,
  MoreVertical,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, TaskStatus, TaskPriority } from '../types';

const TaskManager = () => {
  const { tasks, subjects, firebaseUser, user } = useAppContext();
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleShareTask = async (task: Task) => {
    if (!firebaseUser || !user) return;
    try {
      const subject = subjects.find(s => s.id === task.subjectId)?.name || 'Geral';
      await addDoc(collection(db, 'posts'), {
        userId: firebaseUser.uid,
        userName: user.name,
        userEmail: user.email,
        content: `Tarefa concluída: ${task.title}. Mais uma meta batida! 🎯`,
        type: 'achievement',
        subjectId: task.subjectId || null,
        createdAt: serverTimestamp(),
        likesCount: 0,
        commentsCount: 0,
        isPublic: true,
        likes: []
      });
      alert('Compartilhado na comunidade!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
    }
  };

  // New Task Form
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [subjectId, setSubjectId] = useState('');
  const [deadline, setDeadline] = useState('');

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !title || !subjectId) return;

    try {
      // 1. Criar a Tarefa
      const taskRef = await addDoc(collection(db, 'tasks'), {
        title,
        priority,
        status: TaskStatus.TODO,
        subjectId,
        userId: firebaseUser.uid,
        deadline: deadline || null,
        createdAt: serverTimestamp()
      });

      // 2. Sincronizar com Agenda (se houver prazo)
      if (deadline) {
        await addDoc(collection(db, 'events'), {
          title: `Tarefa: ${title}`,
          type: 'other',
          start: new Date(deadline).toISOString(),
          end: new Date(new Date(deadline).getTime() + 60 * 60 * 1000).toISOString(), // +1 hora
          userId: firebaseUser.uid,
          subjectId,
          taskId: taskRef.id // Referência cruzada
        });
      }

      setTitle('');
      setDeadline('');
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tasks');
    }
  };

  const updateStatus = async (id: string, status: TaskStatus) => {
    try {
      await updateDoc(doc(db, 'tasks', id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      // 1. Deletar a tarefa
      await deleteDoc(doc(db, 'tasks', id));

      // 2. Tentar deletar o evento associado (se houver)
      // Nota: Em um sistema robusto buscaríamos por taskId, aqui faremos uma busca rápida se necessário ou apenas deixamos o usuário gerenciar.
      // Como não temos um index complexo aqui, vamos encorajar delete via Dashboard ou simplesmente gerenciar no backend se possível.
      // Por agora, o usuário deleta a tarefa.
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${id}`);
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
                       {subjects.find(s => s.id === task.subjectId)?.name || 'Geral'}
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

      {/* New Task Form */}
      {isAdding && (
        <motion.form
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleAddTask}
          className="bg-white p-8 rounded-3xl shadow-xl border border-blue-50 space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="space-y-2 col-span-1 md:col-span-2">
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
             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Prazo / Agenda</label>
                <input 
                  type="datetime-local" 
                  value={deadline} 
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full p-4 bg-gray-50 rounded-xl outline-none text-sm font-medium"
                />
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
                               {subjects.find(s => s.id === task.subjectId)?.name || 'Geral'}
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
