import { useMemo } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Check, Loader2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  flowControlApi,
  FLOW_STATES,
  FLOW_STATE_LABELS,
  type FlowControlItem,
  type FlowState,
} from "@/lib/api/flow-control"
import { queryClient } from "@/lib/providers"
import { formatDateShort } from "@/lib/format"

type Props = {
  customerId: number
}

export function WorkflowChecklist({ customerId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["flow-control", customerId],
    queryFn: () => flowControlApi.get(customerId),
  })

  const items = data?.items ?? []

  // Group by section
  const grouped = useMemo(() => {
    const map = new Map<string, FlowControlItem[]>()
    for (const item of items) {
      const section = item.sectionName || "General"
      const arr = map.get(section) ?? []
      arr.push(item)
      map.set(section, arr)
    }
    return map
  }, [items])

  // Progress
  const completed = items.filter((i) => i.state === FLOW_STATES.COMPLETED).length
  const total = items.length
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground py-4">Loading…</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load"}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium">No workflow items defined yet</div>
              <p className="text-muted-foreground mt-1">
                Admins can add items at{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">/flow-items</code>.
                Items added there appear automatically on every customer's checklist.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">Workflow checklist</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {completed} of {total} completed · {progressPct}%
            </p>
          </div>
          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([section, sectionItems]) => (
            <div key={section}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {section}
              </h3>
              <div className="divide-y border rounded-md">
                {sectionItems.map((item) => (
                  <ChecklistRow key={item.id} item={item} customerId={customerId} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ChecklistRow({ item, customerId }: { item: FlowControlItem; customerId: number }) {
  const mutation = useMutation({
    mutationFn: (state: FlowState) => flowControlApi.updateItem(item.id, { state }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-control", customerId] })
    },
  })

  const completedBy = item.completedByFirstName
    ? `${item.completedByFirstName} ${item.completedByLastName ?? ""}`.trim()
    : null

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-accent/30">
      <StateIndicator state={item.state} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{item.name}</div>
        {item.description && (
          <div className="text-xs text-muted-foreground">{item.description}</div>
        )}
        {item.state === FLOW_STATES.COMPLETED && item.completedAt && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Completed {formatDateShort(item.completedAt)}
            {completedBy ? ` by ${completedBy}` : ""}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">
        {mutation.isPending && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        <Select
          value={String(item.state)}
          onValueChange={(v) => mutation.mutate(Number(v) as FlowState)}
          disabled={mutation.isPending}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(FLOW_STATE_LABELS) as [string, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function StateIndicator({ state }: { state: FlowState }) {
  const config: Record<FlowState, { className: string; label: string }> = {
    0: { className: "bg-muted border-muted-foreground/30", label: "Not started" },
    1: { className: "bg-blue-500 border-blue-600", label: "In progress" },
    2: { className: "bg-amber-500 border-amber-600", label: "Awaiting" },
    3: { className: "bg-green-500 border-green-600", label: "Done" },
    4: { className: "bg-muted border-muted-foreground/30", label: "Skipped" },
  }

  const cfg = config[state]
  return (
    <div
      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${cfg.className}`}
      title={cfg.label}
    >
      {state === FLOW_STATES.COMPLETED && <Check className="h-3 w-3 text-white" />}
    </div>
  )
}