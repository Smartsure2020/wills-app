import { createFileRoute } from "@tanstack/react-router"
import { useAuth, useDropdowns } from "@/lib/providers"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const user = useAuth()
  const dropdowns = useDropdowns()

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, {user.firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          You're signed in as account type {user.accountTypeId}
          {user.manageAll ? " · ManageAll enabled" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Countries" value={dropdowns.countries.length} />
        <StatCard label="Flow Types" value={dropdowns.flowTypes.length} />
        <StatCard label="Relation Types" value={dropdowns.relationTypes.length} />
        <StatCard label="Wishes" value={dropdowns.wishes.length} />
      </div>

      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Phase 2d foundation working. Customer screens land in Phase 2e.
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  )
}