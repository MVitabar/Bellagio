import { UserRole } from './user'; // Needed if CurrentUser usage implies roles

// Inventory Management
export enum InventoryCategory {
  Produce = 'produce',
  Meat = 'meat',
  Dairy = 'dairy',
  Pantry = 'pantry',
  Beverages = 'beverages'
}

export interface InventoryItem {
  uid: string;  
  id?: string;
  name: string;
  category: string; // Consider using InventoryCategory enum type here
  categoryName?: string;
  quantity?: number;
  unit: string;
  price?: number;
  minQuantity?: number;
  description?: string;
  supplier?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lowStockThreshold?: number;
}

export interface InventoryItemSourceData {
  id?: string;
  name: string;
  category: string; // Consider using InventoryCategory enum type here
  quantity: number;
  minQuantity?: number;
  lowStockThreshold?: number;
  price: number;
  unit: string;
  description?: string;
  supplier?: string;
  createdAt?: Date;
  updatedAt?: Date;
  uid?: string;
  purchaseDate?: Date;
  expirationDate?: Date;
  reorderPoint?: number;
  notes?: string;
  categoryName?: string;
}
