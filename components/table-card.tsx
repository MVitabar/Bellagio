"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Users,
  Square,
  Circle,
  RectangleVerticalIcon as Rectangle,
  Edit,
  Trash,
  ClipboardList,
  CheckCircle,
  Receipt,
  Settings,
  CreditCard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useFirebase } from "@/components/firebase-provider"
import { useAuth } from "@/components/auth-provider"
import { doc, getDoc, updateDoc, collection, query, where, getDocs, limit, serverTimestamp } from "firebase/firestore"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { OrderDetailsDialog } from './orders/order-details-dialog'
import { AddItemsDialog } from "@/components/orders/add-items-dialog";
import { TableItem, Order, PaymentInfo, PaymentMethod, UserRole } from '@/types'
import { DialogDescription } from "@radix-ui/react-dialog"
import { toast } from "sonner"
import { RESTAURANT_CONFIG } from "@/lib/config"

export interface TableCardProps {
  table: TableItem;
  hasActiveOrder?: boolean;
  orderStatus?: string;
  activeOrder?: Order | null;
  onViewOrder?: (() => void) | undefined;
  onEdit?: () => void;
  onDelete?: () => void;
  onCreateOrder?: () => void;
  onMarkAsServed?: () => void;
  onCloseOrder?: () => void;
  isEditing?: boolean;
}

