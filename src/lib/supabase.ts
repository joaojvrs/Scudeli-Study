import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _supabaseInstance: SupabaseClient<any> | null = null;

export const supabase = new Proxy({} as SupabaseClient<any>, {
  get(target, prop: string | symbol) {
    if (!_supabaseInstance) {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          'Supabase configuration missing! Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables (Settings > Environment Variables).'
        );
      }
      _supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    }
    
    const value = (_supabaseInstance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(_supabaseInstance);
    }
    return value;
  }
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleSupabaseError(error: any, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error.message || String(error),
    operationType,
    path,
    code: error.code,
    details: error.details,
    hint: error.hint
  };
  console.error('Supabase Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const trackAnalytics = async (userId: string, data: { studySeconds?: number, questionsAttempted?: number, questionsCorrect?: number, subjectId?: string, isCorrect?: boolean }) => {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw fetchError;
    }

    if (!existing) {
      const subjectStats: any = {};
      if (data.subjectId) {
        subjectStats[data.subjectId] = {
          total: data.questionsAttempted || 0,
          correct: data.questionsCorrect || 0
        };
      }
      
      const { error: insertError } = await supabase
        .from('analytics')
        .insert({
          user_id: userId,
          date: today,
          study_seconds: data.studySeconds || 0,
          questions_attempted: data.questionsAttempted || 0,
          questions_correct: data.questionsCorrect || 0,
          subject_stats: subjectStats
        });
      
      if (insertError) throw insertError;
    } else {
      const subjectStats = existing.subject_stats || {};
      if (data.subjectId) {
        const current = subjectStats[data.subjectId] || { total: 0, correct: 0 };
        subjectStats[data.subjectId] = {
          total: current.total + (data.questionsAttempted || 0),
          correct: current.correct + (data.questionsCorrect || 0)
        };
      }

      const { error: updateError } = await supabase
        .from('analytics')
        .update({
          study_seconds: (existing.study_seconds || 0) + (data.studySeconds || 0),
          questions_attempted: (existing.questions_attempted || 0) + (data.questionsAttempted || 0),
          questions_correct: (existing.questions_correct || 0) + (data.questionsCorrect || 0),
          subject_stats: subjectStats
        })
        .eq('id', existing.id);
      
      if (updateError) throw updateError;
    }
  } catch (error) {
    console.error('Error tracking analytics:', error);
  }
};

export const loginWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  
  if (error) throw error;
  return data;
};

export const signUpWithEmail = async (email: string, pass: string, name: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: {
        full_name: name,
      }
    }
  });
  if (error) throw error;
  return data;
};

export const signInWithEmail = async (email: string, pass: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error) throw error;
  return data;
};

export const logout = () => supabase.auth.signOut();
