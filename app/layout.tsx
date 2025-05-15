"use client"

import React, { useEffect, useState } from "react"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import I18nProvider from "@/components/i18n-provider"
import { AuthProvider } from "@/components/auth-provider"
import { FirebaseProvider } from "@/components/firebase-provider"
import { FirebaseError } from "@/components/firebase-error"
import { CollapsibleSidebar } from "@/components/collapsible-sidebar"
import { useAuth } from "@/components/auth-provider"
import { usePathname } from "next/navigation"
import LoginPage from "@/app/login/page"
import RegisterPage from "@/app/register/page"
import { UserProvider } from '@/contexts/UserContext';
import { NotificationProvider } from '@/components/providers/NotificationProvider';
import "./globals.css"
import { PermissionsProvider } from "@/components/permissions-provider"
import { Metadata } from "next"
const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <FirebaseProvider>
            <FirebaseError />
            <AuthProvider>
              <I18nProvider>
                <UserProvider>
                  <PermissionsProvider>
                    <NotificationProvider>
                      <LayoutContent>{children}</LayoutContent>
                      <Toaster />
                    </NotificationProvider>
                  </PermissionsProvider>
                </UserProvider>
              </I18nProvider>
            </AuthProvider>
          </FirebaseProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!loading) {
      setIsInitialized(true)
    }
  }, [loading])

  // Esperar a que Firebase se inicialice
  if (!isInitialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-blue-500"></div>
      </div>
    )
  }

  // Verificar si es una ruta de invitación
  const isInvitationRoute = pathname.includes('/invitation/register')
  
  // Si es una ruta de invitación, permitir acceso sin autenticación
  if (isInvitationRoute) {
    return <div className="min-h-screen">{children}</div>
  }

  // Para otras rutas públicas
  const publicPages = ["/login", "/register", "/invitation/register"]
  const isPublicPage = publicPages.some(page => pathname === page)

  // Si no está autenticado y no es una página pública, redirigir al login
  if (!user && !isPublicPage) {
    return <LoginPage />
  }

  // Si está autenticado o es una página pública
  return user ? (
    <div className="flex min-h-screen">
      <CollapsibleSidebar />
      <main className="flex-1 overflow-x-hidden pl-0 md:pl-[250px] transition-all duration-300 pt-16 md:pt-0 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  ) : (
    <div className="min-h-screen">{children}</div>
  )
}