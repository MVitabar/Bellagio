"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { User as FirebaseUser } from "firebase/auth"
import { useFirebase } from "@/components/firebase-provider"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { doc, getDoc } from "firebase/firestore"

export default function InvitationRegisterPage() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [invitationData, setInvitationData] = useState<any>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const authContext = useAuth()
  const { signUp } = authContext
  const currentUser = authContext.currentUser

  const { db, auth } = useFirebase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationId = searchParams.get('id')

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!db || !invitationId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const invitationRef = doc(db, 'invitations', invitationId)
        const invitationDoc = await getDoc(invitationRef)

        if (!invitationDoc.exists()) {
          toast.error("Convite inválido ou expirado.")
          router.push('/login')
          return
        }

        const data = invitationDoc.data()
        
        // Verificar si la invitación ha expirado
        if (data.expiresAt.toDate() < new Date()) {
          toast.error("Este convite expirou.")
          router.push('/login')
          return
        }

        setInvitationData(data)
        setFormData(prev => ({
          ...prev,
          username: data.username || '',
          email: data.email || ''
        }))
      } catch (error) {
        console.error("Error fetching invitation:", error)
        toast.error("Erro ao buscar o convite.")
      } finally {
        setLoading(false)
      }
    }

    fetchInvitation()
  }, [db, invitationId])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.password) {
      newErrors.password = "A senha é obrigatória."
    } else if (formData.password.length < 8) {
      newErrors.password = "A senha deve ter pelo menos 8 caracteres."
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "As senhas não coincidem."
    }

    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)
  
    try {
      console.group('Registration Diagnostic Information')
      console.log('Invitation Data:', JSON.stringify(invitationData, null, 2))
      console.log('Form Data:', JSON.stringify(formData, null, 2))
      
      console.log('Browser Capabilities:', {
        windowAvailable: typeof window !== 'undefined',
        navigatorUserAgent: navigator.userAgent,
        browserLanguage: navigator.language,
        platformInfo: navigator.platform
      })

      const browserAPIs = [
        'fetch', 'Promise', 'localStorage', 
        'sessionStorage', 'crypto', 'TextEncoder'
      ] as const;

      const missingAPIs = browserAPIs.filter(api => {
        // Type-safe check for window object properties
        switch (api) {
          case 'fetch':
            return typeof window.fetch === 'undefined';
          case 'Promise':
            return typeof window.Promise === 'undefined';
          case 'localStorage':
            return typeof window.localStorage === 'undefined';
          case 'sessionStorage':
            return typeof window.sessionStorage === 'undefined';
          case 'crypto':
            return typeof window.crypto === 'undefined';
          case 'TextEncoder':
            return typeof window.TextEncoder === 'undefined';
          default:
            return false;
        }
      });

      console.log('Missing Browser APIs:', missingAPIs);
      console.groupEnd()

      const result = await signUp(
        formData.email,
        formData.password,
        {
          username: formData.username,
          role: invitationData.role,
        }
      )

      if (result.success) {
        toast.success("Registro realizado com sucesso!")
        
        const navigationMethods = [
          // Method 1: Next.js router with auth check
          async () => {
            try {
              console.group('Next.js Router Navigation')
              
              // Get current user from Firebase/Auth context
              const user = auth.currentUser
              console.log('Current User:', {
                uid: user?.uid,
                email: user?.email,
                emailVerified: user?.emailVerified
              })

              // Additional auth validation
              if (!user) {
                console.error('No authenticated user found')
                toast.error("Autenticação necessária para navegação.")
                return false
              }

              // Fetch user's custom claims or role
              let idTokenResult;
              if ('getIdTokenResult' in user) {
                idTokenResult = await (user as FirebaseUser).getIdTokenResult()
              } else {
                // Fallback for custom User type
                idTokenResult = { claims: {} }
              }
              console.log('User Claims:', idTokenResult.claims)

              // Determine route based on user role
              let targetRoute = "/dashboard"
              switch (invitationData.role) {
                case 'owner':
                case 'admin':
                  targetRoute = "/dashboard"
                  break
                case 'manager':
                case 'waiter':
                  targetRoute = "/orders"
                  break
                case 'chef':
                  targetRoute = "/orders"
                  break
                case 'barman':
                  targetRoute = "/orders"
                  break
                default:
                  // Fallback to dashboard for unexpected roles
                  targetRoute = "/dashboard"
              }

              // Log navigation details
              console.log('Navigation Attempt:', {
                target: targetRoute,
                role: invitationData.role,
                timestamp: new Date().toISOString()
              })
              
              await router.push(targetRoute)
              console.log('Next.js router navigation successful')
              console.groupEnd()
              return true
            } catch (error) {
              console.error("Next.js router navigation failed:", {
                errorType: typeof error,
                errorName: error instanceof Error ? error.name : 'Unknown',
                errorMessage: error instanceof Error ? error.message : 'No message',
                errorStack: error instanceof Error ? error.stack : 'No stack'
              })
              console.groupEnd()
              
              // Show user-friendly error toast
              toast.error("Erro ao navegar para a página.")
              return false
            }
          },
          // Method 2: Window location with auth validation
          async () => {
            try {
              console.group('Window Location Navigation')
              
              // Get current user from Firebase/Auth context
              const user = auth.currentUser
              if (!user) {
                console.error('No authenticated user found')
                toast.error("Autenticação necessária para navegação.")
                return false
              }

              console.log('Current location:', window.location.href)
              console.log('Navigation target:', "/dashboard")
              
              // Validate dashboard route
              try {
                const response = await fetch("/dashboard", { 
                  method: 'GET',
                  credentials: 'include' // Important for session validation
                })
                
                if (!response.ok) {
                  console.error('Dashboard route validation failed:', {
                    status: response.status,
                    statusText: response.statusText
                  })
                  return false
                }
              } catch (routeError) {
                console.error('Dashboard route check failed:', routeError)
                return false
              }
              
              window.location.href = "/dashboard"
              console.log('Window location navigation initiated')
              console.groupEnd()
              return true
            } catch (error) {
              console.error("Window location navigation failed:", error)
              console.groupEnd()
              
              // Show user-friendly error toast
              toast.error("Erro ao navegar para a página.")
              return false
            }
          }
        ];

        // Try navigation methods sequentially
        for (const attempt of navigationMethods) {
          const success = await attempt()
          if (success) break
        }
      } else {
        console.error('Sign Up Error:', result.error)
        setErrors({ form: result.error || "Ocorreu um erro inesperado. Por favor, tente novamente." })
      }
    } catch (error: unknown) {
      console.group('Registration Error Details')
      console.error('Complete Error Object:', error)
      console.error('Error Type:', typeof error)

      // Type-safe error handling
      const errorDetails = {
        name: error instanceof Error ? error.name : 'Unknown Error',
        message: error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
            ? error 
            : 'An unexpected error occurred',
        stack: error instanceof Error ? error.stack : undefined
      }

      console.error('Error Name:', errorDetails.name)
      console.error('Error Message:', errorDetails.message)
      console.error('Error Stack:', errorDetails.stack)
      
      try {
        console.error('Serialized Error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
      } catch {}
      console.groupEnd()

      const errorMessage = errorDetails.message

      setErrors({ form: errorMessage })
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Completar Registro por Convite</CardTitle>
          <CardDescription>Preencha o formulário abaixo para criar sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.form && (
              <div className="text-red-500 text-sm mb-4">{errors.form}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Nome de Usuário</Label>
              <Input
                id="username"
                value={formData.username}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={formData.email}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={errors.password ? "border-red-500" : ""}
                  disabled={loading}
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className={errors.confirmPassword ? "border-red-500" : ""}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm">{errors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {"Criando conta..."}
                </>
              ) : (
                "Criar Conta"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            {"Já tem uma conta?"}{" "}
            <Link href="/login" className="text-primary hover:underline">
              {"Faça login"}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}