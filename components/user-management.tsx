// components/user-management.tsx
import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { UnauthorizedAccess } from './unauthorized'
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc 
} from "firebase/firestore"
import { useFirebase } from '@/components/firebase-provider'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table'
import { User } from '@/types'
import { toast } from "sonner"
import { useNotifications } from "@/hooks/useNotifications"
import { useTranslation } from 'react-i18next';

export function UserManagement() {
  const { canView, canDo } = usePermissions() as { canView: (module: string | number) => boolean; canDo?: (module: string | number, action: string) => boolean }
  const { db } = useFirebase()
  const { sendNotification } = useNotifications();
  const { t } = useTranslation();
  
  // Especificar el tipo de estado como User[]
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  // Solo accesible para admin
  if (!canView('users-management')) {
    return <UnauthorizedAccess />
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const usersRef = collection(db, 'users')
      const usersSnapshot = await getDocs(usersRef)
      
      // Mapear los documentos con tipado correcto
      const usersList: User[] = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<User, 'id'>)
      }))
      
      setUsers(usersList)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!canDo || !canDo('users-management', 'deleteUser')) {
      toast.error("No tienes permisos para eliminar usuarios.");
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId))
      
      // Filtrar el usuario eliminado del estado
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId))
      toast.success(t("users.deleted"));
      await sendNotification({
        title: t("users.deleted"),
        message: `Se eliminó el usuario con ID ${userId}`,
        url: window.location.href,
      });
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error("Error al eliminar el usuario.");
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Gestión de Usuarios</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(user => (
            <TableRow key={user.id}>
              <TableCell>{user.username}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>
                {canDo && canDo('users-management', 'deleteUser') && (
                  <Button 
                    variant="destructive" 
                    onClick={() => handleDeleteUser(user.id ?? '')}
                  >
                    {t("commons.delete")}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}