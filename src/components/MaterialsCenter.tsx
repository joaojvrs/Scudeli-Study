import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Upload,
  Search,
  File,
  Image as ImageIcon,
  Brain,
  FileSearch,
  Trash2,
  Tag,
  ChevronRight,
  Loader2,
  BrainCircuit,
  Filter
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { Material } from '../types';
import { geminiService } from '../services/geminiService';
import TagPicker from './TagPicker';

const MaterialsCenter = () => {
  const { session, subjects, materials } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [processingAI, setProcessingAI] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  const handleSimulateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !session) return;
    const file = e.target.files[0];
    setIsUploading(true);

    setTimeout(async () => {
      try {
        const { error } = await supabase.from('materials').insert({
          user_id: session.user.id,
          title: file.name,
          type: file.type.includes('pdf') ? 'pdf' : file.type.includes('image') ? 'image' : 'docx',
          url: 'https://example.com/simulated-file.pdf',
          subject_id: subjects[0]?.id || 'general',
          tags: [],
          summary: '',
        });
        if (error) handleSupabaseError(error, OperationType.CREATE, 'materials');
      } finally {
        setIsUploading(false);
      }
    }, 1500);
  };

  const handleProcessAI = async (material: Material) => {
    setProcessingAI(true);
    try {
      const simulatedContent = `Este documento trata sobre ${material.title}. Os principais conceitos envolvem fisiopatologia aplicada ao contexto clínico médico.`;

      const summary = await geminiService.summarizeMaterial(simulatedContent);
      const flashcards = await geminiService.generateFlashcardsFromContent(simulatedContent);
      const questions = await geminiService.generateQuestions(
        subjects.find(s => s.id === material.subject_id)?.name || 'Medicina',
        material.title,
        'medium',
        3
      );

      await supabase.from('materials').update({ summary }).eq('id', material.id);
      setSelectedMaterial({ ...material, summary });

      for (const card of flashcards) {
        await supabase.from('flashcards').insert({
          ...card,
          user_id: session?.user.id,
          subject_id: material.subject_id,
          next_review: new Date().toISOString(),
          interval: 1,
          easiness: 2.5,
          repetitions: 0,
          tags: ['ia-generated', 'material-sync', material.title],
        });
      }

      for (const q of questions) {
        await supabase.from('questions').insert({
          ...q,
          user_id: session?.user.id,
          subject_id: material.subject_id,
          difficulty: 'medium',
          source: 'ai',
          tags: ['ia-generated', 'material-sync', material.title],
        });
      }

      alert('IA Processada: Resumo gerado, 5 flashcards e 3 questões criadas!');
    } catch (e) {
      console.error(e);
      alert('Erro ao processar IA.');
    } finally {
      setProcessingAI(false);
    }
  };

  const handleGenerateQuestions = async (material: Material) => {
    setGeneratingQuestions(true);
    try {
      const simulatedContent = `Este documento trata sobre ${material.title}. Os principais conceitos envolvem fisiopatologia aplicada ao contexto clínico médico.`;
      const questions = await geminiService.generateQuestions(
        subjects.find(s => s.id === material.subject_id)?.name || 'Medicina',
        material.title,
        'medium',
        5
      );

      for (const q of questions) {
        await supabase.from('questions').insert({
          ...q,
          user_id: session?.user.id,
          subject_id: material.subject_id,
          material_id: material.id,
          difficulty: 'medium',
          source: 'ai',
          tags: ['document-based', material.title],
        });
      }
      alert('5 questões geradas a partir do documento!');
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar questões.');
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const deleteMaterial = async (id: string) => {
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (error) handleSupabaseError(error, OperationType.DELETE, `materials/${id}`);
    else setSelectedMaterial(null);
  };

  const filteredMaterials = materials.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTags = filterTags.length === 0 || filterTags.every(t => m.tags?.includes(t));
    return matchSearch && matchTags;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header className="flex justify-between items-center bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Centro de Materiais</h1>
          <p className="text-gray-500 text-sm">Gerencie PDFs e utilize IA para processar seu conhecimento.</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-gray-50 border border-gray-100 rounded-2xl w-80 outline-none focus:bg-white focus:ring-4 focus:ring-brand-primary/5 transition-all text-sm"
            />
          </div>

          <label className="cursor-pointer bg-brand-primary text-white px-8 py-3 rounded-2xl font-bold flex items-center space-x-2 hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20">
            {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
            <span>Subir Material</span>
            <input type="file" className="hidden" onChange={handleSimulateUpload} />
          </label>
        </div>
      </header>

      <div className="flex items-center space-x-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
         <Filter size={16} className="text-gray-400 ml-2" />
         <div className="flex-1">
            <TagPicker selectedTags={filterTags} onChange={setFilterTags} />
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMaterials.map(material => (
              <motion.div
                key={material.id}
                layoutId={material.id}
                onClick={() => setSelectedMaterial(material)}
                className={`p-6 bg-white rounded-3xl border transition-all cursor-pointer group ${
                  selectedMaterial?.id === material.id ? 'border-brand-primary shadow-lg ring-1 ring-brand-primary' : 'border-gray-100 hover:border-brand-primary/50'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl ${
                    material.type === 'pdf' ? 'bg-red-50 text-red-500' :
                    material.type === 'image' ? 'bg-blue-50 text-blue-500' : 'bg-brand-light text-brand-primary'
                  }`}>
                    {material.type === 'pdf' ? <FileText size={24} /> : material.type === 'image' ? <ImageIcon size={24} /> : <File size={24} />}
                  </div>
                </div>

                <div className="space-y-2">
                   <h3 className="font-bold text-gray-900 group-hover:text-brand-primary transition-colors line-clamp-1">{material.title}</h3>
                   <div className="flex items-center space-x-2 text-xs text-gray-400">
                     <span>{new Date(material.created_at).toLocaleDateString()}</span>
                     <span>•</span>
                     <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                       {subjects.find(s => s.id === material.subject_id)?.name || 'Geral'}
                     </span>
                   </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-400">
                   <span className="flex items-center space-x-1">
                      <Tag size={12} />
                      <span>{material.tags?.length || 0} Tags</span>
                   </span>
                   {material.summary && (
                     <span className="text-brand-primary flex items-center space-x-1">
                       <Brain size={12} />
                       <span>IA Ativa</span>
                     </span>
                   )}
                </div>
              </motion.div>
            ))}

            {filteredMaterials.length === 0 && (
              <div className="col-span-full py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                  <File size={32} />
                </div>
                <p className="text-gray-400">Nenhum material encontrado.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <AnimatePresence mode="wait">
            {selectedMaterial ? (
              <motion.div
                key={selectedMaterial.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden sticky top-8"
              >
                <div className="h-40 bg-gray-50 flex items-center justify-center">
                  <FileSearch size={48} className="text-gray-200" />
                </div>

                <div className="p-8 space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-gray-900">{selectedMaterial.title}</h2>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                       <span className="flex items-center space-x-1">
                         <FileText size={14} />
                         <span>{selectedMaterial.type.toUpperCase()}</span>
                       </span>
                       <span className="bg-brand-light text-brand-primary px-2 py-0.5 rounded-md">
                         {subjects.find(s => s.id === selectedMaterial.subject_id)?.name}
                       </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleProcessAI(selectedMaterial)}
                      disabled={processingAI}
                      className="flex flex-col items-center justify-center p-4 bg-brand-light hover:bg-brand-primary/10 text-brand-primary rounded-2xl transition-all border border-brand-primary/20 space-y-2 disabled:opacity-50"
                    >
                      {processingAI ? <Loader2 className="animate-spin" size={20} /> : <Brain size={20} />}
                      <span className="text-[10px] font-bold uppercase tracking-widest text-center">IA: Resumo & Cards</span>
                    </button>
                    <button
                      onClick={() => handleGenerateQuestions(selectedMaterial)}
                      disabled={generatingQuestions}
                      className="flex flex-col items-center justify-center p-4 bg-brand-secondary/10 hover:bg-brand-secondary/20 text-brand-secondary rounded-2xl transition-all border border-brand-secondary/20 space-y-2 disabled:opacity-50"
                    >
                      {generatingQuestions ? <Loader2 className="animate-spin" size={20} /> : <BrainCircuit size={20} />}
                      <span className="text-[10px] font-bold uppercase tracking-widest text-center">IA: Gerar Questões</span>
                    </button>
                  </div>

                  {selectedMaterial.summary && (
                    <div className="space-y-4 pt-6 border-t border-gray-50 animate-in fade-in slide-in-from-top-4">
                       <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center space-x-2">
                         <Brain size={14} className="text-brand-primary" />
                         <span>Resumo Inteligente</span>
                       </h4>
                       <div className="text-sm text-gray-600 leading-relaxed bg-brand-light/50 p-4 rounded-2xl">
                         {selectedMaterial.summary}
                       </div>
                    </div>
                  )}

                  <div className="pt-8 border-t border-gray-50 flex items-center justify-between">
                     <button className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">Ver Documento</button>
                     <button
                       onClick={() => deleteMaterial(selectedMaterial.id)}
                       className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                     >
                       <Trash2 size={18} />
                     </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-96 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 space-y-4">
                 <div className="p-4 bg-white rounded-2xl shadow-sm">
                   <ChevronRight size={24} className="text-gray-300" />
                 </div>
                 <p className="text-gray-400 text-sm font-medium">Selecione um documento para processar com inteligência artificial.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default MaterialsCenter;
