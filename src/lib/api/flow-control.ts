import { api } from "../api"

export const FLOW_STATES = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  AWAITING_CUSTOMER: 2,
  COMPLETED: 3,
  SKIPPED: 4,
} as const

export type FlowState = (typeof FLOW_STATES)[keyof typeof FLOW_STATES]

export const FLOW_STATE_LABELS: Record<FlowState, string> = {
  0: "Not started",
  1: "In progress",
  2: "Awaiting customer",
  3: "Completed",
  4: "Skipped",
}

export type FlowControlItem = {
  id: number
  flowItemId: number
  name: string
  description: string
  sectionName: string
  sortOrder: number
  state: FlowState
  notes: string
  completedAt: string | null
  completedByFirstName: string | null
  completedByLastName: string | null
}

export type FlowControlResponse = {
  flowControlId: number
  items: FlowControlItem[]
}

export const flowControlApi = {
  get: (customerId: number) =>
    api.get<FlowControlResponse>(`/flow-control?customerId=${customerId}`),

  updateItem: (id: number, input: { state: FlowState; notes?: string }) =>
    api.post<{ ok: true }>(`/flow-control/items/${id}`, input),
}