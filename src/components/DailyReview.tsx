import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAppContext } from '../contexts/AppContext';
import { Flashcard, ErrorLog } from '../types';
import { 
  RotateCcw, 
  Brain, 
  XCircle, 
  ChevronRight, 
  Zap, 
  CheckCircle2,
  CalendarDays,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DailyReview = () => {
  const { firebaseUser, subjects } = useAppContext();
  const [reviewQueue, setReviewQueue] = useState<{ id: string; type: 'flashcard' | 'error'; data: any }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;

    // 1. Fetch Due Flashcards
    const flashQ = query(
      collection(db, 'flashcards'), 
      where('userId', '==', firebaseUser.uid),
      where('nextReview', '<=', new Date().toISOString())
    );

    // 2. Fetch Recent Errors (unlearned)
    const errorQ = query(
      collection(db, 'errors'),
      where('userId', '==', firebaseUser.uid),
      where('isLearned', '!=', true),
      orderBy('isLearned'),
      orderBy('answeredAt', 'desc'),
      limit(10)
    );

    const unsubFlash = onSnapshot(flashQ, (snapshot) => {
      const cards = snapshot.docs.map(doc => ({ id: doc.id, type: 'flashcard' as const, data: doc.data() }));
      updateQueue(cards, 'flashcard');
    });

    const unsubError = onSnapshot(errorQ, (snapshot) => {
      const errors = snapshot.docs.map(doc => ({ id: doc.id, type: 'error' as const, data: doc.data() }));
      updateQueue(errors, 'error');
    });

    return () => { unsubFlash(); unsubError(); };
  }, [firebaseUser]);

  const updateQueue = (items: any[], type: 'flashcard' | 'error') => {
    setReviewQueue(prev => {
      const otherType = prev.filter(i => i.type !== type);
      const combined = [...otherType, ...items];
      // Shuffle slightly or sort by urgency
      return combined.sort((a, b) => {
        if (a.type === 'error' && b.type === 'flashcard') return -1;
        return 0;
      });
    });
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="flex items-center space-x-6 relative z-10">
          <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
            <RotateCcw size={32} />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Revisão do Dia</h2>
            <p className="text-sm text-gray-500 font-medium">Otimizamos sua sessão de hoje baseado em erros recentes e SRS.</p>
          </div>
        </div>

        <div className="flex items-center space-x-4 relative z-10">
           <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Itens na Fila</p>
              <p className="text-2xl font-bold text-brand-primary">{reviewQueue.length}</p>
           </div>
           <button className="bg-brand-primary text-white h-16 px-10 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20 hover:scale-105 transition-all">
              Começar Review
           </button>
        </div>

        {/* Decor */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-brand-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
           <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-900">Cards Aguardando</h4>
              <Brain size={18} className="text-brand-primary" />
           </div>
           <div className="space-y-4">
              {reviewQueue.filter(i => i.type === 'flashcard').length > 0 ? (
                reviewQueue.filter(i => i.type === 'flashcard').slice(0, 3).map((item, idx) => (
                  <div key={item.id} className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700 truncate max-w-[200px]">{item.data.front}</span>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 italic">Nenhum card para revisar agora.</p>
              )}
           </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
           <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-900">Erros Recentes</h4>
              <XCircle size={18} className="text-red-500" />
           </div>
           <div className="space-y-4">
              {reviewQueue.filter(i => i.type === 'error').length > 0 ? (
                reviewQueue.filter(i => i.type === 'error').slice(0, 3).map((item, idx) => (
                  <div key={item.id} className="p-4 bg-red-50/50 rounded-2xl flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700 truncate max-w-[200px]">{item.data.context}</span>
                    <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Pendente</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 italic">Caderno de erros limpo!</p>
              )}
           </div>
        </div>
      </div>

      <div className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-sm flex flex-col items-center text-center space-y-8">
        <div className="w-20 h-20 bg-brand-light rounded-[32px] flex items-center justify-center text-brand-primary">
          <Zap size={40} />
        </div>
        <div className="max-w-lg space-y-4">
          <h3 className="text-2xl font-bold tracking-tight text-gray-900">Sua mente está pronta?</h3>
          <p className="text-gray-500 font-medium font-montserrat">Consolidar o que você errou ou o que está esquecendo é a única forma de garantir o 10 na prova. Comece agora sua sessão de hiper-foco.</p>
        </div>
        <button className="bg-gray-900 text-white px-16 py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:-translate-y-1 transition-all">
          Iniciar Sessão Completa
        </button>
      </div>
    </div>
  );
};

export default DailyReview;
