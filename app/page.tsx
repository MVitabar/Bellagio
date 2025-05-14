"use client"

import { useRouter } from 'next/navigation'
import { useAuth } from "@/components/auth-provider"
import { usePathname } from 'next/navigation'

export default function RootPage() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isInvitationRoute = pathname.includes('/invitation/register')

  if (loading) {
    return null 
  }

  if (!user) {
    router.push(isInvitationRoute ? "/login" : "/register")
    return
  }

  router.push('/dashboard') // or your default authenticated route
}