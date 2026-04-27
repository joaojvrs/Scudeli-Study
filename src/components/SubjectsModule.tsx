import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  BookOpen, 
  Edit3, 
  Layers,
  Palette,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = [
  '#ff85a1', '#ff9a85', '#ffc785', '#85ffc7', '#85d3ff', '#a185ff', '#ff85ef', '#71717a'
];

const SubjectsModule = () => {
  const { subjects, tasks, notes, flashcards, firebaseUser } = useAppContext();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !name) return;

    try {
      await addDoc(collection(db, 'subjects'), {
        name,
        color,
        userId: firebaseUser.uid,
        createdAt: serverTimestamp()
      });
      setName('');
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'subjects');
    }
  };

  const getStats = (subjectId: string) => ({
    tasks: tasks.filter(t => t.subjectId === subjectId).length,
    notes: notes.filter(n => n.subjectId === subjectId).length,
    cards: flashcards.filter(c => c.subjectId === subjectId).length
  });

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
                 <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => deleteDoc(doc(db, 'subjects', subject.id))}
                      className="p-2 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                       <Trash2 size={18} />
                    </button>
                 </div>
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

              <button className="w-full mt-6 py-3 bg-brand-bg rounded-xl text-gray-400 font-bold text-xs hover:bg-brand-light hover:text-brand-primary transition-all flex items-center justify-center space-x-2">
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
    </div>
  );
};

export default SubjectsModule;
