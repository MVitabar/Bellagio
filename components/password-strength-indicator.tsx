"use client"

import { PasswordStrengthIndicatorProps } from '@/types'

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {

  // Calculate password strength
  const getPasswordStrength = (password: string): number => {
    let strength = 0

    // Length check
    if (password.length >= 8) strength += 1
    if (password.length >= 12) strength += 1

    // Character variety checks
    if (/[a-z]/.test(password)) strength += 1
    if (/[A-Z]/.test(password)) strength += 1
    if (/\d/.test(password)) strength += 1
    if (/[^a-zA-Z0-9]/.test(password)) strength += 1

    return Math.min(strength, 5)
  }

  const strength = getPasswordStrength(password)

  // Determine color and label based on strength
  const getStrengthInfo = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return { color: "bg-red-500", label: "Muito Fraca" }
      case 2:
        return { color: "bg-orange-500", label: "Fraca" }
      case 3:
        return { color: "bg-yellow-500", label: "Moderada" }
      case 4:
        return { color: "bg-green-400", label: "Forte" }
      case 5:
        return { color: "bg-green-600", label: "Muito Forte" }
      default:
        return { color: "bg-gray-300", label: "" }
    }
  }

  const { color, label } = getStrengthInfo(strength)

  return (
    <div className="space-y-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`${color} transition-all duration-300`} style={{ width: `${(strength / 5) * 100}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
