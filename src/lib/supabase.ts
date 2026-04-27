import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const loginWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
};

export const logout = () => supabase.auth.signOut();

export const trackAnalytics = async (
  userId: string,
  data: {
    studySeconds?: number;
    questionsAttempted?: number;
    questionsCorrect?: number;
    subjectId?: string;
    isCorrect?: boolean;
  }
) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data: existing } = await supabase
      .from('analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (!existing) {
      await supabase.from('analytics').insert({
        user_id: userId,
        date: today,
        study_seconds: data.studySeconds || 0,
        questions_attempted: data.questionsAttempted || 0,
        questions_correct: data.questionsCorrect || 0,
      });
    } else {
      const updates: Record<string, number> = {};
      if (data.studySeconds) updates.study_seconds = existing.study_seconds + data.studySeconds;
      if (data.questionsAttempted) updates.questions_attempted = existing.questions_attempted + data.questionsAttempted;
      if (data.questionsCorrect) updates.questions_correct = existing.questions_correct + data.questionsCorrect;
      if (Object.keys(updates).length) {
        await supabase.from('analytics').update(updates).eq('id', existing.id);
      }
    }

    if (data.subjectId) {
      const { data: existingStat } = await supabase
        .from('subject_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('subject_id', data.subjectId)
        .eq('date', today)
        .maybeSingle();

      if (!existingStat) {
        await supabase.from('subject_stats').insert({
          user_id: userId,
          subject_id: data.subjectId,
          date: today,
          total: data.questionsAttempted || 0,
          correct: data.questionsCorrect || 0,
        });
      } else {
        await supabase.from('subject_stats').update({
          total: existingStat.total + (data.questionsAttempted || 0),
          correct: existingStat.correct + (data.questionsCorrect || 0),
        }).eq('id', existingStat.id);
      }
    }
  } catch (error) {
    console.error('Error tracking analytics:', error);
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleSupabaseError(error: unknown, operationType: OperationType, path: string | null): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Supabase Error [${operationType}] ${path}:`, message);
  throw new Error(message);
}
