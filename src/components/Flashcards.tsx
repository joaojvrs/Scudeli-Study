import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { 
  Plus, 
  Search, 
  Trash2, 
  Play, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink,
  Brain,
  Layers,
  Sparkles,
  Zap,
  RotateCcw,
  History,
  XCircle,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Flashcard } from '../types';
import TagPicker from './TagPicker';

const Flashcards = () => {
  const { flashcards, subjects, supabaseUser, tags: globalTags } = useAppContext();
  const [isAdding, setIsAdding] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // New Card Form
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);

  // Review State
  const [reviewCards, setReviewCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const filteredCards = useMemo(() => {
    return flashcards.filter(c => {
      const matchSubject = selectedSubject === 'all' || c.subject_id === selectedSubject;
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = c.front.toLowerCase().includes(searchLower) || 
                          c.back.toLowerCase().includes(searchLower);
      const matchSearchTags = c.tags?.some(tag => tag.toLowerCase().includes(searchLower));
      const matchFilterTags = filterTags.length === 0 || filterTags.every(t => c.tags?.includes(t));
      return matchSubject && (matchSearch || matchSearchTags) && matchFilterTags;
    });
  }, [flashcards, selectedSubject, searchTerm, filterTags]);

  const cardsToReview = useMemo(() => {
    const today = new Date();
    return flashcards.filter(c => new Date(c.next_review || 0) <= today);
  }, [flashcards]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !front || !back || !subjectId) return;

    try {
      await supabase.from('flashcards').insert({
        front,
        back,
        subject_id: subjectId,
        user_id: supabaseUser.id,
        next_review: new Date().toISOString(),
        interval: 0,
        easiness: 2.5,
        repetitions: 0,
        created_at: new Date().toISOString(),
        tags: formTags
      });
      setFront('');
      setBack('');
      setFormTags([]);
      setIsAdding(false);
    } catch (err) {
      handleSupabaseError(err, OperationType.CREATE, 'flashcards');
    }
  };

  const calculateSM2 = (quality: number, interval: number, repetitions: number, easiness: number) => {
    let nextInterval: number;
    let nextRepetitions: number;
    let nextEasiness: number;

    if (quality >= 3) {
      if (repetitions === 0) nextInterval = 1;
      else if (repetitions === 1) nextInterval = 6;
      else nextInterval = Math.round(interval * easiness);
      nextRepetitions = repetitions + 1;
    } else {
      nextRepetitions = 0;
      nextInterval = 1;
    }

    nextEasiness = Math.max(1.3, easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    return {
      interval: nextInterval,
      repetitions: nextRepetitions,
      easiness: nextEasiness
    };
  };

  const handleReview = async (quality: number) => {
    if (!supabaseUser || currentIndex >= reviewCards.length) return;
    const card = reviewCards[currentIndex];
    
    const { interval, repetitions, easiness } = calculateSM2(quality, card.interval, card.repetitions, card.easiness);
    
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    try {
      await supabase.from('flashcards').update({
        interval,
        easiness,
        repetitions,
        next_review: nextReviewDate.toISOString()
      }).eq('id', card.id);
    } catch (err) {
      handleSupabaseError(err, OperationType.UPDATE, `flashcards/${card.id}`);
    }

    if (currentIndex < reviewCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setIsReviewing(false);
      alert('Sessão de revisão concluída!');
    }
  };

  const startReview = () => {
    if (cardsToReview.length === 0) return;
    setReviewCards([...cardsToReview].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setShowAnswer(false);
    setIsReviewing(true);
  };

  if (isReviewing) {
    const card = reviewCards[currentIndex];
    const progress = ((currentIndex + 1) / reviewCards.length) * 100;

    return (
      <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-12">
          <header className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">Sessão de Estudo Ativa</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{subjects.find(s => s.id === card.subject_id)?.name}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="px-6 py-2 bg-white rounded-2xl shadow-sm border border-gray-100 text-sm font-black text-brand-primary">
                {currentIndex + 1} / {reviewCards.length}
              </div>
              <button 
                onClick={() => setIsReviewing(false)}
                className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </header>

          <div className="relative perspective-[2000px] h-[400px] w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex + (showAnswer ? '-back' : '-front')}
                initial={{ rotateX: -20, opacity: 0, scale: 0.9 }}
                animate={{ rotateX: 0, opacity: 1, scale: 1 }}
                exit={{ rotateX: 20, opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                onClick={() => setShowAnswer(!showAnswer)}
                className="absolute inset-0 bg-white rounded-[40px] shadow-2xl p-16 flex flex-col items-center justify-center text-center cursor-pointer border border-gray-100 select-none group"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-gray-100 overflow-hidden rounded-t-[40px]">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${progress}%` }}
                     className="h-full bg-brand-primary shadow-[0_0_15px_rgba(255,59,108,0.5)]"
                   />
                </div>

                <div className="mb-8 p-3 bg-brand-light/50 rounded-2xl text-brand-primary group-hover:scale-110 transition-transform">
                   {showAnswer ? <Zap size={32} /> : <Brain size={32} />}
                </div>

                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 mb-6 font-montserrat">
                  {showAnswer ? 'Solução' : 'Enunciado'}
                </p>
                <h3 className="text-3xl font-bold text-gray-900 leading-[1.4] max-w-md font-montserrat tracking-tight">
                  {showAnswer ? card.back : card.front}
                </h3>
                
                <div className="absolute bottom-10 flex items-center space-x-2 text-gray-300 group-hover:text-brand-primary transition-colors">
                   <RotateCcw size={14} className="animate-spin-slow" />
                   <span className="text-[10px] font-bold uppercase tracking-widest">Toque para virar</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex justify-center h-20">
            <AnimatePresence>
              {showAnswer && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex space-x-6 h-full w-full"
                >
                  <button onClick={() => handleReview(1)} className="flex-1 bg-red-50 text-red-500 rounded-3xl font-black text-xs uppercase tracking-widest border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10">Difícil</button>
                  <button onClick={() => handleReview(3)} className="flex-1 bg-orange-50 text-orange-500 rounded-3xl font-black text-xs uppercase tracking-widest border border-orange-100 hover:bg-orange-500 hover:text-white transition-all shadow-lg shadow-orange-500/10">Bom</button>
                  <button onClick={() => handleReview(5)} className="flex-1 bg-green-50 text-green-500 rounded-3xl font-black text-xs uppercase tracking-widest border border-green-100 hover:bg-green-500 hover:text-white transition-all shadow-lg shadow-green-500/10">Fácil</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center text-brand-primary">
            <Layers size={28} />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Centro de Memorização</h2>
            <p className="text-sm text-gray-500 font-medium font-montserrat">Consolidação de conhecimento via SRS (Spaced Repetition).</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={startReview}
            disabled={cardsToReview.length === 0}
            className={`flex items-center space-x-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl ${
              cardsToReview.length === 0 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                : 'bg-brand-primary text-white hover:scale-105 active:scale-95 shadow-brand-primary/20'
            }`}
          >
            <Play size={16} fill="currentColor" />
            <span>Treinar ({cardsToReview.length})</span>
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className={`p-4 rounded-2xl transition-all border ${
              isAdding ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'
            }`}
          >
            <Plus size={24} />
          </button>
        </div>
      </header>

      {/* Filters & Actions */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Pesquisar nos seus cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-brand-primary/5 transition-all outline-none"
            />
          </div>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-8 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-black text-gray-600 outline-none"
          >
            <option value="all">Todas as Áreas</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="flex items-center space-x-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
           <Filter size={16} className="text-gray-400 ml-2" />
           <div className="flex-1">
              <TagPicker selectedTags={filterTags} onChange={setFilterTags} />
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleAddCard}
            className="bg-white p-10 rounded-[40px] shadow-2xl border border-gray-50 space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Frente (Conceito)</label>
                <textarea
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  placeholder="Ex: Qual o principal mediador da inflamação aguda?"
                  className="w-full p-6 bg-gray-50 border-transparent rounded-[24px] text-sm font-medium focus:bg-white focus:border-brand-primary/20 outline-none min-h-[160px] transition-all border shadow-inner"
                  required
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Verso (Definição)</label>
                <textarea
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  placeholder="Ex: Histamina, liberada principalmente pelos mastócitos."
                  className="w-full p-6 bg-gray-50 border-transparent rounded-[24px] text-sm font-medium focus:bg-white focus:border-brand-primary/20 outline-none min-h-[160px] transition-all border shadow-inner"
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Tags Globais</label>
               <TagPicker selectedTags={formTags} onChange={setFormTags} />
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-gray-50">
               <div className="flex items-center space-x-6 w-full md:w-auto">
                 <div className="space-y-2 flex-1 md:flex-none">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Disciplina</label>
                    <select
                        value={subjectId}
                        onChange={(e) => setSubjectId(e.target.value)}
                        className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-bold border-none outline-none focus:bg-white transition-all shadow-sm"
                        required
                      >
                        <option value="">Selecione...</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                 </div>
               </div>
               <div className="flex items-center space-x-4 w-full md:w-auto">
                  <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-4 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 md:flex-none px-12 py-4 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20">Registrar Card</button>
               </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredCards.map(card => {
           const subject = subjects.find(s => s.id === card.subject_id);
           return (
            <motion.div 
              layout
              key={card.id} 
              className="group bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-6">
                 <div className="flex flex-col space-y-1">
                    <span className="text-[9px] font-black text-brand-primary uppercase tracking-[0.2em]">
                      {subject?.name || 'Geral'}
                    </span>
                 </div>
                 <button 
                  onClick={() => supabase.from('flashcards').delete().eq('id', card.id)}
                  className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                 >
                   <Trash2 size={14} />
                 </button>
              </div>
              
              <p className="text-lg font-bold text-gray-900 leading-tight mb-8 flex-1 font-montserrat tracking-tight line-clamp-4">
                {card.front}
              </p>

              <div className="space-y-4">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <div className="flex items-center space-x-2">
                       <History size={12} />
                       <span>{card.repetitions} reviews</span>
                    </div>
                    <div className="flex items-center space-x-2">
                       <Sparkles size={12} className="text-brand-secondary" />
                       <span className="text-gray-900">{card.easiness.toFixed(1)}x</span>
                    </div>
                 </div>

                 <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                         {new Date(card.next_review) <= new Date() ? 'Para Revisar' : 'Em Dia'}
                       </span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                       {new Date(card.next_review).toLocaleDateString('pt-BR')}
                    </span>
                 </div>
              </div>
            </motion.div>
           );
        })}

        {filteredCards.length === 0 && !isAdding && (
          <div className="col-span-full py-32 bg-gray-50/30 rounded-[40px] border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-12">
             <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-gray-200 mb-8 border border-gray-100">
                <Brain size={40} />
             </div>
             <div className="space-y-2">
                <h4 className="text-xl font-bold text-gray-900">Nenhum card disponível</h4>
                <p className="text-gray-400 text-sm max-w-sm font-medium leading-relaxed">Sua jornada de memorização começa aqui. Crie seu primeiro flashcard para ativar o motor de repetição espaçada.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Flashcards;
