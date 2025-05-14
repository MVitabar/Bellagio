import { DietaryRestriction } from './menu'; // Import if needed for OrderItem or Order

// Order Management Types
export type PaymentMethod = 'cash' | 'card' | 'pix' | 'credit' | 'debit' | 'other';

// Definición actualizada de estados de la orden en portugués
export type BaseOrderStatus =
  | 'Pendente'          // Cuando se toma el pedido
  | 'Pronto para servir' // Cuando el bar o la cocina lo deja listo
  | 'Entregue'           // Cuando el pedido es llevado a la mesa
  | 'Cancelado'        // Cuando sea cancelado
  | 'Pago'              // Cuando ya fue pagado

// Alias for clarity, ensure consistency
export type OrderStatus = BaseOrderStatus;

// Alias, currently same as BaseOrderStatus
export type FlexibleOrderStatus = BaseOrderStatus;

// Status specific to items within an order
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'finished';

export interface OrderItem {
  id: string;
  itemId: string; // ID referencing MenuItem
  name: string;
  category: string; // Consider MenuItemCategory type
  quantity: number;
  price: number; // Unit price at the time of order
  stock: number;  // Changed from 'number | null' to 'number'
  unit: string;
  notes: string;
  description?: string;
  customDietaryRestrictions: string[]; // Free text for specific needs
  // Inherited or specific dietary flags
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isLactoseFree: boolean;
  status: string; // Status of the individual item
}

export interface PaymentInfo {
  amount: number;
  method: string;
  processedAt: Date;
}

export interface Order {
  id: string;
  uid: string; // User ID who created/managed the order (waiter/cashier)
  orderNumber?: number; // Restaurant-specific order sequence number
  items: OrderItem[];
  total: number; // Final total after discounts, taxes, etc.
  subtotal: number; // Total before discounts, taxes
  discount: number;
  // Add tax, serviceCharge if applicable
  status: OrderStatus | string; // Permitimos string para manejar otros estados
  orderType: 'table' | 'counter' | 'takeaway';
  // 'type' seems redundant if 'orderType' exists, keep one
  // type?: 'table' | 'counter' | 'takeaway'; 
  paymentMethod: string;
  paymentInfo: PaymentInfo; // Could be an array if multiple payments
  tableId: string; // Reference to the Table ID if type is 'table'
  tableNumber: number; // Table number if type is 'table'
  mapId?: string; // Reference to TableMap ID if type is 'table'
  waiter: string; // Waiter's name or ID
  notes?: string; // General notes for the order
  createdAt: Date; // Timestamp or Date object
  updatedAt: Date;
  closedAt: Date | null; // Timestamp when the order was finalized
  specialRequests?: string;
  dietaryRestrictions?: string[]; // Overall order dietary notes, e.g., ['gluten-free', 'vegan']
  createdBy?: string; // Could be UID or name of the initial creator
  // Optional debug context from original type
  debugContext?: {
    userInfo?: { uid?: string; displayName?: string | null };
    orderContext?: { orderType?: string; tableNumber?: number; tableId?: string };
    [key: string]: any;
  };
  // Potentially add customer info for takeaway/delivery
  customerName?: string;
  customerPhone?: string;
}

export interface Table {
  id: string;
  name: string;
  status: 'available' | 'occupied' | 'ordering' | 'maintenance' | 'reserved';
  activeOrderId?: string;
  capacity: number;
  mapId: string;
  x: number;
  y: number;
  number: number;
}

export interface TableMap {
  name: string;
  tables: Table[];
  layout: any; // Puedes definir el tipo específico si lo necesitas
  createdAt: Date;
  updatedAt: Date;
  active?: boolean;
}

export interface OrderDetailsDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
