import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  Users,
  UserCog,
  Plus,
  ChevronRight,
  FileText,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/providers"
import { customersApi } from "@/lib/api/customers"
import { accountsApi } from "@/lib/api/accounts"
import { formatDateShort } from "@/lib/format"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const user = useAuth()
  const isAdmin = user.manageAll || user.accountTypeId === 1

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ["customers", { pageNumber: 1, pageSize: 5 }],
    queryFn: () => customersApi.list({ pageNumber: 1, pageSize: 5 }),
  })

  const { data: brokersData } = useQuery({
    queryKey: ["accounts", { accountTypeId: 2, pageSize: 1 }],
    queryFn: () => accountsApi.list({ accountTypeId: 2, pageSize: 1 }),
    enabled: isAdmin,
  })

  const totalCustomers = customersData?.totalCount ?? 0
  const totalBrokers = brokersData?.totalCount ?? 0
  const recentCustomers = customersData?.items ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user.firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin
            ? "You have full access across the business."
            : "Here's what's happening with your customers."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label={isAdmin ? "Total customers" : "My customers"}
          value={totalCustomers}
          icon={Users}
          to="/customers"
          loading={customersLoading}
        />
        {isAdmin && (
          <StatCard
            label="Brokers"
            value={totalBrokers}
            icon={UserCog}
            to="/brokers"
          />
        )}
        <ActionCard
          label="Add a customer"
          description="Start a new file with the wizard"
          icon={Plus}
          to="/customers/new"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent customers</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/customers">
              View all
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {customersLoading ? (
            <div className="px-6 py-8 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading…
            </div>
          ) : recentCustomers.length === 0 ? (
            <div className="px-6 py-8 text-sm text-muted-foreground text-center">
              No customers yet.{" "}
              <Link to="/customers/new" className="underline">
                Add the first one
              </Link>
              .
            </div>
          ) : (
            <div className="divide-y">
              {recentCustomers.map((customer) => (
                <Link
                  key={customer.id}
                  to="/customers/$customerId"
                  params={{ customerId: String(customer.id) }}
                  className="flex items-center justify-between px-6 py-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {customer.title && `${customer.title} `}
                      {customer.firstName} {customer.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{customer.idNumber}</span>
                      {customer.brokerName?.trim() && (
                        <> · {customer.brokerName.trim()}</>
                      )}
                      <> · {formatDateShort(customer.createdAt)}</>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Admin tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <AdminLink
                to="/templates"
                label="Document templates"
                description="Manage folder structures new customers receive"
              />
              <AdminLink
                to="/flow-items"
                label="Workflow items"
                description="Master checklist for each flow type"
              />
              <AdminLink
                to="/brokers/new"
                label="Add a broker"
                description="Create a new user account"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick reference</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                You're signed in as <strong>{user.firstName} {user.lastName}</strong>
              </p>
              <p>
                Account type: <strong>{user.accountTypeId === 1 ? "Admin" : "Broker"}</strong>
                {user.manageAll && (
                  <span className="ml-2 inline-flex items-center text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    ManageAll
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  to,
  loading,
}: {
  label: string
  value: number
  icon: typeof Users
  to: string
  loading?: boolean
}) {
  return (
    <Link to={to} className="block">
      <Card className="hover:bg-accent/30 transition-colors">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                value
              )}
            </div>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/40" />
        </CardContent>
      </Card>
    </Link>
  )
}

function ActionCard({
  label,
  description,
  icon: Icon,
  to,
}: {
  label: string
  description: string
  icon: typeof Plus
  to: string
}) {
  return (
    <Link to={to} className="block">
      <Card className="hover:bg-accent/30 transition-colors border-dashed">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function AdminLink({
  to,
  label,
  description,
}: {
  to: string
  label: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between -mx-2 px-2 py-2 rounded-md hover:bg-accent/30"
    >
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  )
}