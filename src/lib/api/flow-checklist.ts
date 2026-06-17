import { api } from "../api"

export type FlowItemAttachment = {
  id: number
  documentId: number
  documentName: string
}

export type FlowChecklistItem = {
  id: number
  flowControlId: number
  flowControlItemId: number
  abbreviation: string
  description: string
  orderBy: number
  checkedDate: string | null
  checkedBy: string | null
  checkedByFirstName: string | null
  checkedByLastName: string | null
  applicable: boolean
  notes: string
  attachments: FlowItemAttachment[]
}

export type FlowChecklistGroup = {
  id: number
  flowTypeId: number
  flowTypeName: string
  completed: boolean
  createdAt: string
  items: FlowChecklistItem[]
}

export type FlowChecklistResponse = {
  flowControls: FlowChecklistGroup[]
}

export type UpdateChecklistItemInput = {
  checked?: boolean
  applicable?: boolean
  notes?: string
}

export const flowChecklistApi = {
  get: (customerId: number) =>
    api.get<FlowChecklistResponse>(`/flow-checklist?customerId=${customerId}`),

  updateItem: (id: number, input: UpdateChecklistItemInput) =>
    api.post<{ ok: true }>(`/flow-checklist/items/${id}`, input),

  attachDocument: (itemId: number, documentId: number) =>
    api.post<{ id: number }>(`/flow-checklist/items/${itemId}/documents`, {
      documentId,
    }),

  detachDocument: (itemId: number, documentId: number) =>
    api.delete<{ ok: true }>(
      `/flow-checklist/items/${itemId}/documents/${documentId}`
    ),
}