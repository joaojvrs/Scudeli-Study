import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Brain, 
  Coffee, 
  Settings,
  Bell,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Pomodoro = () => {
  const { subjects, firebaseUser } = useAppContext();
  
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState('');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalTime = mode === 'focus' ? 25 * 60 : 5 * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimerComplete();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  const handleTimerComplete = async () => {
    setIsActive(false);
    
    if (mode === 'focus') {
      setSessionsCompleted(prev => prev + 1);
      // Save session to Firestore
      if (firebaseUser) {
        try {
          await addDoc(collection(db, 'studySessions'), {
            duration: 25,
            subjectId: selectedSubject || 'none',
            userId: firebaseUser.uid,
            type: 'pomodoro',
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'studySessions');
        }
      }
      setMode('break');
      setTimeLeft(5 * 60);
    } else {
      setMode('focus');
      setTimeLeft(25 * 60);
    }
    
    // Play sound notification (browser permitting)
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play();
    } catch (e) {}
  };

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col items-center justify-center space-y-12 max-w-4xl mx-auto">
      <header className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Foco Total</h2>
        <p className="text-gray-500">Mantenha sua concentração e evite o burnout acadêmico.</p>
      </header>

      {/* Mode Selector */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex space-x-2">
        <button 
          onClick={() => { setMode('focus'); setTimeLeft(25 * 60); setIsActive(false); }}
          className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition-all ${
            mode === 'focus' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-gray-400 hover:text-brand-primary'
          }`}
        >
          <Brain size={18} />
          <span>Foco</span>
        </button>
        <button 
          onClick={() => { setMode('break'); setTimeLeft(5 * 60); setIsActive(false); }}
          className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition-all ${
            mode === 'break' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-gray-400 hover:text-brand-primary'
          }`}
        >
          <Coffee size={18} />
          <span>Intervalo</span>
        </button>
      </div>

      {/* Timer Circle */}
      <div className="relative w-80 h-80 flex items-center justify-center">
        {/* SVG Progress Circle */}
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="160"
            cy="160"
            r="150"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-gray-100"
          />
          <motion.circle
            cx="160"
            cy="160"
            r="150"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeLinecap="round"
            className="text-brand-primary"
            initial={{ strokeDasharray: 942, strokeDashoffset: 942 }}
            animate={{ strokeDashoffset: 942 - (942 * progress) / 100 }}
            transition={{ ease: "linear" }}
          />
        </svg>

        <div className="absolute flex flex-col items-center">
          <span className="text-6xl font-bold text-gray-900 tabular-nums">
            {formatTime(timeLeft)}
          </span>
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-2">
            {mode === 'focus' ? 'Focando' : 'Descansando'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-6">
        <button 
          onClick={resetTimer}
          className="p-4 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-brand-primary transition-colors shadow-sm"
        >
          <RotateCcw size={24} />
        </button>
        <button 
          onClick={toggleTimer}
          className="w-20 h-20 bg-brand-primary text-white rounded-full flex items-center justify-center shadow-2xl shadow-brand-primary/30 hover:scale-105 active:scale-95 transition-all"
        >
          {isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} className="ml-1" fill="currentColor" />}
        </button>
        <button 
          className="p-4 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-brand-primary transition-colors shadow-sm"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Settings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
         <div className="bg-white p-6 rounded-3xl border border-gray-50 flex items-center justify-between">
            <div className="flex items-center space-x-4">
               <div className="w-12 h-12 bg-brand-light rounded-2xl flex items-center justify-center text-brand-primary">
                  <Play size={24} />
               </div>
               <div>
                  <p className="text-sm font-bold text-gray-900">{sessionsCompleted} Sessões</p>
                  <p className="text-xs text-gray-500">Concluídas hoje</p>
               </div>
            </div>
            <div className="flex -space-x-2">
               {[...Array(4)].map((_, i) => (
                 <div key={i} className={`w-3 h-3 rounded-full border-2 border-white ${i < sessionsCompleted ? 'bg-brand-primary' : 'bg-gray-100'}`} />
               ))}
            </div>
         </div>

         <div className="bg-white p-6 rounded-3xl border border-gray-50 space-y-4">
            <div className="flex items-center justify-between">
               <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Estudar agora</span>
               <select 
                 value={selectedSubject}
                 onChange={(e) => setSelectedSubject(e.target.value)}
                 className="bg-brand-bg text-xs font-bold p-2 px-4 rounded-full outline-none"
               >
                 <option value="">Nenhuma Disciplina</option>
                 {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>
            <div className="flex items-center space-x-2">
               <div className="flex-1 h-2 bg-gray-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '65%' }}
                    className="h-full bg-brand-primary" 
                  />
               </div>
               <span className="text-[10px] font-bold text-gray-400">Meta: 4/6h</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Pomodoro;
