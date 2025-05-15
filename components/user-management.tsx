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
  const [error, setError] = useState<string | null>(null) // Para manejar errores de carga

  // Solo accesible para admin
  if (!canView('users-management')) {
    return <UnauthorizedAccess />
  }

  const fetchUsers = async () => {
    if (!db) { // Verificar si db está disponible
      setError("A base de dados não está disponível.");
      setLoading(false);
      return;
    }
    setLoading(true)
    setError(null) // Limpiar errores previos
    try {
      const usersRef = collection(db, 'users')
      const usersSnapshot = await getDocs(usersRef)
      
      const usersList: User[] = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: data.uid || '', // Asegurar que todas las propiedades requeridas existan
          email: data.email || null,
          role: data.role || 'WAITER', // Un valor por defecto si no existe
          status: data.status || 'active',
          emailVerified: data.emailVerified || false,
          username: data.username,
          displayName: data.displayName,
          photoURL: data.photoURL,
          companyId: data.companyId,
          companyName: data.companyName,
          planId: data.planId,
          subscriptionStatus: data.subscriptionStatus,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          // Agrega aquí cualquier otra propiedad de 'User' que pueda venir del documento
        } as User; // Asegurar el tipo
      })
      setUsers(usersList)
    } catch (err) {
      console.error("Error fetching users:", err)
      setError("Error al cargar usuarios. Intente de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!db) { // Verificar si db está disponible
      toast.error("A base de dados não está disponível.");
      return;
    }
    if (!canDo || !canDo('users-management', 'deleteUser')) {
      toast.error("Você não tem permissão para eliminar usuários.");
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId))
      setUsers(users.filter(user => user.id !== userId))
      toast.success(t("users.deleted"));
      await sendNotification({
        title: t("users.deleted"),
        message: `O usuário com ID ${userId} foi eliminado`,
        url: window.location.href,
      });
    } catch (error) {
      console.error("Error deleting user:", error)
      toast.error("Erro ao eliminar o usuário.");
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Gestão de Usuarios</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Função</TableHead>
            <TableHead>Ações</TableHead>
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