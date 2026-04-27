import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, Subject, Task, Note, Flashcard, Question, Material, Event, GlobalTag, Post } from '../types';

interface AppContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subjects: Subject[];
  tasks: Task[];
  notes: Note[];
  flashcards: Flashcard[];
  questions: Question[];
  materials: Material[];
  events: Event[];
  tags: GlobalTag[];
  posts: Post[];
  refreshUserData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [tags, setTags] = useState<GlobalTag[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  const refreshUserData = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;
    const uid = currentSession.user.id;

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (userData) {
      setUser(userData as User);
    } else {
      const newUser: User = {
        id: uid,
        name: currentSession.user.user_metadata?.full_name || 'Estudante',
        email: currentSession.user.email || '',
        created_at: new Date().toISOString(),
        streak: 0,
        total_study_time: 0,
      };
      await supabase.from('users').insert(newUser);
      setUser(newUser);
    }
  };

  const loadUserData = async (uid: string) => {
    const [
      { data: subjectsData },
      { data: tasksData },
      { data: notesData },
      { data: cardsData },
      { data: questionsData },
      { data: materialsData },
      { data: eventsData },
      { data: tagsData },
      { data: postsData },
    ] = await Promise.all([
      supabase.from('subjects').select('*').eq('user_id', uid),
      supabase.from('tasks').select('*').eq('user_id', uid),
      supabase.from('notes').select('*').eq('user_id', uid),
      supabase.from('flashcards').select('*').eq('user_id', uid),
      supabase.from('questions').select('*').eq('user_id', uid),
      supabase.from('materials').select('*').eq('user_id', uid),
      supabase.from('events').select('*').eq('user_id', uid),
      supabase.from('tags').select('*').eq('user_id', uid),
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
    ]);

    setSubjects((subjectsData || []) as Subject[]);
    setTasks((tasksData || []) as Task[]);
    setNotes((notesData || []) as Note[]);
    setFlashcards((cardsData || []) as Flashcard[]);
    setQuestions((questionsData || []) as Question[]);
    setMaterials((materialsData || []) as Material[]);
    setEvents((eventsData || []) as Event[]);
    setTags((tagsData || []) as GlobalTag[]);
    setPosts((postsData || []) as Post[]);
  };

  const clearUserData = () => {
    setUser(null);
    setSubjects([]);
    setTasks([]);
    setNotes([]);
    setFlashcards([]);
    setQuestions([]);
    setMaterials([]);
    setEvents([]);
    setTags([]);
    setPosts([]);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        clearUserData();
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;

    const setup = async () => {
      await refreshUserData();
      await loadUserData(uid);
      setLoading(false);
    };
    setup();

    const makeChannel = <T extends { id: string }>(
      table: string,
      setState: React.Dispatch<React.SetStateAction<T[]>>,
      filter?: string
    ) => {
      const opts: any = { event: '*', schema: 'public', table };
      if (filter) opts.filter = filter;

      return supabase
        .channel(`${table}_${uid}_${Math.random()}`)
        .on('postgres_changes', { ...opts, event: 'INSERT' }, p => {
          setState(prev => {
            const item = p.new as T;
            if (prev.some(i => i.id === item.id)) return prev;
            return [...prev, item];
          });
        })
        .on('postgres_changes', { ...opts, event: 'UPDATE' }, p => {
          setState(prev => prev.map(i => i.id === (p.new as T).id ? p.new as T : i));
        })
        .on('postgres_changes', { ...opts, event: 'DELETE' }, p => {
          setState(prev => prev.filter(i => i.id !== (p.old as { id: string }).id));
        })
        .subscribe();
    };

    const userFilter = `user_id=eq.${uid}`;
    const channels = [
      makeChannel<Subject>('subjects', setSubjects, userFilter),
      makeChannel<Task>('tasks', setTasks, userFilter),
      makeChannel<Note>('notes', setNotes, userFilter),
      makeChannel<Flashcard>('flashcards', setFlashcards, userFilter),
      makeChannel<Question>('questions', setQuestions, userFilter),
      makeChannel<Material>('materials', setMaterials, userFilter),
      makeChannel<Event>('events', setEvents, userFilter),
      makeChannel<GlobalTag>('tags', setTags, userFilter),
      makeChannel<Post>('posts', (action) => {
        setPosts(prev => {
          const result = typeof action === 'function' ? action(prev) : action;
          return [...result].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      }),
    ];

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [session?.user.id]);

  return (
    <AppContext.Provider value={{
      user,
      session,
      loading,
      subjects,
      tasks,
      notes,
      flashcards,
      questions,
      materials,
      events,
      tags,
      posts,
      refreshUserData,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
