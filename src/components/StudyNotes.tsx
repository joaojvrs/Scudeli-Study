import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  Trash2, 
  FileText, 
  MoreVertical,
  ChevronRight,
  BookOpen,
  ArrowLeft,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import TagPicker from './TagPicker';

const StudyNotes = () => {
  const { notes, subjects, firebaseUser, tags: globalTags } = useAppContext();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  const filteredNotes = notes.filter(n => {
    const matchSubject = selectedSubject === 'all' || n.subjectId === selectedSubject;
    const matchSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        n.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTags = filterTags.length === 0 || filterTags.every(t => n.tags?.includes(t));
    return matchSubject && matchSearch && matchTags;
  });

  const handleCreateNote = async () => {
    if (!firebaseUser) return;
    try {
      const docRef = await addDoc(collection(db, 'notes'), {
        title: 'Nova Nota',
        content: '',
        subjectId: subjects[0]?.id || 'default',
        userId: firebaseUser.uid,
        updatedAt: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      setSelectedNoteId(docRef.id);
      setIsCreating(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notes');
    }
  };

  const handleUpdateNote = async (id: string, updates: any) => {
    try {
      await updateDoc(doc(db, 'notes', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notes/${id}`);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Deseja excluir esta nota?')) return;
    try {
      await deleteDoc(doc(db, 'notes', id));
      if (selectedNoteId === id) setSelectedNoteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `notes/${id}`);
    }
  };

  if (selectedNoteId && selectedNote) {
    return (
      <div className="h-full flex flex-col space-y-6">
        <header className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedNoteId(null)}
            className="flex items-center space-x-2 text-gray-500 hover:text-brand-primary font-medium"
          >
            <ArrowLeft size={20} />
            <span>Voltar para Notas</span>
          </button>
          <div className="flex items-center space-x-3">
             <select 
               value={selectedNote.subjectId}
               onChange={(e) => handleUpdateNote(selectedNote.id, { subjectId: e.target.value })}
               className="bg-white px-4 py-2 rounded-xl text-xs font-bold border border-gray-100 outline-none"
             >
               {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
             <button 
              onClick={() => handleDeleteNote(selectedNote.id)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
             >
               <Trash2 size={20} />
             </button>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
          {/* Editor */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-50 p-8 flex flex-col space-y-6">
            <div className="space-y-4">
              <input 
                type="text"
                value={selectedNote.title}
                onChange={(e) => handleUpdateNote(selectedNote.id, { title: e.target.value })}
                className="w-full text-3xl font-bold text-gray-900 border-none outline-none placeholder:text-gray-200"
                placeholder="Título da Nota"
              />
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">Tags Globais</label>
                <TagPicker 
                  selectedTags={selectedNote.tags || []} 
                  onChange={(newTags) => handleUpdateNote(selectedNote.id, { tags: newTags })} 
                />
              </div>
            </div>
            <textarea
              value={selectedNote.content}
              onChange={(e) => handleUpdateNote(selectedNote.id, { content: e.target.value })}
              className="flex-1 border-none outline-none text-gray-700 leading-relaxed resize-none scrollbar-thin placeholder:text-gray-200 min-h-[400px]"
              placeholder="Comece a escrever seu conhecimento médico (Markdown suportado)..."
            />
          </div>

          {/* Preview */}
          <div className="hidden lg:block bg-brand-bg rounded-3xl p-8 overflow-y-auto border border-gray-100/50">
            <div className="markdown-body">
               <h1 className="text-3xl font-bold text-gray-900 mb-6">{selectedNote.title}</h1>
               <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Suas Notas</h2>
            <p className="text-sm text-gray-500">Editor estilo Notion focado em organização.</p>
          </div>
        </div>
        <button
          onClick={handleCreateNote}
          className="flex items-center space-x-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95"
        >
          <Plus size={18} />
          <span>Nova Nota</span>
        </button>
      </header>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar em todas as notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm outline-none shadow-sm focus:ring-4 focus:ring-brand-primary/5 transition-all"
            />
          </div>
          <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
             <button 
               onClick={() => setSelectedSubject('all')}
               className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${selectedSubject === 'all' ? 'bg-orange-50 text-orange-500' : 'text-gray-400'}`}
             >
               Tudo
             </button>
             {subjects.map(s => (
               <button 
                 key={s.id}
                 onClick={() => setSelectedSubject(s.id)}
                 className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${selectedSubject === s.id ? 'bg-orange-50 text-orange-500' : 'text-gray-400'}`}
               >
                 {s.name}
               </button>
             ))}
          </div>
        </div>

        <div className="flex items-center space-x-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
           <Filter size={16} className="text-gray-400 ml-2" />
           <div className="flex-1">
              <TagPicker selectedTags={filterTags} onChange={setFilterTags} />
           </div>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredNotes.map(note => (
          <motion.div
            key={note.id}
            whileHover={{ y: -4 }}
            onClick={() => setSelectedNoteId(note.id)}
            className="group bg-white p-6 rounded-3xl border border-gray-50 shadow-sm hover:shadow-xl transition-all cursor-pointer relative"
          >
            <div className="flex justify-between items-start mb-4">
               <div className="p-2 bg-orange-50 text-orange-500 rounded-xl">
                  <FileText size={16} />
               </div>
               <span className="text-[10px] font-bold text-gray-400">
                  {new Date(note.updatedAt).toLocaleDateString('pt-BR')}
               </span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2 truncate">{note.title}</h3>
            <p className="text-xs text-gray-500 line-clamp-3 mb-4 leading-relaxed">
               {note.content || 'Sem conteúdo ainda...'}
            </p>
            <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
               <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
                  {subjects.find(s => s.id === note.subjectId)?.name || 'Geral'}
               </span>
               <ChevronRight size={14} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
            </div>
          </motion.div>
        ))}

        {filteredNotes.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
             <FileText className="text-gray-200 mb-4" size={48} />
             <p className="text-gray-400 text-sm">Nenhuma nota encontrada. Crie sua primeira nota agora!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyNotes;
