import { api, type Paginated } from "../api"

export type MailRow = {
  id: number
  address: string
  subject: string
  body: string
  customerId: number | null
  createdAt: string
  sentAt: string | null
  attempts: number
  lastError: string | null
}

export type MailStatus = "all" | "pending" | "sent" | "failed"

export const mailOutboxApi = {
  list: (params: { status?: MailStatus; pageNumber?: number; pageSize?: number } = {}) => {
    const search = new URLSearchParams()
    if (params.status) search.set("status", params.status)
    if (params.pageNumber) search.set("pageNumber", String(params.pageNumber))
    if (params.pageSize) search.set("pageSize", String(params.pageSize))
    return api.get<Paginated<MailRow>>(`/mail-outbox?${search}`)
  },

  retry: (id: number) =>
    api.post<{ ok: true }>(`/mail-outbox/${id}/retry`),
}