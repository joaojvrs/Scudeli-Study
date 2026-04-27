import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Timer, 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  Target, 
  Zap, 
  Waves, 
  FileText, 
  BrainCircuit, 
  HelpCircle, 
  BookOpen,
  Trophy
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, trackAnalytics, handleSupabaseError, OperationType } from '../lib/supabase';

interface FocusModeProps {
  defaultTargetId?: string | null;
  onComplete?: () => void;
}

const FocusMode = ({ defaultTargetId, onComplete }: FocusModeProps) => {
  const { subjects, supabaseUser, notes, flashcards, questions, materials } = useAppContext();
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [focusType, setFocusType] = useState<'pdf' | 'card' | 'note' | 'none'>('none');
  const [selectedContentId, setSelectedContentId] = useState<string | null>(defaultTargetId || null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [distractionFree, setDistractionFree] = useState(true);

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleSessionCompleteSpace();
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const handleSessionCompleteSpace = async () => {
    setIsActive(false);
    if (mode === 'work' && supabaseUser) {
      const durationMinutes = 25;
      try {
        await supabase.from('studySessions').insert({
          userId: supabaseUser.id,
          subjectId: selectedSubject || 'general',
          duration: durationMinutes,
          timestamp: new Date().toISOString(),
          type: 'focus',
          focusType,
          contentId: selectedContentId
        });

        // Track Daily Analytics
        await trackAnalytics(supabaseUser.id, {
          studySeconds: durationMinutes * 60,
          subjectId: selectedSubject || 'general'
        });

        if (onComplete) onComplete();
      } catch (e) {
        console.error(e);
      }
    }
    setMode(mode === 'work' ? 'break' : 'work');
    setTimeLeft(mode === 'work' ? 5 * 60 : 25 * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedContent = () => {
    if (!selectedContentId) return null;
    if (focusType === 'note') return notes.find(n => n.id === selectedContentId);
    if (focusType === 'card') return flashcards.find(f => f.id === selectedContentId);
    if (focusType === 'pdf') return materials.find(m => m.id === selectedContentId);
    return null;
  };

  const progress = ((mode === 'work' ? 25 * 60 : 5 * 60) - timeLeft) / (mode === 'work' ? 25 * 60 : 5 * 60);

  return (
    <div className="fixed inset-0 min-h-screen bg-gray-950 flex flex-col items-center justify-center z-50 p-6 overflow-hidden">
      {/* Distraction Blocking Overlay */}
      {isActive && distractionFree && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-40 bg-gray-950 pointer-events-none"
          style={{ opacity: 0.2 }}
        />
      )}

      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-primary rounded-full blur-[128px] animate-pulse delay-1000" />
      </div>

      <header className="absolute top-8 left-0 right-0 px-12 flex justify-between items-center w-full z-50">
        <div className="flex items-center space-x-4">
          <img src="/logomanu.png" alt="Logo" className="app-logo h-8" referrerPolicy="no-referrer" />
          <div className="flex items-center space-x-2 text-white/50 border-l border-white/10 pl-4">
            <Zap size={20} className="text-brand-primary" />
            <span className="text-sm font-medium tracking-widest uppercase">Deep Work Mode</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
           <button 
             onClick={() => setDistractionFree(!distractionFree)}
             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
               distractionFree ? 'bg-brand-primary text-white' : 'bg-white/5 text-white/40'
             }`}
           >
             Focus Lock: {distractionFree ? 'ON' : 'OFF'}
           </button>
           <button 
             onClick={() => setShowExitConfirm(true)}
             className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all"
           >
             <X size={20} />
           </button>
        </div>
      </header>

      <div className={`max-w-4xl w-full grid grid-cols-1 ${isActive ? 'lg:grid-cols-12' : ''} gap-12 items-center transition-all duration-700 z-50`}>
        {/* Timer Section */}
        <div className={`${isActive ? 'lg:col-span-12' : ''} text-center space-y-12`}>
          <div className="space-y-4">
             <h2 className="text-white/40 text-sm font-medium tracking-widest uppercase">
              {mode === 'work' ? 'Deep Work' : 'Refilmagem'}
             </h2>
             
             <div className="relative inline-block">
                <svg className="w-64 h-64 md:w-80 md:h-80 transform -rotate-90">
                  <circle
                    cx="160"
                    cy="160"
                    r="150"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-white/5"
                  />
                  <motion.circle
                    cx="160"
                    cy="160"
                    r="150"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 150}
                    initial={{ strokeDashoffset: 2 * Math.PI * 150 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 150 * (1 - progress) }}
                    className="text-brand-primary"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-6xl md:text-8xl font-black text-white tracking-tighter tabular-nums leading-none">
                    {formatTime(timeLeft)}
                  </span>
                </div>
             </div>
          </div>

          {!isActive && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Disciplina</p>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white px-6 py-4 rounded-2xl outline-none focus:border-brand-primary transition-all w-full text-sm font-bold"
                  >
                    <option value="" className="bg-gray-900">Estudo Geral</option>
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.id} className="bg-gray-900">{sub.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Conteúdo de Foco</p>
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                    <button 
                      onClick={() => setFocusType('pdf')}
                      className={`flex-1 py-3 rounded-xl flex flex-col items-center space-y-1 transition-all ${focusType === 'pdf' ? 'bg-brand-primary text-white' : 'text-white/40 hover:text-white'}`}
                    >
                      <BookOpen size={16} />
                      <span className="text-[10px] font-bold">PDF</span>
                    </button>
                    <button 
                      onClick={() => setFocusType('card')}
                      className={`flex-1 py-3 rounded-xl flex flex-col items-center space-y-1 transition-all ${focusType === 'card' ? 'bg-brand-primary text-white' : 'text-white/40 hover:text-white'}`}
                    >
                      <BrainCircuit size={16} />
                      <span className="text-[10px] font-bold">CARDS</span>
                    </button>
                    <button 
                      onClick={() => setFocusType('note')}
                      className={`flex-1 py-3 rounded-xl flex flex-col items-center space-y-1 transition-all ${focusType === 'note' ? 'bg-brand-primary text-white' : 'text-white/40 hover:text-white'}`}
                    >
                      <FileText size={16} />
                      <span className="text-[10px] font-bold">NOTAS</span>
                    </button>
                  </div>
                </div>
              </div>

              {focusType !== 'none' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                   <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Selecionar {focusType === 'pdf' ? 'Material' : focusType === 'card' ? 'Deck' : 'Resumo'}</p>
                   <select 
                     value={selectedContentId || ''}
                     onChange={(e) => setSelectedContentId(e.target.value)}
                     className="bg-white/5 border border-white/10 text-white px-6 py-4 rounded-2xl outline-none focus:border-brand-primary transition-all w-full text-sm font-bold"
                   >
                     <option value="" className="bg-gray-900">Escolha um item...</option>
                     {focusType === 'pdf' && (materials || []).map(m => <option key={m.id} value={m.id} className="bg-gray-900">{m.title}</option>)}
                     {focusType === 'note' && (notes || []).map(n => <option key={n.id} value={n.id} className="bg-gray-900">{n.title}</option>)}
                     {focusType === 'card' && Array.from(new Set((subjects || []).map(s => s.name))).map(sname => <option key={sname} value={sname} className="bg-gray-900">{sname}</option>)}
                   </select>
                </div>
              )}

              <div className="flex items-center justify-center space-x-6 pt-8">
                <button
                   onClick={() => {
                     setIsActive(false);
                     setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
                   }}
                   className="p-5 bg-white/5 hover:bg-white/10 rounded-full text-white/50 transition-all active:scale-95 border border-white/5"
                >
                  <RotateCcw size={24} />
                </button>
                <button
                   onClick={() => setIsActive(!isActive)}
                   className="w-24 h-24 bg-brand-primary hover:bg-brand-primary/90 rounded-full flex items-center justify-center text-white shadow-2xl shadow-brand-primary/40 transition-all active:scale-90"
                >
                  {isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-2" />}
                </button>
                <button
                   className="p-5 bg-white/5 hover:bg-white/10 rounded-full text-white/50 transition-all active:scale-95 border border-white/5"
                >
                  <Target size={24} />
                </button>
              </div>
            </div>
          )}

          {isActive && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
               <button
                  onClick={() => setIsActive(!isActive)}
                  className="px-12 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 rounded-full font-black uppercase tracking-[0.3em] text-[10px] transition-all"
               >
                 Interromper Fluxo
               </button>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-12 flex space-x-12 z-50">
         <div className="text-center group cursor-pointer">
            <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-white/10 transition-all mb-2">
               <Waves size={20} className="text-white/40 group-hover:text-cyan-400" />
            </div>
            <span className="text-[10px] text-white/30 uppercase tracking-widest">Som Ambiente</span>
         </div>
      </div>

      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-6"
          >
            <div className="bg-gray-900 border border-white/5 p-8 rounded-3xl max-w-sm w-full space-y-6 text-center shadow-2xl">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <Target className="text-red-500" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-white text-xl font-bold">Abandonar Foco?</h3>
                <p className="text-white/40 text-sm">O tempo acumulado nesta sessão não será registrado se você sair agora.</p>
              </div>
              <div className="flex flex-col space-y-3">
                <button 
                  onClick={() => window.location.reload()} 
                  className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
                >
                  Confirmar Saída
                </button>
                <button 
                  onClick={() => setShowExitConfirm(false)}
                  className="w-full bg-white/5 text-white/60 py-3 rounded-xl font-bold hover:bg-white/10 transition-colors"
                >
                  Continuar Focado
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FocusMode;
