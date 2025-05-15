import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TableMap } from '@/types/table'
import { TableItem } from '@/types/table'
import { useFirebase } from '@/components/firebase-provider'
import { collection, doc, getDoc, onSnapshot, updateDoc, addDoc, serverTimestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'
import { TableCard } from '@/components/table-card'
import { Order, OrderStatus } from '@/types/order'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { OrderForm } from '@/components/orders/order-form'
import { useTranslation } from 'react-i18next'

interface TableMapViewDialogProps {
  isOpen: boolean
  onClose: () => void
  tableMap: TableMap
}

export default function TableMapViewDialog({ isOpen, onClose, tableMap: initialTableMap }: TableMapViewDialogProps) {
  const { db } = useFirebase()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [currentTableMap, setCurrentTableMap] = useState<TableMap>(initialTableMap)
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null)
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!db || !isOpen) return

    const unsubscribe = onSnapshot(
      doc(db, 'tableMaps', initialTableMap.id),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          const tables = data.tables || []
          setCurrentTableMap({
            ...initialTableMap,
            tables: tables.map((table: any) => ({
              id: table.id,
              name: table.name,
              mapId: table.mapId,
              capacity: 4, // Default value
              status: table.status || 'available'
            }))
          })
          setIsLoading(false)
        }
      },
      (error) => {
        console.error('Error listening to table map:', error)
        toast.error(t('tables.tableMaps.fetchError'))
      }
    )

    return () => unsubscribe()
  }, [db, isOpen, initialTableMap.id, t])

  useEffect(() => {
    if (!db || !user || !isOpen) return;

    const ordersRef = collection(db, 'orders');
    const unsubscribe = onSnapshot(ordersRef, (snapshot: { docs: QueryDocumentSnapshot<DocumentData, DocumentData>[] }) => {
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(fetchedOrders);
    });

    return () => unsubscribe();
  }, [db, user, isOpen]);

  const handleTableClick = (table: TableItem) => {
    setSelectedTable(table)
    setIsOrderFormOpen(true)
  }

  const handleCreateOrder = async (order: Order) => {
    try {
      if (!db || !user) {
        throw new Error('No database or user context')
      }

      const ordersRef = collection(db, 'orders')

      const cleanedOrderData = {
        ...order,
        id: order.id || '',
      }

      const cleanedOrderDataForFirestore = {
        ...cleanedOrderData,
        uid: user?.uid || cleanedOrderData.uid || '',
        status: cleanedOrderData.status || 'Pendente',
        orderType: cleanedOrderData.orderType || 'dine-in',
        items: Array.isArray(cleanedOrderData.items) && cleanedOrderData.items.length > 0 
          ? cleanedOrderData.items 
          : [{ name: 'Error - No items', quantity: 0, price: 0, id: '', itemId: '' }],
        tableId: cleanedOrderData.tableId || selectedTable?.id || null,
        total: cleanedOrderData.total || 0,
        subtotal: cleanedOrderData.subtotal || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(ordersRef, cleanedOrderDataForFirestore);
      await updateDoc(docRef, { id: docRef.id });

      // Update table status
      if (selectedTable && selectedTable.id) {
        const tableMapRef = doc(db, 'tableMaps', initialTableMap.id)
        const tableMapDoc = await getDoc(tableMapRef)
        
        if (tableMapDoc.exists()) {
          const tables = tableMapDoc.data().tables || []
          const updatedTables = tables.map((t: any) => 
            t.id === selectedTable.id ? { ...t, status: 'occupied' } : t
          )
          
          await updateDoc(tableMapRef, { 
            tables: updatedTables,
            updatedAt: serverTimestamp()
          })
        }
      }

      toast.success('Pedido criado com sucesso', {
        description: `Pedido #${docRef.id} criado para a comanda ${selectedTable?.name}`
      })

      setIsOrderFormOpen(false)
      setSelectedTable(null)

      return docRef.id
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error('Erro ao criar pedido', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
      return null
    }
  }

  const handleMarkOrderAsServed = async (orderId: string) => {
    if (!db) {
      toast.error('Conexão com o banco de dados não estabelecida.');
      return;
    }
    try {
      const orderRef = doc(db, 'orders', orderId); 
      await updateDoc(orderRef, {
        status: 'Entregue' as OrderStatus, 
        updatedAt: serverTimestamp(),
      });
      setOrders(prevOrders => 
        prevOrders.map(o => o.id === orderId ? { ...o, status: 'Entregue' as OrderStatus } : o)
      );
      toast.success('Pedido marcado como entregue!');
    } catch (error) {
      console.error("Error marking order as served:", error);
      toast.error('Falha ao marcar pedido como entregue.');
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-6xl h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">{t('tables.tableMaps.loadingTitle')}</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Ver Mapa: {currentTableMap.name}</DialogTitle>
            <DialogDescription>
              {currentTableMap.description}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {currentTableMap.tables?.map((table) => {
              const activeOrderForTable = orders.find(order => 
                order.tableId === table.id &&
                order.status !== 'Pago' &&       
                order.status !== 'Entregue' &&   
                order.status !== 'Cancelado'  
              );

              return (
                <TableCard
                  key={table.id}
                  table={table}
                  onCreateOrder={() => handleTableClick(table)}
                  hasActiveOrder={!!activeOrderForTable} 
                  orderStatus={activeOrderForTable?.status} 
                  activeOrder={activeOrderForTable || null} 
                  onMarkAsServed={activeOrderForTable && activeOrderForTable.id ? () => handleMarkOrderAsServed(activeOrderForTable.id) : undefined}
                />
              );
            })}
          </div>

          {/* OrderForm is NO LONGER RENDERED INLINE HERE */}
        </DialogContent>
      </Dialog>

      {selectedTable && (
        <Dialog 
          open={isOrderFormOpen} 
          onOpenChange={(open) => {
            if (!open) {
              setIsOrderFormOpen(false);
              setSelectedTable(null);
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Pedido para Comanda: {selectedTable.name || String(selectedTable.number)}</DialogTitle>
            </DialogHeader>
            <OrderForm
              initialTableNumber={selectedTable.name || String(selectedTable.number)}
              table={selectedTable}
              onOrderCreated={async (order) => {
                const orderId = await handleCreateOrder(order);
                if (orderId) {
                  setIsOrderFormOpen(false);
                  setSelectedTable(null);
                }
              }}
              onCancel={() => {
                setIsOrderFormOpen(false);
                setSelectedTable(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
