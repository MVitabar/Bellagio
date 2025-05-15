"use client"

import { useState, useEffect } from "react"
import { useFirebase } from "@/components/firebase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateRange } from "react-day-picker"
import { ReportGenerators } from "@/components/report-generators"
import { ChevronLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore"
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  format,
  subDays,
  isBefore,
  isAfter
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { Order } from "@/types/order"
import { toast } from "sonner"

interface WaiterStats {
  waiter: string;
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  loginTime: Date | null;
  logoutTime: Date | null;
  topCategories: { category: string; sales: number }[];
}

interface PaymentMethodStats {
  method: string;
  count: number;
  percentage: number;
}

interface ReportData {
  dailySales: number;
  orderCount: number;
  averageTicket: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  categoryData: { name: string; value: number; percentage: number }[];
  paymentMethods: PaymentMethodStats[];
  waiterStats: WaiterStats[];
}

export default function ReportsPage() {
  const { db } = useFirebase()
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [periodFilter, setPeriodFilter] = useState("daily")
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportData>({
    dailySales: 0,
    orderCount: 0,
    averageTicket: 0,
    topItems: [],
    categoryData: [],
    paymentMethods: [],
    waiterStats: []
  })
  const [tabs, setTabs] = useState("summary")

  useEffect(() => {
    if (db) {
      if (periodFilter === "custom" && dateRange?.from && dateRange?.to) {
        fetchReportData(dateRange.from, dateRange.to);
      } else if (date) {
        const { start, end } = getDateRange(date, periodFilter);
        fetchReportData(start, end);
      }
    }
  }, [date, dateRange, periodFilter, db]);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
          const element = mutation.target as HTMLElement;
          if (element.getAttribute('data-state') === 'active') {
            setTabs(element.getAttribute('data-value') || 'summary');
          }
        }
      });
    });

    const tabsTriggers = document.querySelectorAll('[role="tab"]');
    tabsTriggers.forEach((trigger) => {
      observer.observe(trigger, { attributes: true });
    });

    return () => observer.disconnect();
  }, []);

  const getDateRange = (selectedDate: Date, period: string) => {
    switch (period) {
      case "daily":
        return {
          start: startOfDay(selectedDate),
          end: endOfDay(selectedDate)
        };
      case "weekly":
        return {
          start: startOfWeek(selectedDate, { locale: ptBR }),
          end: endOfWeek(selectedDate, { locale: ptBR })
        };
      case "monthly":
        return {
          start: startOfMonth(selectedDate),
          end: endOfMonth(selectedDate)
        };
      case "yearly":
        return {
          start: startOfYear(selectedDate),
          end: endOfYear(selectedDate)
        };
      default:
        return {
          start: startOfDay(selectedDate),
          end: endOfDay(selectedDate)
        };
    }
  };

  const fetchReportData = async (startDate: Date, endDate: Date) => {
    setLoading(true);
    try {
      if (!db) {
        toast.error("Database not found");
        return;
      }

      

      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef,
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      console.log(`Found ${querySnapshot.docs.length} orders`);

      const orders: Order[] = [];
      let totalSales = 0;
      const itemsMap = new Map<string, { quantity: number; revenue: number }>();
      const categoriesMap = new Map<string, number>();
      const paymentMethodsMap = new Map<string, number>();
      const waiterStatsMap = new Map<string, {
        totalSales: number;
        totalOrders: number;
        averageTicket: number;
        loginTime: Date | null;
        logoutTime: Date | null;
        topCategories: { category: string; sales: number }[];
      }>();

      querySnapshot.forEach((doc) => {
        const orderData = doc.data();
        const order: Order = {
          id: doc.id,
          total: Number(orderData.total) || 0,
          subtotal: Number(orderData.subtotal) || 0,
          discount: Number(orderData.discount) || 0,
          status: orderData.status || 'pending',
          orderType: orderData.orderType || 'table',
          items: Array.isArray(orderData.items) ? orderData.items : [],
          paymentMethod: orderData.paymentMethod || 'Não especificado',
          tableNumber: Number(orderData.tableNumber) || 0,
          tableId: orderData.tableId || '',
          waiter: orderData.waiter || '',
          uid: orderData.uid || '',
          createdAt: orderData.createdAt?.toDate() || new Date(),
          updatedAt: orderData.updatedAt?.toDate() || new Date(),
          closedAt: orderData.closedAt?.toDate() || null,
          paymentInfo: orderData.paymentInfo || { 
            amount: 0, 
            method: 'pending',
          }
        };
        
        // Solo procesar órdenes pagadas
        if (order.status !== 'Pago' && order.status !== 'Entregue') {
          return;
        }

        console.log('Processing paid order:', { 
          id: order.id, 
          total: order.total, 
          status: order.status,
          itemsLength: order.items.length,
          paymentMethod: order.paymentMethod
        });
        
        orders.push(order);
        totalSales += order.total;

        // Procesar items solo si es un array
        if (Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (!item || typeof item !== 'object') return;

            const name = item.name || 'Item sem nome';
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            const category = item.category || 'Sem categoria';

            // Solo procesar items con cantidad y precio válidos
            if (quantity > 0 && price > 0) {
              // Actualizar mapa de items
              const current = itemsMap.get(name) || { quantity: 0, revenue: 0 };
              itemsMap.set(name, {
                quantity: current.quantity + quantity,
                revenue: current.revenue + (price * quantity)
              });

              // Actualizar mapa de categorías
              categoriesMap.set(
                category,
                (categoriesMap.get(category) || 0) + (price * quantity)
              );
            }
          });
        }

        // Procesar métodos de pago
        if (order.paymentMethod) {
          paymentMethodsMap.set(
            order.paymentMethod,
            (paymentMethodsMap.get(order.paymentMethod) || 0) + 1
          );
        }

        // Procesar estadísticas de meseros
        if (order.waiter) {
          const waiterStats = waiterStatsMap.get(order.waiter) || {
            totalSales: 0,
            totalOrders: 0,
            averageTicket: 0,
            loginTime: null,
            logoutTime: null,
            topCategories: []
          };

          waiterStats.totalSales += order.total;
          waiterStats.totalOrders += 1;
          waiterStats.averageTicket = (waiterStats.totalSales / waiterStats.totalOrders) || 0;

          // Actualizar mapa de categorías por mesero
          order.items.forEach(item => {
            if (!item || typeof item !== 'object') return;

            const category = item.category || 'Sem categoria';
            const sales = Number(item.price) * Number(item.quantity);

            const existingCategory = waiterStats.topCategories.find(c => c.category === category);
            if (existingCategory) {
              existingCategory.sales += sales;
            } else {
              waiterStats.topCategories.push({ category, sales });
            }
          });

          waiterStatsMap.set(order.waiter, waiterStats);
        }
      });

      // Calcular datos para el reporte
      const orderCount = orders.length;
      const averageTicket = orderCount > 0 ? totalSales / orderCount : 0;

      console.log('Processed data:', {
        totalSales,
        orderCount,
        averageTicket,
        itemsCount: itemsMap.size,
        categoriesCount: categoriesMap.size,
        paymentMethodsCount: paymentMethodsMap.size
      });

      // Convertir el mapa de items a un array ordenado
      const topItems = Array.from(itemsMap.entries())
        .map(([name, stats]) => ({
          name,
          quantity: stats.quantity,
          revenue: stats.revenue
        }))
        .sort((a, b) => b.quantity - a.quantity) // Ordenar por cantidad vendida
        .slice(0, 10); // Tomar los 10 más vendidos

      // Convertir el mapa de categorías a un array con porcentajes
      const totalCategorySales = Array.from(categoriesMap.values()).reduce((a, b) => a + b, 0);
      const categoryData = Array.from(categoriesMap.entries())
        .map(([name, value]) => ({
          name,
          value,
          percentage: totalCategorySales > 0 ? (value / totalCategorySales) * 100 : 0
        }))
        .sort((a, b) => b.value - a.value);

      // Datos de métodos de pago
      const totalOrders = orders.length;
      const paymentMethods: PaymentMethodStats[] = Array.from(paymentMethodsMap.entries())
        .map(([method, count]) => ({
          method,
          count,
          percentage: (count / totalOrders) * 100
        }))
        .sort((a, b) => b.count - a.count);

      // Datos de meseros
      const waiterStats: WaiterStats[] = Array.from(waiterStatsMap.entries())
        .map(([waiter, stats]) => ({ waiter, ...stats }));

      setReportData({
        dailySales: totalSales,
        orderCount,
        averageTicket,
        topItems,
        categoryData,
        paymentMethods,
        waiterStats
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard">
          <Button variant="outline" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Relatórios</h1>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Selecione o período do relatório</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                  <SelectItem value="custom">Período Específico</SelectItem>
                </SelectContent>
              </Select>

              {periodFilter === "custom" ? (
                <div className="relative">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                    className="rounded-md border bg-white"
                    classNames={{
                      months: "flex flex-col space-y-4",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                      row: "flex w-full mt-2",
                      cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
                      day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
                      day_range_end: "day-range-end",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "text-muted-foreground opacity-50",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                      day_hidden: "invisible",
                    }}
                  />
                </div>
              ) : (
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={ptBR}
                  className="rounded-md border"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Relatório de Vendas</h3>
                <ReportGenerators 
                  reportData={{ 
                    ...reportData, 
                    startDate: periodFilter === "custom" ? dateRange?.from : getDateRange(date || new Date(), periodFilter).start,
                    endDate: periodFilter === "custom" ? dateRange?.to : getDateRange(date || new Date(), periodFilter).end
                  }} 
                />
              </div>

              <div className="block md:hidden">
                <Select 
                  value={tabs} 
                  onValueChange={setTabs}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a visualização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Resumo</SelectItem>
                    <SelectItem value="items">Itens</SelectItem>
                    <SelectItem value="analysis">Análise</SelectItem>
                    <SelectItem value="staff">Funcionários</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Tabs value={tabs} onValueChange={setTabs} className="w-full">
                <TabsList className="hidden md:grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="summary">Resumo</TabsTrigger>
                  <TabsTrigger value="items">Itens</TabsTrigger>
                  <TabsTrigger value="analysis">Análise</TabsTrigger>
                  <TabsTrigger value="staff">Funcionários</TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Vendas Totais</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          R$ {reportData.dailySales.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {reportData.orderCount} pedidos
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          R$ {reportData.averageTicket.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">por pedido</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Métodos de Pagamento</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {reportData.paymentMethods.map(method => (
                            <div key={method.method} className="flex justify-between text-sm">
                              <span>{method.method}</span>
                              <span>{method.count}x ({method.percentage.toFixed(1)}%)</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="items">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 10 Itens Mais Vendidos</CardTitle>
                      <CardDescription>
                        Items mais vendidos por quantidade
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {reportData.topItems.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-medium leading-none">
                                {item.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {item.quantity}x vendidos
                              </p>
                            </div>
                            <div className="text-sm font-medium">
                              R$ {item.revenue.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analysis">
                  <Card>
                    <CardHeader>
                      <CardTitle>Análise por Categoria</CardTitle>
                      <CardDescription>
                        Distribuição de vendas por categoria
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {reportData.categoryData.map(category => (
                          <div key={category.name} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{category.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {category.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-secondary">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{ width: `${category.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="staff">
                  <Card>
                    <CardHeader>
                      <CardTitle>Desempenho da Equipe</CardTitle>
                      <CardDescription>
                        Análise de vendas e atendimento por funcionário
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Resumen por mesero */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {reportData.waiterStats.map((stats: WaiterStats, index: number) => (
                            <Card key={stats.waiter}>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">{stats.waiter}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Vendas</span>
                                    <span className="font-medium">R$ {stats.totalSales.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Pedidos</span>
                                    <span className="font-medium">{stats.totalOrders}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Ticket Médio</span>
                                    <span className="font-medium">R$ {stats.averageTicket.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Horário</span>
                                    <span className="font-medium">
                                      {stats.loginTime ? format(stats.loginTime, 'HH:mm') : '-'} - {stats.logoutTime ? format(stats.logoutTime, 'HH:mm') : 'Ativo'}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {/* Gráfico de ventas por hora */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm font-medium">Vendas por Hora</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {/* Aquí podríamos agregar un gráfico de líneas mostrando las ventas por hora de cada mesero */}
                          </CardContent>
                        </Card>

                        {/* Top categorías por mesero */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm font-medium">Top Categorias por Funcionário</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {reportData.waiterStats.map((stats: WaiterStats, index: number) => (
                                <div key={stats.waiter} className="space-y-2">
                                  <h4 className="font-medium">{stats.waiter}</h4>
                                  <div className="space-y-1">
                                    {stats.topCategories.map((category: { category: string; sales: number }) => (
                                      <div key={category.category} className="flex justify-between">
                                        <span className="text-sm">{category.category}</span>
                                        <span className="text-sm font-medium">R$ {category.sales.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
