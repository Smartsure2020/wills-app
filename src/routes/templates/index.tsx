import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Folder,
  FolderPlus,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react"
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
  documentTemplatesApi,
  type DocumentTemplateItem,
} from "@/lib/api/document-templates"
import { queryClient, useAuth } from "@/lib/providers"

export const Route = createFileRoute("/templates/")({
  component: TemplatesPage,
})

function TemplatesPage() {
  const user = useAuth()
  const [addAt, setAddAt] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplateItem | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ["templates"],
    queryFn: () => documentTemplatesApi.list(),
    enabled: user.accountTypeId === 1 || user.manageAll,
  })

  // Build a parent → children map for tree rendering
  const childMap = useMemo(() => {
    const items = data?.items ?? []
    const map = new Map<number, DocumentTemplateItem[]>()
    for (const item of items) {
      const arr = map.get(item.parentId) ?? []
      arr.push(item)
      map.set(item.parentId, arr)
    }
    // Sort each level alphabetically
    for (const arr of map.values()) {
      arr.sort((a, b) => a.documentName.localeCompare(b.documentName))
    }
    return map
  }, [data?.items])

  // Admin gate on the client side too
  if (user.accountTypeId !== 1 && !user.manageAll) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Admin access required</div>
            <p className="text-sm text-muted-foreground mt-1">
              Document templates can only be managed by admins or brokers with the
              ManageAll permission.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const rootItems = childMap.get(0) ?? []

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document templates</h1>
          <p className="text-muted-foreground mt-1 max-w-prose">
            The folder structure new customers receive. Every new customer's document
            tree starts as a copy of these templates. Existing customers are not
            affected by changes here.
          </p>
        </div>
        <Button onClick={() => setAddAt(0)}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Add root folder
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template tree</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading…</div>
          ) : error ? (
            <div className="text-sm text-destructive">
              Failed to load: {error instanceof Error ? error.message : "Unknown"}
            </div>
          ) : rootItems.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
              No templates yet. Add a root folder to get started.
              <div className="mt-3 text-xs">
                Suggested structure: Identity Documents · Will Drafts · Estate
                Information · Power of Attorney · Beneficiary Details
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {rootItems.map((item) => (
                <TemplateNode
                  key={item.id}
                  template={item}
                  childMap={childMap}
                  depth={0}
                  onAddChild={(parentId) => setAddAt(parentId)}
                  onDelete={(t) => setDeleteTarget(t)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddTemplateDialog
        parentId={addAt}
        onOpenChange={(open) => !open && setAddAt(null)}
      />

      <DeleteTemplateDialog
        target={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Recursive tree node
// ─────────────────────────────────────────────────────────

function TemplateNode({
  template,
  childMap,
  depth,
  onAddChild,
  onDelete,
}: {
  template: DocumentTemplateItem
  childMap: Map<number, DocumentTemplateItem[]>
  depth: number
  onAddChild: (parentId: number) => void
  onDelete: (t: DocumentTemplateItem) => void
}) {
  const children = childMap.get(template.id) ?? []

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-accent rounded-sm group"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        <Folder className="h-4 w-4 text-blue-600 flex-shrink-0" />
        <span className="text-sm flex-1">{template.documentName}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAddChild(template.id)}
            title="Add subfolder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(template)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {children.map((child) => (
        <TemplateNode
          key={child.id}
          template={child}
          childMap={childMap}
          depth={depth + 1}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Add dialog
// ─────────────────────────────────────────────────────────

function AddTemplateDialog({
  parentId,
  onOpenChange,
}: {
  parentId: number | null
  onOpenChange: (open: boolean) => void
}) {
  const [folderName, setFolderName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      documentTemplatesApi.createFolder({
        parentId: parentId ?? 0,
        folderName: folderName.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] })
      setFolderName("")
      setError(null)
      onOpenChange(false)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to create")
    },
  })

  return (
    <Dialog
      open={parentId !== null}
      onOpenChange={(o) => {
        if (!o) {
          setFolderName("")
          setError(null)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {parentId === 0 ? "Add root folder" : "Add subfolder"}
          </DialogTitle>
          <DialogDescription>
            This folder will be added to every new customer's document tree going
            forward.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="Folder name"
          onKeyDown={(e) => {
            if (e.key === "Enter" && folderName.trim()) mutation.mutate()
          }}
        />
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!folderName.trim() || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding…
              </>
            ) : (
              "Add folder"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────
// Delete confirmation dialog
// ─────────────────────────────────────────────────────────

function DeleteTemplateDialog({
  target,
  onOpenChange,
}: {
  target: DocumentTemplateItem | null
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useMutation({
    mutationFn: () => documentTemplatesApi.delete(target!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{target?.documentName}"?</DialogTitle>
          <DialogDescription>
            This will remove the folder and all subfolders from the template. New
            customers won't receive it. Existing customers are not affected.
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
