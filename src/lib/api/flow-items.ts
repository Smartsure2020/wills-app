import { api } from "../api"

export type FlowItem = {
  id: number
  name: string
  description: string
  sectionName: string
  sortOrder: number
  createdAt: string
}

export type CreateFlowItemInput = {
  name: string
  description: string
  sectionName: string
  sortOrder: number
}

export const flowItemsApi = {
  list: () => api.get<{ items: FlowItem[] }>("/flow-items"),

  create: (input: CreateFlowItemInput) =>
    api.post<{ id: number; name: string }>("/flow-items", input),

  update: (id: number, input: CreateFlowItemInput) =>
    api.post<{ ok: true }>(`/flow-items/${id}`, input),

  delete: (id: number) => api.delete<{ ok: true }>(`/flow-items/${id}`),
}