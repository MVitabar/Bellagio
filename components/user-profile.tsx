// components/user-profile.tsx
import React, { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { UnauthorizedAccess } from './unauthorized'
import { useAuth } from '@/components/auth-provider'
import { useFirebase } from '@/components/firebase-provider'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { doc, updateDoc } from 'firebase/firestore'
import { UserRole } from '@/types/permissions'
import { UserProfileData } from '@/types'
import { useTranslation } from 'react-i18next'

export function UserProfile() {
  const { canView, canDo } = usePermissions() as { canView: (module: string | number) => boolean; canDo?: (module: string | number, action: string) => boolean }
  const { user } = useAuth()
  const { db } = useFirebase()
  const { t } = useTranslation()

  // Verificar acceso a perfil
  if (!canView('profile')) {
    return <UnauthorizedAccess />
  }

  const [userData, setUserData] = useState<UserProfileData>({
    username: '',
    email: '',
    role: UserRole.WAITER,
    phoneNumber: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setUserData({
        username: user.displayName || '',
        email: user.email || '',
        // Convertir el rol a UserRole con validación
        role: Object.values(UserRole).includes(user.role as UserRole) 
          ? user.role as UserRole 
          : UserRole.WAITER,
        phoneNumber: user.phoneNumber || ''
      })
    }
  }, [user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setUserData(prev => ({ ...prev, [name]: value }))
  }

  const handleRoleChange = (value: UserRole) => {
    // Solo administradores pueden cambiar roles
    if (canDo && canDo('profile', 'changeRole')) {
      setUserData(prev => ({ ...prev, role: value }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !db) return

    setLoading(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        username: userData.username,
        phoneNumber: userData.phoneNumber,
        ...(canDo && canDo('profile', 'changeRole') ? { role: userData.role } : {})
      })
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Perfil de Usuario</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Nombre de Usuario</Label>
          <Input 
            name="username"
            value={userData.username}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        <div>
          <Label>Correo Electrónico</Label>
          <Input 
            value={userData.email}
            disabled
          />
        </div>
        <div>
          <Label>Número de Teléfono</Label>
          <Input 
            name="phoneNumber"
            value={userData.phoneNumber}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        {canDo && canDo('profile', 'changeRole') && (
          <div>
            <Label>Rol</Label>
            <Select 
              value={userData.role} 
              onValueChange={handleRoleChange}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("profile.selectRole")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.ADMIN}>Administrador</SelectItem>
                <SelectItem value={UserRole.MANAGER}>Gerente</SelectItem>
                <SelectItem value={UserRole.CHEF}>Chef</SelectItem>
                <SelectItem value={UserRole.WAITER}>Mesero</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? t("profile.saving") : t("profile.saveChanges")}
        </Button>
      </form>
    </div>
  )
}