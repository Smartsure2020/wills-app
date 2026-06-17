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

export type Breadcrumb = {
  id: number
  parentId: number
  documentName: string
}

export type FolderItem = {
  id: number
  parentId: number
  documentName: string
}

export type CustomerFile = {
  id: number
  documentName: string
  contentType: string
  createdAt: string
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
  list: (customerId: number, parentId: number = 0) =>
    api.get<{ items: DocumentItem[]; breadcrumbs: Breadcrumb[] }>(
      `/documents?customerId=${customerId}&parentId=${parentId}`
    ),

  listFolders: (customerId: number) =>
    api.get<{ folders: FolderItem[] }>(`/documents/folders?customerId=${customerId}`),

  listAllFiles: (customerId: number) =>
    api.get<{ items: CustomerFile[] }>(`/documents/files?customerId=${customerId}`),

  createUploadUrl: (input: {
    customerId: number
    parentId: number
    documentName: string
    contentType: string
  }) => api.post<UploadUrlResponse>("/documents/upload-url", input),

  createFolder: (input: {
    customerId: number
    parentId: number
    folderName: string
  }) => api.post<{ id: number; parentId: number; documentName: string; isFolder: boolean }>("/documents/folder", input),

  move: (id: number, newParentId: number) =>
    api.post<{ ok: true }>(`/documents/${id}/move`, { newParentId }),

  getDownloadUrl: (id: number) =>
    api.get<DownloadUrlResponse>(`/documents/${id}/download-url`),

  delete: (id: number) => api.delete<{ ok: true }>(`/documents/${id}`),
}

export async function uploadDocument(
  customerId: number,
  parentId: number,
  file: File
): Promise<DocumentItem> {
  const init = await documentsApi.createUploadUrl({
    customerId,
    parentId,
    documentName: file.name,
    contentType: file.type || "application/octet-stream",
  })

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

  return {
    id: init.documentId,
    parentId,
    customerId,
    documentName: init.documentName,
    isFolder: false,
    contentType: file.type || "application/octet-stream",
    createdAt: new Date().toISOString(),
    createdBy: null,
  }
}
