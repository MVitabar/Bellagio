import React, { createContext, useContext, useState, useEffect } from 'react'
import { initializeApp, getApps, FirebaseApp } from "firebase/app"
import { getFirestore, Firestore } from "firebase/firestore"
import { getAuth, Auth } from "firebase/auth"
import { User, UserRole } from '@/types'
import { FirebaseContextType } from '@/types/firebase'
import { useAuth } from "@/components/auth-provider"
import { firebaseConfig } from '@/lib/firebase-config'

const FirebaseContext = createContext<FirebaseContextType>({
  app: null,
  auth: null,
  db: null,
  user: null,
  loading: true,
  initializationError: null,
  validateAndPropagateUser: async () => null,
})

export const useFirebase = () => useContext(FirebaseContext)

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth()
  const [app, setApp] = useState<FirebaseApp | null>(null)
  const [auth, setAuth] = useState<Auth | null>(null)
  const [db, setDb] = useState<Firestore | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initializationError, setInitializationError] = useState<Error | null>(null)

  useEffect(() => {
    let app: FirebaseApp | null = null
    let db: Firestore | null = null
    let auth: Auth | null = null
    let error: Error | null = null

    try {
      // Validate configuration
      if (!firebaseConfig.apiKey) {
        throw new Error('❌ Firebase API Key is missing. Check your configuration.')
      }

      // Initialize Firebase
      app = getApps().length === 0 
        ? initializeApp(firebaseConfig) 
        : getApps()[0]

      // Initialize Firestore and Auth
      db = getFirestore(app)
      auth = getAuth(app)

      // Additional auth configuration
      if (auth) {
        auth.useDeviceLanguage()
      }
    } catch (error) {
      console.error('❌ Firebase Initialization Error:', error);
      
      error = error instanceof Error 
        ? error 
        : new Error('Unknown Firebase initialization error')
    } finally {
      setApp(app)
      setAuth(auth)
      setDb(db)
      setInitializationError(error)
      setLoading(false)
    }
  }, [])

  const validateAndPropagateUser = async (authUser: any): Promise<User | null> => {
    if (!authUser) {
      setUser(null)
      return null
    }

    const isValidUser = (user: any): user is User => {
      return (
        user &&
        typeof user.uid === 'string' &&
        (typeof user.email === 'string' || user.email === null) &&
        typeof user.role === 'string' &&
        Object.values(UserRole).includes(user.role as UserRole)
      )
    }

    // Attempt to reconstruct user if validation fails
    if (!isValidUser(authUser)) {
      const reconstructedUser: User = {
        id: authUser.uid,
        uid: authUser.uid,
        email: authUser.email || '',
        username: authUser.displayName || authUser.username || '',
        role: authUser.role || UserRole.WAITER,
        phoneNumber: authUser.phoneNumber,
        position: '',
        status: authUser.status || 'active',
        emailVerified: authUser.emailVerified ?? false,
        loading: false,
        login: async (email: string, password: string) => {
          return { success: false, error: 'Not implemented' }
        },
        logout: async () => {
          return { success: false, error: 'Not implemented' }
        },
        signUp: async (email: string, password: string) => {
          return { success: false, error: 'Not implemented' }
        }
      }

      setUser(reconstructedUser)
      return reconstructedUser
    }

    setUser(authUser)
    return authUser
  }

  useEffect(() => {
    validateAndPropagateUser(authUser)
  }, [authUser])

  useEffect(() => {
    if (initializationError) {
      console.error('Firebase Error:', initializationError);
    }
  }, [initializationError])

  return (
    <FirebaseContext.Provider value={{ app, auth, db, user, loading, initializationError, validateAndPropagateUser }}>
      {children}
    </FirebaseContext.Provider>
  )
}
