import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../contexts/AppContext';
import { Analytics, Simulation, SubjectStats } from '../types';
import {
  TrendingUp,
  Clock,
  Target,
  Award,
  Brain,
  Zap,
  BarChart2,
  XCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const AnalyticsView = () => {
  const { session, subjects } = useAppContext();
  const [dailyStats, setDailyStats] = useState<Analytics[]>([]);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [subjectStatsData, setSubjectStatsData] = useState<SubjectStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;

    const fetchData = async () => {
      const [
        { data: analyticsData },
        { data: simsData },
        { data: statsData },
      ] = await Promise.all([
        supabase
          .from('analytics')
          .select('*')
          .eq('user_id', uid)
          .order('date', { ascending: false })
          .limit(10),
        supabase
          .from('simulations')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('subject_stats')
          .select('*')
          .eq('user_id', uid),
      ]);

      setDailyStats(((analyticsData || []) as Analytics[]).reverse());
      setSimulations((simsData || []) as Simulation[]);
      setSubjectStatsData((statsData || []) as SubjectStats[]);
      setLoading(false);
    };

    fetchData();
  }, [session]);

  const totalStudyTime = dailyStats.reduce((acc, curr) => acc + (curr.study_seconds || 0), 0);
  const totalQuestions = dailyStats.reduce((acc, curr) => acc + (curr.questions_attempted || 0), 0);
  const totalCorrect = dailyStats.reduce((acc, curr) => acc + (curr.questions_correct || 0), 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const avgTimePerQuestion = totalQuestions > 0 ? Math.round(totalStudyTime / totalQuestions) : 0;

  const subjectChartData = subjects.map(sub => {
    const stats = subjectStatsData.filter(s => s.subject_id === sub.id);
    const total = stats.reduce((acc, s) => acc + (s.total || 0), 0);
    const correct = stats.reduce((acc, s) => acc + (s.correct || 0), 0);
    return {
      name: sub.name,
      total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      color: sub.color,
    };
  }).filter(s => s.total > 0);

  const insights = [
    accuracy < 70 ? { text: "Baixo desempenho geral. Foque em revisões teóricas antes de praticar.", type: 'warning' } : null,
    accuracy > 85 ? { text: "Excelente precisão! Você está dominando os temas atuais.", type: 'success' } : null,
    totalStudyTime < 3600 * 5 ? { text: "Consistência é a chave. Tente manter ao menos 1h de estudo diário.", type: 'info' } : null,
  ].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center text-brand-primary">
            <BarChart2 size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Análise de Performance</h2>
            <p className="text-sm text-gray-500 font-medium tracking-tight">Sua jornada acadêmica em dados e métricas reais.</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tempo Total (Semana)</p>
            <h3 className="text-3xl font-bold">{Math.round(totalStudyTime / 3600)}h {Math.round((totalStudyTime % 3600) / 60)}m</h3>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-brand-light text-brand-primary rounded-2xl flex items-center justify-center">
            <Target size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Taxa de Acerto</p>
            <h3 className="text-3xl font-bold">{accuracy}%</h3>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Questões Respondidas</p>
            <h3 className="text-3xl font-bold">{totalQuestions}</h3>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tempo Médio / Questão</p>
            <h3 className="text-3xl font-bold">{avgTimePerQuestion}s</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
           <h4 className="text-xl font-bold text-gray-900 tracking-tight">Últimos Simulados</h4>
           <div className="space-y-4">
              {simulations.length > 0 ? simulations.map(sim => (
                <div key={sim.id} className="p-6 bg-gray-50 rounded-3xl flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-brand-primary/10">
                   <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-brand-light text-brand-primary rounded-xl flex items-center justify-center">
                         <Target size={20} />
                      </div>
                      <div>
                         <h5 className="font-bold text-gray-900">{subjects.find(s => s.id === sim.subject_id)?.name || 'Geral'}</h5>
                         <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{sim.count} questões • {Math.round(sim.duration / 60)}m</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-lg font-black text-brand-primary">{sim.score}%</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Score</div>
                   </div>
                </div>
              )) : (
                <div className="py-20 text-center text-gray-400 text-sm italic">Nenhum simulado realizado ainda.</div>
              )}
           </div>
        </div>

        <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
           <h4 className="text-xl font-bold text-gray-900 tracking-tight">Evolução Diária (Segundos)</h4>
           <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={dailyStats}>
                    <XAxis dataKey="date" tickFormatter={(v) => v.split('-')[2]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#9ca3af' }} />
                    <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="study_seconds" name="Segundos" radius={[8, 8, 8, 8]} fill="#ff3b6c" />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
           <h4 className="text-xl font-bold text-gray-900 tracking-tight">Desempenho por Disciplina</h4>
           <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={subjectChartData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="accuracy" name="Precisão %" radius={[0, 8, 8, 0]} barSize={20}>
                       {subjectChartData.map((entry, index) => (
                         <Cell key={index} fill={entry.color} />
                       ))}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
           <div className="flex items-center justify-between">
              <h4 className="text-xl font-bold text-gray-900 tracking-tight">Foco de Revisão (Mais Erros)</h4>
              <div className="p-2 bg-red-50 text-red-500 rounded-xl">
                 <XCircle size={20} />
              </div>
           </div>
           <div className="space-y-3">
              {subjectChartData.sort((a, b) => a.accuracy - b.accuracy).slice(0, 4).map((sub, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-red-100 transition-all">
                   <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color }} />
                      <span className="font-bold text-gray-700 text-sm">{sub.name}</span>
                   </div>
                   <div className="text-xs font-black text-red-500 bg-red-50 px-3 py-1 rounded-full">
                      {100 - sub.accuracy}% Erros
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="bg-gray-900 p-12 rounded-[40px] text-white relative overflow-hidden">
         <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
               <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center">
                  <Zap size={24} />
               </div>
               <h3 className="text-3xl font-bold tracking-tight">Scudeli AI Insights</h3>
               <p className="text-white/60 font-medium leading-relaxed">Nossa IA analisou seu histórico e gerou recomendações personalizadas para sua rotina.</p>
            </div>
            <div className="space-y-4">
               {insights.map((insight, idx) => (
                 <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={idx}
                    className="p-6 bg-white/5 rounded-3xl border border-white/10 flex items-start space-x-4"
                  >
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${insight?.type === 'warning' ? 'bg-orange-400' : insight?.type === 'success' ? 'bg-green-400' : 'bg-blue-400'}`} />
                    <p className="text-sm font-medium">{insight?.text}</p>
                 </motion.div>
               ))}
            </div>
         </div>
         <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[100px]" />
      </div>
    </div>
  );
};

export default AnalyticsView;
