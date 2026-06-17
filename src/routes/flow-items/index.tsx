import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Plus, Edit, Trash2, Loader2, AlertCircle, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { flowItemsApi, type FlowItem } from "@/lib/api/flow-items"
import { queryClient, useAuth } from "@/lib/providers"

export const Route = createFileRoute("/flow-items/")({
  component: FlowItemsPage,
})

const itemSchema = z.object({
  name: z.string().min(1, "Required").max(500),
  description: z.string().max(2000),
  sectionName: z.string().max(200),
  sortOrder: z.coerce.number().int(),
})

type ItemFormData = z.infer<typeof itemSchema>

function FlowItemsPage() {
  const user = useAuth()
  const [editing, setEditing] = useState<FlowItem | "new" | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FlowItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["flow-items"],
    queryFn: () => flowItemsApi.list(),
  })

  if (user.accountTypeId !== 1 && !user.manageAll) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Admin access required</div>
            <p className="text-sm text-muted-foreground mt-1">
              Workflow items can only be managed by admins or brokers with ManageAll.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const items = data?.items ?? []

  // Group by section for display
  const grouped = new Map<string, FlowItem[]>()
  for (const item of items) {
    const section = item.sectionName || "Uncategorised"
    const arr = grouped.get(section) ?? []
    arr.push(item)
    grouped.set(section, arr)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow items</h1>
          <p className="text-muted-foreground mt-1 max-w-prose">
            The master checklist every customer follows. Items added here appear on
            every customer's workflow checklist. Group items with section names
            (e.g. "Information Gathering", "Will Drafting"). Sort order controls
            display position within a section.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-2" />
          Add item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{items.length} item{items.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
              No workflow items yet. Add the first one to start building the checklist.
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(grouped.entries()).map(([section, sectionItems]) => (
                <div key={section}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {section}
                  </h3>
                  <div className="divide-y border rounded-md">
                    {sectionItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-2 px-3 hover:bg-accent/30"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          #{item.sortOrder}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(item)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EditItemDialog
        target={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <DeleteItemDialog
        target={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </div>
  )
}

function EditItemDialog({
  target,
  onOpenChange,
}: {
  target: FlowItem | "new" | null
  onOpenChange: (open: boolean) => void
}) {
  const isNew = target === "new"
  const item = target && target !== "new" ? target : null

  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    values: {
      name: item?.name ?? "",
      description: item?.description ?? "",
      sectionName: item?.sectionName ?? "",
      sortOrder: item?.sortOrder ?? 0,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: ItemFormData) =>
      isNew ? flowItemsApi.create(data) : flowItemsApi.update(item!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-items"] })
      onOpenChange(false)
      form.reset()
    },
  })

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add workflow item" : "Edit workflow item"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "This item will appear on every customer's checklist."
              : "Changes apply to all customers using this item."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Verify identity documents" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="What needs to happen for this item" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sectionName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Information Gathering" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort order</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : isNew ? (
                  "Add item"
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteItemDialog({
  target,
  onOpenChange,
}: {
  target: FlowItem | null
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useMutation({
    mutationFn: () => flowItemsApi.delete(target!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-items"] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{target?.name}"?</DialogTitle>
          <DialogDescription>
            This item will be removed from the master list. Existing customer
            checklists will keep their progress on this item, but it will no longer
            appear on new fetches. Existing notes and completion records are
            preserved in the database.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}