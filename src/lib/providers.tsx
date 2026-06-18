import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "./supabase"
import { api, type CurrentUser, type Dropdowns } from "./api"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: (count, error) => {
        // Don't retry auth errors
        if (error instanceof Error && error.message.includes("401")) return false
        return count < 1
      },
      refetchOnWindowFocus: false,
    },
  },
})

// ─────────────────────────────────────────────────────────
// Session context
// ─────────────────────────────────────────────────────────

type SessionContextValue = {
  session: Session | null
  isLoading: boolean
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  isLoading: true,
})

function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      // Reset query cache on auth change so we don't show stale data
      queryClient.clear()
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  return (
    <SessionContext.Provider value={{ session, isLoading }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}

// ─────────────────────────────────────────────────────────
// Auth gate — redirects to /login if not authenticated
// ─────────────────────────────────────────────────────────

function AuthGate({ children }: { children: ReactNode }) {
  const { session, isLoading } = useSession()
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })

  useEffect(() => {
    if (!isLoading && !session && location.pathname !== "/login") {
      navigate({ to: "/login" })
    }
  }, [isLoading, session, location.pathname, navigate])

  if (isLoading) {
    return <FullPageMessage>Loading session…</FullPageMessage>
  }

  if (!session && location.pathname !== "/login") {
    return <FullPageMessage>Redirecting to sign in…</FullPageMessage>
  }

  return <>{children}</>
}

// ─────────────────────────────────────────────────────────
// Auth context (fetches account from API once authed)
// ─────────────────────────────────────────────────────────

const AuthContext = createContext<CurrentUser | null>(null)

function AuthProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()

  const { data, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<CurrentUser>("/accounts/me"),
    enabled: !!session,
    staleTime: Infinity,
  })

  if (!session) return <>{children}</>

  if (isLoading) {
    return <FullPageMessage>Loading user…</FullPageMessage>
  }

  if (error || !data) {
    return (
      <FullPageMessage>
        Failed to load user account.
        <div className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-4 text-sm underline"
        >
          Sign out and try again
        </button>
      </FullPageMessage>
    )
  }

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>
}

export function useAuth(): CurrentUser {
  const user = useContext(AuthContext)
  if (!user) throw new Error("useAuth must be used within AuthProvider")
  return user
}

// ─────────────────────────────────────────────────────────
// Dropdowns
// ─────────────────────────────────────────────────────────

const DropdownsContext = createContext<Dropdowns | null>(null)

function DropdownsProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()

  const { data, isLoading, error } = useQuery({
    queryKey: ["dropdowns"],
    queryFn: () => api.get<Dropdowns>("/data/dropdowns"),
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
  })

  if (!session) return <>{children}</>

  if (isLoading) {
    return <FullPageMessage>Loading reference data…</FullPageMessage>
  }

  if (error || !data) {
    return (
      <FullPageMessage>
        Failed to load reference data.
        <div className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </FullPageMessage>
    )
  }

  return <DropdownsContext.Provider value={data}>{children}</DropdownsContext.Provider>
}

export function useDropdowns(): Dropdowns {
  const dropdowns = useContext(DropdownsContext)
  if (!dropdowns) throw new Error("useDropdowns must be used within DropdownsProvider")
  return dropdowns
}

// ─────────────────────────────────────────────────────────
// Composed provider
// ─────────────────────────────────────────────────────────

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AuthGate>
          <AuthProvider>
            <DropdownsProvider>{children}</DropdownsProvider>
          </AuthProvider>
        </AuthGate>
      </SessionProvider>
    </QueryClientProvider>
  )
}

function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">{children}</div>
    </div>
  )
}