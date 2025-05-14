// lib/firestore-paths.ts
import { User } from '@/types';
import { RESTAURANT_ID } from './firebase-config';

export const getEstablishmentId = async (
  user: User | null, 
  db?: any
): Promise<string> => {
  return RESTAURANT_ID;
};

export const getFirestorePaths = (user: User | null) => {
  return {
    users: (userId?: string) => 
      userId 
        ? ['users', userId]
        : ['users'],
    
    inventory: (category?: string, itemId?: string) => {
      const basePath = ['inventory'];
      return category 
        ? [...basePath, category, 'items', ...(itemId ? [itemId] : [])]
        : basePath;
    },
    
    orders: (orderId?: string) => 
      orderId
        ? ['orders', orderId]
        : ['orders'],
    
    tableMaps: (tableMapId?: string) => 
      tableMapId
        ? ['tableMaps', tableMapId]
        : ['tableMaps']
  };
};