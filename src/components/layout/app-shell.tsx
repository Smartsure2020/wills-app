import { Link } from "@tanstack/react-router"
import { Home, Users, UserCog, FileText, Settings } from "lucide-react"
import { useAuth } from "@/lib/providers"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

type NavItem = {
  to: string
  label: string
  icon: typeof Home
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/brokers", label: "Brokers", icon: UserCog },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
]

export function AppShell({ children }: { children: ReactNode }) {
  const user = useAuth()

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 border-r bg-card flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b">
          <span className="text-lg font-semibold tracking-tight">Wills App</span>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              activeProps={{
                className:
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm bg-accent text-accent-foreground font-medium",
              }}
              activeOptions={{ exact: item.to === "/" }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b bg-card flex items-center justify-end px-6 gap-4">
          <div className="text-right">
            <div className="text-sm font-medium">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
          <div
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium",
              "bg-primary text-primary-foreground"
            )}
          >
            {user.firstName[0]?.toUpperCase()}
            {user.lastName[0]?.toUpperCase()}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  )
}