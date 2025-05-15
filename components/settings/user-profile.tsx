"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useFirebase } from "@/components/firebase-provider"
import {toast} from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { updateProfile, User as FirebaseUser } from "firebase/auth"
import { Loader2 } from "lucide-react"
import { UserRole } from "@/types/user"
import { usePermissions } from "@/components/permissions-provider"
import { UnauthorizedAccess } from "../unauthorized-access"
import type { User } from '@/types';
import { useNotifications } from "@/hooks/useNotifications"

export function UserProfile() {
  const { canView, canUpdate } = usePermissions();
  const { user } = useAuth() as { user: User | null }
  const { db, auth } = useFirebase()
  const { sendNotification } = useNotifications();

  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState({
    username: "",
    email: "",
    role: "",
    phoneNumber: "",
    position: "",
  })

  useEffect(() => {
    if (user && db) {
      setLoading(true)
      const fetchUserData = async () => {
        try {
          if (!user.uid) {
            return
          }

          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists()) {
            const data = userDoc.data()
            setUserData({
              username: user.displayName || data.username || "",
              email: user.email || data.email || "",
              role: data.role || "waiter",
              phoneNumber: data.phoneNumber || "",
              position: data.position || "",
            })
          }
        } catch (error) {
          console.error("Erro ao buscar dados do usuário:", error)
        } finally {
          setLoading(false)
        }
      }

      fetchUserData()
    }
  }, [user, db])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setUserData((prev) => ({ ...prev, [name]: value }))
  }

  const handleRoleChange = (value: string) => {
    setUserData((prev) => ({ ...prev, role: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !db || !auth) return

    setLoading(true)

    try {
      if (!user || !auth?.currentUser) { 
        toast.error("Usuário não autenticado.")
        setLoading(false)
        return
      }

      await updateDoc(doc(db, "users", user.uid), {
        username: userData.username,
        phoneNumber: userData.phoneNumber,
        position: userData.position,
        role: userData.role,
        updatedAt: new Date(),
      })

      await updateProfile(auth?.currentUser, { 
        displayName: userData.username,
      })

      toast.success("Perfil atualizado com sucesso!")
      await sendNotification({
        title: "Perfil Salvo",
        message: `Perfil de ${userData.username} foi salvo com sucesso.`,
        url: window.location.href,
      });
    } catch (error) {
      toast.error("Erro ao atualizar o perfil.")
    } finally {
      setLoading(false) 
    }
  }

  // Verificar se pode visualizar o perfil
  if (!canView('profile')) {
    return <UnauthorizedAccess />
  }

  // Verificar se pode alterar funções (apenas OWNER, ADMIN, MANAGER)
  const canChangeRoles = user?.role === UserRole.OWNER || 
                        user?.role === UserRole.ADMIN || 
                        user?.role === UserRole.MANAGER;

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Perfil do Usuário</h2>
        <p className="text-muted-foreground">Atualize as informações do seu perfil e preferências.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Nome de Usuário</Label>
            <Input
              id="username"
              name="username"
              value={userData.username}
              onChange={handleChange}
              disabled={loading || !canUpdate('profile')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" value={userData.email} disabled={true} className="bg-muted" />
            <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Número de Telefone</Label>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              value={userData.phoneNumber}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Cargo</Label>
            <Input
              id="position"
              name="position"
              value={userData.position}
              onChange={handleChange}
              disabled={loading}
              placeholder="Ex: Garçom, Gerente"
            />
          </div>

          {canChangeRoles && (
            <div className="space-y-2">
              <Label htmlFor="role">Função</Label>
              <Select value={userData.role} onValueChange={handleRoleChange} disabled={loading}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(UserRole).map((role) => (
                    <SelectItem key={role} value={role}>
                      {role === UserRole.OWNER ? "Proprietário" : 
                      role === UserRole.ADMIN ? "Administrador" : 
                      role === UserRole.MANAGER ? "Gerente" : 
                      role === UserRole.WAITER ? "Garçom" : 
                      role === UserRole.CHEF ? "Cozinha" : role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        <div className="flex justify-end">
          <Button type="submit" disabled={loading || !canUpdate('profile')}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
