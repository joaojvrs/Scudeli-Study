export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in-progress',
  DONE = 'done',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum EventType {
  EXAM = 'exam',
  CLASS = 'class',
  REVIEW = 'review',
  OTHER = 'other',
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  OPEN_ENDED = 'open_ended',
}

export interface ErrorLog {
  id: string;
  user_id: string;
  question_id: string;
  answered_at: string;
  wrong_option_index: number;
  correct_option_index: number;
  subject_id: string;
  context?: string;
  is_learned?: boolean;
}

export interface Analytics {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  study_seconds: number;
  questions_attempted: number;
  questions_correct: number;
}

export interface SubjectStats {
  id: string;
  user_id: string;
  subject_id: string;
  date: string;
  total: number;
  correct: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  college?: string;
  semester?: string;
  bio?: string;
  created_at: string;
  streak: number;
  last_study_date?: string;
  total_study_time: number;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  user_id: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  subject_id: string;
  user_id: string;
  next_review: string;
  interval: number;
  easiness: number;
  repetitions: number;
  tags: string[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  subject_id: string;
  user_id: string;
  updated_at: string;
  tags: string[];
  linked_note_ids?: string[];
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: string;
  user_id: string;
  subject_id: string;
  tags: string[];
}

export interface Event {
  id: string;
  title: string;
  type: EventType;
  start: string;
  end: string;
  user_id: string;
  subject_id: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  answer_index: number;
  explanation?: string;
  subject_id: string;
  user_id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  source?: 'manual' | 'ai';
  type: QuestionType;
  material_id?: string;
  created_at: string;
}

export interface StudySession {
  id: string;
  duration: number;
  subject_id: string;
  user_id: string;
  timestamp: string;
  type: 'focus' | 'regular';
}

export interface Material {
  id: string;
  title: string;
  type: 'pdf' | 'docx' | 'image';
  url: string;
  subject_id: string;
  user_id: string;
  created_at: string;
  tags: string[];
  summary?: string;
}

export interface StudyPlan {
  id: string;
  user_id: string;
  name: string;
  exam_date: string;
  target_content: string;
  daily_availability: number;
  schedule: {
    date: string;
    topics: string[];
    completed: boolean;
  }[];
  created_at: string;
}

export interface Simulation {
  id: string;
  user_id: string;
  subject_id: string;
  count: number;
  time_limit: number;
  question_ids: string[];
  user_answers: { [questionId: string]: number };
  score: number;
  correct_count: number;
  duration: number;
  created_at: string;
}

export interface GlobalTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

export interface PerformanceMetric {
  id: string;
  user_id: string;
  subject_id: string;
  date: string;
  accuracy: number;
  questions_answered: number;
  time_spent: number;
}

export interface Post {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  content: string;
  text_content?: string;
  image_url?: string;
  music_link?: string;
  audio_url?: string;
  type: 'study_update' | 'achievement' | 'reflection';
  subject_id?: string;
  topic?: string;
  study_minutes?: number;
  attachment_url?: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_public: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}
