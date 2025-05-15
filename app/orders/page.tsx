"use client"

import { useState, useEffect, useMemo } from "react"
import { useI18n } from "@/components/i18n-provider"
import { safeTranslate } from '@/components/i18n-provider';
import { useFirebase } from "@/components/firebase-provider"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, MoreHorizontal, Edit, Trash, X, Eye, PlusSquare, Repeat, CreditCard } from "lucide-react"
import Link from "next/link"
import { t, TFunction } from 'i18next';
import { BaseOrderStatus, FlexibleOrderStatus, Order, OrderItem, PaymentInfo, PaymentMethod } from "@/types/order"
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot 
} from "firebase/firestore";
import * as crypto from 'crypto';
import { useRouter } from "next/navigation";
import { OrderDetailsDialog } from "@/components/orders/order-details-dialog"
import { useNotifications } from "@/hooks/useNotifications";
import { AddItemsDialog } from "@/components/orders/add-items-dialog";
import { filterOrdersByRole } from '@/lib/orderFilters';
import { usePermissions } from '@/hooks/usePermissions';
import {
  splitOrderItemsByCategory,
  normalizeItemCategory,
  canViewBothSections,
  canViewOnlyFood,
  canViewOnlyDrinks,
} from '@/lib/orderFilters';
import { CloseOrderDialog } from "./components/close-order-dialog"
import { UserRole } from "@/types";
import { User } from "firebase/auth";

// Language codes
type LanguageCode = 'en' | 'es' | 'pt';

// Status Translation Type
type StatusTranslation = {
  [key in LanguageCode]: string;
};

// Comprehensive Status Translation Mapping
const STATUS_TRANSLATIONS: Record<BaseOrderStatus | 'null', StatusTranslation> = {
  'Pendente': {
    en: "Pending",
    es: "Pendiente",
    pt: "Pendente"
  },
  'Pronto para servir': {
    en: "Ready to serve",
    es: "Listo para servir",
    pt: "Pronto para servir"
  },
  'Entregue': {
    en: "Delivered",
    es: "Entregado",
    pt: "Entregue"
  },
  'Cancelado': {
    en: "Cancelled",
    es: "Cancelado",
    pt: "Cancelado"
  },
  'Pago': {
    en: "Paid",
    es: "Pagado",
    pt: "Pago"
  },
  'null': {
    en: "Unknown",
    es: "Desconocido",
    pt: "Desconhecido"
  }
};

// Translation Utility
const translateStatus = (
  status: FlexibleOrderStatus | undefined | null | string, 
  language: LanguageCode = 'en'
): string => {
  // Check if status is a valid OrderStatus
  const validStatus = status && Object.keys(STATUS_TRANSLATIONS).includes(status.toString())
    ? status.toString() as BaseOrderStatus
    : 'null';

  // Directly return the translation from STATUS_TRANSLATIONS
  return STATUS_TRANSLATIONS[validStatus][language];
};

// Badge variant types from shadcn/ui
type BadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary';

// Fix Badge variant type issue by creating a type-safe badge variant function
function getStatusBadgeVariant(status?: BaseOrderStatus | 'null'): BadgeVariant {
  switch (status) {
    case 'Pendente':
      return 'secondary'; // amarillo/naranja para pendiente
    case 'Pronto para servir':
      return 'default'; // azul para listo
    case 'Entregue':
      return 'outline'; // gris para entregado
    case 'Pago':
      return 'default'; // azul para pagado
    case 'Cancelado':
      return 'destructive'; // rojo para cancelado
    default:
      return 'secondary';
  }
}

// Helper function to get order type label
function getOrderTypeLabel(orderType?: string, t?: TFunction): string {
  if (!t) return orderType || 'Unknown';
  return orderType
    ? t(`orders.types.${orderType}`)
    : t('orders.types.unknown');
}

// Función para validar el método de pago
const validatePaymentMethod = (method: string): PaymentMethod => {
  const validMethods: PaymentMethod[] = ['cash', 'card', 'pix', 'credit', 'debit', 'other'];
  return validMethods.includes(method as PaymentMethod) 
    ? (method as PaymentMethod) 
    : 'other';
};

