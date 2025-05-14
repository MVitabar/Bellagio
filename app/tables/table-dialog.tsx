"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { TableMap, RestaurantTable } from './table-maps-list'
import { useFirebase } from '@/components/firebase-provider'
import { useAuth } from '@/components/auth-provider'
import { doc, serverTimestamp, updateDoc, arrayUnion, getDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { RESTAURANT_ID } from '@/lib/firebase-config'
import { useTranslation } from 'react-i18next'

interface TableDialogProps {
  isOpen: boolean
  onClose: () => void
  
  tableMap: TableMap
}

export default function TableDialog({ 
  isOpen, 
  onClose, 
  tableMap 
}: TableDialogProps) {
  const { t } = useTranslation()
  const { db } = useFirebase()
  const { user } = useAuth()
  const [tableName, setTableName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Efecto para resetear el nombre cuando se abre el diálogo
  useEffect(() => {
    if (!isOpen) return
    setTableName('')
  }, [isOpen])

  // Efecto para generar el nombre cuando cambian las dependencias necesarias
  useEffect(() => {
    async function generateTableName() {
      if (!db || !user || !tableMap || !isOpen) return

      try {
        const tableMapRef = doc(db, 'tableMaps', tableMap.id)
        const tableMapSnapshot = await getDoc(tableMapRef)
        
        if (!tableMapSnapshot.exists()) {
          console.error('Table map not found')
          return
        }

        const tableMapData = tableMapSnapshot.data()
        const existingTables = tableMapData?.tables || []
        
        const tableCount = existingTables.length
        const newTableNumber = tableCount + 1
        setTableName(`${newTableNumber}`)
      } catch (error) {
        console.error('Error generating table name:', error)
      }
    }

    generateTableName()
  }, [db, user, tableMap, isOpen])

  const handleCreateTable = async () => {
    if (!db || !tableMap) return

    setIsLoading(true)
    try {
      // Crear nueva comanda
      const newTable: RestaurantTable = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: tableName,
        mapId: tableMap.id,
        status: 'available'
      }

      // Actualizar el array tables en el mapa
      const tableMapRef = doc(db, 'tableMaps', tableMap.id)
      await updateDoc(tableMapRef, {
        tables: arrayUnion(newTable),
        updatedAt: serverTimestamp()
      })

      toast.success('Comanda criada com sucesso')
      onClose()
    } catch (error) {
      console.error('Error creating table:', error)
      toast.error('Erro ao criar comanda')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Comanda</DialogTitle>
          <DialogDescription>
            Digite o número da comanda
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="number">Número da Comanda</Label>
            <Input
              id="number"
              type="number"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Digite o número"
              className="text-4xl h-16 text-center font-bold tracking-wider"
              min="1"
              step="1"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCreateTable} 
            disabled={isLoading || !tableName}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm mr-2"></span>
                Criando...
              </>
            ) : (
              'Criar Comanda'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}