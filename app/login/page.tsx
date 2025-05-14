"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import {toast} from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { UserRole } from "@/types"
import "@/styles/globals.css"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { login, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !loading) {
      // Redirigir según el rol
      switch (user.role) {
        case UserRole.OWNER:
        case UserRole.ADMIN:
        case UserRole.MANAGER:
          router.replace("/dashboard")
          break
        case UserRole.WAITER:
        case UserRole.CHEF:
        case UserRole.BARMAN:
          router.replace("/orders")
          break
        default:
          router.replace("/dashboard")
      }
    }
  }, [user, loading, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    // Validate form
    const newErrors: Record<string, string> = {}

    if (!email) {
      newErrors.email = "O email é obrigatório"
    } else if (!email.includes('@')) {
      newErrors.email = "Formato de email inválido"
    }

    if (!password) {
      newErrors.password = "A senha é obrigatória"
    }

    // If validation errors exist, stop and show errors
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setLoading(false)
      return
    }

    try {
      const result = await login(email, password)

      if (result.success) {
        toast.success("Login realizado com sucesso!")
        router.push("/dashboard")
      } else {
        // Handle specific error cases
        setErrors({ 
          form: result.error || "Ocorreu um erro inesperado. Por favor, tente novamente."
        })
      }
    } catch (error) {
      console.error("Login error:", error)
      setErrors({ 
        form: "Ocorreu um erro inesperado. Por favor, tente novamente."
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{"Entrar na sua conta"}</CardTitle>
          <CardDescription>{"Digite seu email e senha para acessar o sistema."}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {errors.form && (
              <div className="text-red-500 text-sm mb-4">
                {errors.form}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">{"Email"}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={"seu@email.com"}
                disabled={loading}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-red-500 text-sm">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{"Senha"}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={"Sua senha"}
                  disabled={loading}
                  className={errors.password ? "border-red-500" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm">{errors.password}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {"Entrando..."}</>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Link 
            href="/forgot-password" 
            className="text-sm text-blue-600 hover:underline"
          >
            {"Esqueceu a senha?"}
          </Link>
          <Link 
            href="/register" 
            className="text-sm text-blue-600 hover:underline"
          >
            {"Não tem uma conta? Registre-se"}
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
