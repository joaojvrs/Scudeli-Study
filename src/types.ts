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

export interface ErrorLog {
  id: string;
  userId: string;
  questionId: string;
  answeredAt: string;
  wrongOptionIndex: number;
  correctOptionIndex: number;
  subjectId: string;
  context?: string;
  isLearned?: boolean;
}

export interface Analytics {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  studySeconds: number;
  questionsAttempted: number;
  questionsCorrect: number;
  subjectStats: {
    [subjectId: string]: {
      total: number;
      correct: number;
    }
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  college?: string;
  semester?: string;
  bio?: string;
  createdAt: string;
  streak: number;
  lastStudyDate?: string;
  totalStudyTime: number; // total minutes
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  userId: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  subjectId: string;
  userId: string;
  nextReview: string;
  interval: number;
  easiness: number;
  repetitions: number;
  tags: string[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  subjectId: string;
  userId: string;
  updatedAt: string;
  tags: string[];
  linkedNoteIds?: string[];
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: string;
  userId: string;
  subjectId: string;
  tags: string[];
}

export interface Event {
  id: string;
  title: string;
  type: EventType;
  start: string;
  end: string;
  userId: string;
  subjectId: string;
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  OPEN_ENDED = 'open_ended'
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  subjectId: string;
  userId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  source?: 'manual' | 'ai';
  type: QuestionType;
  materialId?: string;
  createdAt: any;
}

export interface StudySession {
  id: string;
  duration: number; // in minutes
  subjectId: string;
  userId: string;
  timestamp: string;
  type: 'focus' | 'regular';
}

export interface Material {
  id: string;
  title: string;
  type: 'pdf' | 'docx' | 'image';
  url: string;
  subjectId: string;
  userId: string;
  createdAt: string;
  tags: string[];
  summary?: string;
}

export interface StudyPlan {
  id: string;
  userId: string;
  name: string;
  examDate: string;
  targetContent: string;
  dailyAvailability: number; // minutes
  schedule: {
    date: string;
    topics: string[];
    completed: boolean;
  }[];
  createdAt: any;
}

export interface Simulation {
  id: string;
  userId: string;
  subjectId: string;
  count: number;
  timeLimit: number; // minutes
  questionIds: string[];
  userAnswers: { [questionId: string]: number };
  score: number;
  correctCount: number;
  duration: number; // actual time spent in seconds
  createdAt: any;
}

export interface GlobalTag {
  id: string;
  userId: string;
  name: string;
  color: string;
}

export interface PerformanceMetric {
  id: string;
  userId: string;
  subjectId: string;
  date: string;
  accuracy: number; // 0-1
  questionsAnswered: number;
  timeSpent: number;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  content: string;
  textContent?: string;
  imageUrl?: string;
  musicLink?: string;
  audioUrl?: string;
  type: 'study_update' | 'achievement' | 'reflection';
  subjectId?: string;
  topic?: string;
  studyMinutes?: number;
  attachmentUrl?: string;
  createdAt: any;
  likesCount: number;
  commentsCount: number;
  isPublic: boolean;
  likes: string[]; // array of userIds
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: any;
}
