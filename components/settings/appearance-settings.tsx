"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useFirebase } from "@/components/firebase-provider"
import { useTheme, Theme } from "@/components/theme-provider"
import { useNotifications } from "@/hooks/useNotifications"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { Loader2, Moon, Sun, Monitor } from "lucide-react"

export function AppearanceSettings() {
  const { user } = useAuth()
  const { db } = useFirebase()
  const { theme, setTheme } = useTheme()
  const { sendNotification } = useNotifications()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && db) {
      setLoading(true)
      const fetchAppearancePreference = async () => {
        try {
          const prefsDoc = await getDoc(doc(db, "users", user.uid, "settings", "appearance"))
          if (prefsDoc.exists() && prefsDoc.data().theme) {
            setTheme(prefsDoc.data().theme as Theme)
          }
        } catch (error) {
          setLoading(false)
          throw error
        } finally {
          setLoading(false)
        }
      }

      fetchAppearancePreference()
    }
  }, [user, db, setTheme])

  const handleThemeChange = (value: Theme) => {
    setTheme(value)
  }

  const handleSave = async () => {
    if (!user || !db) return

    setSaving(true)

    try {
      await setDoc(doc(db, "users", user.uid, "settings", "appearance"), {
        theme,
        updatedAt: new Date(),
      })

      toast.success("Preferências salvas!", {
        description: "Suas configurações de aparência foram atualizadas.",
      })

      await sendNotification({
        title: "Aparência Atualizada",
        message: `Seu tema foi alterado para ${theme}.`,
        url: window.location.href,
      })
    } catch (error) {
      toast.error("Erro ao salvar", {
        description: "Não foi possível salvar suas preferências de aparência.",
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
        <h2 className="text-2xl font-bold">Aparência</h2>
        <p className="text-muted-foreground">Personalize a aparência do aplicativo. Escolha entre os temas claro, escuro ou sistema.</p>
      </div>

      <RadioGroup value={theme} onValueChange={handleThemeChange} className="space-y-4">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="light" id="light" />
          <Label htmlFor="light" className="flex items-center gap-2 font-medium">
            <Sun className="h-4 w-4" />
            Claro
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="dark" id="dark" />
          <Label htmlFor="dark" className="flex items-center gap-2 font-medium">
            <Moon className="h-4 w-4" />
            Escuro
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="system" id="system" />
          <Label htmlFor="system" className="flex items-center gap-2 font-medium">
            <Monitor className="h-4 w-4" />
            Sistema
          </Label>
        </div>
      </RadioGroup>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Alterações"
          )}
        </Button>
      </div>
    </div>
  )
}
