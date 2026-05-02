import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../contexts/AppContext';
import {
  TrendingUp,
  Clock,
  Target,
  Brain,
  Zap,
  BarChart2,
  XCircle,
  Plus,
  X,
  Flame,
  Calendar,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const { supabaseUser, subjects, analytics: dailyStats, simulations, user, refreshAllData } = useAppContext();

  const [showLogModal, setShowLogModal] = useState(false);
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logHours, setLogHours] = useState('0');
  const [logMinutes, setLogMinutes] = useState('30');
  const [logSubjectId, setLogSubjectId] = useState('');
  const [saving, setSaving] = useState(false);

  const [dailyGoalHours, setDailyGoalHours] = useState(() =>
    parseFloat(localStorage.getItem('daily_goal_hours') || '4')
  );
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('week');

  const todayStr = new Date().toISOString().split('T')[0];

  // Aggregate
  const totalStudyTime = dailyStats.reduce((acc, curr) => acc + curr.study_seconds, 0);
  const totalQuestions = dailyStats.reduce((acc, curr) => acc + curr.questions_attempted, 0);
  const totalCorrect = dailyStats.reduce((acc, curr) => acc + curr.questions_correct, 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const avgTimePerQuestion = totalQuestions > 0 ? Math.round(totalStudyTime / totalQuestions) : 0;

  const todayStats = dailyStats.find(a => a.date === todayStr);
  const todaySeconds = todayStats?.study_seconds ?? 0;
  const todayHours = todaySeconds / 3600;
  const dailyGoalProgress = Math.min(100, Math.round((todayHours / dailyGoalHours) * 100));

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklySeconds = dailyStats
    .filter(a => new Date(a.date) >= weekAgo)
    .reduce((acc, a) => acc + a.study_seconds, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlySeconds = dailyStats
    .filter(a => new Date(a.date) >= monthStart)
    .reduce((acc, a) => acc + a.study_seconds, 0);

  // Chart data (sorted ascending, sliced by period)
  const sortedStats = [...dailyStats].sort((a, b) => a.date.localeCompare(b.date));
  const chartSlice = chartPeriod === 'week' ? sortedStats.slice(-7) : sortedStats;
  const chartData = chartSlice.map(a => ({
    date: a.date,
    label: a.date.slice(5).replace('-', '/'),
    hours: parseFloat((a.study_seconds / 3600).toFixed(1)),
  }));

  // Subject performance
  const subjectChartData = subjects.map(sub => {
    let total = 0, correct = 0;
    dailyStats.forEach(day => {
      if (day.subject_stats?.[sub.id]) {
        total += day.subject_stats[sub.id].total;
        correct += day.subject_stats[sub.id].correct;
      }
    });
    return {
      name: sub.name,
      total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      color: sub.color,
    };
  }).filter(s => s.total > 0);

  // AI insights
  const insights: { text: string; type: string }[] = [
    accuracy < 70 && totalQuestions > 0
      ? { text: 'Baixo desempenho geral. Foque em revisões teóricas antes de praticar.', type: 'warning' }
      : null,
    accuracy > 85
      ? { text: 'Excelente precisão! Você está dominando os temas atuais.', type: 'success' }
      : null,
    totalStudyTime < 3600 * 5
      ? { text: 'Consistência é a chave. Tente manter ao menos 1h de estudo diário.', type: 'info' }
      : null,
    weeklySeconds >= dailyGoalHours * 7 * 3600 && weeklySeconds > 0
      ? { text: 'Você atingiu ou superou sua meta semanal! Continue com o mesmo ritmo.', type: 'success' }
      : null,
  ].filter(Boolean) as { text: string; type: string }[];

  const formatHours = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const handleLogSession = async () => {
    if (!supabaseUser) return;
    const seconds = (parseInt(logHours) || 0) * 3600 + (parseInt(logMinutes) || 0) * 60;
    if (seconds === 0) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('analytics')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .eq('date', logDate)
        .single();

      const subjectStats: any = existing?.subject_stats || {};

      if (!existing) {
        await supabase.from('analytics').insert({
          user_id: supabaseUser.id,
          date: logDate,
          study_seconds: seconds,
          questions_attempted: 0,
          questions_correct: 0,
          subject_stats: subjectStats,
        });
      } else {
        await supabase.from('analytics').update({
          study_seconds: (existing.study_seconds || 0) + seconds,
          subject_stats: subjectStats,
        }).eq('id', existing.id);
      }

      await refreshAllData();
      setShowLogModal(false);
      setLogHours('0');
      setLogMinutes('30');
      setLogSubjectId('');
      setLogDate(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error('Error logging session:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGoal = () => {
    const val = parseFloat(goalInput);
    if (!isNaN(val) && val > 0) {
      localStorage.setItem('daily_goal_hours', String(val));
      setDailyGoalHours(val);
    }
    setEditingGoal(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header */}
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
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => { setGoalInput(String(dailyGoalHours)); setEditingGoal(true); }}
            className="flex items-center gap-2 bg-gray-50 border border-gray-100 px-5 py-3 rounded-2xl hover:border-brand-primary/30 transition-colors"
          >
            <Target size={16} className="text-brand-primary" />
            <span className="text-sm font-bold text-gray-700">Meta: {dailyGoalHours}h/dia</span>
            <Edit2 size={12} className="text-gray-400" />
          </button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/40 transition-shadow"
          >
            <Plus size={18} />
            Registrar Sessão
          </motion.button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <div className="xl:col-span-2 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
              <Clock size={22} />
            </div>
            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">30 dias</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tempo Total</p>
            <h3 className="text-2xl font-bold">{formatHours(totalStudyTime)}</h3>
            <p className="text-xs text-gray-400 font-medium mt-1">Hoje: {formatHours(todaySeconds)}</p>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-brand-light text-brand-primary rounded-2xl flex items-center justify-center">
              <Target size={22} />
            </div>
            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">geral</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Taxa de Acerto</p>
            <h3 className="text-2xl font-bold">{accuracy}%</h3>
            <p className="text-xs text-gray-400 font-medium mt-1">{totalCorrect}/{totalQuestions} corretas</p>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center">
              <Flame size={22} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Streak Atual</p>
            <h3 className="text-2xl font-bold">{user?.streak || 0} dias</h3>
            <p className="text-xs text-gray-400 font-medium mt-1">Consecutivos</p>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center">
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Questões</p>
            <h3 className="text-2xl font-bold">{totalQuestions}</h3>
            <p className="text-xs text-gray-400 font-medium mt-1">Respondidas</p>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center">
            <Brain size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tempo Médio/Questão</p>
            <h3 className="text-2xl font-bold">{avgTimePerQuestion}s</h3>
            <p className="text-xs text-gray-400 font-medium mt-1">Por questão</p>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
            <Calendar size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Este Mês</p>
            <h3 className="text-2xl font-bold">{formatHours(monthlySeconds)}</h3>
            <p className="text-xs text-gray-400 font-medium mt-1">Horas de estudo</p>
          </div>
        </div>
      </div>

      {/* Daily Goal Progress */}
      <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-xl font-bold text-gray-900">Meta Diária de Estudos</h4>
            <p className="text-sm text-gray-400 font-medium mt-0.5">
              Meta: {dailyGoalHours}h hoje • {formatHours(todaySeconds)} registradas
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-brand-primary">{dailyGoalProgress}%</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Concluído</p>
          </div>
        </div>
        <div className="bg-gray-100 h-4 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${dailyGoalProgress}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className={`h-full rounded-full transition-colors ${dailyGoalProgress >= 100 ? 'bg-green-500' : 'bg-brand-primary'}`}
          />
        </div>
        {dailyGoalProgress >= 100 && (
          <p className="text-sm text-green-600 font-bold mt-3">Meta atingida hoje! Excelente dedicação.</p>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Study Evolution */}
        <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-bold text-gray-900 tracking-tight">Evolução de Estudos</h4>
            <div className="flex items-center space-x-1 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
              <button
                onClick={() => setChartPeriod('week')}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartPeriod === 'week' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-400'}`}
              >
                7 Dias
              </button>
              <button
                onClick={() => setChartPeriod('month')}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${chartPeriod === 'month' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-400'}`}
              >
                30 Dias
              </button>
            </div>
          </div>
          <div className="h-[260px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: any) => [`${v}h`, 'Estudo']}
                  />
                  <Bar dataKey="hours" name="Horas" radius={[8, 8, 8, 8]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.date === todayStr ? '#ff3b6c' : '#ffccd5'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                Nenhum dado registrado ainda. Use "Registrar Sessão" para começar.
              </div>
            )}
          </div>
        </div>

        {/* Subject Performance */}
        <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-xl font-bold text-gray-900 tracking-tight">Desempenho por Disciplina</h4>
          {subjectChartData.length > 0 ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectChartData} layout="vertical">
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: any) => [`${v}%`, 'Precisão']}
                  />
                  <Bar dataKey="accuracy" name="Precisão %" radius={[0, 8, 8, 0]} barSize={20}>
                    {subjectChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm italic text-center px-4">
              Sem dados de disciplinas ainda. Responda questões para ver o desempenho.
            </div>
          )}
        </div>
      </div>

      {/* Simulations + Error Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
          <h4 className="text-xl font-bold text-gray-900 tracking-tight">Últimos Simulados</h4>
          <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
            {simulations.length > 0 ? simulations.map(sim => (
              <div
                key={sim.id}
                className="p-6 bg-gray-50 rounded-3xl flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-brand-primary/10"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-brand-light text-brand-primary rounded-xl flex items-center justify-center">
                    <Target size={20} />
                  </div>
                  <div>
                    <h5 className="font-bold text-gray-900">{subjects.find(s => s.id === sim.subject_id)?.name || 'Geral'}</h5>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {sim.count} questões • {Math.round(sim.duration / 60)}m
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-black ${sim.score >= 70 ? 'text-green-500' : sim.score >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
                    {sim.score}%
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Score</div>
                </div>
              </div>
            )) : (
              <div className="py-20 text-center text-gray-400 text-sm italic">Nenhum simulado realizado ainda.</div>
            )}
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
            {subjectChartData
              .slice()
              .sort((a, b) => a.accuracy - b.accuracy)
              .slice(0, 5)
              .map((sub, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-red-100 transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-black text-gray-300">#{idx + 1}</span>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color }} />
                    <span className="font-bold text-gray-700 text-sm">{sub.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">{sub.total} questões</span>
                    <div className={`text-xs font-black px-3 py-1 rounded-full ${100 - sub.accuracy > 40 ? 'text-red-500 bg-red-50' : 'text-orange-500 bg-orange-50'}`}>
                      {100 - sub.accuracy}% erros
                    </div>
                  </div>
                </div>
              ))}
            {subjectChartData.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm italic">Sem dados suficientes ainda.</div>
            )}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-gray-900 p-12 rounded-[40px] text-white relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center">
              <Zap size={24} />
            </div>
            <h3 className="text-3xl font-bold tracking-tight">Scudeli AI Insights</h3>
            <p className="text-white/60 font-medium leading-relaxed">
              Nossa IA analisou seu histórico e gerou recomendações personalizadas para sua rotina.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Esta Semana</p>
                <p className="text-xl font-bold mt-1">{formatHours(weeklySeconds)}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Este Mês</p>
                <p className="text-xl font-bold mt-1">{formatHours(monthlySeconds)}</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {insights.length > 0 ? insights.map((insight, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={idx}
                className="p-6 bg-white/5 rounded-3xl border border-white/10 flex items-start space-x-4"
              >
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${insight.type === 'warning' ? 'bg-orange-400' : insight.type === 'success' ? 'bg-green-400' : 'bg-blue-400'}`} />
                <p className="text-sm font-medium">{insight.text}</p>
              </motion.div>
            )) : (
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex items-start space-x-4">
                <div className="mt-1 w-2 h-2 rounded-full shrink-0 bg-blue-400" />
                <p className="text-sm font-medium">
                  Continue estudando para receber recomendações personalizadas baseadas no seu histórico.
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[100px]" />
      </div>

      {/* Log Session Modal */}
      <AnimatePresence>
        {showLogModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowLogModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-10 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Registrar Sessão</h3>
                  <p className="text-sm text-gray-400 font-medium mt-1">Adicione horas de estudo manualmente</p>
                </div>
                <button
                  onClick={() => setShowLogModal(false)}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-2xl flex items-center justify-center transition-colors"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Data</label>
                  <input
                    type="date"
                    value={logDate}
                    max={todayStr}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 font-bold focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Duração</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={logHours}
                        onChange={(e) => setLogHours(e.target.value)}
                        className="w-full pt-4 pb-6 px-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 font-bold focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-center text-2xl"
                      />
                      <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-black text-gray-400 uppercase">horas</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={logMinutes}
                        onChange={(e) => setLogMinutes(e.target.value)}
                        className="w-full pt-4 pb-6 px-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 font-bold focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-center text-2xl"
                      />
                      <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-black text-gray-400 uppercase">min</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Disciplina (opcional)</label>
                  <select
                    value={logSubjectId}
                    onChange={(e) => setLogSubjectId(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 font-bold focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
                  >
                    <option value="">Sem disciplina específica</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogSession}
                  disabled={saving || ((parseInt(logHours) || 0) === 0 && (parseInt(logMinutes) || 0) === 0)}
                  className="w-full bg-brand-primary text-white py-5 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] hover:shadow-xl hover:shadow-brand-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Salvando...' : 'Registrar Sessão'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Goal Modal */}
      <AnimatePresence>
        {editingGoal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setEditingGoal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-10 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-gray-900">Meta Diária</h3>
                <button
                  onClick={() => setEditingGoal(false)}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-2xl flex items-center justify-center transition-colors"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Horas de Estudo por Dia
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 font-bold text-3xl text-center focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  />
                  <p className="text-xs text-gray-400 text-center mt-2">horas por dia</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingGoal(false)}
                    className="flex-1 py-4 rounded-[20px] border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveGoal}
                    className="flex-1 py-4 bg-brand-primary text-white rounded-[20px] font-bold text-sm hover:shadow-lg hover:shadow-brand-primary/20 transition-all"
                  >
                    Salvar Meta
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnalyticsView;
