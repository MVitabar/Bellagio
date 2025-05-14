"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useFirebase } from "@/components/firebase-provider"
import { DollarSign, Utensils, Clock } from "lucide-react"
import { collection, query, where, getDocs, orderBy, doc, onSnapshot, limit, getDoc } from "firebase/firestore"
import { Order, OrderItem } from "@/types/order" 
import { MetricCard } from "./components/metric-card"
import { SalesChart } from "./components/sales-chart"
import { RecentActivity } from "./components/recent-activity"
import { ExcelReportGenerator } from "@/components/reports/excel-report-generator"
import { CategoryChart } from "./components/category-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SalesSummary } from "./components/sales-summary"
import { PaymentMethodsSummary } from "./components/payment-methods-summary"
import { Button } from "@/components/ui/button"
import { Download, FileText } from "lucide-react"
import Link from "next/link"

interface DashboardMetrics {
  totalVentas: number;
  pedidosHoje: number;  
  mesasOcupadas: number;
  clientesAtivos: number;
  vendasSemanais: { date: string; total: number; }[];
  pedidosPendentes: number;
  topItems: { name: string; quantity: number; revenue: number; }[];
  salesHistory: { date: string; total: number; }[];
  categoryData: { name: string; value: number; percentage: number; }[];
  yesterdayTotal: number;
  averageTicket: number;
  peakHours: { hour: number; sales: number }[];
  topProfitItems: { name: string; profit: number }[];
  recentActivities: {
    id: string;
    type: 'order' | 'table' | 'payment';
    description: string;
    time: Date;
    status?: string;
    amount?: number;
    tableNumber?: number;
    paymentMethod?: string;
  }[];
  topPaymentMethods: { method: string; count: number; percentage: number }[];
  paymentMethod: string;
}

