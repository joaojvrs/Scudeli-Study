import React, { useState } from 'react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import {
  LayoutDashboard,
  Layers,
  FileText,
  CheckSquare,
  Calendar,
  BrainCircuit,
  Timer,
  Search,
  Settings,
  LogOut,
  User as UserIcon,
  Plus,
  Menu,
  X,
  XCircle,
  BookOpen,
  CalendarDays,
  Target,
  Zap,
  TrendingUp,
  RotateCcw,
  MessageSquare,
  Users
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { loginWithGoogle, logout } from './lib/supabase';

import GlobalSearch from './components/GlobalSearch';

// Components
import Dashboard from './components/Dashboard';
import Flashcards from './components/Flashcards';
import StudyNotes from './components/StudyNotes';
import TaskManager from './components/TaskManager';
import AcademicCalendar from './components/AcademicCalendar';
import QuestionBank from './components/QuestionBank';
import Pomodoro from './components/Pomodoro';
import SubjectsModule from './components/SubjectsModule';
import MaterialsCenter from './components/MaterialsCenter';
import StudyPlanner from './components/StudyPlanner';
import FocusMode from './components/FocusMode';
import ErrorNotebook from './components/ErrorNotebook';
import DailyReview from './components/DailyReview';
import AnalyticsView from './components/AnalyticsView';
import Community from './components/Community';

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active
        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
        : 'text-gray-500 hover:bg-brand-light hover:text-brand-primary'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const AppContent = () => {
  const { user, loading, session, notes, flashcards, questions, materials } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [navTargetId, setNavTargetId] = useState<string | null>(null);

  const handleNavigate = (tab: string, id?: string) => {
    setActiveTab(tab);
    if (id) setNavTargetId(id);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-brand-bg">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-brand-bg p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-10 rounded-2xl shadow-xl text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Scudeli Study</h1>
            <p className="text-gray-500">Plataforma Inteligente de Medicina</p>
          </div>

          <div className="py-4">
             <div className="w-24 h-24 flex items-center justify-center mx-auto mb-4">
                <img src="/logomanu.png" alt="Scudeli Study Logo" className="app-logo h-full" referrerPolicy="no-referrer" />
             </div>
             <p className="text-sm text-gray-400">Ambiente de alta performance para estudos médicos.</p>
          </div>

          <button
            onClick={() => loginWithGoogle()}
            className="w-full bg-brand-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-brand-primary/90 transition-colors shadow-lg shadow-brand-primary/20 flex items-center justify-center space-x-3"
          >
            <span>Entrar na plataforma</span>
          </button>

          <p className="text-xs text-gray-400">Desenvolvido para máxima escalabilidade e organização.</p>
        </motion.div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'analytics': return <AnalyticsView />;
      case 'focus': return <FocusMode defaultTargetId={navTargetId} onComplete={() => setNavTargetId(null)} />;
      case 'review': return <DailyReview />;
      case 'materials': return <MaterialsCenter />;
      case 'errors': return <ErrorNotebook />;
      case 'planner': return <StudyPlanner />;
      case 'flashcards': return <Flashcards />;
      case 'notes': return <StudyNotes />;
      case 'questions': return <QuestionBank />;
      case 'tasks': return <TaskManager />;
      case 'calendar': return <AcademicCalendar />;
      case 'subjects': return <SubjectsModule />;
      case 'community': return <Community />;
      default: return <Dashboard />;
    }
  };

  const avatarUrl = session.user.user_metadata?.avatar_url;
  const displayName = user?.name || session.user.user_metadata?.full_name || 'Estudante';

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden text-gray-900">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -288 }}
            animate={{ x: 0 }}
            exit={{ x: -288 }}
            className="w-72 bg-white border-r border-gray-100 flex flex-col h-full z-20 shadow-sm shrink-0"
          >
            <div className="p-8 pb-4 flex items-center space-x-3">
              <div className="w-10 h-10 flex items-center justify-center">
                <img src="/logomanu.png" alt="Logo" className="app-logo h-full" referrerPolicy="no-referrer" />
              </div>
              <h1 className="text-lg font-black tracking-tight text-gray-900 uppercase">SCUDELI <span className="text-brand-primary">STUDY</span></h1>
            </div>

            <div className="flex-1 px-4 space-y-1 overflow-y-auto py-4 scrollbar-hide">
              <div className="mb-4">
                <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Painel</p>
                <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                <SidebarItem icon={TrendingUp} label="Estatísticas" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
                <SidebarItem icon={Users} label="Comunidade" active={activeTab === 'community'} onClick={() => setActiveTab('community')} />
              </div>

              <div className="mb-4">
                <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Treinamento</p>
                <SidebarItem icon={Zap} label="Modo Foco" active={activeTab === 'focus'} onClick={() => setActiveTab('focus')} />
                <SidebarItem icon={RotateCcw} label="Revisão Diária" active={activeTab === 'review'} onClick={() => setActiveTab('review')} />
                <SidebarItem icon={Plus} label="Questões IA" active={activeTab === 'questions'} onClick={() => setActiveTab('questions')} />
              </div>

              <div className="mb-4">
                <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Conteúdo</p>
                <SidebarItem icon={BookOpen} label="Materiais" active={activeTab === 'materials'} onClick={() => setActiveTab('materials')} />
                <SidebarItem icon={XCircle} label="Caderno de Erros" active={activeTab === 'errors'} onClick={() => setActiveTab('errors')} />
                <SidebarItem icon={BrainCircuit} label="Flashcards" active={activeTab === 'flashcards'} onClick={() => setActiveTab('flashcards')} />
                <SidebarItem icon={FileText} label="Resumos" active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} />
              </div>

              <div className="mb-4">
                <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Organização</p>
                <SidebarItem icon={CalendarDays} label="Cronograma" active={activeTab === 'planner'} onClick={() => setActiveTab('planner')} />
                <SidebarItem icon={CheckSquare} label="Tarefas" active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
                <SidebarItem icon={Calendar} label="Agenda" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
                <SidebarItem icon={Layers} label="Disciplinas" active={activeTab === 'subjects'} onClick={() => setActiveTab('subjects')} />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 space-y-2">
              <div className="flex items-center space-x-3 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="text-brand-primary" size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
                  <p className="text-[10px] text-brand-primary font-black uppercase tracking-widest">Estudante de Med</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all font-bold text-sm"
              >
                <LogOut size={18} />
                <span>Sair</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 flex items-center justify-between px-8 bg-brand-bg md:bg-transparent absolute top-0 left-0 right-0 z-10 pointer-events-none">
           <div className="pointer-events-auto flex items-center space-x-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 text-gray-500 hover:text-brand-primary transition-colors"
              >
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>

              {!isSidebarOpen && (
                <div className="h-8 flex items-center space-x-2">
                  <img src="/logomanu.png" alt="Scudeli Study" className="app-logo h-full" referrerPolicy="no-referrer" />
                  <span className="text-xs font-black tracking-tighter text-gray-900 uppercase">SCUDELI <span className="text-brand-primary">STUDY</span></span>
                </div>
              )}
           </div>

           <div className="flex items-center space-x-4 pointer-events-auto bg-white/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-gray-100/50">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center space-x-2 text-gray-400 hover:text-brand-primary transition-all"
              >
                <Search size={18} />
                <span className="text-sm w-32 md:w-64 text-left">Busca global...</span>
              </button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto mt-16 p-8">
           {renderContent()}
        </div>
      </main>

      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigate}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
