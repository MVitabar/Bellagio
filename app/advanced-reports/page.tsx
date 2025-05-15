"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useFirebase } from "@/components/firebase-provider"
import { useI18n } from "@/components/i18n-provider"
import {toast} from "sonner"
import { Loader2 } from "lucide-react"
import { collection, query, where, orderBy, getDocs, DocumentData } from "firebase/firestore"
import { ExcelReportGenerator } from "@/components/reports/excel-report-generator"
import { 
  OrderType as Order, 
  InventoryItem, 
  ReportDataAdvanced, 
  SalesData, 
  FinancialData, 
  StaffData, 
  CustomersData, 
  ReservationsData,
  SalesDataAdvanced,
  CustomerRecord,
  ReservationEntry,
  TableItem,
  SalesCategoryData,
  ExcelReportData
} from "@/types"

const AdvancedReportsPage = () => {
  const { db } = useFirebase()
  const { user } = useAuth()
  const { t } = useI18n()

  const generateDefaultFinancialData = (): FinancialData => ({
    summary: [
      { label: t("totalRevenue"), value: "$0.00" },
      { label: t("netProfit"), value: "$0.00" },
      { label: t("expenses"), value: "$0.00" },
    ],
    data: []
  })

  const generateDefaultStaffData = (): StaffData => ({
    summary: [
      { label: t("totalStaff"), value: "0" },
      { label: t("activeStaff"), value: "0" },
      { label: t("avgPerformance"), value: "0%" },
    ],
    data: []
  })

  const generateDefaultCustomersData = (): CustomersData => ({
    summary: [
      { label: t("totalCustomers"), value: "0" },
      { label: t("newCustomers"), value: "0" },
      { label: t("repeatCustomers"), value: "0" },
    ],
    data: []
  })

  const generateDefaultReservationsData = (): ReservationsData => ({
    summary: [
      { label: t("totalReservations"), value: "0" },
      { label: t("confirmedReservations"), value: "0" },
      { label: t("pendingReservations"), value: "0" },
    ],
    data: []
  })

  const [reportData, setReportData] = useState<ReportDataAdvanced>({
    sales: {
      summary: [
        { label: t("totalSales"), value: "$0.00" },
        { label: t("averageTicket"), value: "$0.00" },
        { label: t("totalOrders"), value: "0" },
        { label: t("categories"), value: "0" },
      ],
      data: []
    },
    orders: [],
    inventory: [],
    tables: [],
    financial: generateDefaultFinancialData(),
    staff: generateDefaultStaffData(),
    customers: generateDefaultCustomersData(),
    reservations: generateDefaultReservationsData()
  })
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])

  const convertSalesDataToAdvanced = (salesData: SalesData): SalesDataAdvanced => ({
    summary: [
      { label: t("totalSales"), value: `$${salesData.totalRevenue.toFixed(2)}` },
      { label: t("averageTicket"), value: `$${salesData.averageTicket.toFixed(2)}` },
      { label: t("totalOrders"), value: salesData.orderCount.toString() },
      { label: t("categories"), value: salesData.topSellingItems?.length.toString() || "0" },
    ],
    data: salesData.topSellingItems?.map(item => ({
      category: item.itemName,
      amount: item.revenue,
      percentage: (item.revenue / salesData.totalRevenue) * 100
    })) || []
  })

  const fetchAllReportData = async (): Promise<ReportDataAdvanced> => {
    try {
      if (!db || !user) {
        return {
          sales: {
            summary: [
              { label: t("totalSales"), value: "$0.00" },
              { label: t("averageTicket"), value: "$0.00" },
              { label: t("totalOrders"), value: "0" },
              { label: t("categories"), value: "0" },
            ],
            data: []
          },
          orders: [],
          inventory: [],
          tables: [],
          financial: generateDefaultFinancialData(),
          staff: generateDefaultStaffData(),
          customers: generateDefaultCustomersData(),
          reservations: generateDefaultReservationsData()
        }
      }

      const orders = await fetchOrdersData()
      const inventory = await fetchInventoryData()
      const salesData = await fetchSalesData()
      const tables = await fetchTablesData()

      return {
        orders,
        inventory,
        sales: convertSalesDataToAdvanced(salesData),
        tables,
        financial: generateDefaultFinancialData(),
        staff: generateDefaultStaffData(),
        customers: generateDefaultCustomersData(),
        reservations: generateDefaultReservationsData()
      }
    } catch (error) {
      console.error("Error fetching report data:", error)
      return {
        sales: {
          summary: [
            { label: t("totalSales"), value: "$0.00" },
            { label: t("averageTicket"), value: "$0.00" },
            { label: t("totalOrders"), value: "0" },
            { label: t("categories"), value: "0" },
          ],
          data: []
        },
        orders: [],
        inventory: [],
        tables: [],
        financial: generateDefaultFinancialData(),
        staff: generateDefaultStaffData(),
        customers: generateDefaultCustomersData(),
        reservations: generateDefaultReservationsData()
      }
    }
  }

  const fetchSalesData = async (): Promise<SalesData> => {
    try {
      if (!db || !user) return {
        date: new Date().toISOString(),
        totalRevenue: 0,
        orderCount: 0,
        averageTicket: 0,
        topSellingItems: []
      }

      const salesRef = collection(db, "sales")
      const q = query(salesRef, where("status", "==", "closed"), orderBy("closedAt", "desc"))

      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return {
          date: new Date().toISOString(),
          totalRevenue: 0,
          orderCount: 0,
          averageTicket: 0,
          topSellingItems: []
        }
      }

      const orders: Order[] = querySnapshot.docs.map((doc) => {
        const data = doc.data() as DocumentData
        return {
          id: doc.id,
          uid: data.uid || data.createdBy || '',
          total: data.total || 0,
          status: data.status || 'closed',
          tableNumber: data.tableNumber || undefined,
          tableId: data.tableId || '',
          tableMapId: data.tableMapId || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          closedAt: data.closedAt?.toDate ? data.closedAt.toDate() : undefined,
          items: (data.items || []).map((item: any) => ({
            id: item.id || '',
            name: item.name || '',
            category: item.category || 'Uncategorized',
            quantity: item.quantity || 0,
            price: item.price || 0
          })),
          orderType: data.orderType || 'table',
          restaurantId: data.restaurantId || '',
          subtotal: data.subtotal || 0,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          paymentInfo: data.paymentInfo || {},
          createdBy: data.createdBy || '',
          discount: data.discount || 0,
          paymentMethod: data.paymentMethod || 'pending',
          waiter: data.waiter || data.createdBy || ''
        }
      })

      // Calculate total sales
      const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)

      // Calculate order count
      const orderCount = orders.length

      // Calculate average ticket
      const averageTicket = orderCount > 0 ? totalRevenue / orderCount : 0

      // Calculate top selling items
      const itemSales: Record<string, { quantity: number, revenue: number }> = {}
      orders.forEach((order) => {
        (Array.isArray(order.items) ? order.items : []).forEach((item) => {
          if (!itemSales[item.name]) {
            itemSales[item.name] = { quantity: 0, revenue: 0 }
          }
          itemSales[item.name].quantity += item.quantity
          itemSales[item.name].revenue += item.price * item.quantity
        })
      })

      const topSellingItems = Object.entries(itemSales)
        .map(([itemName, { quantity, revenue }]) => ({
          itemName,
          quantity,
          revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      return {
        date: new Date().toISOString(),
        totalRevenue,
        orderCount,
        averageTicket,
        topSellingItems
      }
    } catch (error) {
      console.error("Error fetching sales data:", error)
      return {
        date: new Date().toISOString(),
        totalRevenue: 0,
        orderCount: 0,
        averageTicket: 0,
        topSellingItems: []
      }
    }
  }

  const fetchOrdersData = async (): Promise<Order[]> => {
    try {
      if (!db || !user) return []

      const ordersRef = collection(db, "orders")
      const q = query(ordersRef, orderBy("createdAt", "desc"))

      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return []
      }

      return querySnapshot.docs.map((doc) => {
        const data = doc.data() as DocumentData
        return {
          id: doc.id,
          uid: data.uid || data.createdBy || '',
          total: data.total || 0,
          status: data.status || 'closed',
          tableNumber: data.tableNumber || undefined,
          tableId: data.tableId || '',
          tableMapId: data.tableMapId || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          closedAt: data.closedAt?.toDate ? data.closedAt.toDate() : undefined,
          items: (data.items || []).map((item: any) => ({
            id: item.id || '',
            name: item.name || '',
            category: item.category || 'Uncategorized',
            quantity: item.quantity || 0,
            price: item.price || 0
          })),
          orderType: data.orderType || 'table',
          restaurantId: data.restaurantId || '',
          subtotal: data.subtotal || 0,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          paymentInfo: data.paymentInfo || {},
          createdBy: data.createdBy || '',
          discount: data.discount || 0,
          paymentMethod: data.paymentMethod || 'pending',
          waiter: data.waiter || data.createdBy || ''
        }
      })
    } catch (error) {
      console.error("Error fetching orders data:", error)
      return []
    }
  }

  const fetchInventoryData = async (): Promise<InventoryItem[]> => {
    try {
      if (!db || !user) return []

      const inventoryRef = collection(db, "inventory")
      const q = query(inventoryRef, orderBy("name"))

      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return []
      }

      return querySnapshot.docs.map((doc) => {
        const data = doc.data() as DocumentData
        return {
          id: doc.id,
          name: data.name || '',
          category: data.category || 'Uncategorized',
          quantity: data.quantity || 0,
          minQuantity: data.minQuantity || 0,
          unit: data.unit || '',
          price: data.price || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          restaurantId: user.uid,
          description: data.description || ''
        } as unknown as InventoryItem
      })
    } catch (error) {
      console.error("Error fetching inventory data:", error)
      return []
    }
  }

  const fetchStaffData = async (): Promise<StaffData> => {
    try {
      if (!db || !user) return generateDefaultStaffData()

      const usersRef = collection(db, "users")
      const q = query(usersRef)

      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return generateDefaultStaffData()
      }

      const staffData: StaffData = {
        summary: [
          { label: t("totalStaff"), value: querySnapshot.docs.length.toString() },
          { label: t("activeStaff"), value: "0" },
          { label: t("avgPerformance"), value: "0%" },
        ],
        data: querySnapshot.docs.map((doc) => {
          const data = doc.data() as DocumentData
          return {
            id: doc.id,
            name: data.displayName || '',
            role: data.role || '',
            performance: 0,
            shifts: 0
          }
        })
      }

      return staffData
    } catch (error) {
      console.error("Error fetching staff data:", error)
      return generateDefaultStaffData()
    }
  }

  const fetchCustomersData = async (): Promise<CustomersData> => {
    try {
      if (!db || !user) return generateDefaultCustomersData()

      const customersRef = collection(db, "customers")
      const q = query(customersRef)

      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return generateDefaultCustomersData()
      }

      const customersData: CustomersData = {
        summary: [
          { label: t("totalCustomers"), value: querySnapshot.docs.length.toString() },
          { label: t("newCustomers"), value: "0" },
          { label: t("repeatCustomers"), value: "0" },
        ],
        data: querySnapshot.docs.map((doc) => {
          const data = doc.data() as DocumentData
          return {
            uid: doc.id,
            name: data.displayName || '',
            email: data.email || 'N/A',
            phone: data.phone || 'N/A',
            visits: data.visits || 0,
            lastVisit: (data.lastVisit?.toDate ? data.lastVisit.toDate() : new Date()).toISOString(),
            totalSpent: data.totalSpent || 0,
            loyaltyTier: data.loyaltyTier || 'Bronze'
          } as CustomerRecord
        })
      };

      return customersData
    } catch (error) {
      console.error("Error fetching customers data:", error)
      return generateDefaultCustomersData()
    }
  }

  const fetchReservationsData = async (): Promise<ReservationsData> => {
    try {
      if (!db || !user) return generateDefaultReservationsData()

      const reservationsRef = collection(db, "reservations")
      const q = query(reservationsRef, orderBy("reservationTime", "desc"))

      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return generateDefaultReservationsData()
      }

      const reservationsData: ReservationsData = {
        summary: [
          { label: t("totalReservations"), value: querySnapshot.docs.length.toString() },
          { label: t("confirmedReservations"), value: "0" },
          { label: t("pendingReservations"), value: "0" },
        ],
        data: querySnapshot.docs.map((doc) => {
          const data = doc.data() as DocumentData
          const reservationDateTime = data.reservationDateTimeStamp?.toDate ? data.reservationDateTimeStamp.toDate() : (data.date?.toDate ? data.date.toDate() : new Date());
          return {
            id: doc.id,
            customerName: data.customerName || data.name || 'N/A',
            reservationDate: reservationDateTime.toISOString(),
            partySize: data.partySize || data.guests || 0,
            status: data.status || "pending",
            notes: data.notes || undefined
          } as ReservationEntry
        })
      }

      return reservationsData
    } catch (error) {
      console.error("Error fetching reservations data:", error)
      return generateDefaultReservationsData()
    }
  }

  const fetchTablesData = async (): Promise<TableItem[]> => {
    if (!db) return [];
    try {
      const tablesRef = collection(db, "tables");
      const querySnapshot = await getDocs(tablesRef);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TableItem));
    } catch (error) {
      console.error("Error fetching tables data:", error);
      toast.error(t("errors.fetchTablesData"));
      return [];
    }
  };

  const convertReportDataForGenerator = (data: ReportDataAdvanced): ExcelReportData => ({
    sales: {
      daily: data.sales.data.map((item: SalesCategoryData) => ({
        date: new Date().toISOString(), 
        totalRevenue: item.amount,
        orderCount: 0, 
        averageTicket: 0, 
        topSellingItems: [
          {
            itemName: item.category, 
            revenue: item.amount, 
            quantitySold: 0 
          }
        ]
      })),
      weekly: [], 
      monthly: [], 
      yearly: [] 
    },
    inventory: data.inventory || [],
    orders: data.orders || [],
    tables: data.tables || [],
    financial: data.financial ? Object.entries(data.financial).map(([category, data]) => ({
      category,
      amount: data.total || 0,
      percentage: data.percentage || 0
    })) : [],
    staff: data.staff ? Object.entries(data.staff).map(([name, data]) => ({
      name,
      role: data.role || '',
      performance: data.performance || 0,
      shifts: data.shifts || 0
    })) : [],
    reservations: data.reservations ? Object.entries(data.reservations).map(([_, data]) => ({
      id: data.id,
      customerName: data.customerName,
      reservationDate: data.reservationDate,
      partySize: data.partySize,
      status: data.status,
      notes: data.notes
    })) : [],
    customers: data.customers?.data?.map((customer: CustomerRecord) => ({
      uid: customer.uid, 
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      visits: customer.visits,
      lastVisit: customer.lastVisit, 
      totalSpent: customer.totalSpent,
      loyaltyTier: customer.loyaltyTier
    })),
  })

  useEffect(() => {
    const loadReportData = async () => {
      try {
        const data = await fetchAllReportData()
        setReportData(data)
        setOrders(data.orders || [])
        setInventory(data.inventory || [])
        setLoading(false)
      } catch (error) {
        console.error("Error fetching report data:", error)
        setLoading(false)
        toast.error(t("errorFetchingData"))
      }
    }

    loadReportData()
  }, [db, user])

  return (
    <div>
      {loading ? (
        <div className="flex justify-center items-center h-full">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <ExcelReportGenerator reportData={convertReportDataForGenerator(reportData)} />
      )}
    </div>
  )
}

export default AdvancedReportsPage
