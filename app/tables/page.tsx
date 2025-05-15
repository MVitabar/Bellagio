"use client"

import { useState } from 'react'
import TableMapsList from './table-maps-list'
import TableMapDialog from './table-map-dialog'

export default function TableMapsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setRefreshKey(prevKey => prevKey + 1)
  }

  return (
    <div>
      <TableMapsList 
        key={refreshKey} 
        onCreateMap={() => setIsDialogOpen(true)} 
        onMapDeleted={handleDialogClose} 
      />
      <TableMapDialog 
        isOpen={isDialogOpen} 
        onClose={handleDialogClose} 
      />
    </div>
  )
}