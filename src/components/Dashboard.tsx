import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import logoManu from '../../assets/logomanu.jpeg';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  BookOpen, 
  TrendingUp, 
  Brain,
  ChevronRight,
  Plus,
  Zap,
  Target,
  Flame,
  Award
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

const Dashboard = () => {
  const { tasks, events, flashcards, subjects, user } = useAppContext();

  const todayTasks = tasks.filter(t => t.status !== 'done').slice(0, 4);
  const pendingCards = flashcards.filter(c => new Date(c.next_review) <= new Date()).length;
  const upcomingExams = events.filter(e => e.type === 'exam').slice(0, 3);
  const dailyProgress = 65; // Simulated

  const studyData = [
    { name: 'S', hours: 4 },
    { name: 'T', hours: 5 },
    { name: 'Q', hours: 3 },
    { name: 'Q', hours: 6 },
    { name: 'S', hours: 4 },
    { name: 'S', hours: 2 },
    { name: 'D', hours: 1 },
  ];

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
        
        <div className="flex items-center space-x-3">
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
              <span className="text-sm font-bold text-gray-700">{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</span>
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
               <h3 className="text-3xl font-bold tracking-tight">Meta Diária</h3>
               <p className="opacity-80 max-w-sm font-medium">Você concluiu {dailyProgress}% das atividades planejadas para hoje. Faltam apenas alguns passos!</p>
               
               <div className="w-full max-w-md bg-white/20 h-4 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${dailyProgress}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                  />
               </div>
            </div>
            
            <div className="relative z-10">
               <button className="bg-white text-brand-primary px-10 py-5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl">
                  Continuar Estudos
               </button>
            </div>

            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-full translate-y-1/4 translate-x-1/4" />
         </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard 
          icon={CheckCircle2} 
          label="Pendências" 
          value={tasks.filter(t => t.status !== 'done').length} 
          sublabel="Tarefas no checklist"
          color="bg-blue-50 text-blue-500"
        />
        <StatCard 
          icon={Brain} 
          label="Informativos" 
          value={pendingCards} 
          sublabel="Cards para revisão"
          color="bg-brand-light text-brand-primary"
        />
        <StatCard 
          icon={Clock} 
          label="Foco semanal" 
          value="24h" 
          sublabel="Horas registradas"
          color="bg-orange-50 text-orange-500"
        />
        <StatCard 
          icon={Award} 
          label="Rank Acadêmico" 
          value="Ouro" 
          sublabel="Top 5% da coorte"
          color="bg-green-50 text-green-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Performance Graph */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[40px] shadow-sm border border-gray-100 flex flex-col h-[450px]">
          <div className="flex items-center justify-between mb-10">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">Consistência Diária</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Tempo de estudo efetivo</p>
            </div>
            <div className="flex items-center space-x-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
               <button className="px-4 py-2 bg-white text-brand-primary text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm">Semanal</button>
               <button className="px-4 py-2 text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-xl">Mensal</button>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studyData}>
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
                />
                <Bar dataKey="hours" radius={[12, 12, 12, 12]} barSize={48}>
                  {studyData.map((entry, index) => (
                    <Cell key={index} fill={entry.hours > 4 ? '#ff3b6c' : '#ffccd5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insights & Quick Actions */}
        <div className="space-y-8">
           <div className="bg-gray-900 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
              <div className="relative z-10 space-y-6">
                 <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center">
                    <Zap size={24} />
                 </div>
                 <h4 className="text-2xl font-bold tracking-tight">Performance Insight</h4>
                 <p className="text-white/60 text-sm leading-relaxed">Você teve <b>baixo desempenho em Farmacologia</b> na última semana. Sugerimos uma revisão intensiva hoje.</p>
                 <button className="flex items-center space-x-2 text-brand-primary font-bold text-sm uppercase tracking-widest pt-2 group-hover:translate-x-2 transition-transform">
                    <span>Resolver Agora</span>
                    <ChevronRight size={16} />
                 </button>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-[40px]" />
           </div>

           <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                 <h4 className="font-bold text-gray-900">Tarefas Urgentes</h4>
                 <CheckCircle2 size={18} className="text-brand-primary" />
              </div>
              <div className="space-y-4">
                 {todayTasks.length > 0 ? todayTasks.map(task => (
                   <div key={task.id} className="flex items-center justify-between group">
                      <div className="flex items-center space-x-4">
                         <div className="w-2 h-2 rounded-full bg-brand-primary" />
                         <span className="text-sm font-bold text-gray-700">{task.title}</span>
                      </div>
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Ver Detalhes</span>
                   </div>
                 )) : (
                   <p className="text-sm text-gray-400 italic">Sem tarefas para agora.</p>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
