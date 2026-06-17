import { Fragment, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  Upload,
  FileText,
  Folder,
  FolderPlus,
  Trash2,
  Download,
  Loader2,
  ChevronRight,
  Move,
  Home,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  documentsApi,
  uploadDocument,
  type DocumentItem,
  type FolderItem,
} from "@/lib/api/documents"
import { queryClient } from "@/lib/providers"
import { formatDateShort } from "@/lib/format"

type Props = {
  customerId: number
  parentId: number
  onNavigateToFolder: (folderId: number) => void
}

export function DocumentsCard({ customerId, parentId, onNavigateToFolder }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [moveTarget, setMoveTarget] = useState<DocumentItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["documents", customerId, parentId],
    queryFn: () => documentsApi.list(customerId, parentId),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(customerId, parentId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", customerId] })
      setUploadError(null)
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: documentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", customerId] })
    },
  })

  const downloadMutation = useMutation({
    mutationFn: documentsApi.getDownloadUrl,
    onSuccess: (data) => {
      window.open(data.signedUrl, "_blank")
    },
  })

  const items = data?.items ?? []
  const breadcrumbs = data?.breadcrumbs ?? []

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">
              Documents ({items.length})
            </CardTitle>
            <DocumentBreadcrumb
              breadcrumbs={breadcrumbs}
              onNavigate={onNavigateToFolder}
            />
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNewFolder(true)}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New folder
            </Button>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={onFileChosen}
              className="hidden"
            />
          </div>
        </CardHeader>

        <CardContent>
          {uploadError && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {uploadError}
            </div>
          )}

          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
              {parentId === 0
                ? "No documents yet. Upload a file or create a folder to get started."
                : "This folder is empty."}
            </div>
          ) : (
            <div className="divide-y">
              {items.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onOpen={() => doc.isFolder && onNavigateToFolder(doc.id)}
                  onDownload={() => downloadMutation.mutate(doc.id)}
                  onDelete={() => {
                    const label = doc.isFolder
                      ? `the folder "${doc.documentName}" and everything inside it`
                      : `"${doc.documentName}"`
                    if (confirm(`Delete ${label}?`)) {
                      deleteMutation.mutate(doc.id)
                    }
                  }}
                  onMove={() => setMoveTarget(doc)}
                  isDownloading={
                    downloadMutation.isPending && downloadMutation.variables === doc.id
                  }
                  isDeleting={
                    deleteMutation.isPending && deleteMutation.variables === doc.id
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewFolderDialog
        open={showNewFolder}
        onOpenChange={setShowNewFolder}
        customerId={customerId}
        parentId={parentId}
      />

      <MoveDocumentDialog
        target={moveTarget}
        onOpenChange={(open) => !open && setMoveTarget(null)}
        customerId={customerId}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Breadcrumb
// ─────────────────────────────────────────────────────────

function DocumentBreadcrumb({
  breadcrumbs,
  onNavigate,
}: {
  breadcrumbs: { id: number; documentName: string }[]
  onNavigate: (id: number) => void
}) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 flex-wrap">
      <button
        type="button"
        onClick={() => onNavigate(0)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3 w-3" />
        Root
      </button>
      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1
        return (
          <Fragment key={crumb.id}>
            <ChevronRight className="h-3 w-3" />
            {isLast ? (
              <span className="text-foreground">{crumb.documentName}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(crumb.id)}
                className="hover:text-foreground transition-colors"
              >
                {crumb.documentName}
              </button>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Document row
// ─────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  onOpen,
  onDownload,
  onDelete,
  onMove,
  isDownloading,
  isDeleting,
}: {
  doc: DocumentItem
  onOpen: () => void
  onDownload: () => void
  onDelete: () => void
  onMove: () => void
  isDownloading: boolean
  isDeleting: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 px-1 hover:bg-accent/30 rounded-sm">
      <button
        type="button"
        onClick={doc.isFolder ? onOpen : undefined}
        disabled={!doc.isFolder}
        className="flex items-center gap-3 min-w-0 flex-1 text-left"
      >
        {doc.isFolder ? (
          <Folder className="h-4 w-4 text-blue-600 flex-shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <div className="min-w-0">
          <div className={`text-sm font-medium truncate ${doc.isFolder ? "hover:underline" : ""}`}>
            {doc.documentName}
          </div>
          <div className="text-xs text-muted-foreground">
            {doc.isFolder ? "Folder" : doc.contentType || "file"} ·{" "}
            {formatDateShort(doc.createdAt)}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button size="sm" variant="ghost" onClick={onMove} title="Move">
          <Move className="h-4 w-4" />
        </Button>
        {!doc.isFolder && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDownload}
            disabled={isDownloading}
            title="Download"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={isDeleting}
          title="Delete"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// New folder dialog
// ─────────────────────────────────────────────────────────

function NewFolderDialog({
  open,
  onOpenChange,
  customerId,
  parentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: number
  parentId: number
}) {
  const [folderName, setFolderName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      documentsApi.createFolder({
        customerId,
        parentId,
        folderName: folderName.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", customerId] })
      setFolderName("")
      setError(null)
      onOpenChange(false)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to create folder")
    },
  })

  return (
    <Dialog
      open={open}
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
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            Create a folder to organize documents. It will appear inside the current
            location.
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
                Creating…
              </>
            ) : (
              "Create folder"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────
// Move dialog
// ─────────────────────────────────────────────────────────

function MoveDocumentDialog({
  target,
  onOpenChange,
  customerId,
}: {
  target: DocumentItem | null
  onOpenChange: (open: boolean) => void
  customerId: number
}) {
  const [destination, setDestination] = useState<string>("0")
  const [error, setError] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ["folders", customerId],
    queryFn: () => documentsApi.listFolders(customerId),
    enabled: !!target,
  })

  const mutation = useMutation({
    mutationFn: () => documentsApi.move(target!.id, Number(destination)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", customerId] })
      queryClient.invalidateQueries({ queryKey: ["folders", customerId] })
      onOpenChange(false)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to move")
    },
  })

  // Build folder options with computed paths, excluding the target itself and its descendants
  const folderOptions = useMemo(() => {
    if (!data || !target) return []
    const folders = data.folders
    const byId = new Map(folders.map((f) => [f.id, f]))

    function getPath(f: FolderItem): string {
      const parts: string[] = [f.documentName]
      let current = f
      while (current.parentId > 0) {
        const parent = byId.get(current.parentId)
        if (!parent) break
        parts.unshift(parent.documentName)
        current = parent
      }
      return parts.join(" / ")
    }

    // Identify descendants of target (only relevant if target is a folder)
    const excluded = new Set<number>()
    if (target.isFolder) {
      excluded.add(target.id)
      let changed = true
      while (changed) {
        changed = false
        for (const f of folders) {
          if (excluded.has(f.parentId) && !excluded.has(f.id)) {
            excluded.add(f.id)
            changed = true
          }
        }
      }
    }

    return folders
      .filter((f) => !excluded.has(f.id))
      .map((f) => ({ id: f.id, path: getPath(f) }))
      .sort((a, b) => a.path.localeCompare(b.path))
  }, [data, target])

  if (!target) return null

  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => {
        if (!o) {
          setDestination("0")
          setError(null)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move "{target.documentName}"</DialogTitle>
          <DialogDescription>
            Choose a destination folder. The current location is excluded.
          </DialogDescription>
        </DialogHeader>

        <Select value={destination} onValueChange={setDestination}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">— Root —</SelectItem>
            {folderOptions.map((opt) => (
              <SelectItem key={opt.id} value={String(opt.id)}>
                {opt.path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
            disabled={mutation.isPending || Number(destination) === target.parentId}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Moving…
              </>
            ) : (
              "Move"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}