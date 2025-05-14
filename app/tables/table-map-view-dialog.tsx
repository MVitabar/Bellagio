"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TableMap, RestaurantTable } from './table-maps-list'
import { useFirebase } from '@/components/firebase-provider'
import { collection, doc, DocumentData, getDoc, onSnapshot, QueryDocumentSnapshot, setDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { TableCard } from '@/components/table-card'
import { Order } from '@/types'
import { TableItem, TableStatus } from '@/types/table'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { OrderForm } from '@/components/orders/order-form'
import { useTranslation } from 'react-i18next'

interface TableMapViewDialogProps {
  isOpen: boolean
  onClose: () => void
  tableMap: TableMap
}

// Función auxiliar para convertir RestaurantTable a TableItem
const convertToTableItem = (table: RestaurantTable): TableItem => ({
  uid: table.id,
  id: table.id,
  number: parseInt(table.name.replace(/\D/g, ''), 10),
  seats: table.capacity,
  shape: 'square' as const,
  width: 100,
  height: 100,
  x: 0,
  y: 0,
  status: table.status,
  name: table.name,
  mapId: table.mapId
})

// Función auxiliar para convertir TableItem a RestaurantTable
const convertToRestaurantTable = (tableItem: TableItem): RestaurantTable => ({
  id: tableItem.id || tableItem.uid,
  name: tableItem.name || String(tableItem.number),
  mapId: tableItem.mapId,
  capacity: tableItem.seats,
  status: tableItem.status as RestaurantTable['status']
})

export default function TableMapViewDialog({ isOpen, onClose, tableMap: initialTableMap }: TableMapViewDialogProps) {
  const { db } = useFirebase()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [currentTableMap, setCurrentTableMap] = useState<TableMap>(initialTableMap)
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null)
  const [selectedTableItem, setSelectedTableItem] = useState<TableItem | null>(null)
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

  const handleTableClick = (table: RestaurantTable) => {
    setSelectedTable(table)
    setSelectedTableItem(convertToTableItem(table))
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
          const updatedTables = tables.map((t: RestaurantTable) => 
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
      setSelectedTableItem(null)

      return docRef.id
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error('Erro ao criar pedido', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      })
      return null
    }
  }

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
    <><Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Visualizar Comandas - {currentTableMap.name}</DialogTitle>
          <DialogDescription>
            {currentTableMap.description || 'Sem descrição'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:grid md:grid-cols-4 gap-4 p-4 overflow-y-auto h-[80vh] scrollbar-thin">
          {currentTableMap.tables?.map((table) => (
            <TableCard
              key={table.id}
              table={convertToTableItem(table)}
              onCreateOrder={() => handleTableClick(table)}
              hasActiveOrder={orders.some(order => order.tableId === table.id &&
                order.status !== 'Fechado' &&
                order.status !== 'Cancelado' &&
                order.status !== 'Pago'
              )}
              orderStatus={orders.find(order => order.tableId === table.id &&
                order.status !== 'Fechado' &&
                order.status !== 'Cancelado' &&
                order.status !== 'Pago'
              )?.status || ''} />
          ))}
          {currentTableMap.tables?.length === 0 && (
            <p className="col-span-4 text-center text-muted-foreground">
              Nenhuma comanda adicionada
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog><Dialog open={isOrderFormOpen} onOpenChange={(open) => {
      if (!open) {
        setIsOrderFormOpen(false)
        setSelectedTable(null)
        setSelectedTableItem(null)
      }
    } }>
        <DialogContent>
          {selectedTable && selectedTableItem && (
            <OrderForm
              initialTableNumber={selectedTable.name}
              table={{
                ...selectedTable,
                status: selectedTable.status as 'available' | 'occupied' | 'reserved'
              }}
              onOrderCreated={(order) => {
                handleCreateOrder(order)
                setIsOrderFormOpen(false)
                setSelectedTable(null)
                setSelectedTableItem(null)
              } } />
          )}
        </DialogContent>
      </Dialog></>
  )
}
