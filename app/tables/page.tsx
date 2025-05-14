"use client"

import { useState } from 'react'
import TableMapsList from './table-maps-list'
import TableMapDialog from './table-map-dialog'

export default function TableMapsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <div>
      <TableMapsList onCreateMap={() => setIsDialogOpen(true)} />
      <TableMapDialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
      />
    </div>
  )
}