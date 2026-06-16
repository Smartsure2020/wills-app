import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { accountsApi } from "@/lib/api/accounts"
import { useDebounce } from "@/lib/hooks/use-debounce"

export const Route = createFileRoute("/brokers/")({
  component: BrokersListPage,
})

const PAGE_SIZE = 20
const BROKER_TYPE_ID = 2

function BrokersListPage() {
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(searchInput, 300)

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["accounts", { page, search: debouncedSearch, accountTypeId: BROKER_TYPE_ID }],
    queryFn: () =>
      accountsApi.list({
        pageNumber: page,
        pageSize: PAGE_SIZE,
        accountTypeId: BROKER_TYPE_ID,
        searchText: debouncedSearch || undefined,
      }),
    placeholderData: (prev) => prev,
  })

  const items = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brokers</h1>
          <p className="text-muted-foreground mt-1">
            {totalCount > 0
              ? `${totalCount} broker${totalCount === 1 ? "" : "s"}`
              : "No brokers yet"}
          </p>
        </div>
        <Button asChild>
          <Link to="/brokers/new">
            <Plus className="h-4 w-4 mr-2" />
            Add broker
          </Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Permissions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-destructive py-8">
                  Failed to load: {error instanceof Error ? error.message : "Unknown"}
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  {debouncedSearch
                    ? `No brokers match "${debouncedSearch}"`
                    : "No brokers yet. Add your first one to get started."}
                </TableCell>
              </TableRow>
            ) : (
              items.map((broker) => (
                <TableRow key={broker.id} className="cursor-pointer hover:bg-accent/50">
                  <TableCell className="font-medium">
                    <Link
                      to="/brokers/$brokerId"
                      params={{ brokerId: broker.id }}
                      className="hover:underline"
                    >
                      {broker.firstName} {broker.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{broker.email}</TableCell>
                  <TableCell>{broker.contactNumber || "—"}</TableCell>
                  <TableCell>
                    {broker.manageAll ? (
                      <Badge>ManageAll</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Standard</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
            {isFetching && page === data?.pageNumber ? " · Loading…" : ""}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}