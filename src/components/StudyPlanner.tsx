import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarDays,
  Target,
  Sparkles,
  Calendar as CalendarIcon,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  Zap,
  ArrowRight
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { StudyPlan } from '../types';
import { geminiService } from '../services/geminiService';

const StudyPlanner = () => {
  const { session, subjects } = useAppContext();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    name: 'Simulado Residência 2024',
    examDate: '',
    availability: 120,
    targetContent: '',
    selectedSubjects: [] as string[],
  });

  useEffect(() => {
    if (!session) return;

    supabase
      .from('study_plans')
      .select('*')
      .eq('user_id', session.user.id)
      .then(({ data }) => setPlans((data || []) as StudyPlan[]));

    const channel = supabase
      .channel(`study_plans_${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'study_plans', filter: `user_id=eq.${session.user.id}` }, p => {
        setPlans(prev => [...prev, p.new as StudyPlan]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'study_plans', filter: `user_id=eq.${session.user.id}` }, p => {
        setPlans(prev => prev.map(pl => pl.id === (p.new as StudyPlan).id ? p.new as StudyPlan : pl));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const activePlan = plans[0];

  const handleGeneratePlan = async () => {
    if (!session) return;
    setIsGenerating(true);

    const subjectNames = subjects
      .filter(s => formData.selectedSubjects.includes(s.id))
      .map(s => s.name);

    try {
      const schedule = await geminiService.generateStudyPlan(
        formData.examDate,
        formData.targetContent || subjectNames.join(', '),
        formData.availability
      );

      const planData = {
        user_id: session.user.id,
        name: formData.name,
        exam_date: formData.examDate,
        target_content: formData.targetContent,
        daily_availability: formData.availability,
        schedule: schedule.map((s: Record<string, unknown>) => ({ ...s, completed: false })),
      };

      if (activePlan) {
        const { error } = await supabase.from('study_plans').update(planData).eq('id', activePlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('study_plans').insert(planData);
        if (error) throw error;
      }

      alert('Plano de estudo gerado com sucesso pela IA!');
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar plano. Verifique os dados e tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSubject = (id: string) => {
    setFormData(prev => ({
      ...prev,
      selectedSubjects: prev.selectedSubjects.includes(id)
        ? prev.selectedSubjects.filter(sid => sid !== id)
        : [...prev.selectedSubjects, id],
    }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Planejamento Inteligente</h1>
          <p className="text-gray-500 text-sm">IA gera seu cronograma otimizado baseado em sua disponibilidade.</p>
        </div>
        {!activePlan && (
           <div className="flex items-center space-x-2 text-brand-primary bg-brand-light px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest">
              <Zap size={14} />
              <span>Crie seu primeiro plano</span>
           </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <h3 className="font-bold text-gray-900 flex items-center space-x-2">
                <Target className="text-brand-primary" size={20} />
                <span>Configurar Prova</span>
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nome do Objetivo</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Prova de Residência USP"
                    className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all text-sm font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Data da Prova</label>
                  <input
                    type="date"
                    value={formData.examDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, examDate: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Conteúdo / Foco</label>
                  <textarea
                    value={formData.targetContent}
                    onChange={(e) => setFormData(prev => ({ ...prev, targetContent: e.target.value }))}
                    placeholder="Quais tópicos você quer priorizar?"
                    className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all text-sm min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tempo Diário (minutos)</label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="30"
                      max="480"
                      step="30"
                      value={formData.availability}
                      onChange={(e) => setFormData(prev => ({ ...prev, availability: parseInt(e.target.value) }))}
                      className="flex-1 accent-brand-primary"
                    />
                    <span className="font-bold text-brand-primary w-16 text-center">{formData.availability}m</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Disciplinas</label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2">
                    {subjects.map(subject => (
                      <button
                        key={subject.id}
                        onClick={() => toggleSubject(subject.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all text-sm ${
                          formData.selectedSubjects.includes(subject.id)
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-white border-gray-100 text-gray-600 hover:border-brand-primary/50'
                        }`}
                      >
                        <span>{subject.name}</span>
                        {formData.selectedSubjects.includes(subject.id) && <CheckCircle2 size={16} />}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleGeneratePlan}
                  disabled={isGenerating || !formData.examDate || formData.selectedSubjects.length === 0}
                  className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all disabled:opacity-50"
                >
                  {isGenerating ? <RefreshCw className="animate-spin" size={20} /> : <Sparkles size={20} />}
                  <span>{activePlan ? 'Atualizar Plano IA' : 'Gerar Novo Plano'}</span>
                </button>
              </div>
           </div>

           {activePlan && (
             <div className="bg-brand-primary p-8 rounded-3xl text-white shadow-xl shadow-brand-primary/20 space-y-4">
                <div className="flex items-center space-x-3">
                   <div className="p-2 bg-white/20 rounded-lg">
                      <Target size={20} />
                   </div>
                   <div>
                      <p className="text-xs text-white/60 font-medium uppercase tracking-widest">Contagem Regressiva</p>
                      <h4 className="text-xl font-bold">Prova em {Math.ceil((new Date(activePlan.exam_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} dias</h4>
                   </div>
                </div>
                <div className="pt-4 border-t border-white/10">
                   <p className="text-sm opacity-80 leading-relaxed">Você está no caminho certo. A IA planejou suas revisões para garantir a retenção máxima.</p>
                </div>
             </div>
           )}
        </div>

        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {activePlan ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {activePlan.schedule.map((day, idx) => (
                  <div key={idx} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex divide-x divide-gray-50">
                    <div className="w-40 p-6 flex flex-col items-center justify-center bg-gray-50/50 space-y-1">
                       <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dia {idx + 1}</span>
                       <span className="text-lg font-bold text-gray-900">{new Date(day.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="flex-1 p-8 space-y-4">
                       <div className="flex items-center space-x-2 text-brand-primary mb-2">
                          <BookOpen size={18} />
                          <h4 className="font-bold text-gray-900">Atividades Sugeridas</h4>
                       </div>
                       <ul className="space-y-3">
                         {day.topics.map((task: string, tidx: number) => (
                           <li key={tidx} className="flex items-start space-x-3 group">
                              <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-primary/30 group-hover:bg-brand-primary transition-all" />
                              <span className="text-gray-600 text-sm leading-relaxed">{task}</span>
                           </li>
                         ))}
                       </ul>
                    </div>
                    <div className="px-6 flex items-center">
                      <button className="p-3 bg-white hover:bg-brand-light text-gray-300 hover:text-brand-primary rounded-2xl border border-gray-100 transition-all">
                        <ArrowRight size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 1 }}
                className="h-[600px] bg-gray-50/50 rounded-[40px] border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-12 space-y-6"
              >
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <CalendarIcon className="text-gray-200" size={48} />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">Nenhum plano ativo</h3>
                  <p className="text-gray-400 text-sm">Configure sua prova à esquerda para que nossa IA gere o cronograma ideal para você.</p>
                </div>
                <div className="flex items-center space-x-2 text-xs font-bold text-brand-primary uppercase tracking-[0.2em] bg-brand-light px-6 py-2 rounded-full animate-pulse">
                   Aguardando configuração
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default StudyPlanner;
