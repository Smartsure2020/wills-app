import { api } from "../api"

export type FlowControlItem = {
  id: number
  flowTypeId: number
  abbreviation: string
  description: string
  orderBy: number
}

export type FlowTypeLookup = {
  id: number
  description: string
}

export type CreateFlowControlItemInput = {
  flowTypeId: number
  abbreviation: string
  description: string
  orderBy: number
}

export const flowControlItemsApi = {
  list: () =>
    api.get<{ items: FlowControlItem[]; flowTypes: FlowTypeLookup[] }>(
      "/flow-control-items"
    ),

  create: (input: CreateFlowControlItemInput) =>
    api.post<{ id: number }>("/flow-control-items", input),

  update: (id: number, input: CreateFlowControlItemInput) =>
    api.post<{ ok: true }>(`/flow-control-items/${id}`, input),

  delete: (id: number) => api.delete<{ ok: true }>(`/flow-control-items/${id}`),
}