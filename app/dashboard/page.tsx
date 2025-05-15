"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useFirebase } from "@/components/firebase-provider"
import { DollarSign, Utensils, Clock } from "lucide-react"
import { collection, query, where, getDocs, orderBy, doc, onSnapshot, limit, getDoc, Timestamp } from "firebase/firestore"
import { Order, OrderItem } from "@/types/order" 
import { MetricCard } from "./components/metric-card"
import { RecentActivity } from "./components/recent-activity"
import { CategoryChart } from "./components/category-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SalesSummary } from "./components/sales-summary"
import { PaymentMethodsSummary } from "./components/payment-methods-summary"
import { Button } from "@/components/ui/button"
import { Download, FileText } from "lucide-react"
import Link from "next/link"
import { ReportViewDialog } from "./components/report-view-dialog"

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

// Función auxiliar para convertir Timestamp a Date
const convertToDate = (timestamp: Date | Timestamp): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  return timestamp
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { db } = useFirebase()
  const [loading, setLoading] = useState(true)
  // State for dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogData, setDialogData] = useState<Record<string, any>>({});
  const [dialogDescription, setDialogDescription] = useState<string | undefined>(undefined);

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
        
        const ordersRef = collection(db, 'orders')
        const ordersQuery = query(
          ordersRef,
          where('createdAt', '>=', thirtyDaysAgo),
          orderBy('createdAt', 'desc')
        )

        const ordersSnapshot = await getDocs(ordersQuery)

        const orders = ordersSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(0),
            paymentMethod: data.paymentMethod || 'Não especificado' // Assuming paymentMethod field and providing a default
          }
        }) as Order[]

        // Filter orders for today
        const ordersToday = orders.filter(order => {
          if (!order.createdAt) return false
          const orderDate = convertToDate(order.createdAt)
          return orderDate.getFullYear() === today.getFullYear() &&
                 orderDate.getMonth() === today.getMonth() &&
                 orderDate.getDate() === today.getDate()
        })

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
          const date = convertToDate(order.createdAt).toISOString().split('T')[0]
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

        // Calcular topPaymentMethods
        const paymentMethodMap = new Map<string, number>()
        orders.forEach(order => {
          // Ensure order.paymentMethod is a string and not undefined/null
          const method = typeof order.paymentMethod === 'string' && order.paymentMethod ? order.paymentMethod : 'Não especificado';
          paymentMethodMap.set(method, (paymentMethodMap.get(method) || 0) + 1)
        })

        const totalPayments = orders.length
        const topPaymentMethods = Array.from(paymentMethodMap.entries())
          .map(([method, count]) => ({
            method,
            count,
            percentage: totalPayments > 0 ? (count / totalPayments) * 100 : 0
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5) // Show top 5 payment methods

        // Generar recentActivities (ejemplo con los últimos 5 pedidos)
        const recentActivities = orders.slice(0, 5).map(order => {
          return {
            id: order.id,
            type: 'order' as 'order' | 'table' | 'payment',
            description: `Pedido ${order.tableNumber ? 'Nº ' + order.tableNumber : '#' + order.orderType === 'Balcão' ? 'Balcão' : 'Mesa ' + order.tableNumber } ${order.status || ''}`.trim(),
            time: convertToDate(order.createdAt),
            status: order.status,
            amount: order.total,
            // tableNumber: order.tableNumber, // Uncomment if you have tableNumber in Order
            paymentMethod: typeof order.paymentMethod === 'string' ? order.paymentMethod : 'Não especificado'
          }
        })

        // Calcular Horários de Pico (Peak Hours) para hoje
        const salesByHour = new Array(24).fill(0).map((_, i) => ({ hour: i, sales: 0 }));
        ordersToday.forEach(order => {
          if (order.createdAt && order.total) {
            const hour = convertToDate(order.createdAt).getHours();
            salesByHour[hour].sales += order.total;
          }
        });
        // Filtrar horas com vendas e ordenar pelas que tiveram mais vendas, pegar top 3-5, ou como preferir
        const peakHours = salesByHour
          .filter(h => h.sales > 0)
          .sort((a, b) => b.sales - a.sales);

        // Calcular métricas del día
        const totalVendasHoje = ordersToday.reduce((sum, order) => sum + (order.total || 0), 0);
        const pedidosPendentes = ordersToday.filter(order => 
          order.status === "Pendente" || order.status === "Pronto para servir"
        ).length;

        const localCalculatedAvgTicket = ordersToday.length > 0 ? totalVendasHoje / ordersToday.length : 0;

        // Actualizar todas las métricas
        setMetrics(prev => {
          const updatedMetrics = {
            ...prev,
            totalVentas: totalVendasHoje,
            pedidosHoje: ordersToday.length,
            pedidosPendentes,
            topItems,
            salesHistory: salesHistory,
            categoryData,
            vendasSemanais: salesHistory.slice(-7),
            topPaymentMethods,
            recentActivities,
            averageTicket: localCalculatedAvgTicket, 
            peakHours
          };
          return updatedMetrics;
        });

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
                  const reportData = {
                    data: new Date().toLocaleDateString('pt-BR'),
                    totalVendas: metrics.totalVentas,
                    pedidosRealizados: metrics.pedidosHoje,
                    ticketMedio: metrics.averageTicket
                  };
                  setDialogTitle("Relatório de Vendas do Dia");
                  setDialogData(reportData);
                  setDialogDescription(`Dados detalhados para ${new Date().toLocaleDateString('pt-BR')}.`);
                  setDialogOpen(true);
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Ver Detalhes
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Vendas da Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="secondary" 
                className="w-full" 
                onClick={() => {
                  const weeklySalesTotal = metrics.vendasSemanais.reduce((sum, day) => sum + day.total, 0);
                  const reportData = {
                    periodo: "Últimos 7 dias",
                    totalVendas: weeklySalesTotal,
                    mediaDiaria: metrics.vendasSemanais.length > 0 ? weeklySalesTotal / metrics.vendasSemanais.length : 0,
                    // Poderíamos adicionar mais detalhes se necessário, como vendas por dia da semana
                    diasComVendas: metrics.vendasSemanais.length
                  };
                  setDialogTitle("Relatório de Vendas da Semana");
                  setDialogData(reportData);
                  setDialogDescription("Resumo das vendas dos últimos 7 dias.");
                  setDialogOpen(true);
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Ver Detalhes
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="secondary" 
                className="w-full" 
                onClick={() => {
                  const monthlySalesTotal = metrics.salesHistory.reduce((sum, day) => sum + day.total, 0);
                  // Assuming salesHistory is for the last 30 days
                  const reportData = {
                    periodo: "Últimos 30 dias",
                    totalVendas: monthlySalesTotal,
                    mediaDiaria: metrics.salesHistory.length > 0 ? monthlySalesTotal / metrics.salesHistory.length : 0,
                    diasComVendas: metrics.salesHistory.length
                  };
                  setDialogTitle("Relatório de Vendas do Mês");
                  setDialogData(reportData);
                  setDialogDescription("Resumo das vendas dos últimos 30 dias.");
                  setDialogOpen(true);
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Ver Detalhes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Render the Dialog */}
      <ReportViewDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        title={dialogTitle} 
        data={dialogData} 
        description={dialogDescription}
      />
    </div>
  )
}
function unsubscribe() {
  throw new Error("Function not implemented.")
}
