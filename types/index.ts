// Comandero/types/index.ts

import { Order } from './order';

// Re-export all types from individual files
export * from './permissions'; 
export * from './user';
export * from './inventory';
export * from './order';
export * from './table';
export * from './menu';

// Add exports for any other type files created (e.g., reporting.ts, settings.ts)

export interface OrderDetailsDialogProps {
  order: Order; // Assuming Order type is already defined and exported in your types
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface PasswordStrengthIndicatorProps {
  password: string;
}

// Export advanced report types from their own file
export * from './advanced-reports';
export * from './reports';