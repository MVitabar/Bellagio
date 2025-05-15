"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'
import { TableMap } from '@/types/table'
import { useFirebase } from '@/components/firebase-provider'
import { useAuth } from '@/components/auth-provider'
import { doc, collection, updateDoc, setDoc, query, getDocs, serverTimestamp } from 'firebase/firestore'
import {toast} from 'sonner'
interface TableMapDialogProps {
  isOpen: boolean
  onClose: () => void
  initialData?: TableMap
}

export default function TableMapDialog({ 
  isOpen, 
  onClose, 
  initialData 
}: TableMapDialogProps) {
  const { t } = useTranslation()
  const { db } = useFirebase()
  const { user } = useAuth()
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [layout, setLayout] = useState(initialData?.layout || { tables: [] })

  useEffect(() => {
    // Reset form when initialData changes
    if (initialData) {
      setName(initialData.name)
      setDescription(initialData.description || '')
      setLayout(initialData.layout || { tables: [] })
    }
  }, [initialData])

  const handleSave = async () => {
    if (!db || !user) {
      toast.error(t('common.error'))
      return
    }

    try {
      const tableMapData = {
        name,
        description,
        layout,
        updatedAt: new Date(),
        createdAt: initialData?.createdAt || new Date()
      }

      if (initialData) {
        // Update existing table map
        await updateDoc(doc(db, 'tableMaps', initialData.id), tableMapData)
      } else {
        // Create new table map
        const tableMapRef = doc(collection(db, `tableMaps`));
        await setDoc(tableMapRef, {
          ...tableMapData,
          uid: user.uid,
          id: tableMapRef.id,
          createdAt: serverTimestamp()
        })
      }

      onClose()
    } catch (error) {
      console.error('Error saving table map:', error)
      toast.error(t('common.error'))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby="table-map-description">
        <DialogHeader>
          <DialogTitle>
            {initialData ? t('tables.tableMaps.editMap') : t('tables.tableMaps.createMap')}
          </DialogTitle>
          <DialogDescription id="table-map-description">
            {initialData ? t('tables.tableMaps.editMapDescription') : t('tables.tableMaps.createMapDescription')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              {t('tables.tableMaps.mapName')}
            </Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="col-span-3" 
              placeholder={t('tables.tableMaps.mapNamePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              {t('tables.tableMaps.mapDescription')}
            </Label>
            <Input 
              id="description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="col-span-3" 
              placeholder={t('tables.tableMaps.mapDescriptionPlaceholder')}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>
            {initialData ? t('common.update') : t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}