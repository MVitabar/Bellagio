// types/reports.ts

import { Order } from './order';
import { TableItem } from './table';
import { InventoryItem } from './inventory';

export interface SalesData {
  date: string;
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
  topSellingItems?: TopSellingItem[];
}

export interface TopSellingItem {
  itemName: string;
  revenue: number;
  quantitySold?: number;
}

export interface ExcelReportTableProps {
  title: string;
  data: any[];
  columns: {
    header: string;
    accessorKey: string;
  }[];
  headerColor?: string;
}

export interface ExcelReportData {
  sales: {
    daily: SalesData[];
    weekly: SalesData[];
    monthly: SalesData[];
    yearly: SalesData[];
  };
  inventory: InventoryItem[];
  orders: Order[];
  tables: TableItem[];
  [key: string]: any;
}

export interface ExcelReportGeneratorProps {
  reportData: ExcelReportData;
}
