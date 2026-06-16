import { api } from "../api"

export type DocumentItem = {
  id: number
  parentId: number
  customerId: number
  documentName: string
  isFolder: boolean
  contentType: string
  createdAt: string
  createdBy: string | null
}

export type UploadUrlResponse = {
  documentId: number
  documentName: string
  path: string
  token: string
  signedUrl: string
}

export type DownloadUrlResponse = {
  signedUrl: string
  documentName: string
  contentType: string
}

export const documentsApi = {
  list: (customerId: number) =>
    api.get<{ items: DocumentItem[] }>(`/documents?customerId=${customerId}`),

  createUploadUrl: (input: {
    customerId: number
    documentName: string
    contentType: string
  }) => api.post<UploadUrlResponse>("/documents/upload-url", input),

  getDownloadUrl: (id: number) =>
    api.get<DownloadUrlResponse>(`/documents/${id}/download-url`),

  delete: (id: number) => api.delete<{ ok: true }>(`/documents/${id}`),
}

// ─────────────────────────────────────────────────────────
// Upload helper: orchestrates the two-step upload flow
// ─────────────────────────────────────────────────────────

export async function uploadDocument(customerId: number, file: File): Promise<DocumentItem> {
  // 1. Get signed upload URL
  const init = await documentsApi.createUploadUrl({
    customerId,
    documentName: file.name,
    contentType: file.type || "application/octet-stream",
  })

  // 2. PUT the file directly to Supabase Storage using the signed URL
  const uploadRes = await fetch(init.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  })

  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`)
  }

  // Return a shape matching DocumentItem so the UI can show it immediately
  return {
    id: init.documentId,
    parentId: 0,
    customerId,
    documentName: init.documentName,
    isFolder: false,
    contentType: file.type || "application/octet-stream",
    createdAt: new Date().toISOString(),
    createdBy: null,
  }
}