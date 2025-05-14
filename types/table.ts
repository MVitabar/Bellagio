import { Order } from './order'; // Import Order type for props

// Table and Seating Management
export type TableStatus = "available" | "occupied" | "reserved" | "maintenance" | "ordering" | "preparing" | "ready" | "served";

export interface TableItem {
  uid: string;
  number: number;
  seats: number;
  shape: "square" | "round" | "rectangle";
  width: number;
  height: number;
  x: number;
  y: number;
  status: TableStatus;
  activeOrderId?: string;
  id?: string; // Often same as uid in Firestore context
  name?: string; // Optional name/label for the table
  mapId: string; // Reference to the TableMap this table belongs to
}

export interface TableMap {
  id: string; // Firestore document ID
  uid: string; // User ID who created/owns the map
  name: string;
  description?: string;
  tables: TableItem[]; // Embedded or references?
  createdAt: Date;
  updatedAt: Date;
}

// This seems slightly redundant with TableItem, perhaps a simplified version?
// Or maybe intended for initial creation data?
export interface RestaurantTable {
  id?: string;
  name: string;
  capacity: number;
  x?: number;
  y?: number;
  mapId: string;
  status: 'available' | 'occupied' | 'reserved'; // Simpler status set?
}

// Component Prop Interfaces related to Tables

export interface TableCardProps {
  table: TableItem;
  hasActiveOrder?: boolean;
  orderStatus?: string; // Consider using OrderStatus from ./order
  onEdit?: () => void;
  onDelete?: () => void;
  onCreateOrder?: () => void;
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
