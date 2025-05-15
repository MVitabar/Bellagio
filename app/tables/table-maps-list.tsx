"use client"

import { useState, useEffect } from 'react'
import { 
  collection, 
  getDocs, 
  doc, 
  deleteDoc, 
  query, 
  where, 
  writeBatch, 
  addDoc,
  Timestamp 
} from 'firebase/firestore'
import { useFirebase } from '@/components/firebase-provider'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, Edit, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { TableItem, TableStatus, TableMap } from '@/types/table'
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
import TableMapDialog from './table-map-dialog'
import TableMapViewDialog from './table-map-view-dialog'
import TableDialog from './table-dialog'
import { clsx } from "@/lib/utils"
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

// Define interfaces
interface TableMapWithId extends TableMap {
  id: string;
}

interface TableMapsListProps {
  onCreateMap?: () => void;
  onMapDeleted?: () => void;
}

// Función auxiliar para convertir Timestamp a Date
const convertTimestampToDate = (timestamp: Timestamp | Date): Date => {
  if (!timestamp) return new Date();
  return timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
}

// Función para convertir nuestro TableMap local al tipo TableMap de @/types/table
const convertToTableMapType = (map: TableMapWithId): TableMap => {
  return {
    ...map,
    createdAt: convertTimestampToDate(map.createdAt),
    updatedAt: convertTimestampToDate(map.updatedAt),
    tables: map.tables.map(table => ({
      ...table,
      status: table.status || 'available'
    }))
  };
}

export default function TableMapsList({ onCreateMap, onMapDeleted }: TableMapsListProps) {
  const { db } = useFirebase()
  const { user } = useAuth()
  const [tableMaps, setTableMaps] = useState<TableMapWithId[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTableMap, setSelectedTableMap] = useState<TableMapWithId | null>(null)
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false)
  const [isTableMapViewDialogOpen, setIsTableMapViewDialogOpen] = useState(false)
  const [tableToDelete, setTableToDelete] = useState<TableMapWithId | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingMap, setEditingMap] = useState<TableMapWithId | null>(null)

  useEffect(() => {
    if (!db || !user) return;

    const fetchTableMaps = async () => {
      try {
        const q = query(collection(db, 'tableMaps'), where('uid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const maps = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            uid: data.uid || user.uid,
            name: data.name || '',
            description: data.description || '',
            layout: {
              tables: (data.layout?.tables || []).map((t: any) => ({
                ...t,
                status: t.status || 'available'
              }))
            },
            tables: (data.tables || []).map((t: any) => ({
              ...t,
              status: t.status || 'available'
            })),
            createdAt: data.createdAt || new Date(),
            updatedAt: data.updatedAt || new Date()
          };
        });
        setTableMaps(maps);
      } catch (error) {
        console.error('Error fetching table maps:', error);
        toast.error('Erro ao carregar mapas');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTableMaps();
  }, [db, user]);

  const handleAddTables = (tableMap: TableMapWithId) => {
    setSelectedTableMap(tableMap)
    setIsTableDialogOpen(true)
  }

  const handleViewMap = (tableMap: TableMapWithId) => {
    setSelectedTableMap(tableMap)
    setIsTableMapViewDialogOpen(true)
  }

  const handleEditMap = (map: TableMapWithId) => {
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
      onMapDeleted?.()
    } catch (error) {
      console.error('Error deleting table map:', error)
      toast.error('Erro ao excluir mapa')
    }
  }

  const handleCreateMap = async () => {
    if (!db || !user) return

    try {
      const newMap = {
        uid: user.uid,  
        name: `Mapa ${tableMaps.length + 1}`,
        description: '',
        layout: {
          tables: []
        },
        tables: [],  
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const docRef = await addDoc(collection(db, 'tableMaps'), newMap)
      toast.success('Mapa criado com sucesso')
    } catch (error) {
      console.error('Error creating table map:', error)
      toast.error('Erro ao criar mapa')
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
            <div key={map.id}>
              <CardHeader>
                <CardTitle>{map.name}</CardTitle>
                <CardDescription>
                  {map.description || 'Sem descrição'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Comandas</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {/* Aquí se deben mostrar las comandas asociadas al mapa */}
                  </div>
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
            </div>
          ))}
        </div>
      )}

      {/* Diálogos */}
      {/* Dialog for Viewing Map Details */}
      {selectedTableMap && isTableMapViewDialogOpen && (
        <TableMapViewDialog 
          isOpen={isTableMapViewDialogOpen} 
          onClose={() => setIsTableMapViewDialogOpen(false)}
          tableMap={convertToTableMapType(selectedTableMap)}
        />
      )}

      {/* Dialog for Adding/Editing Tables within a Map */}
      {isTableDialogOpen && selectedTableMap && ( 
        <TableDialog
          isOpen={isTableDialogOpen} 
          onClose={() => {
            setIsTableDialogOpen(false);
            // setSelectedTableMap(null); // Temporarily commented for debugging
          }}
          tableMap={convertToTableMapType(selectedTableMap)}
        />
      )}

      {/* Dialog for Editing Map Properties (Name, Description) */}
      {editingMap && (
        <TableMapDialog 
          isOpen={isEditModalOpen} 
          onClose={handleCloseEditModal} 
          initialData={convertToTableMapType(editingMap)}
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
  map: TableMapWithId;
  onView: (map: TableMapWithId) => void;
  onAddTables: (map: TableMapWithId) => void;
  onEdit: (map: TableMapWithId) => void;
  onDelete: (map: TableMapWithId) => void;
  onConfirmDelete: () => void;  
  tableToDelete: TableMapWithId | null;
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