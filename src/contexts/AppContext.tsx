import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { User, Subject, Task, Note, Flashcard, Question, Material, Event, GlobalTag, Analytics, Simulation, StudyPlan, ErrorLog } from '../types';

interface AppContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  subjects: Subject[];
  tasks: Task[];
  notes: Note[];
  flashcards: Flashcard[];
  questions: Question[];
  errors: ErrorLog[];
  materials: Material[];
  events: Event[];
  tags: GlobalTag[];
  analytics: Analytics[];
  simulations: Simulation[];
  studyPlans: StudyPlan[];
  refreshUserData: () => Promise<void>;
  refreshAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [tags, setTags] = useState<GlobalTag[]>([]);
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);

  const refreshUserData = async (uId?: string) => {
    const id = uId || supabaseUser?.id;
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        setUser(data as User);
      } else if (error && error.code === 'PGRST116') {
        // User doesn't exist, create profile
        const newUser: User = {
          id: id,
          name: supabaseUser?.user_metadata?.full_name || 'Estudante',
          email: supabaseUser?.email || '',
          created_at: new Date().toISOString(),
          streak: 0,
          total_study_time: 0,
        };
        const { error: insertError } = await supabase.from('users').insert(newUser);
        if (insertError) throw insertError;
        setUser(newUser);
      } else if (error) {
        throw error;
      }
    } catch (error) {
      handleSupabaseError(error, OperationType.GET, `users/${id}`);
    }
  };

  const refreshAllData = async () => {
    if (!supabaseUser) return;
    const userId = supabaseUser.id;

    try {
      const [
        { data: subjectsData },
        { data: tasksData },
        { data: notesData },
        { data: flashcardsData },
        { data: questionsData },
        { data: errorsData },
        { data: materialsData },
        { data: eventsData },
        { data: tagsData },
        { data: analyticsData },
        { data: simulationsData },
        { data: studyPlansData }
      ] = await Promise.all([
        supabase.from('subjects').select('*').eq('user_id', userId),
        supabase.from('tasks').select('*').eq('user_id', userId),
        supabase.from('notes').select('*').eq('user_id', userId),
        supabase.from('flashcards').select('*').eq('user_id', userId),
        supabase.from('questions').select('*').eq('user_id', userId),
        supabase.from('errors').select('*').eq('user_id', userId),
        supabase.from('materials').select('*').eq('user_id', userId),
        supabase.from('events').select('*').eq('user_id', userId),
        supabase.from('tags').select('*').eq('user_id', userId),
        supabase.from('analytics').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
        supabase.from('simulations').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('study_plans').select('*').eq('user_id', userId)
      ]);

      setSubjects(subjectsData || []);
      setTasks(tasksData || []);
      setNotes(notesData || []);
      setFlashcards(flashcardsData || []);
      setQuestions(questionsData || []);
      setErrors(errorsData || []);
      setMaterials(materialsData || []);
      setEvents(eventsData || []);
      setTags(tagsData || []);
      setAnalytics(analyticsData || []);
      setSimulations(simulationsData || []);
      setStudyPlans(studyPlansData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        refreshUserData(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        refreshUserData(session.user.id);
      } else {
        setUser(null);
        setSubjects([]);
        setTasks([]);
        setNotes([]);
        setFlashcards([]);
        setQuestions([]);
        setMaterials([]);
        setEvents([]);
        setTags([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (supabaseUser) {
      refreshAllData();

      // Real-time listeners
      const channels = [
        'subjects', 'tasks', 'notes', 'flashcards', 'questions', 'errors', 'materials', 'events', 'tags', 'analytics', 'simulations', 'studyPlans'
      ].map(table => 
        supabase
          .channel(`public:${table}`)
          .on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${supabaseUser.id}` }, () => {
            refreshAllData();
          })
          .subscribe()
      );

      return () => {
        channels.forEach(channel => supabase.removeChannel(channel));
      };
    }
  }, [supabaseUser]);

  return (
    <AppContext.Provider value={{
      user,
      supabaseUser,
      loading,
      subjects,
      tasks,
      notes,
      flashcards,
      questions,
      errors,
      materials,
      events,
      tags,
      analytics,
      simulations,
      studyPlans,
      refreshUserData,
      refreshAllData
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
