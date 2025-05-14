import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "./auth-provider"
import { signOut } from "firebase/auth"
import { useFirebase } from "./firebase-provider"
import { toast } from "sonner"
import { usePermissions } from "@/hooks/usePermissions"
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Download,
  Home,
  ListOrdered,
  TableIcon,
  Layers,
  UserCog,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ModulePermissions } from "@/types/permissions";

export function CollapsibleSidebar() {
  const { user } = useAuth()
  const { auth } = useFirebase()
  const { canView } = usePermissions()
  const pathname = usePathname()
  const sidebarRef = useRef<HTMLDivElement>(null)

  // State for mobile menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // State for desktop sidebar collapse
  const [isCollapsed, setIsCollapsed] = useState(false)

  // State for temporary expanded hover
  const [isTemporarilyExpanded, setIsTemporarilyExpanded] = useState(false)

  // State for global sidebar toggle
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)

  // Check if we're on mobile based on screen width
  const [isMobile, setIsMobile] = useState(false)

  // Effect to handle window resize and set mobile state
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
      // If switching to desktop, close mobile menu
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false)
      }
    }

    // Initial check
    checkIfMobile()

    // Add event listener
    window.addEventListener("resize", checkIfMobile)

    // Cleanup
    return () => window.removeEventListener("resize", checkIfMobile)
  }, [])

  // Load collapsed and hidden states from localStorage
  useEffect(() => {
    const savedCollapsedState = localStorage.getItem("sidebarCollapsed")
    const savedHiddenState = localStorage.getItem("sidebarHidden")
    
    // Check if it's desktop view
    const isDesktop = window.innerWidth >= 768

    if (savedCollapsedState !== null && !isDesktop) {
      setIsCollapsed(savedCollapsedState === "true")
    } else if (isDesktop) {
      // Force expand on desktop
      setIsCollapsed(false)
      setIsTemporarilyExpanded(false)
    }
    
    if (savedHiddenState !== null) {
      setIsSidebarHidden(savedHiddenState === "true")
    }
  }, [])

  // Ensure sidebar is fully expanded on desktop by default
  useEffect(() => {
    // Check if it's desktop view (you might want to adjust this breakpoint)
    const checkDesktopView = () => {
      if (window.innerWidth >= 768) { // Typical desktop breakpoint
        setIsCollapsed(false)
        setIsTemporarilyExpanded(false)
      }
    }

    // Run on mount and add resize listener
    checkDesktopView()
    window.addEventListener('resize', checkDesktopView)

    // Cleanup listener
    return () => window.removeEventListener('resize', checkDesktopView)
  }, [])

  // Handle mouse enter to temporarily expand
  const handleMouseEnter = () => {
    if (isCollapsed) {
      setIsTemporarilyExpanded(true)
    }
  }

  // Handle mouse leave to collapse back
  const handleMouseLeave = () => {
    if (isCollapsed) {
      setIsTemporarilyExpanded(false)
    }
  }

  // Toggle sidebar collapse
  const toggleCollapsed = () => {
    // Only allow collapsing if it's not a desktop view
    if (window.innerWidth < 768) {
      const newState = !isCollapsed
      setIsCollapsed(newState)
      setIsTemporarilyExpanded(false)
      
      // Update localStorage only for mobile
      localStorage.setItem("sidebarCollapsed", String(newState))
    }
  }

  // Toggle sidebar visibility
  const toggleSidebarVisibility = () => {
    const newState = !isSidebarHidden
    setIsSidebarHidden(newState)
    localStorage.setItem("sidebarHidden", String(newState))
  }

  const handleLogout = async () => {
    if (!auth) return

    try {
      await signOut(auth)
      toast.success("Logout realizado com sucesso.")
    } catch (error: any) {
      if (error.code === "auth/popup-closed-by-user") {
        toast.error("Logout cancelado pelo usuário.")
      } else {
        toast.error("Erro ao fazer logout.")
      }
    }
  }

  // Install app state and handler
  const [installPrompt, setInstallPrompt] = useState<any>(null)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser install prompt
      e.preventDefault()
      // Store the event for later use
      setInstallPrompt(e as any)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallApp = async () => {
    if (!installPrompt) return

    try {
      // Show the install prompt
      const result = await (installPrompt as any).prompt()
      
      // Wait for the user to respond to the prompt
      const choiceResult = await result.userChoice

      if (choiceResult.outcome === 'accepted') {
        toast.success("App instalado com sucesso!")
      }

      // Reset the install prompt
      setInstallPrompt(null)
    } catch (error) {
      toast.error("Erro ao instalar o aplicativo.")
    }
  }

  const navItems: Array<{
    name: string;
    href: string;
    icon: React.ComponentType<any>;
    mobileIcon: React.ComponentType<any>;
    requiredPermission: keyof ModulePermissions;
  }> = [
    {
      name: "Painel",
      href: "/dashboard",
      icon: LayoutDashboard,
      mobileIcon: Home,
      requiredPermission: 'dashboard'
    },
    {
      name: "Pedidos",
      href: "/orders",
      icon: ClipboardList,
      mobileIcon: ListOrdered,
      requiredPermission: 'orders'
    },
    {
      name: "Mesas",
      href: "/tables",
      icon: TableIcon,
      mobileIcon: TableIcon,
      requiredPermission: 'tables'
    },
    {
      name: "Inventário",
      href: "/inventory",
      icon: Package,
      mobileIcon: Layers,
      requiredPermission: 'inventory'
    },
    {
      name: "Usuários",
      href: "/users",
      icon: Users,
      mobileIcon: Users,
      requiredPermission: 'users-management'
    },
    {
      name: "Configurações",
      href: "/settings",
      icon: Settings,
      mobileIcon: UserCog,
      requiredPermission: 'settings'
    }
  ]

  // Filter navigation items based on user permissions
  const filteredNavItems = navItems.filter(item => {
    const hasPermission = canView(item.requiredPermission);
    return hasPermission;
  });

  // Add debug logs
  useEffect(() => {
  }, [user, isMobile, filteredNavItems.length]);

  return (
    <>
      {/* Global Sidebar Toggle for Desktop */}
      {!isMobile && isSidebarHidden && (
        <Button 
          variant="outline" 
          size="icon" 
          className="fixed top-4 left-4 z-50 bg-background shadow-md"
          onClick={() => setIsSidebarHidden(false)}
        >
          <ChevronsRight className="h-6 w-6" />
        </Button>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && !isSidebarHidden && (
        <aside 
          ref={sidebarRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "fixed top-0 left-0 z-40 h-screen bg-background border-r transition-all duration-300 hidden md:block",
            isCollapsed && !isTemporarilyExpanded ? "w-16" : "w-64"
          )}
        >
          <div className="h-full px-3 py-4 overflow-y-auto relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2"
              onClick={toggleSidebarVisibility}
            >
              <X className="h-5 w-5" />
            </Button>

            <div className="flex items-center justify-between mb-4 mt-6">
              <h2 className={cn(
                "text-lg font-semibold transition-opacity", 
                (isCollapsed && !isTemporarilyExpanded) ? "opacity-0" : "opacity-100"
              )}>
                {"Comandero"}
              </h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleCollapsed}
              >
                {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
              </Button>
            </div>

            {/* User Role Display */}
            {user && (
              <div className={cn(
                "text-sm text-muted-foreground mb-4 transition-opacity", 
                (isCollapsed && !isTemporarilyExpanded) ? "opacity-0" : "opacity-100"
              )}>
                {user.role?.toUpperCase()}
              </div>
            )}

            {/* Navigation Items */}
            <nav className="space-y-2">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center p-2 rounded-md transition-colors group",
                    pathname === item.href 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted",
                    (isCollapsed && !isTemporarilyExpanded) && "justify-center"
                  )}
                  title={isCollapsed && !isTemporarilyExpanded ? item.name : undefined}
                >
                  <item.icon className={cn(
                    "h-5 w-5", 
                    (!isCollapsed || isTemporarilyExpanded) && "mr-3",
                    pathname === item.href 
                      ? "text-primary-foreground" 
                      : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  {(!isCollapsed || isTemporarilyExpanded) && <span>{item.name}</span>}
                </Link>
              ))}
            </nav>

            {/* Install App Button - Only show if install prompt is available */}
            {installPrompt && (
              <Button 
                variant="outline" 
                className={cn(
                  "w-full justify-start mt-2", 
                  (isCollapsed && !isTemporarilyExpanded) && "p-2 justify-center"
                )} 
                onClick={handleInstallApp}
              >
                <Download className="mr-2 h-5 w-5" />
                {(!isCollapsed || isTemporarilyExpanded) && "Instalar App"}
              </Button>
            )}

            {/* Logout Button */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <Button 
                variant="ghost" 
                className={cn(
                  "w-full justify-start", 
                  (isCollapsed && !isTemporarilyExpanded) && "justify-center px-0"
                )}
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 mr-2" />
                {(!isCollapsed || isTemporarilyExpanded) && "Sair"}
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Header Actions */}
      {isMobile && (
        <>
          {/* Logout button on the right */}
          <div className="fixed top-0 right-0 z-50 p-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="h-8"
            >
              <LogOut className="h-5 w-5" />
              <span className="sr-only">{"Sair"}</span>
            </Button>
          </div>
        </>
      )}

      {/* Mobile Footer Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 py-2">
          <div className="flex justify-around w-full">
            {filteredNavItems.map((item) => {
              const MobileIcon = item.mobileIcon || item.icon;
              const isSelected = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-lg transition-all",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <MobileIcon
                    className={cn(
                      "h-6 w-6",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  {isSelected && (
                    <span className="mt-1 h-1 w-1 bg-primary rounded-full"></span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
