import { api, type Paginated } from "../api"

export type AccountListItem = {
  id: string
  accountTypeId: number
  accountType: string | null
  customerId: number | null
  firstName: string
  lastName: string
  email: string
  contactNumber: string
  manageAll: boolean
}

export type AccountListParams = {
  pageNumber?: number
  pageSize?: number
  searchText?: string
  accountTypeId?: number
}

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

export const accountsApi = {
  list: (params: AccountListParams = {}) =>
    api.get<Paginated<AccountListItem>>(`/accounts${toQueryString(params)}`),

  get: (id: string) => api.get<AccountListItem>(`/accounts/${id}`),
}