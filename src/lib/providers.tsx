import { createContext, useContext, type ReactNode } from "react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { api, type CurrentUser, type Dropdowns } from "./api"

// ─────────────────────────────────────────────────────────
// Query client
// ─────────────────────────────────────────────────────────

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// ─────────────────────────────────────────────────────────
// Auth context
// ─────────────────────────────────────────────────────────

const AuthContext = createContext<CurrentUser | null>(null)

function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<CurrentUser>("/accounts/me"),
    staleTime: Infinity,
  })

  if (isLoading) {
    return <FullPageMessage>Loading session…</FullPageMessage>
  }

  if (error || !data) {
    return (
      <FullPageMessage>
        Failed to load session.
        <div className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
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
// Dropdowns context
// ─────────────────────────────────────────────────────────

const DropdownsContext = createContext<Dropdowns | null>(null)

function DropdownsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dropdowns"],
    queryFn: () => api.get<Dropdowns>("/data/dropdowns"),
    staleTime: 5 * 60 * 1000,
  })

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
      <AuthProvider>
        <DropdownsProvider>{children}</DropdownsProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

// ─────────────────────────────────────────────────────────
// Tiny helper for loading / error states
// ─────────────────────────────────────────────────────────

function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">{children}</div>
    </div>
  )
}