import { useMutation, useQuery } from "@tanstack/react-query"
import { Check, Loader2, AlertCircle, MinusCircle, RotateCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  flowChecklistApi,
  type FlowChecklistItem,
  type FlowChecklistGroup,
} from "@/lib/api/flow-checklist"
import { queryClient } from "@/lib/providers"
import { formatDateShort } from "@/lib/format"

type Props = {
  customerId: number
}

export function WorkflowChecklist({ customerId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["flow-checklist", customerId],
    queryFn: () => flowChecklistApi.get(customerId),
  })

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

  const flowControls = data?.flowControls ?? []

  if (flowControls.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <div className="font-medium">No flow control records</div>
              <p className="text-muted-foreground mt-1">
                This customer has no flow_control rows. The customer-create logic
                normally creates one — if this is an older customer, you may need to
                create one manually via SQL.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {flowControls.map((fc) => (
        <FlowControlGroup key={fc.id} group={fc} customerId={customerId} />
      ))}
    </div>
  )
}

function FlowControlGroup({
  group,
  customerId,
}: {
  group: FlowChecklistGroup
  customerId: number
}) {
  const total = group.items.filter((i) => i.applicable).length
  const completed = group.items.filter(
    (i) => i.applicable && i.checkedDate
  ).length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              {group.flowTypeName}{" "}
              {group.completed && (
                <Badge variant="secondary" className="ml-1">
                  Complete
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {completed} of {total} completed · {pct}%
            </p>
          </div>
          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {group.items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
            No items configured for this flow type. Admins can add them at{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">/flow-items</code>.
          </div>
        ) : (
          <div className="divide-y border rounded-md">
            {group.items.map((item) => (
              <ChecklistRow key={item.id} item={item} customerId={customerId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ChecklistRow({
  item,
  customerId,
}: {
  item: FlowChecklistItem
  customerId: number
}) {
  const mutation = useMutation({
    mutationFn: (input: { checked?: boolean; applicable?: boolean }) =>
      flowChecklistApi.updateItem(item.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-checklist", customerId] })
    },
  })

  const isChecked = !!item.checkedDate
  const isNotApplicable = !item.applicable

  const checkedByName = item.checkedByFirstName
    ? `${item.checkedByFirstName} ${item.checkedByLastName ?? ""}`.trim()
    : null

  return (
    <div>
      <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-accent/30">
        <button
          type="button"
          onClick={() => mutation.mutate({ checked: !isChecked })}
          disabled={mutation.isPending || isNotApplicable}
          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            isNotApplicable
              ? "bg-muted border-muted-foreground/30 cursor-not-allowed opacity-50"
              : isChecked
              ? "bg-green-500 border-green-600 hover:bg-green-600"
              : "border-muted-foreground/40 hover:border-foreground"
          }`}
          title={
            isNotApplicable
              ? "Marked not applicable"
              : isChecked
              ? "Click to uncheck"
              : "Click to mark complete"
          }
        >
          {isChecked && !isNotApplicable && <Check className="h-3 w-3 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
              {item.abbreviation}
            </span>
            <span
              className={`text-sm font-medium ${
                isNotApplicable ? "line-through text-muted-foreground" : ""
              }`}
            >
              {item.description}
            </span>
          </div>
          {isChecked && item.checkedDate && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Completed {formatDateShort(item.checkedDate)}
              {checkedByName ? ` by ${checkedByName}` : ""}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {mutation.isPending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {isNotApplicable ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => mutation.mutate({ applicable: true })}
              disabled={mutation.isPending}
              title="Mark applicable"
              className="h-7 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Restore
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => mutation.mutate({ applicable: false })}
              disabled={mutation.isPending}
              title="Mark not applicable"
              className="h-7 text-xs"
            >
              <MinusCircle className="h-3.5 w-3.5 mr-1" />
              N/A
            </Button>
          )}
        </div>
      </div>
      {mutation.isError && (
        <div className="px-3 pb-2 text-xs text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "Update failed"}
        </div>
      )}
    </div>
  )
}