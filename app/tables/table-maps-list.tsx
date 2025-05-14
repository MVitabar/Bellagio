"use client"

import { useState, useEffect } from 'react'
import { collection, getDocs, query, where, doc, onSnapshot, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore'
import { useFirebase } from '@/components/firebase-provider'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, Edit, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import TableDialog from './table-dialog'
import TableMapViewDialog from './table-map-view-dialog'
import TableMapDialog from './table-map-dialog'
import { clsx } from "@/lib/utils"
import { TableStatus } from '@/types/table'

// Define interfaces
export interface RestaurantTable {
  id: string
  name: string
  mapId: string
  capacity: number
  status: TableStatus
}

export interface TableMap {
  id: string
  name: string
  description?: string
  layout?: {
    tables: any[]
  }
  tables: RestaurantTable[]
  createdAt: Timestamp | Date
  updatedAt: Timestamp | Date
}

interface TableMapsListProps {
  onCreateMap?: () => void
}

export default function TableMapsList({ onCreateMap }: TableMapsListProps) {
  const { db } = useFirebase()
  const [tableMaps, setTableMaps] = useState<TableMap[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTableMap, setSelectedTableMap] = useState<TableMap | null>(null)
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false)
  const [isTableMapViewDialogOpen, setIsTableMapViewDialogOpen] = useState(false)
  const [tableToDelete, setTableToDelete] = useState<TableMap | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingMap, setEditingMap] = useState<TableMap | null>(null)

  useEffect(() => {
    if (!db) return

    const unsubscribeMaps = onSnapshot(
      collection(db, 'tableMaps'),
      (snapshot) => {
        const maps: TableMap[] = snapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.name,
            description: data.description,
            layout: data.layout,
            tables: data.tables || [],
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          }
        })
        setTableMaps(maps)
        setIsLoading(false)
      },
      (error) => {
        console.error('Error fetching maps:', error)
        toast.error('Erro ao carregar comandas')
        setIsLoading(false)
      }
    )

    return () => unsubscribeMaps()
  }, [db])

  const handleAddTables = (tableMap: TableMap) => {
    setSelectedTableMap(tableMap)
    setIsTableDialogOpen(true)
  }

  const handleViewMap = (tableMap: TableMap) => {
    setSelectedTableMap(tableMap)
    setIsTableMapViewDialogOpen(true)
  }

  const handleEditMap = (map: TableMap) => {
    setEditingMap(map)
    setIsEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setEditingMap(null)
    setIsEditModalOpen(false)
  }

  const handleDeleteTableMap = async () => {
    if (!db || !tableToDelete) return

    try {
      // Primero eliminamos todas las comandas asociadas al mapa
      const tablesRef = collection(db, 'tables')
      const q = query(tablesRef, where('mapId', '==', tableToDelete.id))
      const querySnapshot = await getDocs(q)
      
      const batch = writeBatch(db)
      
      // Agregar todas las comandas al batch para eliminar
      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })
      
      // Agregar el mapa al batch para eliminar
      const tableMapRef = doc(db, 'tableMaps', tableToDelete.id)
      batch.delete(tableMapRef)
      
      // Ejecutar el batch
      await batch.commit()

      toast.success('Mapa e comandas excluídos com sucesso')
      setTableToDelete(null)
    } catch (error) {
      console.error('Error deleting table map:', error)
      toast.error('Erro ao excluir mapa')
    }
  }

  if (isLoading) {
    return <div className="p-6">Carregando...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Comandas</h1>
        {onCreateMap && (
          <Button 
            variant="outline" 
            onClick={onCreateMap}
          >
            <Plus className="mr-2 h-4 w-4" /> Nova Comanda
          </Button>
        )}
      </div>

      {tableMaps.length === 0 ? (
        <div className="text-center text-muted-foreground">
          Nenhuma comanda encontrada
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tableMaps.map((map) => (
            <Card key={map.id}>
              <CardHeader>
                <CardTitle>{map.name}</CardTitle>
                <CardDescription>
                  {map.description || 'Sem descrição'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Comandas ({map.tables?.length || 0})</h4>
                  {map.tables && map.tables.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {map.tables.map((table) => (
                        <div 
                          key={table.id}
                          className={clsx(
                            "flex items-center justify-center p-2 rounded-md text-sm font-medium",
                            {
                              "bg-green-100 text-green-700": table.status === "available",
                              "bg-red-100 text-red-700": table.status === "occupied",
                              "bg-yellow-100 text-yellow-700": table.status === "ordering",
                              "bg-gray-100 text-gray-700": table.status === "maintenance"
                            }
                          )}
                        >
                          {table.name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma comanda adicionada</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <ActionButtons
                  map={map}
                  onView={() => handleViewMap(map)}
                  onAddTables={() => handleAddTables(map)}
                  onEdit={() => handleEditMap(map)}
                  onDelete={() => setTableToDelete(map)}
                  onConfirmDelete={handleDeleteTableMap}
                  tableToDelete={tableToDelete}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogos */}
      {selectedTableMap && (
        <>
          <TableDialog 
            isOpen={isTableDialogOpen} 
            onClose={() => setIsTableDialogOpen(false)}
            tableMap={selectedTableMap}
          />
          <TableMapViewDialog 
            isOpen={isTableMapViewDialogOpen} 
            onClose={() => setIsTableMapViewDialogOpen(false)}
            tableMap={selectedTableMap}
          />
        </>
      )}

      {isEditModalOpen && editingMap && (
        <TableMapDialog 
          isOpen={isEditModalOpen} 
          onClose={handleCloseEditModal} 
          initialData={editingMap} 
        />
      )}

      {/* Diálogo de confirmación para eliminar */}
      <AlertDialog open={!!tableToDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir Mapa
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Tem certeza que deseja excluir o mapa "{tableToDelete?.name}"?</p>
                <p>• Todas as comandas associadas serão excluídas</p>
                <p>• O histórico de pedidos será mantido no sistema</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTableToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTableMap}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// First, define the interface for ActionButtons props
interface ActionButtonsProps {
  map: TableMap;
  onView: (map: TableMap) => void;
  onAddTables: (map: TableMap) => void;
  onEdit: (map: TableMap) => void;
  onDelete: (map: TableMap) => void;
  onConfirmDelete: () => void;  
  tableToDelete: TableMap | null;
}

// Update the ActionButtons component
function ActionButtons({ 
  map, 
  onView, 
  onAddTables, 
  onEdit, 
  onDelete,
  onConfirmDelete,  
  tableToDelete 
}: ActionButtonsProps) {
  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => onView(map)}
      >
        <Eye className="mr-2 h-4 w-4" /> Ver Comanda
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => onAddTables(map)}
      >
        <Plus className="mr-2 h-4 w-4" /> Adicionar Comanda
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => onEdit(map)}
      >
        <Edit className="h-4 w-4" /> Editar
      </Button>
      <Button 
        variant="destructive" 
        size="sm"
        onClick={() => onDelete(map)}
      >
        <Trash2 className="h-4 w-4" /> Excluir
      </Button>
    </>
  )
}