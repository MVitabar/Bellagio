"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useFirebase } from "@/components/firebase-provider"
import { useNotifications } from "@/hooks/useNotifications"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { Loader2 } from "lucide-react"
import { NotificationPreferences, BooleanNotificationPreferenceKey } from "@/types/notification-preferences"

export function NotificationSettings() {
  const { user } = useAuth()
  const { db } = useFirebase()
  const { sendNotification } = useNotifications()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    newOrders: true,
    orderStatusUpdates: true,
    lowInventoryAlerts: true,
    systemUpdates: true,
    dailyReports: false,
    customerFeedback: true,
    tableReservations: true,
    staffMessages: true,
    soundAlerts: true,
    emailNotifications: true,
    pushNotifications: true,
  })

  useEffect(() => {
    if (user && db) {
      setLoading(true)
      const fetchNotificationPreferences = async () => {
        try {
          const prefsDoc = await getDoc(doc(db, "users", user.uid, "settings", "notifications"))
          if (prefsDoc.exists()) {
            setPreferences(prefsDoc.data() as NotificationPreferences)
          }
        } finally {
          setLoading(false)
        }
      }

      fetchNotificationPreferences()
    }
  }, [user, db])

  const handleToggle = (key: BooleanNotificationPreferenceKey) => {
    setPreferences((prev: NotificationPreferences) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSave = async () => {
    if (!user || !db) return

    setSaving(true)

    try {
      await setDoc(doc(db, "users", user.uid, "settings", "notifications"), {
        ...preferences,
        updatedAt: new Date()
      })

      toast.success("Preferências de Notificação Salvas", {
        description: "Suas configurações de notificação foram atualizadas.",
      })

      await sendNotification({
        title: "Notificações Atualizadas",
        message: "Suas preferências de notificação foram salvas com sucesso.",
        url: window.location.href,
      });
    } catch (error) {
      toast.error("Erro ao Salvar Notificações", {
        description: "Não foi possível salvar suas preferências de notificação.",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Notificações</h2>
        <p className="text-muted-foreground">Gerencie como você recebe notificações.</p>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-4">Tipos de Notificação</h3>
          <div className="space-y-4">
            {([
              "newOrders",
              "orderStatusUpdates",
              "lowInventoryAlerts",
              "systemUpdates",
              "dailyReports",
              "customerFeedback",
              "tableReservations",
              "staffMessages",
              "soundAlerts"
            ] as Array<BooleanNotificationPreferenceKey>).map((key) => (
              <div key={String(key)} className="flex items-center justify-between">
                <div>
                  <Label htmlFor={String(key)} className="font-medium">
                    {key === 'newOrders' ? 'Novos Pedidos' :
                     key === 'orderStatusUpdates' ? 'Atualizações de Pedidos' :
                     key === 'lowInventoryAlerts' ? 'Alertas de Estoque' :
                     key === 'systemUpdates' ? 'Atualizações do Sistema' :
                     key === 'dailyReports' ? 'Relatórios Diários' :
                     key === 'customerFeedback' ? 'Feedback de Clientes' :
                     key === 'tableReservations' ? 'Reservas de Mesa' :
                     key === 'staffMessages' ? 'Mensagens da Equipe' :
                     key === 'soundAlerts' ? 'Alertas Sonoros' : String(key)}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {key === 'newOrders' ? 'Receba notificações para cada novo pedido recebido.' :
                     key === 'orderStatusUpdates' ? 'Seja notificado sobre mudanças no status dos pedidos.' :
                     key === 'lowInventoryAlerts' ? 'Receba alertas quando os itens do estoque estiverem baixos.' :
                     key === 'systemUpdates' ? 'Receba atualizações importantes do sistema.' :
                     key === 'dailyReports' ? 'Receba relatórios diários de vendas e desempenho.' :
                     key === 'customerFeedback' ? 'Receba notificações de feedback dos clientes.' :
                     key === 'tableReservations' ? 'Seja notificado sobre novas reservas de mesa.' :
                     key === 'staffMessages' ? 'Receba mensagens importantes da equipe.' :
                     key === 'soundAlerts' ? 'Ative ou desative alertas sonoros.' : ''}
                  </p>
                </div>
                <Switch
                  id={String(key)}
                  checked={preferences[key]}
                  onCheckedChange={() => handleToggle(key)}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-lg font-medium mb-4">Métodos de Entrega</h3>
          <div className="space-y-4">
            {(["emailNotifications", "pushNotifications"] as Array<BooleanNotificationPreferenceKey>).map((key) => (
              <div key={String(key)} className="flex items-center justify-between">
                <div>
                  <Label htmlFor={String(key)} className="font-medium">
                    {key === 'emailNotifications' ? 'Notificações por Email' :
                      key === 'pushNotifications' ? 'Notificações Push' : String(key)}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {key === 'emailNotifications' ? 'Receba notificações importantes por email.' :
                      key === 'pushNotifications' ? 'Receba notificações push no seu dispositivo.' : ''}
                  </p>
                </div>
                <Switch
                  id={String(key)}
                  checked={preferences[key]}
                  onCheckedChange={() => handleToggle(key)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Preferências"
          )}
        </Button>
      </div>
    </div>
  )
}
