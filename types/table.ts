import { Order } from './order'; // Import Order type for props
import { Timestamp } from 'firebase/firestore';

// Table and Seating Management
export type TableStatus = 
  | "available" 
  | "occupied" 
  | "reserved" 
  | "maintenance" 
  | "ordering" 
  | "preparing" 
  | "ready" 
  | "served";

export interface TableItem {
  uid: string;
  id?: string;
  number: number;
  seats: number;
  shape: "square" | "round" | "rectangle";
  width: number;
  height: number;
  x: number;
  y: number;
  status: TableStatus;
  activeOrderId?: string;
  name?: string;
  mapId: string;
}

// Alias para mantener compatibilidad con código existente
export type RestaurantTable = TableItem;

export interface TableMap {
  id: string;
  uid: string;
  name: string;
  description?: string;
  layout?: {
    tables: TableItem[];
  };
  tables: TableItem[];
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// Component Prop Interfaces related to Tables

export interface TableCardProps {
  table: TableItem;
  onCreateOrder?: () => void;
  hasActiveOrder?: boolean;
  orderStatus?: string; // Consider using OrderStatus from ./order
  onEdit?: () => void;
  onDelete?: () => void;
  onViewOrder?: (order: Order) => void; // Needs Order type
  onMarkAsServed?: () => void;
  onCloseOrder?: () => void;
  isEditing?: boolean;
}

export interface TableGridViewProps {
  tables: TableItem[];
  orders?: Record<string, Order>; // Map Order ID to Order object
  onTableClick?: (table: TableItem) => void;
  onCreateOrder?: (table: TableItem) => void;
  onViewOrder?: (table: TableItem) => void; // Might need Order info too
  onMarkAsServed?: (table: TableItem, orderId: string) => void;
  onCloseOrder?: (table: TableItem, orderId: string) => void;
  onAddTable?: () => void;
  onEditTable?: (table: TableItem) => void;
  onDeleteTable?: (table: TableItem) => void;
  isEditing?: boolean;
}

export interface TableMapEditorProps {
  mapUid: string;
  tables: TableItem[];
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
  onTablesChange?: (tables: TableItem[]) => void; // Callback when tables are modified
}

export interface TableMapViewerProps {
  tables: TableItem[];
  selectedTable?: TableItem | null;
  onTableSelect?: (table: TableItem | null) => void;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  showControls?: boolean;
  showLegend?: boolean;
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
}
