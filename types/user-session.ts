export interface UserSession {
  id: string;
  userId: string;
  userName: string;
  role: string;
  loginTime: Date;
  logoutTime: Date | null;
  isActive: boolean;
  totalOrders?: number;
  totalSales?: number;
  device?: string;
  ipAddress?: string;
}

export interface UserStats {
  userId: string;
  userName: string;
  role: string;
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  topCategories: { category: string; sales: number }[];
  averageOrderTime: number;
  peakHours: { hour: number; orders: number }[];
  customerSatisfaction?: number;
  sessionHistory: {
    date: Date;
    loginTime: Date;
    logoutTime: Date | null;
    sales: number;
    orders: number;
  }[];
}
