"use client"

import { useState, useEffect, FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useFirebase } from '@/components/firebase-provider'
import { useAuth } from '@/components/auth-provider'
import { usePermissions } from '@/components/permissions-provider'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { User, UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { toast } from 'sonner'
import { UnauthorizedAccess } from '@/components/unauthorized-access'
import { ArrowLeft } from 'lucide-react'

// Helper function to translate roles to Portuguese (can be moved to a shared utils file)
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

const USER_ROLES = Object.values(UserRole);

export default function EditUserPage() {
  const { db } = useFirebase()
  const { user: currentUser } = useAuth()
  const { canUpdate } = usePermissions()
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string

  const [userData, setUserData] = useState<Partial<User> | null>(null)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('') // Email might be read-only depending on auth provider
  const [role, setRole] = useState<UserRole | ''>('')
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo') 
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!db || !userId) return

    const fetchUserData = async () => {
      try {
        setLoading(true)
        const userDocRef = doc(db, 'users', userId)
        const userDocSnap = await getDoc(userDocRef)

        if (userDocSnap.exists()) {
          const fetchedUser = userDocSnap.data() as User
          setUserData(fetchedUser)
          setUsername(fetchedUser.username || '')
          setEmail(fetchedUser.email || '') 
          setRole(fetchedUser.role || '')
          const statusFromDB = fetchedUser.status;
          setStatus(statusFromDB === 'inativo' ? 'inativo' : 'ativo');
        } else {
          toast.error('Usuário não encontrado.')
          router.push('/users')
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        toast.error('Erro ao buscar dados do usuário.')
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [db, userId, router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!db || !userId || !userData || !canUpdate('users-management')) {
      toast.error('Não é possível salvar. Permissões insuficientes ou dados faltando.');
      return;
    }

    setSaving(true)
    try {
      const userDocRef = doc(db, 'users', userId)
      const updatedData: Partial<User> = {
        username,
        // email, // Usually email is not updatable directly or handled by auth provider
        role: role || undefined,
        status,
        updatedAt: new Date(),
      }
      
      await updateDoc(userDocRef, updatedData)
      toast.success('Usuário atualizado com sucesso!')
      router.push('/users')
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Erro ao atualizar usuário.')
    } finally {
      setSaving(false)
    }
  }

  if (!canUpdate('users-management')) {
    return <UnauthorizedAccess />
  }

  if (loading) {
    return <div className="p-6">Carregando dados do usuário...</div>
  }

  if (!userData) {
    // This case should ideally be handled by the redirect in useEffect
    return <div className="p-6">Usuário não encontrado.</div>
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para Usuários
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Editar Usuário</CardTitle>
          <CardDescription>Modifique os detalhes do usuário abaixo.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="username">Nome de Usuário</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled className="bg-gray-100" />
              <p className="text-xs text-muted-foreground mt-1">O email geralmente não pode ser alterado diretamente.</p>
            </div>
            <div>
              <Label htmlFor="role">Função</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((roleValue) => (
                    <SelectItem key={roleValue} value={roleValue}>
                      {translateRolePt(roleValue)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as 'ativo' | 'inativo')} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={saving || loading}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
