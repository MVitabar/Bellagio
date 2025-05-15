import { 
  createUserWithEmailAndPassword, 
  getAuth,
  signInWithEmailAndPassword,
  signOut 
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getFirestore,
  serverTimestamp
} from "firebase/firestore";
import { UserRole } from "@/types/user";

interface UserCreationOptions {
  email: string;
  password: string;
  username: string;
  role?: UserRole;
  additionalData?: Record<string, any>;
}

export interface CurrentUser {
  uid: string;
  role?: UserRole;
  email?: string | null;
}

export async function createTeamMember(
  currentUser: CurrentUser, 
  userData: {
    email: string;
    password: string;
    username: string;
    role?: UserRole;
    additionalData?: any;
    skipAutoLogin?: boolean;
  }
) {
  const auth = getAuth();
  const db = getFirestore();

  // Validate owner role creation
  if (userData.role === UserRole.OWNER && 
      (!currentUser || currentUser.role !== UserRole.OWNER)) {
    throw new Error('Only owners can create owner accounts');
  }

  // Crear el usuario y obtener sus credenciales
  const userCredential = await createUserWithEmailAndPassword(
    auth, 
    userData.email, 
    userData.password
  );

  // Si skipAutoLogin es true, cerrar la sesión del usuario recién creado y restaurar la del admin
  if (userData.skipAutoLogin && auth?.currentUser?.email) {
    try {
      // Obtener la sesión actual antes de cerrarla
      const currentSession = auth?.currentUser;
      
      // Solo cerrar sesión si el usuario actual no es el admin
      if (currentSession?.uid !== currentUser.uid) {
        await signOut(auth);
      }
    } catch (error) {
      console.error('Error managing session:', error);
    }
  }

  // Create user document in Firestore
  const newUserDocRef = doc(db, 'users', userCredential.user.uid);
  await setDoc(newUserDocRef, {
    uid: userCredential.user.uid,
    email: userData.email,
    username: userData.username,
    role: userData.role || UserRole.WAITER,
    createdAt: serverTimestamp(),
    status: 'active'
  });

  return userCredential.user;
}

export async function updateUserProfile(
  userId: string, 
  updateData: Partial<UserCreationOptions>
) {
  const db = getFirestore();
  
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, updateData, { merge: true });
}

export async function deleteUser(userId: string) {
  const db = getFirestore();
  
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, { status: 'deleted' }, { merge: true });
}