"use client"

import type React from "react"
import { AuthContextType, User, UserRole, LoginAttempt } from "@/types"
// Remove unused import for deleted enum
// import { MenuItemCategory } from "@/types/menu"

import { createContext, useContext, useEffect, useState } from "react"
import { 
  type User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendEmailVerification 
} from "firebase/auth"
import { useRouter, usePathname } from "next/navigation"
import { useFirebase } from "@/components/firebase-provider"
import {toast} from "sonner"
import { 
  getFirestore, 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  Firestore,
  setDoc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp, 
  writeBatch, 
  increment,
  runTransaction,
  limit
} from 'firebase/firestore'
import { nanoid } from 'nanoid';

const AuthContext = createContext<AuthContextType>({
  user: null,
  currentUser: null,
  loading: true,
  login: async () => ({ success: false, needsPasswordChange: false }),
  logout: async () => ({ success: false }),
  signUp: async (email, password, options) => {
    console.warn('Default signUp method called');
    return { 
      success: false, 
      error: 'Sign up method not implemented', 
      needsPasswordChange: false 
    };
  }
})

export const useAuth = () => useContext(AuthContext)

const publicRoutes = ["/login", "/register", "/forgot-password", "/invitation/register"]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { db, auth } = useFirebase()
  const router = useRouter()
  const pathname = usePathname()

  // Debug method to check authentication state
  const debugAuthState = () => {
    return {
      isAuthenticated: !!user,
      user,
      loading,
      authAvailable: !!auth
    }
  }

  // Expose debug method globally for easier debugging
  useEffect(() => {
    // @ts-ignore
    window.debugAuthState = debugAuthState
  }, [user, auth, loading])

  // Comprehensive initial state logging
  useEffect(() => {
  }, [])

  // Función para generar nombre de usuario
  const generateUsername = (email: string): string => {
    if (!email) return 'user' + Math.floor(Math.random() * 10000)
    
    // Extraer parte antes del @ 
    const baseUsername = email.split('@')[0]
    
    // Reemplazar caracteres no permitidos
    const sanitizedUsername = baseUsername
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      
    // Si queda vacío, generar uno aleatorio
    return sanitizedUsername || 'user' + Math.floor(Math.random() * 10000)
  }

  // Función para verificar si un nombre de usuario ya existe
  const isUsernameTaken = async (username: string): Promise<boolean> => {
    if (!db) return false

    try {
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('username', '==', username))
      const querySnapshot = await getDocs(q)
      
      return !querySnapshot.empty
    } catch (error) {
      return false
    }
  }

  // Función para generar nombre de usuario único
  const generateUniqueUsername = async (email: string): Promise<string> => {
    let baseUsername = generateUsername(email)
    let uniqueUsername = baseUsername
    let counter = 1

    while (await isUsernameTaken(uniqueUsername)) {
      uniqueUsername = `${baseUsername}${counter}`
      counter++
    }

    return uniqueUsername
  }

  // Función de registro actualizada
  const signUp = async (
    email: string, 
    password: string, 
    options?: {
      role?: UserRole;
      username?: string;
    }
  ): Promise<{ success: boolean, error?: string, userId?: string, needsPasswordChange?: boolean }> => {
    try {
      // Validate inputs
      if (!email) {
        return {
          success: false,
          error: 'Email is required',
          needsPasswordChange: false
        };
      }

      if (!password) {
        return {
          success: false,
          error: 'Password is required',
          needsPasswordChange: false
        };
      }

      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth!, email, password);
      const firebaseUser = userCredential.user;
      if (!firebaseUser) {
        return {
          success: false,
          error: 'User creation failed',
          needsPasswordChange: false
        };
      }
      if (!db) {
        return {
          success: false,
          error: 'Database not found',
          needsPasswordChange: false
        };
      }
      // Initialize user profile
      const newUser = await initializeUserProfile(
        firebaseUser, 
        db,
        options
      );

      if (!newUser) {
        return {
          success: false,
          error: 'Failed to create user profile',
          needsPasswordChange: false
        };
      }

      // Automatically sign in the user
      await signInWithEmailAndPassword(auth!, email, password);

      // Send email verification only if not verified
      if (!firebaseUser.emailVerified) {
        try {
          await sendEmailVerification(firebaseUser);
        } catch (verificationError) {
          console.error('Email verification error:', verificationError);
          // Non-critical error, so we'll continue
        }
      }

      // Update the user state in the context
      setUser(newUser ? {
        id: newUser.uid,
        uid: newUser.uid,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role || UserRole.WAITER,
        status: newUser.status || 'active',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      } : null);

      return {
        success: true,
        userId: newUser.uid,
        needsPasswordChange: false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
      console.error('Sign up error:', error);
      
      return {
        success: false,
        error: errorMessage,
        needsPasswordChange: false
      };
    }
  };

  // Función de obtención de detalles de usuario
  const fetchUserDetails = async (firebaseUser: FirebaseUser) => {
    try {
      const db = getFirestore();
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: userData.role || UserRole.WAITER,
          status: userData.status || 'active',
          emailVerified: firebaseUser.emailVerified,
          username: userData.username || '',
          displayName: userData.displayName || '',
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date()
        } as User;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user details:', error);
      return null;
    }
  };

  // Helper function to get device and location information
  const getUserActivityContext = () => {
    return {
      ipAddress: 'TODO: Implement IP tracking',
      device: {
        type: navigator.userAgent.match(/mobile/i) ? 'mobile' : 'desktop',
        os: navigator.platform,
        browser: navigator.userAgent
      },
      location: {
        country: 'Unknown',
        city: 'Unknown'
      }
    };
  };

  // Enhanced login method with detailed error handling and activity tracking
  const login = async (email: string, password: string): Promise<{ success: boolean, error?: string, needsPasswordChange: boolean }> => {
    const activityContext = getUserActivityContext();
    
    try {
      // Validate email format
      if (!email || !email.includes('@')) {
        return {
          success: false,
          error: 'Invalid email format',
          needsPasswordChange: false
        };
      }

      // Check for empty password
      if (!password) {
        return {
          success: false,
          error: 'Password cannot be empty',
          needsPasswordChange: false
        };
      }

      // Attempt authentication
      const userCredential = await signInWithEmailAndPassword(auth!, email, password);
      const firebaseUser = userCredential.user;

      // Fetch user details
      const customUser = await fetchUserDetails(firebaseUser);
      
      if (!customUser) {
        return {
          success: false,
          error: 'User profile not found. Please contact support.',
          needsPasswordChange: false
        };
      }

      // Check user account status
      if (customUser.status === 'suspended') {
        return {
          success: false,
          error: 'Your account has been suspended. Please contact support.',
          needsPasswordChange: false
        };
      }

      // Update last login timestamp, status, and activity
      if (db) {
        const userRef = doc(db, 'users', firebaseUser.email?.toLowerCase().replace(/[^a-z0-9]/g, '_') || '')
        
        // Prepare login attempt record
        const loginAttempt: LoginAttempt = {
          timestamp: new Date(),
          success: true,
          ipAddress: activityContext.ipAddress,
          device: activityContext.device,
          location: activityContext.location
        };

        // Update user document with login activity
        await updateDoc(userRef, {
          status: 'active',
          'activity.lastSuccessfulLogin': serverTimestamp(),
          'activity.loginAttempts': arrayUnion(loginAttempt),
          'activity.failedLoginCount': 0 // Reset failed login count on successful login
        });
      }

      // Update user state
      setUser(customUser);
      
      toast.success(t("auth.login.success", { username: customUser.username || 'User' }))

      return {
        success: true,
        needsPasswordChange: false
      };
    } catch (error) {
      let errorMessage = "An unexpected error occurred";
      if (error instanceof Error) {
        switch (error.message) {
          case 'auth/user-not-found':
            errorMessage = "No user found with this email";
            break;
          case 'auth/wrong-password':
            errorMessage = "Incorrect password";
            break;
          case 'auth/too-many-requests':
            errorMessage = "Too many login attempts. Please try again later.";
            break;
          case 'auth/invalid-email':
            errorMessage = "Invalid email address";
            break;
          case 'auth/user-disabled':
            errorMessage = "This account has been disabled";
            break;
          default:
            errorMessage = error.message;
        }
      }

      // Log failed login attempt
      if (db) {
        const userRef = doc(db, 'users', email.toLowerCase().replace(/[^a-z0-9]/g, '_'));
        
        // Prepare failed login attempt record
        const failedLoginAttempt: LoginAttempt = {
          timestamp: new Date(),
          success: false,
          error: errorMessage,
          ipAddress: activityContext.ipAddress,
          device: activityContext.device,
          location: activityContext.location
        };

        // Update user document with failed login attempt
        await updateDoc(userRef, {
          'activity.loginAttempts': arrayUnion(failedLoginAttempt),
          'activity.failedLoginCount': increment(1)
        });
      }

      toast.error(t("auth.login.error", { username: errorMessage }))

      return {
        success: false,
        error: errorMessage,
        needsPasswordChange: false
      };
    }
  };

  // Enhanced logout method
  const logout = async (): Promise<{ success: boolean, error?: string }> => {
    try {
      // Update user status before logout
      if (db && user) {
        const userRef = doc(db, 'users', user.email?.toLowerCase().replace(/[^a-z0-9]/g, '_') || '')
        await updateDoc(userRef, {
          status: 'inactive'
        });
      }

      await signOut(auth!);
      setUser(null);
      
      toast.success(t("auth.logout.success", { username: user?.username || "Guest" }))

      return {
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : "An unexpected error occurred during logout";

      toast.error(t("auth.logout.error", { username: errorMessage }))

      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const initializeUserProfile = async (
    firebaseUser: FirebaseUser, 
    db: Firestore,
    options?: {
      role?: UserRole;
      username?: string;
    }
  ): Promise<User | null> => {
    if (!db) return null;

    try {
      // Generate unique username if not provided
      const username = options?.username ||
        await generateUniqueUsername(firebaseUser.email || '');

      const userRole = options?.role || UserRole.WAITER; // Determine role

      // Prepare user data
      const userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        username,
        role: userRole,
        status: 'active',
        emailVerified: false,
        createdAt: serverTimestamp(), // Use serverTimestamp
        updatedAt: serverTimestamp()  // Use serverTimestamp
      };

      // Reference to the user document
      const userRef = doc(db, 'users', firebaseUser.uid);

      // Check if the user is an OWNER to initialize collections
      if (userRole === UserRole.OWNER) {
        // Create a batch write
        const batch = writeBatch(db);

        // 1. Set the owner's user document
        batch.set(userRef, userData);

        // 2. Create a default table map
        const defaultMapRef = doc(db, 'tableMaps', 'default_map');
        batch.set(defaultMapRef, {
          name: 'Default Map',
          layout: { tables: [] },
          createdAt: serverTimestamp()
        });

        // 3. Initialize inventory categories with the required categories
        const inventoryCategories = [
          { id: 'refrigerantes', name: 'Refrigerantes', _isCategory: true },
          { id: 'drinks', name: 'Drinks', _isCategory: true },
          { id: 'cervejas', name: 'Cervejas', _isCategory: true },
          { id: 'vinhos', name: 'Vinhos', _isCategory: true },
          { id: 'acompanhamentos', name: 'Acompanhamentos', _isCategory: true },
          { id: 'almoco', name: 'Almoco', _isCategory: true },
          { id: 'jantar', name: 'Jantar', _isCategory: true }
        ];

        // Create each category in the batch
        inventoryCategories.forEach(category => {
          batch.set(doc(db, 'inventory', category.id), {
            name: category.name,
            _isCategory: true,
            createdAt: serverTimestamp()
          });
        });

        //4. Create placeholder documents for other collections
        batch.set(doc(db, 'orders', '_placeholder'), { initializedAt: serverTimestamp() });
        batch.set(doc(db, 'invitations', '_placeholder'), { initializedAt: serverTimestamp() });

        // Commit the batch
        await batch.commit();
        console.log('Owner registered, collections and inventory categories initialized.'); // Optional log

      } else {
        // For non-owners, just set the user document
        await setDoc(userRef, userData);
      }

      // Fetch the data to return (optional, userData is likely sufficient)
      // const userDocSnap = await getDoc(userRef);
      // return userDocSnap.exists() ? (userDocSnap.data() as User) : null;
      // Returning the locally constructed userData is often sufficient
      // Ensure the returned object matches the User type completely
      return {
          uid: userData.uid,
          email: userData.email,
          username: userData.username,
          role: userData.role,
          status: userData.status,
          emailVerified: userData.emailVerified,
          // Timestamps are null locally immediately after serverTimestamp()
          createdAt: null,
          updatedAt: null,
           id: userData.uid // Assuming id should be the same as uid
      } as User;


    } catch (error) {
      console.error('Error initializing user profile:', error);
      toast.error(`Error initializing profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  useEffect(() => {
    // Immediate loading state if Firebase is not initialized
    if (!db || !auth) {
      setLoading(true)
      return
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setLoading(true)
        if (firebaseUser) {
          const customUser = await fetchUserDetails(firebaseUser)
          setUser(customUser)
        } else {
          setUser(null)
        }
        setLoading(false)

        // Redirect logic
        if (!firebaseUser && !publicRoutes.includes(pathname)) {
          router.push("/login")
        }
      },
      (authError) => {
        setLoading(false)
        toast.error("Error during authentication state change")
      }
    )

    return () => unsubscribe()
  }, [auth, db, pathname, router, toast])

  function t(key: string, params?: Record<string, string | number>): string {
    console.warn(`Translation not implemented for key: ${key}`)
    return key
  }

  return <AuthContext.Provider value={{ 
    user, 
    currentUser: user, 
    loading, 
    login, 
    logout, 
    signUp 
  }}>{children}</AuthContext.Provider>
}
