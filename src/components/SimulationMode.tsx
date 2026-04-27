import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType, trackAnalytics } from '../lib/supabase';
import { Question, Simulation } from '../types';
import {
  Timer,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  BarChart3,
  Loader2,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SimulationMode = ({ onExit }: { onExit: () => void }) => {
  const { session, subjects } = useAppContext();
  const [step, setStep] = useState<'config' | 'exam' | 'result'>('config');

  // Config State
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(20);

  // Exam State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ [qId: string]: number }>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulationResult, setSimulationResult] = useState<Simulation | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (step === 'exam' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev: number) => {
          if (prev <= 1) {
            finishExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const startExam = async () => {
    if (!session) return;
    setIsSubmitting(true);

    try {
      let query = supabase.from('questions').select('*').eq('user_id', session.user.id);
      if (selectedSubject !== 'all') {
        query = query.eq('subject_id', selectedSubject);
      }

      const { data, error } = await query;
      if (error) handleSupabaseError(error, OperationType.LIST, 'questions');

      const allQs = (data || []) as Question[];

      if (allQs.length === 0) {
        alert("Nenhuma questão encontrada para este critério.");
        setIsSubmitting(false);
        return;
      }

      const shuffled = allQs.sort(() => 0.5 - Math.random()).slice(0, questionCount);
      setQuestions(shuffled);
      setTimeLeft(timeLimit * 60);
      setStep('exam');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishExam = async () => {
    if (!session) return;
    setIsSubmitting(true);
    let correct = 0;
    questions.forEach((q: Question) => {
      if (userAnswers[q.id] === q.answer_index) correct++;
    });

    const score = Math.round((correct / questions.length) * 100);
    const duration = (timeLimit * 60) - timeLeft;

    const simData = {
      user_id: session.user.id,
      subject_id: selectedSubject,
      count: questions.length,
      time_limit: timeLimit,
      question_ids: questions.map(q => q.id),
      user_answers: userAnswers,
      score,
      correct_count: correct,
      duration,
    };

    try {
      const { data, error } = await supabase.from('simulations').insert(simData).select().single();
      if (error) handleSupabaseError(error, OperationType.WRITE, 'simulations');

      setSimulationResult(data as Simulation);

      await trackAnalytics(session.user.id, {
        questionsAttempted: questions.length,
        questionsCorrect: correct,
        subjectId: selectedSubject !== 'all' ? selectedSubject : undefined,
      });

      setStep('result');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (step === 'config') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto bg-white p-10 rounded-[40px] border border-gray-100 shadow-xl"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
              <img src="/logomanu.png" alt="Logo" className="app-logo h-8" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Configurar Simulado</h3>
              <p className="text-gray-500 text-sm">Personalize seu teste para máximo desempenho.</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
             <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Disciplina</label>
             <select
               value={selectedSubject}
               onChange={(e) => setSelectedSubject(e.target.value)}
               className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all"
             >
               <option value="all">Todas as Áreas</option>
               {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Nº de Questões</label>
               <input
                 type="number"
                 value={questionCount}
                 onChange={(e) => setQuestionCount(Number(e.target.value))}
                 className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all"
               />
            </div>
            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Tempo (Minutos)</label>
               <input
                 type="number"
                 value={timeLimit}
                 onChange={(e) => setTimeLimit(Number(e.target.value))}
                 className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all"
               />
            </div>
          </div>

          <div className="pt-6 flex gap-4">
             <button
              onClick={onExit}
              className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all"
             >
               Voltar
             </button>
             <button
              onClick={startExam}
              disabled={isSubmitting}
              className="flex-[2] py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50"
             >
               {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Começar Simulado'}
             </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (step === 'exam') {
    const q = questions[currentIdx];
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between bg-white p-6 rounded-3xl border border-gray-100 shadow-sm sticky top-20 z-10">
          <div className="flex items-center space-x-6">
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-black uppercase tracking-widest ${timeLeft < 60 ? 'bg-red-50 text-red-500 animate-pulse' : 'bg-gray-50 text-gray-400'}`}>
              <Timer size={16} />
              <span>{formatTime(timeLeft)}</span>
            </div>
            <div className="h-2 w-48 bg-gray-50 rounded-full overflow-hidden">
               <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                className="h-full bg-brand-primary"
               />
            </div>
          </div>
          <button
            onClick={finishExam}
            className="px-6 py-2 bg-brand-primary text-white rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-brand-primary/20"
          >
            Finalizar
          </button>
        </header>

        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-xl space-y-8"
        >
          <div className="space-y-2">
            <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] bg-brand-light px-3 py-1 rounded-full">
              Questão {currentIdx + 1} de {questions.length}
            </span>
            <h4 className="text-xl font-bold text-gray-900 leading-relaxed font-montserrat">
              {q.text}
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {q.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => setUserAnswers(prev => ({ ...prev, [q.id]: idx }))}
                className={`p-6 rounded-3xl text-left font-medium transition-all border-2 flex items-center space-x-4 ${
                  userAnswers[q.id] === idx
                  ? 'border-brand-primary bg-brand-light text-brand-primary shadow-lg shadow-brand-primary/5'
                  : 'border-gray-50 bg-gray-50 text-gray-500 hover:border-gray-200 hover:bg-white'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${
                   userAnswers[q.id] === idx ? 'bg-brand-primary border-brand-primary text-white' : 'border-gray-200 text-gray-400'
                }`}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <span>{option}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center pt-6">
            <button
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx(prev => prev - 1)}
              className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:text-gray-900 transition-all disabled:opacity-30"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex items-center space-x-2">
               {questions.map((_, idx) => (
                 <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentIdx ? 'w-6 bg-brand-primary' : userAnswers[questions[idx].id] !== undefined ? 'bg-brand-primary/30' : 'bg-gray-100'
                  }`}
                 />
               ))}
            </div>
            <button
              disabled={currentIdx === questions.length - 1}
              onClick={() => setCurrentIdx(prev => prev + 1)}
              className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:text-gray-900 transition-all disabled:opacity-30"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (step === 'result' && simulationResult) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl mx-auto space-y-8 pb-10"
      >
        <div className="bg-white p-12 rounded-[40px] border border-gray-100 shadow-xl text-center space-y-10 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-2 bg-brand-primary" />

           <div className="space-y-4">
              <div className="w-20 h-20 bg-brand-light text-brand-primary rounded-[32px] flex items-center justify-center mx-auto">
                 <Award size={40} />
              </div>
              <h3 className="text-3xl font-bold">Simulado Concluído!</h3>
              <p className="text-gray-500 font-medium">Veja seu desempenho e identifique pontos de melhoria.</p>
           </div>

           <div className="grid grid-cols-3 gap-8">
              <div className="space-y-2">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sua Nota</p>
                 <p className="text-4xl font-black text-brand-primary">{simulationResult.score}%</p>
              </div>
              <div className="space-y-2">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Acertos</p>
                 <p className="text-4xl font-black text-green-500">{simulationResult.correct_count}/{simulationResult.count}</p>
              </div>
              <div className="space-y-2">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tempo Total</p>
                 <p className="text-4xl font-black text-blue-500">{Math.floor(simulationResult.duration / 60)}m</p>
              </div>
           </div>

           <div className="pt-6">
              <button
                onClick={onExit}
                className="px-12 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-xl shadow-gray-900/20"
              >
                Voltar para o Banco
              </button>
           </div>
        </div>

        <div className="space-y-6">
          <h4 className="text-xl font-bold px-4">Revisão de Questões</h4>
          <div className="grid grid-cols-1 gap-4">
            {questions.map((q: Question, idx: number) => {
              const isCorrect = userAnswers[q.id] === q.answer_index;
              return (
                <div key={idx} className={`p-8 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-start space-x-6 ${!isCorrect ? 'border-red-100' : 'border-green-100'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCorrect ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                    {isCorrect ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                  </div>
                  <div className="space-y-3">
                    <p className="font-bold text-gray-900">{q.text}</p>
                    <div className="flex items-center space-x-4">
                       <span className="text-xs font-bold text-gray-400">Resposta: {q.options[userAnswers[q.id]] || 'Não respondida'}</span>
                       {!isCorrect && <span className="text-xs font-bold text-green-500">Correta: {q.options[q.answer_index]}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
};

export default SimulationMode;
