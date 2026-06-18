import { createRootRoute, Outlet, Link, useRouterState } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { AppProviders } from "@/lib/providers"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isLoginRoute = pathname === "/login"

  return (
    <AppProviders>
      {isLoginRoute ? (
        <Outlet />
      ) : (
        <AppShell>
          <Outlet />
        </AppShell>
      )}
      <TanStackRouterDevtools position="bottom-right" />
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </AppProviders>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-5xl font-bold tracking-tight">404</h1>
      <p className="text-muted-foreground mt-2 max-w-md">
        This page doesn't exist.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  )
}
