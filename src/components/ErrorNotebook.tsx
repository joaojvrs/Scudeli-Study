import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { ErrorLog } from '../types';
import { 
  XCircle, 
  Trash2, 
  ChevronRight, 
  Zap, 
  AlertCircle,
  Clock,
  BookOpen,
  Search,
  Brain,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ErrorNotebook = () => {
  const { supabaseUser, subjects, errors } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');


  const removeError = async (id: string) => {
    try {
      await supabase.from('errors').delete().eq('id', id);
    } catch (err) {
      handleSupabaseError(err, OperationType.DELETE, `errors/${id}`);
    }
  };

  const toggleLearned = async (id: string, currentStatus: boolean) => {
    try {
      await supabase.from('errors').update({
        is_learned: !currentStatus
      }).eq('id', id);
    } catch (err) {
      handleSupabaseError(err, OperationType.UPDATE, `errors/${id}`);
    }
  };

  const filteredErrors = errors.filter(e => {
    const matchSubject = selectedSubject === 'all' || e.subject_id === selectedSubject;
    const matchSearch = e.context?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSubject && matchSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
            <XCircle size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Caderno de Erros</h2>
            <p className="text-sm text-gray-500 font-medium">Revisão focada nas suas maiores dificuldades.</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 px-6 py-2 bg-red-50 text-red-500 rounded-full text-sm font-bold">
           <AlertCircle size={16} />
           <span>{errors.length} Erros Registrados</span>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por conteúdo do erro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-red-500/5 transition-all"
          />
        </div>
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="px-8 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-gray-600 outline-none"
        >
          <option value="all">Todas as Áreas</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredErrors.map((error, idx) => (
          <motion.div
            key={error.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col md:flex-row md:items-center gap-6"
          >
            <div className="flex-1 space-y-4">
              <div className="flex items-center space-x-3">
                <span className="text-[10px] font-black px-3 py-1 bg-gray-50 text-gray-400 rounded-full uppercase tracking-[0.2em]">
                  {subjects.find(s => s.id === error.subject_id)?.name || 'Geral'}
                </span>
                <span className="flex items-center space-x-1 text-[10px] font-black text-gray-300 uppercase tracking-widest">
                  <Clock size={12} />
                  <span>{new Date(error.answered_at).toLocaleDateString()}</span>
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 leading-relaxed font-montserrat">
                {error.context}
              </p>
              <div className="flex flex-wrap gap-3">
                 <div className="flex items-center space-x-3 px-4 py-2 bg-red-50 rounded-xl border border-red-100">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Opção Errada selecionada:</span>
                    <span className="text-sm font-bold text-red-700">{error.wrong_option_index + 1}</span>
                 </div>
                 <div className="flex items-center space-x-3 px-4 py-2 bg-green-50 rounded-xl border border-green-100">
                    <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Gabarito Correto:</span>
                    <span className="text-sm font-bold text-green-700">{error.correct_option_index + 1}</span>
                 </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
               <button 
                onClick={() => toggleLearned(error.id, !!error.is_learned)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  error.is_learned ? 'bg-green-50 text-green-500' : 'bg-gray-50 text-gray-300 hover:text-green-500 hover:bg-green-50'
                }`}
                title={error.is_learned ? "Marcar como pendente" : "Marcar como aprendido"}
               >
                 <CheckCircle2 size={20} />
               </button>
               <button 
                className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 hover:text-brand-primary hover:bg-brand-light transition-all"
                title="Criar Flashcard deste erro"
               >
                 <Brain size={20} />
               </button>
               <button 
                onClick={() => removeError(error.id)}
                className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
               >
                 <Trash2 size={20} />
               </button>
            </div>
          </motion.div>
        ))}

        {filteredErrors.length === 0 && (
          <div className="py-32 bg-gray-50/50 rounded-[40px] border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 space-y-4">
             <div className="p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
               <XCircle className="text-gray-200" size={64} />
             </div>
             <div className="space-y-1">
               <p className="text-gray-900 font-bold text-xl font-montserrat">Caderno de Erros Vazio</p>
               <p className="text-gray-400 text-sm max-w-sm">Isso é bom! Significa que você está acertando tudo. Seus erros em questões aparecerão aqui automaticamente.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorNotebook;
