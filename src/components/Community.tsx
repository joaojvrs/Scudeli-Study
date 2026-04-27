import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Heart, 
  Share2, 
  Plus, 
  User as UserIcon, 
  Clock, 
  BookOpen, 
  Trophy, 
  Filter,
  MoreVertical,
  Send,
  X,
  Target,
  Zap,
  Image as ImageIcon,
  Music,
  Link as LinkIcon,
  Loader2,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../contexts/AppContext';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  increment,
  getDocs,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Post, Comment } from '../types';

const Community = () => {
  const { user, firebaseUser, subjects, posts } = useAppContext();
  const [isPosting, setIsPosting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine' | 'achievements'>('all');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  
  // New Post State
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState<'study_update' | 'achievement' | 'reflection'>('study_update');
  const [newPostSubject, setNewPostSubject] = useState('');
  const [newPostStudyMinutes, setNewPostStudyMinutes] = useState<number | ''>('');
  const [newPostImageUrl, setNewPostImageUrl] = useState('');
  const [newPostMusicLink, setNewPostMusicLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMusicInput, setShowMusicInput] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;

    if (!storage) {
      alert('O serviço de Armazenamento (Storage) não está ativo neste projeto. Por favor, ative-o no console do Firebase.');
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `posts/${firebaseUser.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setNewPostImageUrl(url);
    } catch (error) {
      alert('Erro ao fazer upload da imagem. Verifique o tamanho e formato.');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !user) return;
    if (!newPostContent.trim() && !newPostImageUrl) {
       alert('O post precisa ter pelo menos um texto ou uma imagem.');
       return;
    }

    setIsSubmitting(true);
    try {
      const postData = {
        userId: firebaseUser.uid,
        userName: user.name || user.email || 'Estudante',
        userEmail: user.email,
        content: newPostContent,
        textContent: newPostContent,
        imageUrl: newPostImageUrl || null,
        musicLink: newPostMusicLink || null,
        type: newPostType,
        subjectId: newPostSubject || null,
        studyMinutes: newPostStudyMinutes || 0,
        createdAt: serverTimestamp(),
        likesCount: 0,
        commentsCount: 0,
        isPublic: true,
        likes: []
      };

      await addDoc(collection(db, 'posts'), postData);
      setNewPostContent('');
      setNewPostType('study_update');
      setNewPostSubject('');
      setNewPostStudyMinutes('');
      setNewPostImageUrl('');
      setNewPostMusicLink('');
      setShowMusicInput(false);
      setIsPosting(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'posts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (post: Post) => {
    if (!firebaseUser) return;
    const isLiked = post.likes?.includes(firebaseUser.uid);
    const postRef = doc(db, 'posts', post.id);

    try {
      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(firebaseUser.uid) : arrayUnion(firebaseUser.uid),
        likesCount: increment(isLiked ? -1 : 1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `posts/${post.id}`);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta postagem?')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const filteredPosts = posts.filter(post => {
    if (filter === 'mine') return post.userId === firebaseUser?.uid;
    if (filter === 'achievements') return post.type === 'achievement';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-bold text-gray-900 tracking-tight">Comunidade</h2>
          <p className="text-gray-500 font-medium">Compartilhe sua jornada e inspire outros estudantes.</p>
        </div>
        
        <button 
          onClick={() => setIsPosting(true)}
          className="flex items-center space-x-2 bg-brand-primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-brand-primary/20 hover:scale-105 transition-all"
        >
          <Plus size={20} />
          <span>Nova Postagem</span>
        </button>
      </header>

      <div className="flex space-x-2 bg-white p-1.5 rounded-[20px] border border-gray-100 w-fit">
        {(['all', 'mine', 'achievements'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              filter === f 
                ? 'bg-brand-primary text-white shadow-md' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'mine' ? 'Minhas' : 'Conquistas'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="popLayout">
            {filteredPosts.map((post) => (
              <PostCard 
                key={post.id} 
                post={post} 
                onLike={() => handleLike(post)}
                onComment={() => setSelectedPost(post)}
                isLiked={post.likes?.includes(firebaseUser?.uid || '')}
                onDelete={() => handleDeletePost(post.id)}
              />
            ))}
          </AnimatePresence>

          {filteredPosts.length === 0 && (
            <div className="bg-white rounded-[32px] p-20 text-center border border-gray-100">
               <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="text-gray-300" size={32} />
               </div>
               <h3 className="text-xl font-bold text-gray-900 mb-2">Nada por aqui ainda</h3>
               <p className="text-gray-400 max-w-xs mx-auto">Seja o primeiro a compartilhar seu progresso hoje!</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <CommunityStats onPost={() => setIsPosting(true)} />
          <TrendingTopics />
        </div>
      </div>

      {/* Post Modal */}
      <AnimatePresence>
        {isPosting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPosting(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-10 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold">O que há de novo?</h3>
                <button onClick={() => setIsPosting(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleCreatePost} className="space-y-6">
                <div className="flex space-x-2">
                  {(['study_update', 'achievement', 'reflection'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewPostType(t)}
                      className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        newPostType === t 
                          ? 'bg-brand-primary text-white' 
                          : 'bg-gray-50 text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {t === 'study_update' ? 'Estudo' : t === 'achievement' ? 'Conquista' : 'Reflexão'}
                    </button>
                  ))}
                </div>

                <textarea
                  required={!newPostImageUrl}
                  placeholder="No que você está trabalhando hoje?"
                  className="w-full h-32 bg-gray-50 rounded-2xl p-6 outline-none focus:ring-2 ring-brand-primary/20 text-gray-900 font-medium placeholder:text-gray-300 resize-none transition-all"
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                />

                {newPostImageUrl && (
                  <div className="relative rounded-2xl overflow-hidden group">
                     <img src={newPostImageUrl} alt="Preview" className="w-full h-48 object-cover" referrerPolicy="no-referrer" />
                     <button 
                       type="button"
                       onClick={() => setNewPostImageUrl('')}
                       className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                     >
                        <X size={16} />
                     </button>
                  </div>
                )}

                {showMusicInput && (
                   <div className="relative">
                      <Music size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text"
                        placeholder="Link do Spotify, YouTube ou MP3..."
                        className="w-full bg-gray-50 border-none px-12 py-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-brand-primary/20 transition-all"
                        value={newPostMusicLink}
                        onChange={(e) => setNewPostMusicLink(e.target.value)}
                      />
                   </div>
                )}

                <div className="flex items-center space-x-2">
                   <label className="flex items-center justify-center space-x-2 bg-gray-50 text-gray-500 hover:text-brand-primary h-14 flex-1 rounded-2xl font-bold cursor-pointer transition-all hover:bg-brand-light active:scale-95">
                      {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                      <span className="text-[10px] uppercase tracking-widest">Galeria</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                   </label>
                   
                   <label className="flex items-center justify-center space-x-2 bg-gray-50 text-gray-500 hover:text-brand-primary h-14 flex-1 rounded-2xl font-bold cursor-pointer transition-all hover:bg-brand-light active:scale-95">
                      {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                      <span className="text-[10px] uppercase tracking-widest">Câmera</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                   </label>

                   <button 
                     type="button"
                     onClick={() => setShowMusicInput(!showMusicInput)}
                     className={`flex items-center justify-center space-x-2 h-14 flex-1 rounded-2xl font-bold transition-all active:scale-95 ${showMusicInput ? 'bg-brand-primary text-white' : 'bg-gray-50 text-gray-500 hover:text-brand-primary hover:bg-brand-light'}`}
                   >
                      <Music size={18} />
                      <span className="text-[10px] uppercase tracking-widest">Música</span>
                   </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={newPostSubject}
                    onChange={(e) => setNewPostSubject(e.target.value)}
                    className="bg-gray-50 border-none px-6 py-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-brand-primary/20 transition-all"
                  >
                    <option value="">Disciplina (opcional)</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Minutos (opcional)"
                    className="bg-gray-50 border-none px-6 py-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-brand-primary/20 transition-all"
                    value={newPostStudyMinutes}
                    onChange={(e) => setNewPostStudyMinutes(e.target.value ? parseInt(e.target.value) : '')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !newPostContent.trim()}
                  className="w-full bg-brand-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {isSubmitting ? 'Publicando...' : 'Postar na Comunidade'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <PostDetailModal 
            post={selectedPost} 
            onClose={() => setSelectedPost(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const PostCard = ({ post, onLike, onComment, isLiked, onDelete }: { post: Post, onLike: () => void, onComment: () => void, isLiked: boolean, onDelete?: () => void }) => {
  const { subjects, firebaseUser } = useAppContext();
  const subjectName = post.subjectId ? subjects.find(s => s.id === post.subjectId)?.name || post.subjectId : null;
  const isOwner = firebaseUser?.uid === post.userId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-brand-primary font-black text-xl overflow-hidden">
            {post.userName?.[0] || 'U'}
          </div>
          <div>
            <h4 className="font-bold text-gray-900">{post.userName}</h4>
            <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              <Clock size={12} />
              <span>{post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleDateString() : 'Agora'}</span>
              <span>•</span>
              <span className="text-brand-primary">
                {post.type === 'study_update' ? 'Estudo' : post.type === 'achievement' ? 'Conquista' : 'Reflexão'}
              </span>
            </div>
          </div>
        </div>
        {isOwner && onDelete && (
          <button 
            onClick={onDelete}
            className="p-2 text-gray-300 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="space-y-4 mb-8">
        {post.textContent && (
          <p className="text-gray-600 leading-relaxed font-medium">
            {post.textContent}
          </p>
        )}

        {post.imageUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-3xl overflow-hidden bg-gray-50"
          >
             <img src={post.imageUrl} alt="Post" className="w-full h-auto max-h-[500px] object-cover" referrerPolicy="no-referrer" />
          </motion.div>
        )}

        {post.musicLink && (
          <div className="bg-gray-50 rounded-2xl p-4 flex items-center space-x-4 border border-gray-100">
             <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center">
                <Music size={20} />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-brand-primary uppercase tracking-widest mb-0.5">Trilha Sonora</p>
                <a 
                  href={post.musicLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-gray-900 truncate block hover:text-brand-primary transition-colors"
                >
                   {post.musicLink.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                </a>
             </div>
             <LinkIcon size={16} className="text-gray-300" />
          </div>
        )}
        
        {!post.textContent && !post.imageUrl && post.content && (
          <p className="text-gray-600 leading-relaxed font-medium">
            {post.content}
          </p>
        )}
        
        {(subjectName || (post.studyMinutes || 0) > 0) && (
          <div className="flex flex-wrap gap-2">
            {subjectName && (
              <div className="bg-brand-light text-brand-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                {subjectName}
              </div>
            )}
            {(post.studyMinutes || 0) > 0 && (
              <div className="bg-gray-50 text-gray-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center space-x-1">
                <Clock size={10} />
                <span>{post.studyMinutes} min estudados</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-gray-50">
        <div className="flex items-center space-x-6">
          <button 
            onClick={onLike}
            className={`flex items-center space-x-2 transition-all ${isLiked ? 'text-red-500 scale-110' : 'text-gray-400 hover:text-red-500'}`}
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
            <span className="text-xs font-bold">{post.likesCount || 0}</span>
          </button>
          <button 
            onClick={onComment}
            className="flex items-center space-x-2 text-gray-400 hover:text-brand-primary transition-all"
          >
            <MessageSquare size={18} />
            <span className="text-xs font-bold">{post.commentsCount || 0}</span>
          </button>
        </div>
        <button className="text-gray-300 hover:text-brand-primary transition-all">
          <Share2 size={18} />
        </button>
      </div>
    </motion.div>
  );
};

const PostDetailModal = ({ post, onClose }: { post: Post, onClose: () => void }) => {
  const { firebaseUser, user } = useAppContext();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'comments'), 
      where('postId', '==', post.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const loadedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      loadedComments.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setComments(loadedComments);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'comments'));
    return () => unsub();
  }, [post.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !user || !newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'comments'), {
        postId: post.id,
        userId: firebaseUser.uid,
        userName: user.name || user.email || 'Estudante',
        content: newComment,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'posts', post.id), {
        commentsCount: increment(1)
      });
      setNewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'comments');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white shrink-0">
          <h3 className="text-xl font-bold">Comentários</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
          <div className="pb-8 border-b border-gray-50">
             <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-brand-light rounded-xl flex items-center justify-center text-brand-primary font-black uppercase">
                  {post.userName?.[0] || 'U'}
                </div>
                <div>
                   <h4 className="font-bold text-sm">{post.userName}</h4>
                   <p className="text-[10px] text-gray-400 font-bold uppercase">{post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleDateString() : 'Recente'}</p>
                </div>
             </div>
             <div className="space-y-4">
                {post.textContent && <p className="text-gray-600 font-medium leading-relaxed">{post.textContent}</p>}
                {post.imageUrl && <img src={post.imageUrl} alt="Post" className="w-full rounded-2xl" referrerPolicy="no-referrer" />}
                {post.musicLink && (
                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center space-x-4">
                    <Music size={16} className="text-brand-primary" />
                    <a href={post.musicLink} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-primary truncate">{post.musicLink}</a>
                  </div>
                )}
                {!post.textContent && !post.imageUrl && post.content && <p className="text-gray-600 font-medium leading-relaxed">{post.content}</p>}
             </div>
          </div>

          <div className="space-y-6">
            {comments.map((comment) => (
              <div key={comment.id} className="flex space-x-4">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 font-bold text-xs shrink-0">
                  {comment.userName[0]}
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-gray-900">{comment.userName}</span>
                    <span className="text-[10px] text-gray-400">
                      {comment.createdAt?.toDate ? new Date(comment.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium leading-relaxed">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))}

            {comments.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-sm font-bold text-gray-300">Nenhum comentário ainda. Comece a conversa!</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-8 bg-gray-50 border-t border-gray-100 shrink-0">
          <form onSubmit={handleAddComment} className="relative">
            <input 
              type="text"
              placeholder="Escreva um comentário..."
              className="w-full bg-white border border-gray-200 px-6 py-4 rounded-2xl pr-16 outline-none focus:ring-2 ring-brand-primary/20 transition-all font-medium text-sm"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button 
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="absolute right-3 top-3 p-2 text-brand-primary hover:bg-brand-light rounded-xl transition-all disabled:opacity-30"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const CommunityStats = ({ onPost }: { onPost: () => void }) => {
  const { posts, user, firebaseUser } = useAppContext();
  const studiedToday = (posts || []).some(p => p.userId === firebaseUser?.uid && p.type === 'study_update' && new Date(p.createdAt?.toDate?.() || 0).toDateString() === new Date().toDateString());
  
  const userPosts = (posts || []).filter(p => p.userId === firebaseUser?.uid);
  const totalImpact = userPosts.reduce((acc, p) => acc + (p.likesCount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold mb-6">Sua Atividade</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-6 rounded-2xl text-center">
             <Trophy className="text-yellow-500 mx-auto mb-3" size={24} />
             <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Impacto</p>
             <p className="text-2xl font-black text-gray-900">{totalImpact}</p>
          </div>
          <div className="bg-gray-50 p-6 rounded-2xl text-center">
             <Target className="text-brand-primary mx-auto mb-3" size={24} />
             <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Streak</p>
             <p className="text-2xl font-black text-gray-900">{user?.streak || 0} d</p>
          </div>
        </div>
      </div>

      {!studiedToday && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-brand-primary text-white rounded-[32px] p-8 shadow-xl shadow-brand-primary/20"
        >
          <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
            <Zap size={20} />
          </div>
          <h3 className="text-lg font-bold mb-2">Hora de inspirar!</h3>
          <p className="text-white/80 text-sm font-medium mb-6">Você já estudou hoje. Que tal compartilhar seu progresso com a galera?</p>
          <button 
            onClick={onPost}
            className="w-full bg-white text-brand-primary py-3 rounded-xl font-bold text-sm shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            Postar Agora
          </button>
        </motion.div>
      )}
    </div>
  );
};

const TrendingTopics = () => {
  return (
    <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
      <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
        <span>Em Alta</span>
        <Filter size={16} className="text-gray-300" />
      </h3>
      <div className="space-y-4">
        {[
          { label: 'Anatomia Humana', count: 42, icon: BookOpen },
          { label: 'Ciclo de Krebs', count: 28, icon: MessageSquare },
          { label: 'Internato 2024', count: 15, icon: Trophy },
        ].map((topic, i) => (
          <div key={i} className="flex items-center justify-between group cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-brand-light group-hover:text-brand-primary transition-all">
                <topic.icon size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 group-hover:text-brand-primary transition-colors">{topic.label}</p>
                <p className="text-[10px] font-black text-gray-400 uppercase">{topic.count} pessoas estudando</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Community;
