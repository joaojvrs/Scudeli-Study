import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType, trackAnalytics } from '../lib/supabase';
import { 
  Plus, 
  Search, 
  BookOpen, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  Filter,
  BrainCircuit,
  Sparkles,
  Loader2,
  List,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Question, Material } from '../types';
import SimulationMode from './SimulationMode';
import TagPicker from './TagPicker';

const QuestionBank = () => {
  const { subjects, supabaseUser, user, tags: globalTags, questions, materials, refreshAllData } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'browse' | 'create' | 'simulation' | 'ai'>('browse');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});

  // AI Prompt State
  const [aiSourceType, setAiSourceType] = useState<'theme' | 'document'>('theme');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [aiTheme, setAiTheme] = useState('');
  const [aiSubject, setAiSubject] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
  const [aiMultipleChoiceCount, setAiMultipleChoiceCount] = useState(3);
  const [aiDiscursiveCount, setAiDiscursiveCount] = useState(2);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // New Question Form
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);


  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser || !questionText || !formSubjectId) return;

    try {
      await supabase.from('questions').insert({
        text: questionText,
        options,
        answerIndex: correctIndex,
        explanation,
        difficulty,
        subject_id: formSubjectId,
        user_id: supabaseUser.id,
        created_at: new Date().toISOString(),
        source: 'manual',
        tags: formTags
      });
      setActiveView('browse');
      setQuestionText('');
      setOptions(['', '', '', '']);
      setExplanation('');
      setFormTags([]);
      await refreshAllData();
    } catch (err) {
      handleSupabaseError(err, OperationType.CREATE, 'questions');
    }
  };

  const handleGenerateAiQuestions = async () => {
    if (!supabaseUser) return;
    if (aiSourceType === 'theme' && (!aiTheme || !aiSubject)) return;
    if (aiSourceType === 'document' && !selectedMaterialId) return;
    if (aiMultipleChoiceCount + aiDiscursiveCount === 0) return;

    setIsAiGenerating(true);

    try {
      let targetSubjectId = aiSubject;
      const payload: Record<string, unknown> = {
        sourceType: aiSourceType,
        multipleChoiceCount: aiMultipleChoiceCount,
        discursiveCount: aiDiscursiveCount,
        difficulty: aiDifficulty,
      };

      if (aiSourceType === 'document') {
        const material = materials.find(m => m.id === selectedMaterialId);
        if (!material) throw new Error('Material não encontrado');
        payload.documentUrl = material.url;
        payload.documentTitle = material.title;
        targetSubjectId = material.subject_id || '';
      } else {
        payload.subjectName = subjects.find(s => s.id === aiSubject)?.name || '';
        payload.theme = aiTheme;
      }

      const response = await fetch('https://webhook.saveautomatik.shop/webhook/questoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Erro na resposta do webhook');

      const aiQuestions: Partial<Question>[] = await response.json();

      for (const q of aiQuestions) {
        await supabase.from('questions').insert({
          text: q.text,
          options: q.options ?? [],
          answerIndex: q.answerIndex ?? -1,
          explanation: q.explanation || '',
          type: q.type,
          difficulty: aiDifficulty,
          subject_id: targetSubjectId,
          user_id: supabaseUser.id,
          created_at: new Date().toISOString(),
          source: 'ai',
          material_id: aiSourceType === 'document' ? selectedMaterialId : null,
          tags: aiSourceType === 'theme'
            ? ['ia-generated', aiTheme.toLowerCase()]
            : ['ia-generated', 'documento'],
        });
      }

      setIsAiGenerating(false);
      setAiTheme('');
      await refreshAllData();
      alert(`${aiQuestions.length} questões geradas com sucesso!`);
    } catch (e) {
      console.error(e);
      setIsAiGenerating(false);
      alert('Ocorreu um erro ao gerar questões.');
    }
  };

  const handleSelectOption = async (qId: string, index: number) => {
    if (selectedAnswers[qId] !== undefined) return;
    setSelectedAnswers(prev => ({ ...prev, [qId]: index }));
    setShowExplanation(prev => ({ ...prev, [qId]: true }));

    const question = questions.find(q => q.id === qId);
    if (!question || !supabaseUser) return;

    const isCorrect = index === question.answerIndex;

    // Track Analytics
    trackAnalytics(supabaseUser.id, {
      questions_attempted: 1,
      questions_correct: isCorrect ? 1 : 0,
      subject_id: question.subject_id,
      is_correct: isCorrect
    });

    if (!isCorrect) {
      try {
        // Criar item no Caderno de Erros
        await supabase.from('errors').insert({
          user_id: supabaseUser.id,
          question_id: qId,
          answered_at: new Date().toISOString(),
          wrong_option_index: index,
          correct_option_index: question.answerIndex,
          subject_id: question.subject_id,
          context: question.text,
          is_learned: false
        });

        // Opcionalmente: Criar Flashcard do erro
        await supabase.from('flashcards').insert({
          front: `[REVISÃO DE ERRO] ${question.text}`,
          back: `Resposta Correta: ${question.options[question.answerIndex]}\n\nExplicação: ${question.explanation || 'Nenhuma'}`,
          subject_id: question.subject_id,
          user_id: supabaseUser.id,
          next_review: new Date().toISOString(),
          interval: 0,
          easiness: 2.5,
          repetitions: 0,
          created_at: new Date().toISOString(),
          tags: ['erro-automatizado', ...question.tags]
        });
        await refreshAllData();
      } catch (err) {
        console.error("Erro ao processar erro de questão:", err);
      }
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchSubject = selectedSubject === 'all' || q.subject_id === selectedSubject;
    const searchLower = searchTerm.toLowerCase();
    const matchText = q.text.toLowerCase().includes(searchLower);
    const matchTagsSearch = q.tags?.some(tag => tag.toLowerCase().includes(searchLower));
    const matchFilterTags = filterTags.length === 0 || filterTags.every(t => q.tags?.includes(t));
    return matchSubject && (matchText || matchTagsSearch) && matchFilterTags;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-brand-light rounded-2xl flex items-center justify-center text-brand-primary">
            <BrainCircuit size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Banco de Questões</h2>
            <p className="text-sm text-gray-500">Pratique com inteligência artificial e casos clínicos reais.</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveView(activeView === 'simulation' ? 'browse' : 'simulation')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeView === 'simulation' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
            }`}
          >
            <Zap size={18} />
            <span>Simulado</span>
          </button>
          <button
            onClick={() => setActiveView(activeView === 'create' ? 'browse' : 'create')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeView === 'create' ? 'bg-gray-100 text-gray-500' : 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:scale-105'
            }`}
          >
            <Plus size={18} />
            <span>Manual</span>
          </button>
          <button
            onClick={() => setActiveView(activeView === 'ai' ? 'browse' : 'ai')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition-all ${
              activeView === 'ai' ? 'bg-gray-100 text-gray-500' : 'bg-brand-secondary text-white shadow-lg shadow-brand-secondary/20 hover:scale-105'
            }`}
          >
            <Sparkles size={18} />
            <span>Gerar com IA</span>
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por conteúdo ou tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all"
            />
          </div>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-8 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-gray-600 outline-none"
          >
            <option value="all">Todas as Áreas</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        
        <div className="flex items-center space-x-3">
          <Filter size={14} className="text-gray-400" />
          <div className="flex-1">
            <TagPicker selectedTags={filterTags} onChange={setFilterTags} />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'simulation' && (
          <SimulationMode onExit={() => setActiveView('browse')} />
        )}

        {activeView === 'ai' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-brand-secondary/5 border border-brand-secondary/20 p-8 rounded-3xl space-y-6"
          >
            <div className="flex items-center space-x-3 text-brand-secondary">
              <Sparkles size={24} />
              <h3 className="text-xl font-bold">Configurador de IA</h3>
            </div>

            <div className="flex p-1 bg-white rounded-2xl border border-gray-100 w-fit">
               <button 
                onClick={() => setAiSourceType('theme')}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${aiSourceType === 'theme' ? 'bg-brand-secondary text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 Por Tema
               </button>
               <button 
                onClick={() => setAiSourceType('document')}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${aiSourceType === 'document' ? 'bg-brand-secondary text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 Por Documento
               </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {aiSourceType === 'theme' ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Tema Específico</label>
                  <input 
                    type="text"
                    placeholder="Ex: Diabetes Mellitus tipo 2"
                    value={aiTheme}
                    onChange={(e) => setAiTheme(e.target.value)}
                    className="w-full p-4 bg-white rounded-2xl border border-gray-100 outline-none focus:border-brand-secondary transition-all"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Selecionar Material</label>
                  <select 
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    className="w-full p-4 bg-white rounded-2xl border border-gray-100 outline-none focus:border-brand-secondary transition-all"
                  >
                    <option value="">Escolha um documento...</option>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              )}
              
              {aiSourceType === 'theme' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Disciplina</label>
                  <select 
                    value={aiSubject}
                    onChange={(e) => setAiSubject(e.target.value)}
                    className="w-full p-4 bg-white rounded-2xl border border-gray-100 outline-none focus:border-brand-secondary transition-all"
                  >
                    <option value="">Selecione...</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Dificuldade</label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value as any)}
                  className="w-full p-4 bg-white rounded-2xl border border-gray-100 outline-none focus:border-brand-secondary transition-all"
                >
                  <option value="easy">Fácil</option>
                  <option value="medium">Média</option>
                  <option value="hard">Difícil</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Múltipla Escolha</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={aiMultipleChoiceCount}
                  onChange={(e) => setAiMultipleChoiceCount(parseInt(e.target.value) || 0)}
                  className="w-full p-4 bg-white rounded-2xl border border-gray-100 outline-none focus:border-brand-secondary transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Discursivas</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={aiDiscursiveCount}
                  onChange={(e) => setAiDiscursiveCount(parseInt(e.target.value) || 0)}
                  className="w-full p-4 bg-white rounded-2xl border border-gray-100 outline-none focus:border-brand-secondary transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleGenerateAiQuestions}
                disabled={isAiGenerating || aiMultipleChoiceCount + aiDiscursiveCount === 0 || (aiSourceType === 'theme' ? !aiTheme || !aiSubject : !selectedMaterialId)}
                className="bg-brand-secondary text-white px-10 py-4 rounded-2xl font-bold flex items-center space-x-2 hover:bg-brand-secondary/90 transition-all shadow-lg shadow-brand-secondary/20 disabled:opacity-50"
              >
                {loading || isAiGenerating ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                <span>{isAiGenerating ? 'Gerando...' : 'Gerar Questões agora'}</span>
              </button>
            </div>
          </motion.div>
        )}

        {activeView === 'create' && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddQuestion}
            className="bg-white p-8 rounded-3xl shadow-xl border border-brand-light space-y-6"
          >
            {/* ... form content adapted to brand primary ... */}
            <div className="space-y-4">
               <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Enunciado da Questão</label>
                  <textarea 
                    value={questionText} 
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Descreva o caso clínico ou a pergunta teórica..."
                    className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-sm min-h-[120px] focus:bg-white focus:ring-4 focus:ring-brand-primary/5 border border-transparent focus:border-brand-primary/20 transition-all"
                    required
                  />
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Alternativas</label>
                     {options.map((opt, i) => (
                       <div key={i} className="flex items-center space-x-3">
                          <button 
                            type="button" 
                            onClick={() => setCorrectIndex(i)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${correctIndex === i ? 'bg-brand-primary border-brand-primary' : 'border-gray-200 hover:border-brand-primary/50'}`}
                          >
                             {correctIndex === i && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </button>
                          <input 
                            type="text" 
                            value={opt} 
                            onChange={(e) => {
                              const newOpts = [...options];
                              newOpts[i] = e.target.value;
                              setOptions(newOpts);
                            }}
                            placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                            className="flex-1 p-4 bg-gray-50 rounded-2xl outline-none text-sm border border-transparent focus:bg-white focus:border-brand-primary/20 transition-all"
                            required
                          />
                       </div>
                     ))}
                  </div>
                  
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Gabarito Comentado</label>
                        <textarea 
                          value={explanation} 
                          onChange={(e) => setExplanation(e.target.value)}
                          placeholder="Explique por que esta alternativa é a correta..."
                          className="w-full p-4 bg-gray-50 rounded-2xl outline-none text-sm min-h-[150px] border border-transparent focus:bg-white focus:border-brand-primary/20 transition-all"
                        />
                     </div>

                     <div className="space-y-4">
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tags Especializadas</label>
                           <TagPicker selectedTags={formTags} onChange={setFormTags} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Disciplina</label>
                              <select 
                                value={formSubjectId} 
                                onChange={(e) => setFormSubjectId(e.target.value)}
                                className="w-full p-4 bg-gray-50 rounded-2xl text-xs outline-none focus:bg-white border focus:border-brand-primary/20 transition-all"
                                required
                              >
                                 <option value="">Selecione...</option>
                                 {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                           </div>
                           <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dificuldade</label>
                              <select 
                                value={difficulty} 
                                onChange={(e) => setDifficulty(e.target.value as any)}
                                className="w-full p-4 bg-gray-50 rounded-2xl text-xs outline-none focus:bg-white border focus:border-brand-primary/20 transition-all"
                              >
                                 <option value="easy">Fácil</option>
                                 <option value="medium">Média</option>
                                 <option value="hard">Difícil</option>
                              </select>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
            <div className="flex justify-end space-x-6 pt-4">
               <button type="button" onClick={() => setActiveView('browse')} className="text-gray-400 font-bold hover:text-gray-600 transition-colors">Cancelar</button>
               <button type="submit" className="px-12 py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg shadow-brand-primary/20">Salvar Manualmente</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {filteredQuestions.map((q, qIndex) => (
          <motion.div 
            key={q.id} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: qIndex * 0.05 }}
            className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-all group"
          >
             <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                   <div className="flex items-center space-x-3">
                      <span className="text-[10px] font-black px-4 py-1.5 bg-gray-50 text-gray-400 rounded-full uppercase tracking-[0.2em] border border-gray-100">
                         Questão #{qIndex + 1}
                      </span>
                      {q.source === 'ai' && (
                        <span className="flex items-center space-x-1 text-[10px] font-black px-3 py-1 bg-brand-secondary/10 text-brand-secondary rounded-full uppercase tracking-[0.2em]">
                           <Sparkles size={10} />
                           <span>IA</span>
                        </span>
                      )}
                      <span className="text-[10px] font-black text-brand-primary/60 uppercase tracking-[0.2em]">
                         {subjects.find(s => s.id === q.subject_id)?.name || 'Geral'}
                      </span>
                   </div>
                   <div className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full border ${
                      q.difficulty === 'easy' ? 'bg-green-50 text-green-500 border-green-100' :
                      q.difficulty === 'medium' ? 'bg-orange-50 text-orange-500 border-orange-100' :
                      'bg-red-50 text-red-500 border-red-100'
                   } tracking-[0.2em]`}>
                      {q.difficulty}
                   </div>
                </div>

                <p className="text-xl font-bold text-gray-900 leading-snug">
                   {q.text}
                </p>

                <div className="grid grid-cols-1 gap-3">
                   {q.options.map((opt, i) => {
                      const isCorrect = i === q.answerIndex;
                      const isSelected = selectedAnswers[q.id] === i;
                      const hasAnswered = selectedAnswers[q.id] !== undefined;

                      let variantStyle = "bg-gray-50 border-transparent hover:bg-gray-100";
                      if (hasAnswered) {
                        if (isCorrect) variantStyle = "bg-green-50 border-green-200 text-green-700 font-bold";
                        else if (isSelected) variantStyle = "bg-red-50 border-red-200 text-red-700 font-bold";
                        else variantStyle = "bg-gray-50 border-transparent opacity-40 grayscale-[0.5]";
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => handleSelectOption(q.id, i)}
                          disabled={hasAnswered}
                          className={`w-full p-5 rounded-[20px] border-2 text-left transition-all flex items-center justify-between group/opt ${variantStyle}`}
                        >
                           <div className="flex items-center space-x-5">
                              <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all sm:group-hover/opt:scale-110 ${
                                isCorrect && hasAnswered ? 'bg-green-500 text-white' : 
                                isSelected && !isCorrect ? 'bg-red-500 text-white' : 'bg-white text-gray-400 group-hover/opt:text-brand-primary'
                              }`}>
                                 {String.fromCharCode(65 + i)}
                              </span>
                              <span className="text-sm tracking-tight">{opt}</span>
                           </div>
                           {hasAnswered && isCorrect && <CheckCircle2 size={24} className="text-green-500 shrink-0" />}
                           {hasAnswered && isSelected && !isCorrect && <XCircle size={24} className="text-red-500 shrink-0" />}
                        </button>
                      );
                   })}
                </div>

                <AnimatePresence>
                   {showExplanation[q.id] && q.explanation && (
                     <motion.div
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="mt-8 p-8 bg-brand-light/30 border border-brand-primary/10 rounded-[28px] space-y-4"
                     >
                        <div className="flex items-center space-x-2 text-brand-primary">
                           <MessageSquare size={16} />
                           <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Explicativo Profissional</h4>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed font-medium">
                           {q.explanation}
                        </p>
                     </motion.div>
                   )}
                </AnimatePresence>
             </div>
          </motion.div>
        ))}

        {filteredQuestions.length === 0 && !loading && (
          <div className="py-32 bg-gray-50/50 rounded-[40px] border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 space-y-4">
             <div className="p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
               <BrainCircuit className="text-gray-200" size={64} />
             </div>
             <div className="space-y-1">
               <p className="text-gray-900 font-bold">Nenhuma questão encontrada</p>
               <p className="text-gray-400 text-sm max-w-sm">Tente mudar os filtros ou use nossa IA para gerar questões inéditas agora mesmo.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionBank;
