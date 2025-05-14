"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { sendPasswordResetEmail } from "firebase/auth"
import { useFirebase } from "@/components/firebase-provider"
import {toast} from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowLeft } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const { auth } = useFirebase()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      toast.error("Por favor, insira seu endereço de email.")
      return
    }

    if (!auth) {
      toast.error("Erro de autenticação. Por favor, tente novamente.")
      return
    }

    setLoading(true)

    try {
      await sendPasswordResetEmail(auth, email)
      setEmailSent(true)
      toast.success("Instruções enviadas com sucesso!")
    } catch (error: any) {
      console.error("Password reset error:", error)

      if (error.code === "auth/user-not-found") {
        toast.error("Nenhuma conta encontrada com este email.")
      } else if (error.code === "auth/invalid-email") {
        toast.error("Formato de email inválido.")
      } else {
        toast.error("Ocorreu um erro ao enviar as instruções. Tente novamente.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push("/login")} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>Esqueceu a Senha?</CardTitle>
          </div>
          <CardDescription>
            {emailSent
              ? "Verifique seu email para obter as instruções de redefinição de senha."
              : "Digite seu email abaixo e enviaremos instruções para redefinir sua senha."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Instruções"
                )}
              </Button>
            </form>
          ) : (
            <div className="text-center py-4">
              <p className="mb-4">
                Instruções enviadas com sucesso! <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Se você não receber o email em alguns minutos, verifique sua pasta de spam.
              </p>
              <Button 
                className="mt-4" 
                variant="outline" 
                onClick={() => setEmailSent(false)}
              >
                Tentar com outro email
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Lembrou sua senha?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Voltar para o Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
