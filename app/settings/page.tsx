"use client"

import { useState } from "react"
import { useI18n } from "@/components/i18n-provider"
import { usePermissions } from "@/components/permissions-provider"
import { useAuth } from "@/components/auth-provider"
import { ROLE_PERMISSIONS, UserRole } from "@/types/permissions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { UserProfile } from "@/components/settings/user-profile"
import { NotificationSettings } from "@/components/settings/notification-settings"
import { AppearanceSettings } from "@/components/settings/appearance-settings"
import { User, Settings, Bell, Globe, Palette, Store, Shield, CreditCard } from "lucide-react"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { CompanySettings } from "@/components/settings/company-settings"
import { SecuritySettings } from "@/components/settings/security-settings"
import { BillingSettings } from "@/components/settings/billing-settings"

export default function SettingsPage() {
  const { canView } = usePermissions()
  const { t } = useI18n() as { t: (key: string) => string }
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("profile")

  // Check if user has full access
  const hasFullAccess = user?.role === UserRole.OWNER || user?.role === UserRole.ADMIN

  // Get settings permissions with safe fallback
  const settingsPermissions = hasFullAccess ? {
    profile: true,
    appearance: true,
    language: true,
    notifications: true,
    company: true,
    security: true,
    billing: true
  } : user?.role ? 
    ROLE_PERMISSIONS[user.role].settings.sections : 
    ROLE_PERMISSIONS['waiter'].settings.sections

  const availableTabs = [
    {
      id: "profile",
      label: t("settings.profile.title"),
      icon: <User className="h-4 w-4" />,
      content: <UserProfile />,
      permission: settingsPermissions?.profile
    },
    {
      id: "appearance",
      label: t("settings.appearance.title"),
      icon: <Palette className="h-4 w-4" />,
      content: <AppearanceSettings />,
      permission: settingsPermissions?.appearance
    },
    {
      id: "notifications",
      label: t("settings.notifications.title"),
      icon: <Bell className="h-4 w-4" />,
      content: <NotificationSettings />,
      permission: settingsPermissions?.notifications
    },
    // Additional tabs only for owner and admin
    {
      id: "company",
      label: t("settings.company.title"),
      icon: <Store className="h-4 w-4" />,
      content: <CompanySettings />,
      permission: settingsPermissions?.company
    },
    {
      id: "security",
      label: t("settings.security.title"),
      icon: <Shield className="h-4 w-4" />,
      content: <SecuritySettings />,
      permission: settingsPermissions?.security
    },
    {
      id: "billing",
      label: t("settings.billing.title"),
      icon: <CreditCard className="h-4 w-4" />,
      content: <BillingSettings />,
      permission: settingsPermissions?.billing
    }
  ]

  // Filter available tabs based on permissions
  const allowedTabs = availableTabs.filter(tab => tab.permission)

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">{t("settings.title")}</h1>

      {/* Mobile Dropdown */}
      <div className="md:hidden mb-6">
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("settings.selectTab")} />
          </SelectTrigger>
          <SelectContent>
            {allowedTabs.map(tab => (
              <SelectItem key={tab.id} value={tab.id}>
                <span className="flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs Container for both desktop view and content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Desktop Tab List */}
        <div className="hidden md:block">
          <TabsList className="mb-6">
            {allowedTabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id}>
                <span className="flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab Content - Same for both mobile and desktop */}
        {allowedTabs.map(tab => (
          <TabsContent key={tab.id} value={tab.id}>
            <Card className="p-6">
              {tab.content}
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
