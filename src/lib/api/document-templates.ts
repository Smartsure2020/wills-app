import { api } from "../api"

export type DocumentTemplateItem = {
  id: number
  parentId: number
  documentName: string
  isFolder: boolean
  createdAt: string
}

export const documentTemplatesApi = {
  list: () => api.get<{ items: DocumentTemplateItem[] }>("/document-templates"),

  createFolder: (input: { parentId: number; folderName: string }) =>
    api.post<{
      id: number
      parentId: number
      documentName: string
      isFolder: boolean
    }>("/document-templates", input),

  delete: (id: number) => api.delete<{ ok: true }>(`/document-templates/${id}`),
}