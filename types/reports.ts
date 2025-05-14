// types/reports.ts

export interface ExcelReportTableProps {
  title: string;
  data: any[]; // Consider making this more specific if possible, e.g., Record<string, any>[] or a union of specific report data types
  headerColor?: string;
}

export interface TopSellingItem {
  itemName: string;
  revenue: number;
  quantitySold?: number;
}

export interface SalesData {
  date: string;
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
  topSellingItems?: TopSellingItem[];
}
