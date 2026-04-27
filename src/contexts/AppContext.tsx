import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, Subject, Task, Note, Flashcard, Question, Material, Event, GlobalTag, Post, Comment } from '../types';

interface AppContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
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
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
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
    if (!firebaseUser) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        setUser({ id: userDoc.id, ...userDoc.data() } as User);
      } else {
        const newUser: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Estudante',
          email: firebaseUser.email || '',
          createdAt: new Date().toISOString(),
          streak: 0,
          totalStudyTime: 0,
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
        setUser(newUser);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      if (!u) {
        setUser(null);
        setSubjects([]);
        setTasks([]);
        setNotes([]);
        setFlashcards([]);
        setQuestions([]);
        setMaterials([]);
        setEvents([]);
        setLoading(false);
      } else {
        refreshUserData().finally(() => setLoading(false));
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const qSubjects = query(collection(db, 'subjects'), where('userId', '==', firebaseUser.uid));
    const unsubSubjects = onSnapshot(qSubjects, (snapshot) => {
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'subjects'));

    const qTasks = query(collection(db, 'tasks'), where('userId', '==', firebaseUser.uid));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));

    const qNotes = query(collection(db, 'notes'), where('userId', '==', firebaseUser.uid));
    const unsubNotes = onSnapshot(qNotes, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notes'));

    const qCards = query(collection(db, 'flashcards'), where('userId', '==', firebaseUser.uid));
    const unsubCards = onSnapshot(qCards, (snapshot) => {
      setFlashcards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Flashcard)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'flashcards'));

    const qQuestions = query(collection(db, 'questions'), where('userId', '==', firebaseUser.uid));
    const unsubQuestions = onSnapshot(qQuestions, (snapshot) => {
      setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'questions'));

    const qMaterials = query(collection(db, 'materials'), where('userId', '==', firebaseUser.uid));
    const unsubMaterials = onSnapshot(qMaterials, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'materials'));

    const qEvents = query(collection(db, 'events'), where('userId', '==', firebaseUser.uid));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'events'));

    const qTags = query(collection(db, 'tags'), where('userId', '==', firebaseUser.uid));
    const unsubTags = onSnapshot(qTags, (snapshot) => {
      setTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalTag)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tags'));

    const qPosts = query(collection(db, 'posts'));
    const unsubPosts = onSnapshot(qPosts, (snapshot) => {
      const loadedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      // Robust sorting: prioritize posts with createdAt, fallback to 0
      loadedPosts.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setPosts(loadedPosts);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'posts'));

    return () => {
      unsubSubjects();
      unsubTasks();
      unsubNotes();
      unsubCards();
      unsubQuestions();
      unsubMaterials();
      unsubEvents();
      unsubTags();
      unsubPosts();
    };
  }, [firebaseUser]);

  return (
    <AppContext.Provider value={{
      user,
      firebaseUser,
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
      refreshUserData
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
