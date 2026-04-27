import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
let storage: any = null;
try {
  storage = getStorage(app);
} catch (error) {
  console.warn('Firebase Storage not initialized. It may be disabled in the project console.');
}

export { storage };
export const googleProvider = new GoogleAuthProvider();

export const trackAnalytics = async (userId: string, data: { studySeconds?: number, questionsAttempted?: number, questionsCorrect?: number, subjectId?: string, isCorrect?: boolean }) => {
  const today = new Date().toISOString().split('T')[0];
  const analyticsRef = doc(db, 'analytics', `${userId}_${today}`);
  
  try {
    const docSnap = await getDoc(analyticsRef);
    if (!docSnap.exists()) {
      const initialData: any = {
        userId,
        date: today,
        studySeconds: data.studySeconds || 0,
        questionsAttempted: data.questionsAttempted || 0,
        questionsCorrect: data.questionsCorrect || 0,
        subjectStats: {}
      };
      if (data.subjectId) {
        initialData.subjectStats[data.subjectId] = {
          total: data.questionsAttempted || 0,
          correct: data.questionsCorrect || 0
        };
      }
      await setDoc(analyticsRef, initialData);
    } else {
      const updates: any = {};
      if (data.studySeconds) updates.studySeconds = increment(data.studySeconds);
      if (data.questionsAttempted) updates.questionsAttempted = increment(data.questionsAttempted);
      if (data.questionsCorrect) updates.questionsCorrect = increment(data.questionsCorrect);
      
      if (data.subjectId) {
        const currentStats = docSnap.data().subjectStats || {};
        const subjectStat = currentStats[data.subjectId] || { total: 0, correct: 0 };
        updates[`subjectStats.${data.subjectId}.total`] = increment(data.questionsAttempted || 0);
        updates[`subjectStats.${data.subjectId}.correct`] = increment(data.questionsCorrect || 0);
      }
      
      await updateDoc(analyticsRef, updates);
    }
  } catch (error) {
    console.error('Error tracking analytics:', error);
  }
};

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const logout = () => signOut(auth);

// Validation check as requested by instructions
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Error handler as requested
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
