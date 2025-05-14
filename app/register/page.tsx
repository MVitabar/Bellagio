"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import {toast} from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PasswordStrengthIndicator } from "@/components/password-strength-indicator"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useNotifications } from "@/hooks/useNotifications"
import { UserRole } from "@/types"

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { signUp } = useAuth()
  const router = useRouter()
  const { sendNotification } = useNotifications()

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // Username validation
    if (!formData.username) {
      newErrors.username = "O nome de usuário é obrigatório"
    } else if (formData.username.length < 3) {
      newErrors.username = "O nome de usuário deve ter pelo menos 3 caracteres"
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = "O email é obrigatório"
    } else if (!formData.email.includes('@')) {
      newErrors.email = "Formato de email inválido"
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "A senha é obrigatória"
    } else if (formData.password.length < 8) {
      newErrors.password = "A senha deve ter pelo menos 8 caracteres"
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "As senhas não coincidem"
    }

    // Terms acceptance
    if (!acceptTerms) {
      newErrors.terms = "Você deve aceitar os termos e condições"
    }

    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Validate form
    const validationErrors = validateForm()
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setLoading(false)
      return
    }

    try {
      const result = await signUp(
        formData.email, 
        formData.password, 
        {
          username: formData.username,
          role: UserRole.OWNER, 
        }
      )

      if (result.success) {
        // Notificación in-app con Sonner
        toast.success("Registro realizado com sucesso!")
        
        // Notificación push con OneSignal
        await sendNotification({
          title: "Novo Usuário Registrado", 
          message: `${formData.username} se registrou com sucesso.`,
        })
        
        router.push("/dashboard")
      } else {
        // Handle specific error cases
        setErrors({ 
          form: result.error || "Ocorreu um erro inesperado. Por favor, tente novamente."
        })
        
        toast.error(result.error || "Ocorreu um erro inesperado. Por favor, tente novamente.")
        if (result.error === "EMAIL_ALREADY_EXISTS") {
          setErrors((prev) => ({ ...prev, email: "Este email já está em uso." }))
        }
        if (result.error === "USERNAME_ALREADY_EXISTS") {
          setErrors((prev) => ({ ...prev, username: "Este nome de usuário já está em uso." }))
        }
      }
    } catch (error) {
      console.error("Registration error:", error)
      
      setErrors({ 
        form: "Ocorreu um erro inesperado. Por favor, tente novamente."
      })
      
      toast.error("Ocorreu um erro inesperado. Por favor, tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // Clear specific error when user types
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Criar uma conta</CardTitle>
          <CardDescription>Preencha o formulário abaixo para criar sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.form && (
              <div className="text-red-500 text-sm mb-4">
                {errors.form}
              </div>
            )}

            {/* Username Input */}
            <div className="space-y-2">
              <Label htmlFor="username">Nome de Usuário</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                placeholder="Seu nome de usuário"
                disabled={loading}
                className={errors.username ? "border-red-500" : ""}
              />
              {errors.username && (
                <p className="text-red-500 text-sm">{errors.username}</p>
              )}
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="seu@email.com"
                disabled={loading}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-red-500 text-sm">{errors.email}</p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Crie uma senha segura"
                  disabled={loading}
                  className={errors.password ? "border-red-500 pr-10" : "pr-10"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <PasswordStrengthIndicator password={formData.password} />
              {errors.password && (
                <p className="text-red-500 text-sm">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Digite sua senha novamente"
                  disabled={loading}
                  className={errors.confirmPassword ? "border-red-500 pr-10" : "pr-10"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => {
                  setAcceptTerms(checked as boolean);
                  if (errors.terms) {
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.terms;
                      return newErrors;
                    });
                  }
                }}
                disabled={loading}
              />
              <Label htmlFor="terms" className="text-sm">
                Eu aceito os
                <Link href="/terms" className="text-blue-600 hover:underline mx-1">
                  Termos e Condições
                </Link>.
              </Label>
            </div>
            {errors.terms && (
              <p className="text-red-500 text-sm">{errors.terms}</p>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando conta...</>
              ) : (
                "Criar Conta"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center">
          <p className="text-sm">
            Já tem uma conta?
            <Link href="/login" className="text-blue-600 hover:underline ml-1">
              Faça login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