interface Table {
  id: string;
  name: string;
  status: 'occupied' | 'pending' | 'available';
  activeOrderId?: string;
  capacity: number;
  mapId: string;
  x: number;
  y: number;
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { db } = useFirebase()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalVentas: 0,
    pedidosHoje: 0,
    mesasOcupadas: 0,
    clientesAtivos: 0,
    vendasSemanais: [],
    pedidosPendentes: 0,
    topItems: [],
    salesHistory: [],
    categoryData: [],
    yesterdayTotal: 0,
    averageTicket: 0,
    peakHours: [],
    topProfitItems: [],
    recentActivities: [],
    topPaymentMethods: [],
    paymentMethod: ''
  })

  useEffect(() => {
    if (!db || !user) return

    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Obtener pedidos históricos (últimos 30 días)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        console.log('Fetching orders since:', thirtyDaysAgo)

        const ordersRef = collection(db, 'orders')
        const ordersQuery = query(
          ordersRef,
          where('createdAt', '>=', thirtyDaysAgo),
          orderBy('createdAt', 'desc')
        )

        const ordersSnapshot = await getDocs(ordersQuery)
        console.log(`Found ${ordersSnapshot.docs.length} orders`)

        const orders = ordersSnapshot.docs.map(doc => {
          const data = doc.data()
          console.log('Order data:', { id: doc.id, createdAt: data.createdAt, status: data.status, items: data.items })
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(0)
          }
        }) as Order[]

        // Filter orders for today
        const ordersToday = orders.filter(order => {
          if (!order.createdAt) return false
          const orderDate = order.createdAt
          return orderDate.getFullYear() === today.getFullYear() &&
                 orderDate.getMonth() === today.getMonth() &&
                 orderDate.getDate() === today.getDate()
        })

        console.log(`Found ${ordersToday.length} orders for today`)

        // Calcular items más vendidos
        const itemsMap = new Map()
        orders.forEach(order => {
          let itemsArray: Order["items"] = []
          if (Array.isArray(order.items)) {
            itemsArray = order.items
          } else if (order.items && typeof order.items === 'object') {
            itemsArray = Object.values(order.items)
          }

          itemsArray?.forEach(item => {
            if (!item || typeof item.name === 'undefined') return
            const currentCount = itemsMap.get(item.name) || { quantity: 0, revenue: 0 }
            itemsMap.set(item.name, {
              quantity: currentCount.quantity + (item.quantity || 1),
              revenue: currentCount.revenue + ((item.price || 0) * (item.quantity || 1))
            })
          })
        })

        const topItems = Array.from(itemsMap.entries())
          .map(([name, data]) => ({
            name,
            quantity: data.quantity,
            revenue: data.revenue
          }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5)

        // Calcular histórico de ventas por día
        const salesByDate = orders.reduce((acc, order) => {
          const date = new Date(order.createdAt).toISOString().split('T')[0]
          acc[date] = (acc[date] || 0) + (order.total || 0)
          return acc
        }, {} as Record<string, number>)

        const salesHistory = Object.entries(salesByDate)
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([date, total]) => ({
            date: new Date(date).toLocaleDateString('pt-BR', { 
              day: '2-digit', 
              month: '2-digit' 
            }),
            total: Number(total)
          }))

        // Calcular ventas por categoría
        const categoryMap = new Map<string, number>()
        orders.forEach(order => {
          let itemsArray: OrderItem[] = []
          if (Array.isArray(order.items)) {
            itemsArray = order.items
          } else if (order.items && typeof order.items === 'object') {
            itemsArray = Object.values(order.items) as OrderItem[]
          }
          
          itemsArray.forEach(item => {
            if (!item?.category) return
            const currentTotal = categoryMap.get(item.category) || 0
            categoryMap.set(item.category, currentTotal + (item.price || 0) * (item.quantity || 1))
          })
        })

        const totalVentas = Array.from(categoryMap.values()).reduce((sum, value) => sum + value, 0)
        const categoryData = Array.from(categoryMap.entries())
          .map(([name, value]) => ({
            name,
            value,
            percentage: (value / totalVentas) * 100
          }))
          .sort((a, b) => b.value - a.value)

        // Calcular métricas del día
        const totalVendasHoje = ordersToday.reduce((sum, order) => sum + (order.total || 0), 0)
        const pedidosPendentes = ordersToday.filter(order => 
          order.status === "Pendente" || order.status === "Pronto para servir"
        ).length

        // Configurar listener para mesas
        const tableMapsRef = collection(db, 'tableMaps')
        const tableMapsQuery = query(tableMapsRef, where('active', '==', true), limit(1))
        
        const unsubscribe = onSnapshot(tableMapsQuery, async (mapsSnapshot) => {
          let activeMapId = 'default_map'
          
          if (!mapsSnapshot.empty) {
            activeMapId = mapsSnapshot.docs[0].id
          }
          
          const activeMapRef = doc(db, 'tableMaps', activeMapId)
          const mapSnapshot = await getDoc(activeMapRef)
          const mapData = mapSnapshot.data()
          
          if (!mapData) {
            console.log('No se encontró el mapa:', activeMapId)
            return
          }

          console.log('Datos completos del mapa:', JSON.stringify(mapData, null, 2))
          // Las mesas están en mapData.layout.tables, no en mapData.tables
          const tables = mapData.layout?.tables || []
          console.log('Mesas encontradas:', tables.length, tables)

          const occupiedTables = tables.filter((table: Table) => {
            console.log('Revisando mesa:', {
              name: table.name,
              status: table.status,
              activeOrderId: table.activeOrderId
            })
            const isOccupied = table.status === 'occupied' || 
                             (table.status === 'pending' && table.activeOrderId)
            if (isOccupied) {
              console.log('Mesa ocupada:', table.name)
            }
            return isOccupied
          })

          const activeCustomers = tables.reduce((total: number, table: Table) => {
            if (table.status === 'occupied') {
              console.log('Mesa con clientes:', table.name, 'capacidad:', table.capacity)
              return total + (table.capacity || 2)
            }
            return total
          }, 0)

          console.log('Resumen de mesas:', {
            total: tables.length,
            occupied: occupiedTables.length,
            customers: activeCustomers,
            occupiedTables: occupiedTables.map((t: Table) => t.name)
          })
          
          setMetrics(prev => {
            const newMetrics = {
              ...prev,
              mesasOcupadas: occupiedTables.length,
              clientesAtivos: activeCustomers
            }
            console.log('Actualizando métricas de mesas:', newMetrics)
            return newMetrics
          })
        })

        // Actualizar todas las métricas
        setMetrics(prev => ({
          ...prev,
          totalVentas: totalVendasHoje,
          pedidosHoje: ordersToday.length,
          pedidosPendentes,
          topItems,
          salesHistory: salesHistory,
          categoryData,
          vendasSemanais: salesHistory.slice(-7)
        }))

        return () => unsubscribe()

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [db, user])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Painel de Controle</h1>
        <p className="text-muted-foreground">
          Bem-vindo, {user?.username || user?.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Vendas do Dia"
          value={`R$${metrics.totalVentas.toFixed(2)}`}
          description={`${metrics.pedidosHoje} pedidos realizados`}
          icon={DollarSign}
        />

        <MetricCard
          title="Mesas Ocupadas"
          value={metrics.mesasOcupadas}
          description={`~${metrics.clientesAtivos} clientes ativos`}
          icon={Utensils}
        />

        <MetricCard
          title="Pedidos Pendentes"
          value={metrics.pedidosPendentes}
          description="Pedidos em preparação"
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Items Mais Vendidos</CardTitle>
            <CardDescription>Top 5 produtos mais vendidos nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.topItems.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium">
                    {item.quantity}x - R$ {item.revenue.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CategoryChart data={metrics.categoryData} />
        </Card>
      </div>

      

      <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-2">
        <SalesSummary
          todayTotal={metrics.totalVentas}
          yesterdayTotal={metrics.yesterdayTotal}
          averageTicket={metrics.averageTicket}
          peakHours={metrics.peakHours}
          topProfitItems={metrics.topProfitItems}
        />
        <div className="space-y-4">
          <RecentActivity activities={metrics.recentActivities} />
          <PaymentMethodsSummary methods={metrics.topPaymentMethods} />
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Relatórios Rápidos</h2>
          <Link href="/reports" className="no-underline">
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Ver Relatórios Detalhados
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Vendas do Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="secondary" 
                className="w-full" 
                onClick={() => {
                  const today = new Date().toLocaleDateString();
                  const data = {
                    date: today,
                    total: metrics.totalVentas,
                    orders: metrics.pedidosHoje,
                    average: metrics.averageTicket
                  };
                  // Aqui podríamos usar una función auxiliar para exportar
                  console.log("Exportar reporte diario:", data);
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Resumo Diário
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resumo Semanal</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={() => {
                  const data = {
                    weekSales: metrics.vendasSemanais,
                    topItems: metrics.topItems.slice(0, 5)
                  };
                  console.log("Exportar reporte semanal:", data);
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Resumo Semanal
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Análise de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={() => {
                  const data = {
                    categoryData: metrics.categoryData,
                    peakHours: metrics.peakHours,
                    paymentMethods: metrics.topPaymentMethods
                  };
                  console.log("Exportar análise:", data);
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Análise
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
