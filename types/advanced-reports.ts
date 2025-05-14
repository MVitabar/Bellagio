import { Order } from './order';
import { InventoryItem } from './inventory';

// For Advanced Reports Page
export interface FinancialEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
}

export interface FinancialData {
  summary: Array<{ label: string; value: string }>;
  data: FinancialEntry[];
}

export interface StaffPerformanceEntry {
  id: string;
  name: string;
  ordersServed?: number;
  totalSales?: number;
  averageRating?: number;
  // other relevant staff metrics
}

export interface StaffData {
  summary: Array<{ label: string; value: string }>;
  data: StaffPerformanceEntry[];
}

export interface CustomerRecord {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  visits: number;
  lastVisit: string; // Using string due to common 'Date not assignable to string' errors
  totalSpent?: number;
  loyaltyTier?: string;
}

export interface CustomersData {
  summary: Array<{ label: string; value: string }>;
  data: CustomerRecord[];
}

export interface ReservationEntry {
  id: string;
  customerName: string;
  reservationDate: string; // Using string for date consistency
  partySize: number;
  status: 'Confirmado' | 'Pendente' | 'Cancelado';
  notes?: string;
}

export interface ReservationsData {
  summary: Array<{ label: string; value: string }>;
  data: ReservationEntry[];
}

export interface SalesCategoryData {
  category: string;
  amount: number;
  percentage: number;
}

export interface SalesDataAdvanced {
  summary: Array<{ label: string; value: string }>;
  data: SalesCategoryData[];
}

export interface ReportDataAdvanced {
  sales: SalesDataAdvanced;
  orders: Order[];
  inventory: InventoryItem[];
  financial: FinancialData;
  staff: StaffData;
  customers: CustomersData;
  reservations: ReservationsData;
}
