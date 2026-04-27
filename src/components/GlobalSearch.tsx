import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { 
  Search, 
  X, 
  FileText, 
  BrainCircuit, 
  HelpCircle, 
  BookOpen,
  ArrowRight,
  Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, id?: string) => void;
}

const GlobalSearch = ({ isOpen, onClose, onNavigate }: GlobalSearchProps) => {
  const { notes, flashcards, questions, materials, tags } = useAppContext();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'notes' | 'flashcards' | 'questions' | 'materials'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const results = {
    notes: (notes || []).filter(n => (n.title || '').toLowerCase().includes(query.toLowerCase()) || (n.content || '').toLowerCase().includes(query.toLowerCase())),
    flashcards: (flashcards || []).filter(f => (f.front || '').toLowerCase().includes(query.toLowerCase()) || (f.back || '').toLowerCase().includes(query.toLowerCase())),
    questions: (questions || []).filter(q => (q.text || '').toLowerCase().includes(query.toLowerCase())),
    materials: (materials || []).filter(m => (m.title || '').toLowerCase().includes(query.toLowerCase()))
  };

  const totalResults = results.notes.length + results.flashcards.length + results.questions.length + results.materials.length;

  const handleSelect = (type: string, id: string) => {
    onNavigate(type, id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center space-x-4">
          <Search className="text-gray-400" size={20} />
          <input 
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca global (Notas, Flashcards, Questões...)"
            className="flex-1 bg-transparent border-none outline-none text-lg font-medium text-gray-900 placeholder:text-gray-300"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex bg-gray-50/50 p-2 space-x-1">
          {(['all', 'notes', 'flashcards', 'questions', 'materials'] as const).map(f => (
            <button
               key={f}
               onClick={() => setFilter(f)}
               className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                 filter === f ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'
               }`}
            >
              {f === 'all' ? 'Tudo' : f === 'notes' ? 'Notas' : f === 'flashcards' ? 'Flashcards' : f === 'questions' ? 'Questões' : 'Materiais'}
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6 scrollbar-hide">
          {query.length < 2 ? (
            <div className="py-20 text-center space-y-4">
               <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                  <Search size={32} />
               </div>
               <p className="text-sm font-bold text-gray-400">Digite ao menos 2 caracteres para buscar...</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-20 text-center space-y-4">
               <p className="text-sm font-bold text-gray-400">Nenhum resultado encontrado para "{query}"</p>
            </div>
          ) : (
            <>
              {(filter === 'all' || filter === 'notes') && results.notes.length > 0 && (
                <Section title="Notas de Estudo" count={results.notes.length}>
                  {results.notes.map(note => (
                    <ResultItem 
                      key={note.id}
                      icon={<FileText size={18} />}
                      title={note.title}
                      subtitle={note.content.substring(0, 60) + '...'}
                      onClick={() => handleSelect('notes', note.id)}
                    />
                  ))}
                </Section>
              )}

              {(filter === 'all' || filter === 'flashcards') && results.flashcards.length > 0 && (
                <Section title="Flashcards" count={results.flashcards.length}>
                  {results.flashcards.map(card => (
                    <ResultItem 
                      key={card.id}
                      icon={<BrainCircuit size={18} />}
                      title={card.front}
                      subtitle={`Próxima revisão: ${new Date(card.nextReview).toLocaleDateString()}`}
                      onClick={() => handleSelect('flashcards', card.id)}
                    />
                  ))}
                </Section>
              )}

              {(filter === 'all' || filter === 'questions') && results.questions.length > 0 && (
                <Section title="Banco de Questões" count={results.questions.length}>
                  {results.questions.map(q => (
                    <ResultItem 
                      key={q.id}
                      icon={<HelpCircle size={18} />}
                      title={q.text}
                      subtitle={`Fonte: ${q.source || 'Manual'}`}
                      onClick={() => handleSelect('questions', q.id)}
                    />
                  ))}
                </Section>
              )}

              {(filter === 'all' || filter === 'materials') && results.materials.length > 0 && (
                <Section title="Materiais & PDFs" count={results.materials.length}>
                  {results.materials.map(m => (
                    <ResultItem 
                      key={m.id}
                      icon={<BookOpen size={18} />}
                      title={m.title}
                      subtitle={m.type.toUpperCase()}
                      onClick={() => handleSelect('materials', m.id)}
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const Section = ({ title, count, children }: { title: string, count: number, children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between px-2">
      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</h4>
      <span className="text-[10px] font-black text-brand-primary bg-brand-light px-2 py-0.5 rounded-full">{count}</span>
    </div>
    <div className="space-y-1">
      {children}
    </div>
  </div>
);

const ResultItem = ({ icon, title, subtitle, onClick }: { icon: React.ReactNode, title: string, subtitle: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="w-full text-left p-4 rounded-2xl hover:bg-gray-50 flex items-center justify-between group transition-all"
  >
    <div className="flex items-center space-x-4 overflow-hidden">
      <div className="w-10 h-10 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-brand-light group-hover:text-brand-primary transition-all">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{title}</p>
        <p className="text-xs text-gray-400 truncate font-medium">{subtitle}</p>
      </div>
    </div>
    <ArrowRight size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
  </button>
);

export default GlobalSearch;
