import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import logoManu from '../../assets/logomanu.jpeg';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Clock,
  Calendar,
  Brain,
  ChevronRight,
  Zap,
  Flame,
  BookOpen
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const StatCard = ({ icon: Icon, label, value, sublabel, color }: any) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 space-y-6"
  >
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color}`}>
      <Icon size={28} />
    </div>
    <div className="space-y-1">
      <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">{label}</p>
      <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{value}</h3>
      <p className="text-xs text-gray-500 font-medium">{sublabel}</p>
    </div>
  </motion.div>
);

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const Dashboard = () => {
  const { tasks, events, flashcards, subjects, user, analytics, questions } = useAppContext();

  const todayStr = new Date().toISOString().split('T')[0];

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const found = analytics.find(a => a.date === dateStr);
    const seconds = found?.study_seconds ?? 0;
    return {
      name: DAY_LABELS[d.getDay()],
      hours: parseFloat((seconds / 3600).toFixed(1)),
      seconds,
      date: dateStr,
    };
  });

  const weeklySeconds = last7Days.reduce((acc, d) => acc + d.seconds, 0);
  const weeklyHoursStr = `${Math.floor(weeklySeconds / 3600)}h ${Math.round((weeklySeconds % 3600) / 60)}m`;

  const todayAnalytics = analytics.find(a => a.date === todayStr);
  const todayHours = todayAnalytics ? todayAnalytics.study_seconds / 3600 : 0;
  const dailyGoalHours = parseFloat(localStorage.getItem('daily_goal_hours') || '4');
  const dailyGoalProgress = Math.min(100, Math.round((todayHours / dailyGoalHours) * 100));

  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const todayTasks = pendingTasks.slice(0, 4);
  const pendingCards = flashcards.filter(c => new Date(c.next_review) <= new Date()).length;
  const upcomingExams = events
    .filter(e => e.type === 'exam' && new Date(e.start) >= new Date())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 2);

  const subjectPerf = subjects.map(sub => {
    let correct = 0, total = 0;
    analytics.forEach(day => {
      if (day.subject_stats?.[sub.id]) {
        total += day.subject_stats[sub.id].total;
        correct += day.subject_stats[sub.id].correct;
      }
    });
    return { ...sub, accuracy: total > 0 ? Math.round((correct / total) * 100) : 101, total };
  }).filter(s => s.total > 0).sort((a, b) => a.accuracy - b.accuracy);

  const weakestSubject = subjectPerf[0];

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-24 h-24 flex items-center justify-center shrink-0">
            <img src={logoManu} alt="Logo" className="app-logo h-full w-full object-contain" />
          </div>
          <div className="space-y-1">
            <h2 className="text-4xl font-bold text-gray-900 tracking-tight">
              Olá, {user?.name?.split(' ')[0] || 'Estudante'}
            </h2>
            <p className="text-gray-500 font-medium">Seu centro de controle para alta performance acadêmica.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-500">
              <Flame size={20} fill="currentColor" />
            </div>
            <div className="leading-none">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Streak</p>
              <p className="text-lg font-bold text-gray-900">{user?.streak || 0} Dias</p>
            </div>
          </div>

          <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-3">
            <Calendar className="text-gray-400" size={20} />
            <span className="text-sm font-bold text-gray-700">
              {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
            </span>
          </div>
        </div>
      </header>

      {/* Goal Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-primary p-1 rounded-[40px] shadow-2xl shadow-brand-primary/20"
      >
        <div className="bg-brand-primary p-10 rounded-[38px] flex flex-col md:flex-row md:items-center justify-between gap-8 text-white relative overflow-hidden">
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-3">
              <h3 className="text-3xl font-bold tracking-tight">Meta Diária</h3>
              <span className="bg-white/20 text-white text-xs font-black px-3 py-1 rounded-full">
                {dailyGoalProgress}%
              </span>
            </div>
            <p className="opacity-80 max-w-sm font-medium">
              {todayHours.toFixed(1)}h de {dailyGoalHours}h estudadas hoje.{' '}
              {dailyGoalProgress >= 100 ? 'Meta atingida! Parabéns!' : 'Continue assim!'}
            </p>
            <div className="w-full max-w-md bg-white/20 h-4 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dailyGoalProgress}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.5)]"
              />
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-3 items-start md:items-end">
            <button className="bg-white text-brand-primary px-10 py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl">
              Continuar Estudos
            </button>
            {upcomingExams.length > 0 && (
              <div className="text-white/70 text-xs font-bold">
                Próxima prova: {new Date(upcomingExams[0].start).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
              </div>
            )}
          </div>

          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-full translate-y-1/4 translate-x-1/4" />
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard
          icon={CheckCircle2}
          label="Pendências"
          value={pendingTasks.length}
          sublabel="Tarefas no checklist"
          color="bg-blue-50 text-blue-500"
        />
        <StatCard
          icon={Brain}
          label="Flashcards"
          value={pendingCards}
          sublabel="Cards para revisão"
          color="bg-brand-light text-brand-primary"
        />
        <StatCard
          icon={Clock}
          label="Foco Semanal"
          value={weeklyHoursStr}
          sublabel="Horas registradas"
          color="bg-orange-50 text-orange-500"
        />
        <StatCard
          icon={BookOpen}
          label="Banco de Questões"
          value={questions.length}
          sublabel={`${subjects.length} disciplinas`}
          color="bg-green-50 text-green-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Performance Graph */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[40px] shadow-sm border border-gray-100 flex flex-col h-[450px]">
          <div className="flex items-center justify-between mb-10">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">Consistência Diária</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Horas de estudo efetivo</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Esta semana</p>
              <p className="text-xl font-bold text-brand-primary">{weeklyHoursStr}</p>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7Days}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 700 }}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: '#fff5f7' }}
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                  formatter={(value: any) => [`${value}h`, 'Estudo']}
                />
                <Bar dataKey="hours" radius={[12, 12, 12, 12]} barSize={48}>
                  {last7Days.map((entry, index) => (
                    <Cell key={index} fill={entry.date === todayStr ? '#ff3b6c' : entry.hours > 0 ? '#ffccd5' : '#f3f4f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-8">
          {/* Insight card */}
          <div className="bg-gray-900 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 space-y-6">
              <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center">
                <Zap size={24} />
              </div>
              <h4 className="text-2xl font-bold tracking-tight">Performance Insight</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                {weakestSubject
                  ? `Você teve baixo desempenho em ${weakestSubject.name} (${weakestSubject.accuracy}% de acerto). Sugerimos uma revisão intensiva.`
                  : 'Responda questões para visualizar insights sobre seu desempenho por disciplina.'}
              </p>
              <button className="flex items-center space-x-2 text-brand-primary font-bold text-sm uppercase tracking-widest pt-2 group-hover:translate-x-2 transition-transform">
                <span>Ver Estatísticas</span>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-[40px]" />
          </div>

          {/* Upcoming exams */}
          {upcomingExams.length > 0 && (
            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-900">Próximas Provas</h4>
                <Calendar size={18} className="text-brand-primary" />
              </div>
              <div className="space-y-3">
                {upcomingExams.map(exam => {
                  const daysLeft = Math.ceil((new Date(exam.start).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={exam.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${daysLeft <= 7 ? 'bg-red-500' : 'bg-brand-primary'}`} />
                        <span className="text-sm font-bold text-gray-700 truncate max-w-[130px]">{exam.title}</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${daysLeft <= 7 ? 'bg-red-50 text-red-500' : 'bg-brand-light text-brand-primary'}`}>
                        {daysLeft}d
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tasks */}
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-900">Tarefas Urgentes</h4>
              <CheckCircle2 size={18} className="text-brand-primary" />
            </div>
            <div className="space-y-4">
              {todayTasks.length > 0 ? todayTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between group">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-orange-400' : 'bg-brand-primary'}`} />
                    <span className="text-sm font-bold text-gray-700 truncate">{task.title}</span>
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full shrink-0 ml-2 ${
                    task.priority === 'high' ? 'bg-red-50 text-red-400' :
                    task.priority === 'medium' ? 'bg-orange-50 text-orange-400' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                  </span>
                </div>
              )) : (
                <p className="text-sm text-gray-400 italic">Sem tarefas pendentes.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
