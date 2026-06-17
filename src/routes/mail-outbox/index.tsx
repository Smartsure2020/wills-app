import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCw,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  mailOutboxApi,
  type MailStatus,
  type MailRow,
} from "@/lib/api/mail-outbox"
import { queryClient, useAuth } from "@/lib/providers"
import { formatDateShort } from "@/lib/format"

export const Route = createFileRoute("/mail-outbox/")({
  component: MailOutboxPage,
})

function MailOutboxPage() {
  const user = useAuth()
  const [status, setStatus] = useState<MailStatus>("pending")

  const { data, isLoading } = useQuery({
    queryKey: ["mail-outbox", status],
    queryFn: () => mailOutboxApi.list({ status, pageSize: 50 }),
    enabled: user.accountTypeId === 1 || user.manageAll,
  })

  if (user.accountTypeId !== 1 && !user.manageAll) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Admin access required</div>
          </div>
        </div>
      </div>
    )
  }

  const items = data?.items ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mail outbox</h1>
        <p className="text-muted-foreground mt-1">
          Emails queued by workflow events. The Vercel cron drains pending mail
          hourly via Resend.
        </p>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as MailStatus)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data?.totalCount ?? 0} email{data?.totalCount === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-md">
              No emails in this state.
            </div>
          ) : (
            <div className="divide-y border rounded-md">
              {items.map((m) => (
                <MailRow key={m.id} row={m} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MailRow({ row }: { row: MailRow }) {
  const retryMutation = useMutation({
    mutationFn: () => mailOutboxApi.retry(row.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mail-outbox"] })
    },
  })

  return (
    <div className="px-4 py-3 hover:bg-accent/30">
      <div className="flex items-start gap-3">
        <StatusIcon row={row} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{row.subject}</span>
            {row.attempts >= 5 && (
              <Badge variant="destructive" className="text-xs">
                Failed
              </Badge>
            )}
            {row.attempts > 0 && row.attempts < 5 && (
              <Badge variant="secondary" className="text-xs">
                {row.attempts} attempt{row.attempts === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            To: <span className="font-mono">{row.address}</span> ·{" "}
            Created {formatDateShort(row.createdAt)}
            {row.sentAt && <> · Sent {formatDateShort(row.sentAt)}</>}
          </div>
          {row.lastError && (
            <div className="text-xs text-destructive mt-1 bg-destructive/5 rounded px-2 py-1">
              {row.lastError}
            </div>
          )}
        </div>
        {!row.sentAt && row.attempts >= 5 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
          >
            {retryMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <RotateCw className="h-3.5 w-3.5 mr-1" />
                Retry
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

function StatusIcon({ row }: { row: MailRow }) {
  if (row.sentAt) return <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
  if (row.attempts >= 5) return <XCircle className="h-4 w-4 text-destructive mt-0.5" />
  if (row.attempts > 0) return <Mail className="h-4 w-4 text-amber-600 mt-0.5" />
  return <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
}