import { useState, useEffect } from 'react';
import { useContext } from 'react';
import { getFirestore, collection, doc, getDoc } from 'firebase/firestore';
import { useFirebase } from '@/components/firebase-provider';
import { User as FirebaseUser } from 'firebase/auth';

import { UserContext } from '@/contexts/UserContext';
import { User, UserRole } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const { auth } = useFirebase();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: FirebaseUser | null) => {
      const db = getFirestore();
      if (firebaseUser) {
        // Get additional user data from Firestore
        const userDocRef = doc(collection(db, 'users'), firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();

        setUser({
          uid: firebaseUser.uid, // Ensure uid is set
          id: firebaseUser.uid,  // Also set id, assuming it's the same as uid for now
          email: firebaseUser.email,
          role: userData?.role || UserRole.WAITER, // Default role
          status: userData?.status || 'active',
          emailVerified: firebaseUser.emailVerified,
          username: userData?.username || '',
          displayName: userData?.displayName || '',
          createdAt: userData?.createdAt?.toDate() || new Date(),
          updatedAt: userData?.updatedAt?.toDate() || new Date(),
          // photoURL: firebaseUser.photoURL, // Add if needed and present in User type
          // companyId: userData?.companyId, // Add if needed
          // companyName: userData?.companyName, // Add if needed
          // planId: userData?.planId, // Add if needed
          // subscriptionStatus: userData?.subscriptionStatus, // Add if needed
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user
  };
}