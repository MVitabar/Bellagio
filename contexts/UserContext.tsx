import { createContext, useContext, ReactNode, useState } from 'react';
import { UserRole } from '@/types/user';

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  status: string;
  emailVerified: boolean;
  username?: string;
  displayName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
});

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);