"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Edit,
  ClipboardList,
  Receipt,
  Settings,
  Trash,
  CheckCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useFirebase } from "@/components/firebase-provider"
import { useAuth } from "@/components/auth-provider"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { OrderDetailsDialog } from './orders/order-details-dialog'
import { AddItemsDialog } from "@/components/orders/add-items-dialog";
import { OrderType as Order, PaymentInfo, PaymentMethod } from '@/types'
import { DialogDescription } from "@radix-ui/react-dialog"
import { toast } from "sonner"
import { RESTAURANT_CONFIG } from "@/lib/config"
import { TableItem } from "@/types/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"

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
      paymentMethod: "other",
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
              activeOrderId: order && order.status !== 'Entregue' ? order.id : null 
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

        <CardFooter className="flex flex-col items-stretch gap-2 p-3 border-t">
          {hasActiveOrder && activeOrder ? (
            // Buttons for when there IS an active order
            <>
              <Button onClick={() => setIsOrderDetailsOpen(true)} className="w-full text-xs h-8" variant="outline">
                <ClipboardList className="mr-1 h-3 w-3" /> Ver Pedido
              </Button>
              <Button onClick={() => setShowAddItemsModal(true)} className="w-full text-xs h-8 mt-1" variant="secondary">
                <Edit className="mr-1 h-3 w-3" /> Adicionar Itens
              </Button>

              {activeOrder.status === 'Pronto para servir' ? (
                <>
                  {onMarkAsServed && (
                    <Button onClick={onMarkAsServed} variant="default" className="w-full text-xs h-8 mt-1 bg-green-600 hover:bg-green-700">
                      <CheckCircle className="mr-1 h-3 w-3" /> Marcar Entregue
                    </Button>
                  )}
                </>
              ) : (
                // Show 'Fechar Pedido' for other active statuses (e.g., Pendente, Em Andamento)
                // but not for 'Pago', 'Entregue', 'Cancelado' (already filtered by activeOrder logic) 
                // or 'Pronto para servir' (handled above)
                <Button onClick={handleCloseTableAndOrder} variant="default" className="w-full text-xs h-8 mt-1">
                  <Receipt className="mr-1 h-3 w-3" /> Fechar Pedido
                </Button>
              )}
            </>
          ) : (
            // Buttons/Menu for when there is NO active order
            <>
              {onCreateOrder && (
                <Button onClick={onCreateOrder} className="w-full text-xs h-8">
                  <ClipboardList className="mr-1 h-3 w-3" /> Criar Pedido
                </Button>
              )}
              {/* Settings Dropdown for table Edit/Delete, only if props exist AND no active order */}
              {(onEdit || onDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-full h-8 mt-1 self-center">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && <DropdownMenuItem onClick={onEdit}><Edit className="mr-2 h-4 w-4" />Editar Comanda</DropdownMenuItem>}
                    {onDelete && <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-red-500 focus:text-red-500 focus:bg-red-100"><Trash className="mr-2 h-4 w-4" />Excluir Comanda</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </CardFooter>
      </Card>

      {/* MODALS / DIALOGS */} 

      {/* Order Details Dialog */}
      {activeOrder && (
        <OrderDetailsDialog 
          order={prepareOrderForDialog(activeOrder)}
          open={isOrderDetailsOpen} 
          onOpenChange={setIsOrderDetailsOpen} // Corrected prop for shadcn/ui Dialog
        />
      )}

      {/* Add Items Dialog */}
      {activeOrder && (
        <AddItemsDialog
          order={prepareOrderForDialog(activeOrder)} 
          open={showAddItemsModal} // Corrected prop
          onClose={() => setShowAddItemsModal(false)} // Standard way to close
          onItemsAdded={() => {
            // Optional: callback after items are added
            // e.g., re-fetch activeOrder or update UI as needed
            setShowAddItemsModal(false); // Close modal after adding items
          }}
        />
      )}

      {/* Delete Table Confirmation Dialog (for deleting the table itself, not an order) */}
      {isDeleteDialogOpen && (
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão da Comanda</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir a comanda "{table.name || `Comanda ${table.number}`}"? Esta ação não pode ser desfeita e removerá a comanda do mapa.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => {
                if (onDelete) {
                  onDelete(); // Call the onDelete prop passed from TableMapsList/TableMapViewDialog
                }
                setIsDeleteDialogOpen(false);
              }}>Excluir Comanda</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Payment Method Dialog (for closing an order) */}
      {isPaymentDialogOpen && activeOrder && (
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Selecionar Método de Pagamento</DialogTitle>
              <DialogDescription>
                Escolha como o cliente pagou o pedido para a comanda {table.name || `Comanda ${table.number}`}.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-2 py-4 sm:grid-cols-2">
              {paymentMethods.map((method) => (
                <Button
                  key={method}
                  variant={selectedPaymentMethod === method ? "default" : "outline"}
                  onClick={() => setSelectedPaymentMethod(method)}
                  className="w-full"
                >
                  {getPaymentMethodTranslation(method)}
                </Button>
              ))}
            </div>
            
            <DialogFooter className="mt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsPaymentDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                disabled={!selectedPaymentMethod}
                onClick={confirmCloseOrder} // This function handles order update and table status
              >
                Confirmar Pagamento e Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
