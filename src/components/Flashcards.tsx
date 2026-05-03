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
  Brain,
  Layers,
  Sparkles,
  Zap,
  RotateCcw,
  History,
  XCircle,
  Filter,
  ImagePlus,
  Loader2,
  BookOpen,
  Clock,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Flashcard, Subject } from '../types';
import TagPicker from './TagPicker';

type View = 'subjects' | 'children' | 'cards';

interface Props {
  initialSubjectId?: string;
}

const Flashcards = ({ initialSubjectId }: Props) => {
  const { flashcards, subjects, supabaseUser, refreshAllData } = useAppContext();

  // Navigation state
  const [view, setView] = useState<View>(initialSubjectId ? 'cards' : 'subjects');
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(initialSubjectId ?? null);

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [imageFrontUrl, setImageFrontUrl] = useState<string | null>(null);
  const [imageBackUrl, setImageBackUrl]   = useState<string | null>(null);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack]   = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // Review state
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewCards, setReviewCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const today = new Date();

  // ── Derived data ────────────────────────────────────────────────────────

  const parentSubjects = useMemo(
    () => subjects.filter(s => !s.parent_id),
    [subjects]
  );

  const childrenByParent = useMemo(() => {
    const map: Record<string, Subject[]> = {};
    for (const s of subjects) {
      if (s.parent_id) {
        if (!map[s.parent_id]) map[s.parent_id] = [];
        map[s.parent_id].push(s);
      }
    }
    return map;
  }, [subjects]);

  const cardsBySubject = useMemo(() => {
    const map: Record<string, Flashcard[]> = {};
    for (const card of flashcards) {
      const key = card.subject_id ?? '__none__';
      if (!map[key]) map[key] = [];
      map[key].push(card);
    }
    return map;
  }, [flashcards]);

  // cards due per subject_id (direct, not aggregated)
  const dueBySubject = useMemo(() => {
    const map: Record<string, number> = {};
    for (const card of flashcards) {
      if (new Date(card.next_review || 0) <= today) {
        const key = card.subject_id ?? '__none__';
        map[key] = (map[key] ?? 0) + 1;
      }
    }
    return map;
  }, [flashcards]);

  // aggregated stats for a subject (own + all children)
  const getAggregated = (subjectId: string) => {
    const ownCards = cardsBySubject[subjectId] ?? [];
    const children = childrenByParent[subjectId] ?? [];
    const childCards = children.flatMap(c => cardsBySubject[c.id] ?? []);
    const allCards = [...ownCards, ...childCards];
    const due = allCards.filter(c => new Date(c.next_review || 0) <= today);
    return { total: allCards.length, due: due.length, allCards, dueCards: due };
  };

  const allDueCards = useMemo(
    () => flashcards.filter(c => new Date(c.next_review || 0) <= today),
    [flashcards]
  );

  const activeSubjectCards = useMemo(() => {
    if (!activeSubjectId) return [];
    return (cardsBySubject[activeSubjectId] ?? []).filter(c => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        c.front.toLowerCase().includes(searchLower) ||
        c.back.toLowerCase().includes(searchLower) ||
        c.tags?.some(t => t.toLowerCase().includes(searchLower));
      const matchFilterTags =
        filterTags.length === 0 || filterTags.every(t => c.tags?.includes(t));
      return matchSearch && matchFilterTags;
    });
  }, [activeSubjectId, cardsBySubject, searchTerm, filterTags]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const uploadFlashcardImage = async (file: File, side: 'front' | 'back') => {
    if (!supabaseUser) return;
    const setUploading = side === 'front' ? setUploadingFront : setUploadingBack;
    const setUrl       = side === 'front' ? setImageFrontUrl  : setImageBackUrl;
    setUploading(true);
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `flashcard-images/${supabaseUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('materials').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('materials').getPublicUrl(path);
      setUrl(data.publicUrl);
    } catch (err) {
      console.error('Erro ao fazer upload da imagem:', err);
    } finally {
      setUploading(false);
    }
  };

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
        tags: formTags,
        image_front: imageFrontUrl,
        image_back: imageBackUrl,
      });
      setFront('');
      setBack('');
      setFormTags([]);
      setImageFrontUrl(null);
      setImageBackUrl(null);
      setIsAdding(false);
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.CREATE, 'flashcards');
    }
  };

  const calculateSM2 = (
    quality: number,
    interval: number,
    repetitions: number,
    easiness: number
  ) => {
    let nextInterval: number;
    let nextRepetitions: number;
    if (quality >= 3) {
      if (repetitions === 0) nextInterval = 1;
      else if (repetitions === 1) nextInterval = 6;
      else nextInterval = Math.round(interval * easiness);
      nextRepetitions = repetitions + 1;
    } else {
      nextRepetitions = 0;
      nextInterval = 1;
    }
    const nextEasiness = Math.max(
      1.3,
      easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
    return { interval: nextInterval, repetitions: nextRepetitions, easiness: nextEasiness };
  };

  const handleReview = async (quality: number) => {
    if (!supabaseUser || currentIndex >= reviewCards.length) return;
    const card = reviewCards[currentIndex];
    const { interval, repetitions, easiness } = calculateSM2(
      quality, card.interval, card.repetitions, card.easiness
    );
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    try {
      await supabase.from('flashcards').update({
        interval,
        easiness,
        repetitions,
        next_review: nextReviewDate.toISOString()
      }).eq('id', card.id);
      await refreshAllData();
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

  const startReview = (cards: Flashcard[]) => {
    if (cards.length === 0) return;
    setReviewCards([...cards].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setShowAnswer(false);
    setIsReviewing(true);
  };

  const openParent = (id: string) => {
    setActiveParentId(id);
    setSearchTerm('');
    setFilterTags([]);
    setView('children');
  };

  const openSubject = (id: string) => {
    setActiveSubjectId(id);
    setSearchTerm('');
    setFilterTags([]);
    setIsAdding(false);
    setView('cards');
  };

  const goBack = () => {
    setIsAdding(false);
    setSearchTerm('');
    setFilterTags([]);
    if (view === 'cards') {
      const parent = subjects.find(s => s.id === activeSubjectId)?.parent_id;
      if (parent) {
        setActiveParentId(parent);
        setView('children');
      } else {
        setView('subjects');
        setActiveSubjectId(null);
      }
    } else {
      setView('subjects');
      setActiveParentId(null);
    }
  };

  // ── Review Mode ───────────────────────────────────────────────────────────
  if (isReviewing) {
    const card = reviewCards[currentIndex];
    const progress = ((currentIndex + 1) / reviewCards.length) * 100;
    return (
      <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-12">
          <header className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">Sessão de Estudo Ativa</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                {subjects.find(s => s.id === card.subject_id)?.name}
              </p>
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
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
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
                {!showAnswer && card.image_front && (
                  <img src={card.image_front} alt="" className="max-w-xs max-h-48 rounded-2xl object-contain mt-6" />
                )}
                {showAnswer && card.image_back && (
                  <img src={card.image_back} alt="" className="max-w-xs max-h-48 rounded-2xl object-contain mt-6" />
                )}
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

  // ── Cards View ────────────────────────────────────────────────────────────
  if (view === 'cards' && activeSubjectId) {
    const activeSubject = subjects.find(s => s.id === activeSubjectId);
    const parentSubject = activeSubject?.parent_id
      ? subjects.find(s => s.id === activeSubject.parent_id)
      : null;
    const dueCount = dueBySubject[activeSubjectId] ?? 0;
    const dueCards = (cardsBySubject[activeSubjectId] ?? []).filter(
      c => new Date(c.next_review || 0) <= today
    );
    const accent = activeSubject?.color ?? '#6b7280';

    return (
      <div className="max-w-6xl mx-auto space-y-10 pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-4">
            <button
              onClick={goBack}
              className="p-3 bg-gray-50 rounded-2xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all border border-gray-100"
            >
              <ChevronLeft size={22} />
            </button>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${accent}22` }}
            >
              <BookOpen size={28} style={{ color: accent }} />
            </div>
            <div className="space-y-1">
              {parentSubject && (
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <span>{parentSubject.name}</span>
                  <ChevronRight size={10} />
                </p>
              )}
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{activeSubject?.name}</h2>
              <p className="text-sm text-gray-500 font-medium font-montserrat">
                {cardsBySubject[activeSubjectId]?.length ?? 0} cards · {dueCount} para revisar
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => startReview(dueCards)}
              disabled={dueCount === 0}
              className={`flex items-center space-x-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl ${
                dueCount === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-brand-primary text-white hover:scale-105 active:scale-95 shadow-brand-primary/20'
              }`}
            >
              <Play size={16} fill="currentColor" />
              <span>Treinar ({dueCount})</span>
            </button>
            <button
              onClick={() => { setSubjectId(activeSubjectId); setIsAdding(!isAdding); }}
              className={`p-4 rounded-2xl transition-all border ${
                isAdding ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'
              }`}
            >
              <Plus size={24} />
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="space-y-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Pesquisar nesta matéria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-brand-primary/5 transition-all outline-none"
            />
          </div>
          <div className="flex items-center space-x-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <Filter size={16} className="text-gray-400 ml-2" />
            <div className="flex-1">
              <TagPicker selectedTags={filterTags} onChange={setFilterTags} />
            </div>
          </div>
        </div>

        {/* Add Form */}
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
                  {imageFrontUrl ? (
                    <div className="relative w-fit">
                      <img src={imageFrontUrl} alt="Frente" className="max-h-40 rounded-2xl object-cover border border-gray-100" />
                      <button
                        type="button"
                        onClick={() => setImageFrontUrl(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl text-xs font-bold text-gray-400 hover:bg-gray-100 transition-all border border-dashed border-gray-200">
                      {uploadingFront ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                      {uploadingFront ? 'Enviando...' : 'Adicionar imagem'}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingFront} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFlashcardImage(f, 'front'); e.target.value = ''; }} />
                    </label>
                  )}
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
                  {imageBackUrl ? (
                    <div className="relative w-fit">
                      <img src={imageBackUrl} alt="Verso" className="max-h-40 rounded-2xl object-cover border border-gray-100" />
                      <button
                        type="button"
                        onClick={() => setImageBackUrl(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl text-xs font-bold text-gray-400 hover:bg-gray-100 transition-all border border-dashed border-gray-200">
                      {uploadingBack ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                      {uploadingBack ? 'Enviando...' : 'Adicionar imagem'}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingBack} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFlashcardImage(f, 'back'); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Tags Globais</label>
                <TagPicker selectedTags={formTags} onChange={setFormTags} />
              </div>
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-50">
                <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-4 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600 transition-colors">Cancelar</button>
                <button type="submit" className="px-12 py-4 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20">Registrar Card</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {activeSubjectCards.map(card => (
            <motion.div
              layout
              key={card.id}
              className="group bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden flex flex-col h-full"
            >
              <div className="flex justify-end mb-4">
                <button
                  onClick={async () => { await supabase.from('flashcards').delete().eq('id', card.id); await refreshAllData(); }}
                  className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {card.image_front && (
                <img src={card.image_front} alt="" className="w-full h-28 object-cover rounded-2xl mb-4" />
              )}

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
                    <div className={`w-1.5 h-1.5 rounded-full ${new Date(card.next_review) <= today ? 'bg-brand-primary' : 'bg-green-500'}`} />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      {new Date(card.next_review) <= today ? 'Para Revisar' : 'Em Dia'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {new Date(card.next_review).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

          {activeSubjectCards.length === 0 && !isAdding && (
            <div className="col-span-full py-32 bg-gray-50/30 rounded-[40px] border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-12">
              <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-gray-200 mb-8 border border-gray-100">
                <Brain size={40} />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-gray-900">Nenhum card aqui</h4>
                <p className="text-gray-400 text-sm max-w-sm font-medium leading-relaxed">
                  Crie o primeiro flashcard para esta matéria usando o botão acima.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Children View (sub-subjects of a parent) ──────────────────────────────
  if (view === 'children' && activeParentId) {
    const parentSubject = subjects.find(s => s.id === activeParentId);
    const children = childrenByParent[activeParentId] ?? [];
    const { total: aggTotal, due: aggDue, dueCards: aggDueCards } = getAggregated(activeParentId);
    const accent = parentSubject?.color ?? '#6b7280';

    const allSections: Array<{ subject: Subject; own: boolean }> = [
      ...(cardsBySubject[activeParentId]?.length ? [{ subject: parentSubject!, own: true }] : []),
      ...children.map(c => ({ subject: c, own: false }))
    ];

    return (
      <div className="max-w-6xl mx-auto space-y-10 pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-4">
            <button
              onClick={goBack}
              className="p-3 bg-gray-50 rounded-2xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all border border-gray-100"
            >
              <ChevronLeft size={22} />
            </button>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${accent}22` }}
            >
              <FolderOpen size={28} style={{ color: accent }} />
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{parentSubject?.name}</h2>
              <p className="text-sm text-gray-500 font-medium font-montserrat">
                {aggTotal} cards no total · {aggDue} para revisar
              </p>
            </div>
          </div>
          <button
            onClick={() => startReview(aggDueCards)}
            disabled={aggDue === 0}
            className={`flex items-center space-x-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl ${
              aggDue === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                : 'bg-brand-primary text-white hover:scale-105 active:scale-95 shadow-brand-primary/20'
            }`}
          >
            <Play size={16} fill="currentColor" />
            <span>Treinar Tudo ({aggDue})</span>
          </button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(cardsBySubject[activeParentId]?.length ?? 0) > 0 && (
            <SubjectTile
              subject={parentSubject!}
              total={cardsBySubject[activeParentId]?.length ?? 0}
              due={dueBySubject[activeParentId] ?? 0}
              label="Cards gerais"
              onClick={() => openSubject(activeParentId)}
              today={today}
            />
          )}

          {children.map(child => {
            const total = cardsBySubject[child.id]?.length ?? 0;
            const due = dueBySubject[child.id] ?? 0;
            return (
              <SubjectTile
                key={child.id}
                subject={child}
                total={total}
                due={due}
                onClick={() => openSubject(child.id)}
                today={today}
              />
            );
          })}

          {allSections.length === 0 && (
            <div className="col-span-full py-24 bg-gray-50/30 rounded-[40px] border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-12">
              <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-gray-200 mb-8 border border-gray-100">
                <Brain size={40} />
              </div>
              <h4 className="text-xl font-bold text-gray-900">Nenhum flashcard criado</h4>
              <p className="text-gray-400 text-sm max-w-sm font-medium leading-relaxed mt-2">
                Clique numa sub-área para criar flashcards.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Subjects View (top level) ─────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center text-brand-primary">
            <Layers size={28} />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Centro de Memorização</h2>
            <p className="text-sm text-gray-500 font-medium font-montserrat">
              Consolidação de conhecimento via SRS (Spaced Repetition).
            </p>
          </div>
        </div>
        <button
          onClick={() => startReview(allDueCards)}
          disabled={allDueCards.length === 0}
          className={`flex items-center space-x-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl ${
            allDueCards.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              : 'bg-brand-primary text-white hover:scale-105 active:scale-95 shadow-brand-primary/20'
          }`}
        >
          <Play size={16} fill="currentColor" />
          <span>Treinar Tudo ({allDueCards.length})</span>
        </button>
      </header>

      {parentSubjects.length === 0 ? (
        <div className="py-32 bg-gray-50/30 rounded-[40px] border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-12">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-gray-200 mb-8 border border-gray-100">
            <Brain size={40} />
          </div>
          <h4 className="text-xl font-bold text-gray-900">Nenhuma matéria cadastrada</h4>
          <p className="text-gray-400 text-sm max-w-sm font-medium leading-relaxed mt-2">
            Crie matérias no módulo de pastas para começar a adicionar flashcards.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {parentSubjects.map(subject => {
            const children = childrenByParent[subject.id] ?? [];
            const hasChildren = children.length > 0;
            const { total, due, dueCards: sbjDueCards } = getAggregated(subject.id);
            const accent = subject.color ?? '#6b7280';

            if (total === 0) {
              return (
                <motion.button
                  key={subject.id}
                  layout
                  onClick={() => hasChildren ? openParent(subject.id) : openSubject(subject.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-left bg-gray-50/60 p-8 rounded-[32px] border border-dashed border-gray-200 hover:border-brand-primary/30 hover:bg-white transition-all group"
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 opacity-40" style={{ backgroundColor: `${accent}22` }}>
                    {hasChildren ? <FolderOpen size={22} style={{ color: accent }} /> : <BookOpen size={22} style={{ color: accent }} />}
                  </div>
                  <h3 className="text-xl font-bold text-gray-400 tracking-tight mb-1 group-hover:text-gray-600 transition-colors">{subject.name}</h3>
                  <p className="text-sm text-gray-300 font-medium">Sem cards ainda</p>
                </motion.button>
              );
            }

            return (
              <motion.button
                key={subject.id}
                layout
                onClick={() => hasChildren ? openParent(subject.id) : openSubject(subject.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-left bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 rounded-t-[32px]" style={{ backgroundColor: accent }} />

                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${accent}22` }}>
                    {hasChildren ? <FolderOpen size={22} style={{ color: accent }} /> : <BookOpen size={22} style={{ color: accent }} />}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {due > 0 && (
                      <span className="flex items-center space-x-1 px-3 py-1 bg-brand-light rounded-full text-[10px] font-black uppercase tracking-widest text-brand-primary">
                        <Clock size={10} />
                        <span>{due} p/ revisar</span>
                      </span>
                    )}
                    {hasChildren && (
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {children.length} sub-área{children.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 tracking-tight mb-1 group-hover:text-brand-primary transition-colors">
                  {subject.name}
                </h3>
                <p className="text-sm text-gray-400 font-medium mb-6">
                  {total} {total === 1 ? 'card' : 'cards'}
                </p>

                {hasChildren && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {children.slice(0, 3).map(c => (
                      <span
                        key={c.id}
                        className="px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wide"
                        style={{ backgroundColor: `${c.color ?? accent}22`, color: c.color ?? accent }}
                      >
                        {c.name}
                      </span>
                    ))}
                    {children.length > 3 && (
                      <span className="px-3 py-1 rounded-xl bg-gray-100 text-gray-400 text-[10px] font-bold uppercase tracking-wide">
                        +{children.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      backgroundColor: accent,
                      width: total > 0 ? `${Math.max(5, ((total - due) / total) * 100)}%` : '0%'
                    }}
                  />
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">
                  {total - due} em dia · {due} pendente{due !== 1 ? 's' : ''}
                </p>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Reusable SubjectTile ──────────────────────────────────────────────────────
interface SubjectTileProps {
  subject: Subject;
  total: number;
  due: number;
  label?: string;
  onClick: () => void;
  today: Date;
}

const SubjectTile = ({ subject, total, due, label, onClick, today }: SubjectTileProps) => {
  const accent = subject.color ?? '#6b7280';
  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="text-left bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 rounded-t-[32px]" style={{ backgroundColor: accent }} />

      <div className="flex items-start justify-between mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${accent}22` }}>
          <BookOpen size={22} style={{ color: accent }} />
        </div>
        {due > 0 && (
          <span className="flex items-center space-x-1 px-3 py-1 bg-brand-light rounded-full text-[10px] font-black uppercase tracking-widest text-brand-primary">
            <Clock size={10} />
            <span>{due} p/ revisar</span>
          </span>
        )}
      </div>

      <h3 className="text-xl font-bold text-gray-900 tracking-tight mb-1 group-hover:text-brand-primary transition-colors">
        {label ?? subject.name}
      </h3>
      <p className="text-sm text-gray-400 font-medium mb-6">
        {total === 0 ? 'Sem cards ainda' : `${total} ${total === 1 ? 'card' : 'cards'}`}
      </p>

      {total > 0 && (
        <>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                backgroundColor: accent,
                width: `${Math.max(5, ((total - due) / total) * 100)}%`
              }}
            />
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">
            {total - due} em dia · {due} pendente{due !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </motion.button>
  );
};

export default Flashcards;