export function TableCard({
  table,
  hasActiveOrder = false,
  orderStatus = "",
  activeOrder = null,
  onViewOrder,
  onEdit,
  onDelete,
  onCreateOrder,
  onMarkAsServed,
  onCloseOrder,
  isEditing = false,
}: TableCardProps) {
  const { db } = useFirebase()
  const { user } = useAuth()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);

  // Determine restaurant ID
  const restaurantId = RESTAURANT_CONFIG.id;

  // Helper function for Portuguese status translations
  const getStatusTranslation = (status: string, defaultStatus: string = 'available'): string => {
    const effectiveStatus = status || defaultStatus;
    switch (effectiveStatus) {
      case 'available': return 'Disponível';
      case 'occupied': return 'Em Andamento';
      case 'ordering': return 'Pendente';
      case 'maintenance': return 'Cancelada';
      case 'reserved': return 'Reservada';
      default: return effectiveStatus;
    }
  };

  // Helper function for Portuguese payment method translations
  const getPaymentMethodTranslation = (method: PaymentMethod | null): string => {
    if (!method) return "";
    switch (method) {
      case 'cash': return 'Dinheiro';
      case 'credit': return 'Crédito';
      case 'debit': return 'Débito';
      case 'pix': return 'Pix';
      case 'other': return 'Outro';
      default: return method; // Fallback
    }
  };

  // Comprehensive order preparation with robust type handling
  const prepareOrderForDialog = (activeOrder: Order | null): Order => {
    // Create a base order object with required properties
    const createBaseOrder = (): Order => ({
      id: crypto.randomUUID(),
      status: 'Pendente', // Cambiado de 'pending' a 'Pendente'
      total: 0,
      items: [],
      tableNumber: table.number || 0,
      orderType: 'table',
      subtotal: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user?.uid || 'system',
      paymentInfo: {
        method: 'cash' as PaymentMethod,
        amount: 0,
        processedAt: new Date()
      },
      uid: "",
      discount: 0,
      paymentMethod: "",
      tableId: "",
      waiter: "",
      closedAt: null
    })

    // If no active order, return a base order
    if (!activeOrder) {
      return createBaseOrder()
    }

    // Prepare extended order properties with comprehensive fallbacks
    const extendedOrderProperties: Partial<Order> = {
      // Table-related properties with precise fallback
      tableNumber: 
        activeOrder.tableNumber !== undefined 
          ? activeOrder.tableNumber 
          : (table.number || 0),
      
      orderType: 
        activeOrder.orderType || 
        (table.status === 'occupied' ? 'table' : 'counter'),
      
      // Financial details with comprehensive fallback
      subtotal: 
        activeOrder.subtotal !== undefined 
          ? activeOrder.subtotal 
          : (activeOrder.total || 0),
      
      // Timestamp handling with current time as default
      createdAt: 
        activeOrder.createdAt || 
        new Date(),
      
      updatedAt: 
        activeOrder.updatedAt || 
        new Date(),
      
      // Payment information with safe defaults
      paymentInfo: 
        activeOrder.paymentInfo || ({
          method: 'cash' as PaymentMethod,
          amount: activeOrder.total || 0,
          processedAt: new Date()
        } as PaymentInfo),
      
      // Additional metadata with multiple fallback sources
      tableId: 
        activeOrder.tableId || 
        table.uid || 
        table.id || 
        '',
      
      waiter: 
        activeOrder.waiter || 
        user?.username || 
        '',
      
      // Optional additional details with safe defaults
      specialRequests: 
        activeOrder.specialRequests || 
        '',
      
      dietaryRestrictions: 
        activeOrder.dietaryRestrictions || 
        [],
      
      // Closure tracking
      closedAt: 
        activeOrder.closedAt || 
        null
    }

    // Merge original order with extended properties
    const preparedOrder: Order = {
      ...createBaseOrder(), // Start with a base order
      ...activeOrder, // Overlay original order properties
      ...extendedOrderProperties, // Add extended properties
      
      // Ensure critical properties are always present
      id: activeOrder.id || crypto.randomUUID(),
      items: activeOrder.items || [],
      total: activeOrder.total || 0,
      status: activeOrder.status || 'Pendente' // Cambiado de 'pending' a 'Pendente'
    }

    return preparedOrder
  }

  // Determine table and order status
  const getTableStatusColor = () => {
    switch (table.status) {
      case 'available': return 'bg-green-50 border-green-200 text-green-700'
      case 'occupied': return 'bg-red-50 border-red-200 text-red-700'
      case 'ordering': return 'bg-yellow-50 border-yellow-200 text-yellow-700'
      default: return 'bg-gray-50 border-gray-200 text-gray-700'
    }
  }

  // Payment method types
  const paymentMethods: PaymentMethod[] = [
    'cash', 
    'credit', 
    'debit', 
    'pix', 
    'other'
  ]

  const handleTableOrderSync = async (order?: Order | null) => {
    try {
      if (!db) return

      const mapId = table.mapId; // Ensure mapId is available
      if (!mapId) {
        toast.error('Erro: ID do mapa da mesa não encontrado.');
        return;
      }
      // Updated Firestore path for tableMaps
      const tableMapRef = doc(db, 'tableMaps', mapId); 

      const tableMapSnapshot = await getDoc(tableMapRef)

      if (!tableMapSnapshot.exists()) {
        return
      }

      const tableMapData = tableMapSnapshot.data()
      const tablesInMap = tableMapData?.layout?.tables || []

      // Status mapping logic
      const tableStatusMap: Record<string, string> = {
        'Pendente': 'occupied',
        'Pronto para servir': 'occupied',
        'Servido': 'occupied',
        'Fechado': 'billing',
        'Pago': 'available',
        'Cancelado': 'available'
      }

      // Determine new table status
      const newTableStatus = order 
        ? (tableStatusMap[order.status] || 'available')
        : 'available'

      // Update the table in the table map's layout
      const updatedTables = tablesInMap.map((t: TableItem) => 
        t.id === table.uid 
          ? { 
              ...t, 
              status: newTableStatus,
              activeOrderId: order && order.status !== 'Fechado' ? order.id : null 
            }
          : t
      )

      // Update the entire table map document
      await updateDoc(tableMapRef, {
        'layout.tables': updatedTables,
        updatedAt: new Date()
      })

      // Optional toast notification
      toast(`Table ${table.number} is now ${newTableStatus}`, {
        description: undefined,
      })
    } catch (error) {
      console.error('Table Sync Error:', error)
      toast("Erro ao sincronizar a mesa.", {
        description: undefined,
      })
    }
  }

  const confirmCloseOrder = async () => {
    if (!selectedPaymentMethod) {
      toast("Por favor, selecione um método de pagamento.", {
        description: undefined,
      })
      return
    }

    try {
      if (!db || !user || !activeOrder) return

      const restaurantId = RESTAURANT_CONFIG.id;
      if (!restaurantId || !activeOrder?.id) {
        console.log('DEBUG restaurantId:', restaurantId);
        console.log('DEBUG activeOrder.id:', activeOrder?.id);
        console.log('DEBUG user:', user);
        console.log('DEBUG table:', table);
        console.log('DEBUG activeOrder:', activeOrder);
        throw new Error('Missing restaurantId or orderId');
      }
      const orderRef = doc(db, 'orders', activeOrder.id);
      await updateDoc(orderRef, {
        status: 'Pago', // Cambiado de 'closed' a 'Pago'
        'paymentInfo.method': selectedPaymentMethod,
        closedAt: serverTimestamp()
      })

      // Referencia robusta ao mapa de mesas usando apenas mapId
      const mapId = table.mapId; // Ensure mapId is available
      if (!mapId) {
        toast.error('Erro: ID do mapa da mesa não encontrado.');
        return;
      }
      // Updated Firestore path for tableMaps
      const tableMapRef = doc(db, 'tableMaps', mapId); 

      const tableMapSnapshot = await getDoc(tableMapRef)

      if (!tableMapSnapshot.exists()) {
        return
      }

      const tableMapData = tableMapSnapshot.data()
      const tablesInMap = tableMapData?.layout?.tables || []

      // Update the table in the table map's layout
      const updatedTables = tablesInMap.map((t: TableItem) => 
        t.id === table.uid 
          ? { 
              ...t, 
              status: 'available',
              activeOrderId: null 
            }
          : t
      )

      // Update the entire table map document
      await updateDoc(tableMapRef, {
        'layout.tables': updatedTables,
        updatedAt: new Date()
      })

      toast("Pedido fechado com sucesso", {
        description: `Método de Pagamento: ${getPaymentMethodTranslation(selectedPaymentMethod)}`,
      })

      // Reset states
      setIsPaymentDialogOpen(false)
      setSelectedPaymentMethod(null)
    } catch (error) {
      console.error('Error closing order:', error)
      toast("Falha ao fechar o pedido", {
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado",
      })
    }
  }

  const handleCloseTableAndOrder = () => {
    setIsPaymentDialogOpen(true)
  }

  return (
    <>
      <Card 
        className={cn(
          "transition-all hover:shadow-md",
          getTableStatusColor()
        )}
        onClick={() => {}}
      >
        <CardHeader className="pb-2">
          <CardTitle>
            <span>
              Comanda {table.number}
            </span>
            <Badge variant="outline" className={cn("font-normal", getTableStatusColor())}>
              {getStatusTranslation(table.status, 'available')}
            </Badge>
          </CardTitle>
          <CardDescription>
            {hasActiveOrder 
              ? getStatusTranslation(table.status, 'occupied') // Default to occupied if has order but no status?
              : "Nenhum pedido ativo"
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeOrder 
                  ? `Pedido Ativo: ${activeOrder.status}` 
                  : 'Nenhum pedido ativo'}
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          {table.status === 'available' && !activeOrder && (
            <Button 
              variant="default" 
              className="w-full"
              onClick={() => {
                onCreateOrder && onCreateOrder()
              }}
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Criar Pedido
            </Button>
          )}

          {activeOrder && (
            <>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setIsOrderDetailsOpen(true)
                }}
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Ver Pedido
              </Button>
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={() => setShowAddItemsModal(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Adicionar Itens
              </Button>
              <Button 
                variant="default" 
                className="w-full" 
                onClick={handleCloseTableAndOrder}
              >
                <Receipt className="h-4 w-4 mr-2" />
                Fechar Pedido
              </Button>
            </>
          )}
        </CardFooter>
      </Card>

      {/* Order Details Dialog with comprehensive type handling */}
      {activeOrder && (
        <OrderDetailsDialog 
          order={prepareOrderForDialog(activeOrder)}
          open={isOrderDetailsOpen}
          onOpenChange={(open: boolean | ((prevState: boolean) => boolean)) => setIsOrderDetailsOpen(open)}
        />
      )}

      {/* Add Items Dialog */}
      {activeOrder && activeOrder.id && (
        <AddItemsDialog
          order={activeOrder}
          open={showAddItemsModal}
          onClose={() => setShowAddItemsModal(false)}
          onItemsAdded={() => {
            // Opcional: refresca o pedido ativo aqui se desejar
            // fetchActiveOrder && fetchActiveOrder();
          }}
        />
      )}

      {/* Payment Method Dialog */}
      {isPaymentDialogOpen && (
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Selecionar Método de Pagamento</DialogTitle>
              <DialogDescription>
                Escolha como o cliente pagou.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {paymentMethods.map((method) => (
                <Button
                  key={method}
                  variant={selectedPaymentMethod === method ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setSelectedPaymentMethod(method)}
                >
                  {getPaymentMethodTranslation(method)}
                </Button>
              ))}
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsPaymentDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                disabled={!selectedPaymentMethod}
                onClick={confirmCloseOrder}
              >
                Confirmar Pagamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
