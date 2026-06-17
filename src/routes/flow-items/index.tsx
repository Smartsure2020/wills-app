import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Plus, Edit, Trash2, Loader2, AlertCircle } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  flowControlItemsApi,
  type FlowControlItem,
} from "@/lib/api/flow-control-items"
import { queryClient, useAuth } from "@/lib/providers"

export const Route = createFileRoute("/flow-items/")({
  component: FlowItemsPage,
})

const itemSchema = z.object({
  flowTypeId: z.number().int().min(1, "Required"),
  abbreviation: z.string().min(1, "Required").max(50),
  description: z.string().min(1, "Required").max(2000),
  orderBy: z.number().int(),
})

type ItemFormData = z.infer<typeof itemSchema>

function FlowItemsPage() {
  const user = useAuth()
  const [editing, setEditing] = useState<FlowControlItem | "new" | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FlowControlItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["flow-control-items"],
    queryFn: () => flowControlItemsApi.list(),
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
  const flowTypes = data?.flowTypes ?? []

  // Group by flow type
  const grouped = new Map<number, FlowControlItem[]>()
  for (const item of items) {
    const arr = grouped.get(item.flowTypeId) ?? []
    arr.push(item)
    grouped.set(item.flowTypeId, arr)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow items</h1>
          <p className="text-muted-foreground mt-1 max-w-prose">
            The master checklist customers follow, grouped by flow type. Each customer
            sees the items matching their assigned flow type(s).
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-2" />
          Add item
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : (
        flowTypes.map((ft) => {
          const ftItems = grouped.get(ft.id) ?? []
          return (
            <Card key={ft.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {ft.description}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({ftItems.length} item{ftItems.length === 1 ? "" : "s"})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ftItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
                    No items for this flow type yet.
                  </div>
                ) : (
                  <div className="divide-y border rounded-md">
                    {ftItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-2 px-3 hover:bg-accent/30"
                      >
                        <div className="text-xs text-muted-foreground tabular-nums w-12">
                          #{item.orderBy}
                        </div>
                        <div className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                          {item.abbreviation}
                        </div>
                        <div className="flex-1 text-sm">{item.description}</div>
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
                )}
              </CardContent>
            </Card>
          )
        })
      )}

      <EditItemDialog
        target={editing}
        flowTypes={flowTypes}
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
  flowTypes,
  onOpenChange,
}: {
  target: FlowControlItem | "new" | null
  flowTypes: { id: number; description: string }[]
  onOpenChange: (open: boolean) => void
}) {
  const isNew = target === "new"
  const item = target && target !== "new" ? target : null

  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    values: {
      flowTypeId: item?.flowTypeId ?? flowTypes[0]?.id ?? 1,
      abbreviation: item?.abbreviation ?? "",
      description: item?.description ?? "",
      orderBy: item?.orderBy ?? 0,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      if (isNew) {
        await flowControlItemsApi.create(data)
      } else {
        await flowControlItemsApi.update(item!.id, data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-control-items"] })
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
            New items appear on every customer with a matching flow type.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="flowTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Flow type</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(Number(v))}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {flowTypes.map((ft) => (
                        <SelectItem key={ft.id} value={String(ft.id)}>
                          {ft.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="abbreviation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abbreviation</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. VFID" />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Verify customer identity documents" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="orderBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort order</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                  "Add"
                ) : (
                  "Save"
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
  target: FlowControlItem | null
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useMutation({
    mutationFn: () => flowControlItemsApi.delete(target!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-control-items"] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{target?.description}"?</DialogTitle>
          <DialogDescription>
            This removes the master item from existing customer checklists,
            including any attached document links for that checklist item.
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
            Delete
          </Button>
        </DialogFooter>
        {mutation.isError && (
          <div className="text-xs text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : "Delete failed"}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