export default function OrdersPage() {
  const { t, i18n }: { t: TFunction, i18n: any } = useI18n()
  const { db } = useFirebase()
  const { user } = useAuth()
  const router = useRouter();
  const { sendNotification } = useNotifications();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isOrderDetailsDialogOpen, setIsOrderDetailsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [isAddItemsDialogOpen, setIsAddItemsDialogOpen] = useState(false)
  const [isCloseOrderOpen, setIsCloseOrderOpen] = useState(false)
  // Estados separados para filtro global y status dialog
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedStatus, setSelectedStatus] = useState<BaseOrderStatus>('Pendente');
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map());
  const [usersLoading, setUsersLoading] = useState(true);

  // Fetch users to map waiter IDs to names
  useEffect(() => {
    if (!db) {
      setUsersLoading(false);
      return;
    }
    setUsersLoading(true);
    const fetchUsers = async () => {
      try {
        const usersCollectionRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersCollectionRef);
        const newUsersMap = new Map<string, User>();
        querySnapshot.forEach((doc) => {
          const userData = doc.data() as User;
          newUsersMap.set(doc.id, { ...userData, uid: doc.id }); // Ensure uid is part of the User object in map
        });
        setUsersMap(newUsersMap);
      } catch (error) {
        console.error("Error fetching users: ", error);
        toast.error(t('orders.notifications.fetchUsersError'));
      } finally {
        setUsersLoading(false);
      }
    };
    fetchUsers();
  }, [db, t]);

  useEffect(() => {
    // Wait for user auth, db, and users to be loaded before fetching orders
    if (!db || !user || usersLoading) {
      // If users are still loading, and we don't have orders yet, show main loading
      if (usersLoading && orders.length === 0) {
        setLoading(true);
      } else if (!usersLoading && orders.length === 0 && !loading) {
        // If users finished loading, no orders yet, and not already loading orders, set loading to false
        // This handles the case where there are simply no orders to show initially.
        setLoading(false);
      }
      return;
    }
    
    // If users are loaded, and we are about to fetch orders, ensure main loading is true.
    setLoading(true);

    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        const resolvedWaiterName = data.waiterId 
          ? usersMap.get(data.waiterId)?.displayName || data.waiter || 'N/A'
          : data.waiter || 'N/A';

        const paymentInfo: PaymentInfo = {
          amount: Number(data.paymentInfo?.amount || data.total || 0),
          method: validatePaymentMethod(data.paymentInfo?.method || data.paymentMethod || 'other'),
          processedAt: new Date(data.paymentInfo?.processedAt?.toDate?.() || data.updatedAt?.toDate?.() || Date.now())
        };

        // Asegurar que los items tengan el tipo correcto
        const items: OrderItem[] = normalizeOrderItems(data.items);

        const order: Order = {
          id: String(doc.id),
          uid: String(data.uid || user?.uid || ''),
          items,
          subtotal: Number(data.subtotal || 0),
          total: Number(data.total || 0),
          discount: Number(data.discount || 0),
          createdAt: new Date(data.createdAt?.toDate?.() || Date.now()),
          updatedAt: new Date(data.updatedAt?.toDate?.() || Date.now()),
          closedAt: data.closedAt?.toDate?.() ? new Date(data.closedAt.toDate()) : null,
          status: String(data.status || 'Pendente') as BaseOrderStatus,
          orderType: (data.orderType || 'table') as 'table' | 'counter' | 'takeaway',
          tableId: String(data.tableId || ''),
          tableNumber: Number(data.tableNumber || 0),
          customerName: String(data.customerName || ''),
          specialRequests: String(data.specialRequests || ''),
          paymentMethod: String(data.paymentInfo?.method || data.paymentMethod || 'other') as PaymentMethod,
          paymentInfo,
          debugContext: data.debugContext || null,
          waiter: String(resolvedWaiterName)
        };

        return order;
      });

      setOrders(fetchedOrders);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders in real-time:", error);
      toast.error("Error en la suscripción de órdenes");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, user, t, usersMap, usersLoading]); // Added usersLoading to dependencies

  const handleUpdateStatus = async () => {
    if (!db || !user || !selectedOrder || !selectedOrder.id) return

    try {
      const STATUS_OPTIONS: BaseOrderStatus[] = [
        'Pendente', 'Pronto para servir', 'Entregue', 'Cancelado', 'Pago'
      ]; // Excluye 'null' para no mostrar opción inválida

      if (!selectedStatus || !STATUS_OPTIONS.includes(selectedStatus as BaseOrderStatus)) {
        toast.error(t("orders.error.selectStatus"));
        return;
      }
      const validStatus = selectedStatus as BaseOrderStatus;
      const orderRef = doc(db, 'orders', String(selectedOrder.id))
      await updateDoc(orderRef, { status: validStatus, updatedAt: new Date() })

      // Si la orden es de mesa y el status es "finished" o "closed", liberar la mesa
      const tableId = selectedOrder.tableId || selectedOrder.debugContext?.orderContext?.tableId;
      if (
        (validStatus === "Pago") &&
        tableId &&
        tableId
      ) {
        const tableMapRef = doc(db, 'tableMaps', tableId)
        const tableMapSnap = await getDoc(tableMapRef)
        if (tableMapSnap.exists()) {
          const tableMapData = tableMapSnap.data()
          const tables = (tableMapData.layout?.tables || []).map((t: any) =>
            t.id === tableId ? { ...t, status: "available", activeOrderId: null } : t
          )
          await updateDoc(tableMapRef, {
            "layout.tables": tables,
            updatedAt: new Date()
          })
        }
      }

      setOrders(orders => orders.map(order => order.id === selectedOrder.id ? { ...order, status: validStatus, updatedAt: new Date() } : order))
      setIsStatusDialogOpen(false)
      toast.success(
        t("orders.success.statusUpdated", {
          orderId: selectedOrder.id,
          status: translateStatus(validStatus, i18n?.language as LanguageCode)
        })
      )
      await sendNotification({
        title: t("orders.push.statusUpdatedTitle"),
        message: t("orders.push.statusUpdatedMessage", { orderId: selectedOrder.id, status: translateStatus(validStatus, i18n?.language as LanguageCode) }),
        url: window.location.href,
      });
    } catch (error) {
      console.error("Error updating order status:", error)
      toast.error(t("orders.error.updateStatusFailed"))
      setIsStatusDialogOpen(false)
    }
  }

  const handleDeleteOrder = async () => {
    if (!db || !user || !selectedOrder || !selectedOrder.id) return

    try {
      await deleteDoc(doc(db, 'orders', String(selectedOrder.id)))
      setOrders(orders => orders.filter(order => order.id !== selectedOrder.id))
      setIsDeleteDialogOpen(false)
      toast.success(t("orders.success.orderDeleted", { orderId: selectedOrder.id }))
      await sendNotification({
        title: t("orders.push.orderDeletedTitle"),
        message: t("orders.push.orderDeletedMessage", { orderId: selectedOrder.id }),
        url: window.location.href,
      });
    } catch (error) {
      toast.error(t("orders.error.deleteOrderFailed"))
      setIsDeleteDialogOpen(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!db || !user || !selectedOrder || !selectedOrder.id) return

    try {
      const orderRef = doc(db, 'orders', String(selectedOrder.id))
      await updateDoc(orderRef, { status: 'Cancelado', updatedAt: new Date() })
      setOrders(orders => orders.map(order => order.id === selectedOrder.id ? { ...order, status: 'Cancelado', updatedAt: new Date() } : order))
      setIsDeleteDialogOpen(false)
      toast.success(t("orders.success.orderCancelled", { orderId: selectedOrder.id }))
      await sendNotification({
        title: t("orders.push.orderCancelledTitle"),
        message: t("orders.push.orderCancelledMessage", { orderId: selectedOrder.id }),
        url: window.location.href,
      });
    } catch (error) {
      toast.error(t("orders.error.cancelOrderFailed"))
      setIsDeleteDialogOpen(false)
    }
  }

  const canCloseOrder = (userRole: string) => {
    return ['admin', 'owner', 'manager'].includes(userRole.toLowerCase())
  }

  const handleCloseOrder = (order: Order) => {
    if (!canCloseOrder(user?.role || '')) {
      toast.error("Você não tem permissão para fechar pedidos")
      return
    }
    setSelectedOrder(order)
    setIsCloseOrderOpen(true)
  }

  const handleOrderClosed = () => {
    // Actualizar la lista de pedidos (no es necesario hacerlo manualmente ya que usamos onSnapshot)
    setIsCloseOrderOpen(false)
    setSelectedOrder(null)
  }

 
  // Definir un tipo que incluya 'all' junto con BaseOrderStatus
  type FilterStatus = BaseOrderStatus | 'all';

  // Normalizar items a un array y normalizar categorías
  const normalizeOrderItems = (items: any): OrderItem[] => {
    // Si es null o undefined, retornar array vacío
    if (!items) {
      return [];
    }

    let itemsArray: any[] = [];

    // Si es un array, usarlo directamente
    if (Array.isArray(items)) {
      itemsArray = items;
    }
    // Si es un objeto/map, convertirlo a array
    else if (typeof items === 'object') {
      // Verificar si es un objeto con índices numéricos (como el segundo caso)
      const keys = Object.keys(items);
      const isNumericKeys = keys.every(key => !isNaN(Number(key)));
      
      if (isNumericKeys) {
        // Convertir objeto con keys numéricas a array manteniendo el orden
        itemsArray = keys
          .sort((a, b) => Number(a) - Number(b))
          .map(key => items[key]);
      } else {
        // Si no tiene keys numéricas, convertir los valores a array
        itemsArray = Object.values(items);
      }
    }

    // Normalizar cada item del array
    return itemsArray.map(item => ({
      id: item.id || crypto.randomUUID(),
      itemId: item.itemId || item.id || crypto.randomUUID(),
      name: item.name || 'Sin nombre',
      category: item.category || '',
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      stock: item.stock !== null ? Number(item.stock) : 0,
      unit: item.unit || 'Un',
      notes: item.notes || '',
      description: item.description || '',
      customDietaryRestrictions: Array.isArray(item.customDietaryRestrictions) ? item.customDietaryRestrictions : [],
      isVegetarian: Boolean(item.isVegetarian),
      isVegan: Boolean(item.isVegan),
      isGlutenFree: Boolean(item.isGlutenFree),
      isLactoseFree: Boolean(item.isLactoseFree),
      status: item.status || 'pending'
    }));
  };

  // Filtra las órdenes según los criterios actuales
  const filteredOrders = useMemo(() => {
    // Primero aplicar filtro por rol
    const roleFilteredOrders = user?.role
      ? filterOrdersByRole({ orders, role: user.role })
      : [];

    // Luego aplicar filtros de búsqueda y status
    return roleFilteredOrders.filter(order => {
      // Normalizar items para búsqueda
      const normalizedItems = normalizeOrderItems(order.items);

      // Verificar si coincide con el status seleccionado
      const statusMatch =
        statusFilter === 'all' ||
        order.status === statusFilter;

      // Verificar si coincide con la búsqueda
      const searchMatch =
        searchQuery === '' ||
        (order.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.tableNumber?.toString() || '').includes(searchQuery) ||
        (order.waiter || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.status || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        // Buscar en los nombres de los items
        normalizedItems.some(item =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

      // Retornar true si coincide con status Y con búsqueda
      return statusMatch && searchMatch;
    });
  }, [orders, statusFilter, searchQuery, user?.role]);

  // Helper para roles administrativos y mozo
  const isAdminOrWaiter = (
    user?.role === UserRole.WAITER ||
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.MANAGER ||
    user?.role === UserRole.OWNER
  );

  // Función para abrir el diálogo de status correctamente
  const openStatusDialog = (order: Order) => {
    setSelectedOrder(order);
    setSelectedStatus(order.status as BaseOrderStatus);
    setIsStatusDialogOpen(true);
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setIsOrderDetailsDialogOpen(true)
  }

  // Genera un id único para la descripción del diálogo de status
  const statusDescriptionId = selectedOrder ? `dialog-status-description-${selectedOrder.id}` : 'dialog-status-description';

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] overflow-hidden">
      <div className="flex justify-between items-center mb-4 px-4">
        <h1 className="text-3xl font-bold">{t("orders.title")}</h1>
        <Button asChild>
          <Link href="/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("orders.newOrder")}
          </Link>
        </Button>
      </div>

      <div className="flex items-center space-x-2 mb-4 px-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("orders.search.placeholder")}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterStatus)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("orders.filter.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("orders.filter.allStatuses")}</SelectItem>
            {Object.keys(STATUS_TRANSLATIONS).map((status) => (
              <SelectItem key={status} value={status}>
                {translateStatus(status, i18n?.language as LanguageCode)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-grow overflow-y-auto px-4">
        {loading ? (
          <div className="text-center py-4">{t("table.loading")}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t("table.emptyState.title")}</h3>
            <p className="text-muted-foreground">{t("table.emptyState.description")}</p>
          </div>
        ) : (
          <>
            {/* Vista de tarjetas para móviles y desktop: ocupar todo el ancho disponible */}
            <div className="grid gap-4 grid-cols-1 ">
              {filteredOrders.map((order) => {
                const normalizedItems = normalizeOrderItems(order.items);
                const { comidas, bebidas } = splitOrderItemsByCategory(normalizedItems);
                
                return (
                  <Card key={order.id} className="w-full">
                    <CardHeader className="flex flex-row items-center justify-end space-y-0 pb-2">
                      <Badge variant={getStatusBadgeVariant(order.status as BaseOrderStatus)}>
                        {translateStatus(order.status, i18n?.language as LanguageCode)}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Comanda</p>
                          <p>{order.tableNumber || getOrderTypeLabel(order.orderType, t)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t("orders.errors.headers.waiter")}</p>
                          <div>
                            <p className="text-base font-semibold">
                              {order.waiter || 'N/A'} 
                            </p>
                          </div>
                        </div>
                        <div className="col-span-2 space-y-2">
                          {(canViewBothSections(user?.role) || canViewOnlyFood(user?.role)) && comidas.length > 0 && (
                            <div className="space-y-1">
                              <h4 className="text-sm font-medium">Comidas</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {comidas.map((item) => (
                                  <span key={item.id} className="text-xs bg-muted rounded px-1.5 py-0.5">
                                    {item.name} x{item.quantity}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {(canViewBothSections(user?.role) || canViewOnlyDrinks(user?.role)) && bebidas.length > 0 && (
                            <div className="space-y-1">
                              <h4 className="text-sm font-medium">Bebidas</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {bebidas.map((item) => (
                                  <span key={item.id} className="text-xs bg-muted rounded px-1.5 py-0.5">
                                    {item.name} x{item.quantity}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t("commons.table.headers.price")}</p>
                          <p>R$ {order.total.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center justify-end">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleViewOrder(order)} title="Ver pedido">
                              <Eye className="h-5 w-5" />
                            </Button>
                            {canCreate('orders') && (
                              <Button variant="ghost" size="icon" onClick={() => {
                                setSelectedOrder(order);
                                setIsAddItemsDialogOpen(true);
                              }} title="Agregar ítems">
                                <PlusSquare className="h-5 w-5" />
                              </Button>
                            )}
                            {canUpdate('orders') && (
                              <Button variant="ghost" size="icon" onClick={() => openStatusDialog(order)} title="Cambiar status">
                                <Repeat className="h-5 w-5" />
                              </Button>
                            )}
                            {canDelete('orders') && (
                              <Button variant="ghost" size="icon" onClick={() => {
                                setSelectedOrder(order);
                                setIsDeleteDialogOpen(true);
                              }} title="Eliminar">
                                <Trash className="h-5 w-5" />
                              </Button>
                            )}
                            {canCloseOrder(user?.role || '') && order.status !== 'Pago' && (
                              <Button variant="ghost" size="icon" onClick={() => handleCloseOrder(order)} title="Cerrar pedido">
                                <CreditCard className="h-5 w-5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {isDeleteDialogOpen && selectedOrder && (
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialog.delete.title")}</DialogTitle>
              <DialogDescription>
                {t("dialog.delete.description")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                {t("dialog.delete.cancelButton")}
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteOrder}
              >
                {t("dialog.delete.confirmButton")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isStatusDialogOpen && selectedOrder && (
        <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
          <DialogContent aria-describedby={statusDescriptionId}>
            <DialogHeader>
              <DialogTitle>{t("orders.changeStatusTitle")}</DialogTitle>
              <DialogDescription id={statusDescriptionId}>{t("orders.changeStatusDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select
                value={selectedStatus}
                onValueChange={(value) => setSelectedStatus(value as BaseOrderStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("orders.selectStatus")} />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'Pendente', 'Pronto para servir', 'Entregue', 'Cancelado', 'Pago'
                  ].map(status => (
                    <SelectItem key={status} value={status}>
                      {translateStatus(status, i18n?.language as LanguageCode)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleUpdateStatus} className="w-full">
                {t("orders.changeStatusButton")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isAddItemsDialogOpen && selectedOrder && (
        <AddItemsDialog
          order={selectedOrder}
          open={isAddItemsDialogOpen}
          onClose={() => {
            setIsAddItemsDialogOpen(false);
            setSelectedOrder(null);
          }}
          onItemsAdded={() => {
            setIsAddItemsDialogOpen(false);
            // Opcional: recargar la orden o mostrar un toast
          }}
        />
      )}

      {isCloseOrderOpen && selectedOrder && (
        <CloseOrderDialog
          order={selectedOrder}
          open={isCloseOrderOpen}
          onClose={() => {
            setIsCloseOrderOpen(false);
            setSelectedOrder(null);
          }}
          onOrderClosed={handleOrderClosed}
        />
      )}

      {/* Order Details Dialog */}
      {selectedOrder && (
        <OrderDetailsDialog 
          order={selectedOrder}
          open={isOrderDetailsDialogOpen}
          onOpenChange={setIsOrderDetailsDialogOpen}
        />
      )}
    </div>
  )
}