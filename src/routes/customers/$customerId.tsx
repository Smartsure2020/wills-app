import { useRef, useState, type ChangeEvent } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  IdCard,
  Upload,
  FileText,
  Trash2,
  Download,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { customersApi, type CustomerDetail } from "@/lib/api/customers"
import { documentsApi, uploadDocument, type DocumentItem } from "@/lib/api/documents"
import { queryClient } from "@/lib/providers"
import { formatDate, formatDateShort, formatMoney } from "@/lib/format"

export const Route = createFileRoute("/customers/$customerId")({
  component: CustomerProfilePage,
})

function CustomerProfilePage() {
  const { customerId } = Route.useParams()
  const id = Number(customerId)

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customersApi.get(id),
    enabled: Number.isFinite(id),
  })

  if (isLoading) return <CustomerProfileSkeleton />

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load customer: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="text-muted-foreground">Customer not found.</div>
      </div>
    )
  }

  return <CustomerProfile customer={data} />
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3">
      <Link to="/customers">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to customers
      </Link>
    </Button>
  )
}

function CustomerProfile({ customer }: { customer: CustomerDetail }) {
  const fullName = `${customer.firstName} ${customer.lastName}`

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {customer.title && `${customer.title} `}
              {fullName}
            </h1>
            {customer.isSmoker && <Badge variant="secondary">Smoker</Badge>}
            {customer.registeredDonor && (
              <Badge variant="secondary">Organ donor</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <IdCard className="h-3.5 w-3.5" />
              {customer.idNumber}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Born {formatDate(customer.dateOfBirth)}
            </span>
          </div>
        </div>

        <Button variant="outline" disabled>
          Edit (coming soon)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {customer.email}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {customer.contactNumber || "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Broker</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="font-medium">{customer.brokerName?.trim() || "—"}</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              Assigned broker
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Country" value={customer.country} />
            <Field label="Marital status" value={customer.maritalStatus} />
            <Field label="Highest education" value={customer.highestEducation} />
            <Field label="Occupation" value={customer.occupation} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Monthly income" value={formatMoney(customer.monthlyIncome)} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Wishes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {customer.wish || "—"}
            <Separator className="my-3" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Registered donor" value={customer.registeredDonor ? "Yes" : "No"} />
              <Field label="Willing to donate" value={customer.willDonate ? "Yes" : "No"} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Relations ({customer.relations.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {customer.relations.length === 0 ? (
            <div className="text-sm text-muted-foreground p-6">
              No relations recorded.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Relation</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.relations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant="outline">{r.relationType || "Other"}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.title && `${r.title} `}
                      {r.firstName} {r.lastName}
                    </TableCell>
                    <TableCell>{r.email || "—"}</TableCell>
                    <TableCell>{r.contactNumber || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DocumentsCard customerId={customer.id} />

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Will workflow</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Flow checklist coming in Phase 4.
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-right">{value || "—"}</div>
    </div>
  )
}

function CustomerProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-10 w-96" />
      <div className="grid grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  )
}

function DocumentsCard({ customerId }: { customerId: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["documents", customerId],
    queryFn: () => documentsApi.list(customerId),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(customerId, file),
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

  function onFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          Documents ({items.length})
        </CardTitle>
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
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
      </CardHeader>

      <CardContent>
        {uploadError && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {uploadError}
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
            No documents yet. Upload one to get started.
          </div>
        ) : (
          <div className="divide-y">
            {items.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDownload={() => downloadMutation.mutate(doc.id)}
                onDelete={() => {
                  if (confirm(`Delete "${doc.documentName}"?`)) {
                    deleteMutation.mutate(doc.id)
                  }
                }}
                isDownloading={downloadMutation.isPending && downloadMutation.variables === doc.id}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === doc.id}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DocumentRow({
  doc,
  onDownload,
  onDelete,
  isDownloading,
  isDeleting,
}: {
  doc: DocumentItem
  onDownload: () => void
  onDelete: () => void
  isDownloading: boolean
  isDeleting: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 px-1">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{doc.documentName}</div>
          <div className="text-xs text-muted-foreground">
            {doc.contentType} · {formatDateShort(doc.createdAt)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={onDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={isDeleting}
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
