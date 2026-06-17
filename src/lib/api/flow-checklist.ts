import { api } from "../api"

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
}

export const flowChecklistApi = {
  get: (customerId: number) =>
    api.get<FlowChecklistResponse>(`/flow-checklist?customerId=${customerId}`),

  updateItem: (id: number, input: UpdateChecklistItemInput) =>
    api.post<{ ok: true }>(`/flow-checklist/items/${id}`, input),
}