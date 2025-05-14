import { Timestamp } from 'firebase/firestore';

// User and Authentication
export enum UserRole {
  OWNER = "owner",
  ADMIN = "admin",
  MANAGER = "manager",
  WAITER = "waiter",
  CHEF = "chef",
  BARMAN = "barman",
}

export interface User {
  [x: string]: any;
  id: string;
  uid: string;
  email: string | null;
  role: UserRole;
  status: string;
  emailVerified: boolean;
  username?: string;
  displayName?: string;
  photoURL?: string | null;
  companyId?: string;
  companyName?: string;
  planId?: string; 
  subscriptionStatus?: string; 
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
}

export interface LoginAttempt {
  timestamp: Date;
  success: boolean;
  error?: string;
  ipAddress?: string;
  location?: {
    country?: string;
    city?: string;
  };
  device?: {
    type?: string;
    os?: string;
    browser?: string;
  };
}

export interface UserActivity {
  loginAttempts?: LoginAttempt[];
  lastSuccessfulLogin?: Date;
  failedLoginCount?: number;
  accountCreated: Date;
  lastPasswordChange?: Date;
}

// This seems like a subset of User or a specific context, review if needed
export interface CurrentUser {
  uid: string;
  role?: UserRole;
  email?: string | null;
}

export interface PasswordStrengthIndicatorProps {
  password: string;
}

// Define and export AuthContextType
export interface AuthContextType {
  user: User | null;
  currentUser: User | null; // Or CurrentUser if preferred for this specific context
  loading: boolean;
  login: (
    email: string, 
    password: string
  ) => Promise<{ 
    success: boolean; 
    error?: string; 
    needsPasswordChange?: boolean 
  }>;
  logout: () => Promise<{ 
    success: boolean; 
    error?: string 
  }>;
  signUp: (
    email: string, 
    password: string, 
    options?: {
      role?: UserRole;
      username?: string;
      planId?: string; // As per memory b737e7e4-49c0-4400-92b4-c9e9b505ed47
      subscriptionStatus?: string; // As per memory b737e7e4-49c0-4400-92b4-c9e9b505ed47
    }
  ) => Promise<{
    success: boolean; 
    error?: string; 
    userId?: string; 
    needsPasswordChange?: boolean 
  }>;
  // Add other methods or properties if they exist in your context, e.g., sendPasswordResetEmail
}
