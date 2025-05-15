// Comandero/types/index.ts

import { Order } from './order'; // Esto es una importación local, no afecta exports
import { UserRole } from './permissions'; // Esto es una importación local

// Re-export all types from individual files
export * from './permissions'; 
export * from './user';
export * from './inventory';

// Exportar selectivamente de order.ts para evitar conflicto con TableMap
export {
  type PaymentMethod,
  type BaseOrderStatus,
  type OrderStatus,
  type FlexibleOrderStatus,
  type OrderItemStatus,
  type OrderItem,
  type PaymentInfo,
  type Order as OrderType, // Renombrar Order si hay conflicto o por claridad
  type Table as OrderTableType // Renombrar Table de order.ts
  // No re-exportar TableMap desde order.ts aquí
} from './order';

export * from './menu';
export * from './table'; // Esto exportará TableMap y TableItem de table.ts
export * from './advanced-reports';
export * from './reports';

// Mantener otras interfaces como estaban si no hay conflicto
export interface OrderDetailsDialogProps {
  order: Order; // Usar el tipo Order localmente
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table?: any; 
  onEditOrder?: (order: Order) => void; // Usar el tipo Order localmente
}

export interface PasswordStrengthIndicatorProps {
  password: string;
}

export interface UserProfileData {
  displayName?: string;
  username?: string;
  email?: string;
  photoURL?: string;
  role?: UserRole; 
  phoneNumber?: string;
}