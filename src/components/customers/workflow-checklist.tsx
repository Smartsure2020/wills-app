import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Check,
  Loader2,
  AlertCircle,
  MinusCircle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Paperclip,
  X,
  FileText,
  StickyNote,
  Plus,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  flowChecklistApi,
  type FlowChecklistItem,
  type FlowChecklistGroup,
} from "@/lib/api/flow-checklist"
import { documentsApi } from "@/lib/api/documents"
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
                This customer has no flow_control rows.
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
            No items configured for this flow type. Add them at{" "}
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
  const [expanded, setExpanded] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)

  const isChecked = !!item.checkedDate
  const isNotApplicable = !item.applicable
  const hasNotes = item.notes.length > 0
  const hasAttachments = item.attachments.length > 0

  const stateMutation = useMutation({
    mutationFn: (input: { checked?: boolean; applicable?: boolean }) =>
      flowChecklistApi.updateItem(item.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-checklist", customerId] })
    },
  })

  const checkedByName = item.checkedByFirstName
    ? `${item.checkedByFirstName} ${item.checkedByLastName ?? ""}`.trim()
    : null

  return (
    <div>
      <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-accent/30">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() => stateMutation.mutate({ checked: !isChecked })}
          disabled={stateMutation.isPending || isNotApplicable}
          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            isNotApplicable
              ? "bg-muted border-muted-foreground/30 cursor-not-allowed opacity-50"
              : isChecked
              ? "bg-green-500 border-green-600 hover:bg-green-600"
              : "border-muted-foreground/40 hover:border-foreground"
          }`}
        >
          {isChecked && !isNotApplicable && <Check className="h-3 w-3 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
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
            {hasNotes && (
              <StickyNote className="h-3 w-3 text-amber-600" />
            )}
            {hasAttachments && (
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                {item.attachments.length}
              </span>
            )}
          </div>
          {isChecked && item.checkedDate && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Completed {formatDateShort(item.checkedDate)}
              {checkedByName ? ` by ${checkedByName}` : ""}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {stateMutation.isPending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {isNotApplicable ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => stateMutation.mutate({ applicable: true })}
              disabled={stateMutation.isPending}
              className="h-7 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Restore
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => stateMutation.mutate({ applicable: false })}
              disabled={stateMutation.isPending}
              className="h-7 text-xs"
            >
              <MinusCircle className="h-3.5 w-3.5 mr-1" />
              N/A
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <ExpandedDetails
          item={item}
          customerId={customerId}
          onAttachClick={() => setAttachOpen(true)}
        />
      )}

      <AttachDocumentDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        item={item}
        customerId={customerId}
      />
    </div>
  )
}

function ExpandedDetails({
  item,
  customerId,
  onAttachClick,
}: {
  item: FlowChecklistItem
  customerId: number
  onAttachClick: () => void
}) {
  const [notes, setNotes] = useState(item.notes)
  const [savedNotes, setSavedNotes] = useState(item.notes)

  const notesMutation = useMutation({
    mutationFn: (newNotes: string) =>
      flowChecklistApi.updateItem(item.id, { notes: newNotes }),
    onSuccess: (_, newNotes) => {
      setSavedNotes(newNotes)
      queryClient.invalidateQueries({ queryKey: ["flow-checklist", customerId] })
    },
  })

  const detachMutation = useMutation({
    mutationFn: (documentId: number) =>
      flowChecklistApi.detachDocument(item.id, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-checklist", customerId] })
    },
  })

  function saveNotes() {
    if (notes !== savedNotes) {
      notesMutation.mutate(notes)
    }
  }

  return (
    <div className="bg-muted/30 border-t px-12 py-3 space-y-3">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Notes
          </label>
          {notesMutation.isPending && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {!notesMutation.isPending && notes !== savedNotes && (
            <span className="text-xs text-muted-foreground">unsaved</span>
          )}
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Add notes for this item…"
          rows={2}
          className="text-sm bg-background"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Attachments ({item.attachments.length})
            </label>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onAttachClick}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Attach
          </Button>
        </div>
        {item.attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No documents attached yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {item.attachments.map((att) => (
              <div
                key={att.id}
                className="inline-flex items-center gap-1.5 bg-background border rounded-md px-2 py-1 text-xs"
              >
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[200px]">{att.documentName}</span>
                <button
                  type="button"
                  onClick={() => detachMutation.mutate(att.documentId)}
                  disabled={detachMutation.isPending}
                  className="text-muted-foreground hover:text-destructive ml-1"
                  title="Remove attachment"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AttachDocumentDialog({
  open,
  onOpenChange,
  item,
  customerId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: FlowChecklistItem
  customerId: number
}) {
  const [search, setSearch] = useState("")

  const { data } = useQuery({
    queryKey: ["documents", customerId, "all-files"],
    queryFn: () => documentsApi.listAllFiles(customerId),
    enabled: open,
  })

  const attachMutation = useMutation({
    mutationFn: (documentId: number) =>
      flowChecklistApi.attachDocument(item.id, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-checklist", customerId] })
      onOpenChange(false)
      setSearch("")
    },
  })

  const files = useMemo(() => data?.items ?? [], [data?.items])
  const attachedIds = useMemo(
    () => new Set(item.attachments.map((a) => a.documentId)),
    [item.attachments]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return files
    return files.filter((f) => f.documentName.toLowerCase().includes(q))
  }, [files, search])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach a document</DialogTitle>
          <DialogDescription>
            Link an existing customer document to "{item.description}".
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="max-h-72 overflow-auto border rounded-md divide-y">
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {files.length === 0
                ? "No documents uploaded for this customer yet."
                : `No documents match "${search}"`}
            </div>
          ) : (
            filtered.map((file) => {
              const alreadyAttached = attachedIds.has(file.id)
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => attachMutation.mutate(file.id)}
                  disabled={alreadyAttached || attachMutation.isPending}
                  className="w-full flex items-center gap-3 py-2 px-3 hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {file.documentName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {file.contentType} · {formatDateShort(file.createdAt)}
                    </div>
                  </div>
                  {alreadyAttached && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      Already attached
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
