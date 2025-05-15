"use client"

import { useState, useEffect } from "react"
import { useFirebase } from "@/components/firebase-provider"
import { useAuth } from "@/components/auth-provider"
import { useNotifications } from "@/hooks/useNotifications"
import { collection, query, orderBy, getDocs, doc, deleteDoc } from "firebase/firestore"
import {toast} from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, UserPlus, Edit, Trash2, Copy } from "lucide-react"
import Link from "next/link"
import { User } from "@/types"
import { usePermissions } from "@/components/permissions-provider"
import { UnauthorizedAccess } from "@/components/unauthorized-access"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"

// Helper function to translate roles to Portuguese
const translateRolePt = (role: string | undefined): string => {
  const lowerRole = role?.toLowerCase() || 'default';
  switch (lowerRole) {
    case 'owner': return "Proprietário";
    case 'admin': return "Administrador";
    case 'manager': return "Gerente";
    case 'waiter': return "Garçom";
    case 'chef': return "Chef";
    case 'barman': return "Barman";
    default: return "Função Desconhecida";
  }
};

export default function UsersPage() {
  const { db } = useFirebase()
  const { user: currentUser } = useAuth()
  const { canView, canCreate, canUpdate, canDelete } = usePermissions()
  const { sendNotification } = useNotifications();

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [userToDelete, setUserToDelete] = useState<(User & { id: string }) | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      if (!db || !currentUser) {
        console.error('Cannot fetch users: missing db or user');
        setLoading(false);
        return;
      }

      try {
        // Usar uma coleção directa de usuários em vez de uma subcoleção
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("createdAt", "desc"));
        
        const querySnapshot = await getDocs(q);
        const fetchedUsers = querySnapshot.docs.map(doc => {
          const userData = doc.data() as User;
          return {
            ...userData,
            id: doc.id,
            uid: doc.id
          } as User;
        });

        // Filtrar usuários com base na busca
        const filteredUsers = searchQuery 
          ? fetchedUsers.filter(user => 
              (user.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              (user.email || '').toLowerCase().includes(searchQuery.toLowerCase())
            )
          : fetchedUsers;

        setUsers(filteredUsers);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching users:', error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        toast.error(`Erro ao buscar usuários: ${errorMessage}`);
        setLoading(false);
      }
    };

    fetchUsers();
  }, [db, currentUser, searchQuery]);

  const handleDeleteUser = async () => {
    if (!canDelete('users-management') || !userToDelete || !db) {
      toast.error("Você não tem permissão para excluir usuários.");
      return;
    }

    try {
      // Eliminar directamente da coleção de usuários
      await deleteDoc(doc(db, "users", userToDelete.id));
      
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userToDelete.id));
      
      toast.success(`Usuário ${userToDelete.username} excluído com sucesso.`);
      await sendNotification({
        title: "Usuário Excluído",
        message: `O usuário ${userToDelete.username} foi excluído.`,
        url: window.location.href,
      });
      
      setUserToDelete(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Erro ao excluir usuário: ${errorMessage}`);
    }
  };

  // Check if user has access to view users
  if (!canView('users-management')) {
    return <UnauthorizedAccess />
  }

  // Render loading state
  if (loading) {
    return <div>Carregando...</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
        {canCreate('users-management') && (
          <Button className="w-full sm:w-auto" asChild>
            <Link href="/users/add">
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar Usuário
            </Link>
          </Button>
        )}
      </div>

      {/* Search section */}
      <div className="flex items-center py-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Desktop view - Table */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome de Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {translateRolePt(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={"bg-green-100 text-green-800"}
                        >
                          Ativo
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigator.clipboard.writeText(user.id || user.uid)}
                            title="Copiar ID do Usuário"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          
                          {canUpdate('users-management') && (
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/users/edit/${user.id}`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          
                          {canDelete('users-management') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setUserToDelete({
                                ...user,
                                id: user.id || user.uid || ''
                              })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile view - Cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {users.length === 0 ? (
          <Card>
            <CardContent className="text-center py-6">
              Nenhum usuário encontrado.
            </CardContent>
          </Card>
        ) : (
          users.map((user) => (
            <Card key={user.id} className="overflow-hidden">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {user.username}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigator.clipboard.writeText(user.id || user.uid)}
                      title="Copiar ID do Usuário"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    
                    {canUpdate('users-management') && (
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/users/edit/${user.id}`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    
                    {canDelete('users-management') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setUserToDelete({
                          ...user,
                          id: user.id || user.uid || ''
                        })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2.5">
                <div className="text-sm text-muted-foreground">
                  {user.email}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {translateRolePt(user.role)}
                  </Badge>
                  <Badge className="bg-green-100 text-green-800">
                    Ativo
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Diálogo de confirmação de exclusão */}
      <Dialog 
        open={!!userToDelete} 
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              {`Tem certeza que deseja excluir o usuário ${userToDelete?.username}? Esta ação não pode ser desfeita.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUserToDelete(null)}
            >
              Cancelar
            </Button>
            <Button 
              type="button"
              variant="destructive" 
              onClick={handleDeleteUser}
            >
              Excluir Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
