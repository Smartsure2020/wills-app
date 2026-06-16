import { api, type Paginated } from "../api"

export type CustomerListItem = {
  id: number
  countryId: number
  country: string | null
  maritalStatusId: number
  maritalStatus: string | null
  wishesId: number
  wish: string | null
  title: string
  email: string
  firstName: string
  lastName: string
  idNumber: string
  contactNumber: string
  occupation: string
  highestEducation: string
  monthlyIncome: string
  isSmoker: boolean
  registeredDonor: boolean
  willDonate: boolean
  dateOfBirth: string
  createdAt: string
  assignedTo: string
  brokerName: string
  createdBy: string
}

export type CustomerRelation = {
  id: number
  relationTypeId: number
  relationType: string | null
  title: string
  firstName: string
  lastName: string
  email: string
  contactNumber: string
}

export type CustomerDetail = CustomerListItem & {
  deletedAt: string | null
  relations: CustomerRelation[]
}

export type CustomerListParams = {
  pageNumber?: number
  pageSize?: number
  searchText?: string
  countryId?: number
  maritalStatusId?: number
  wishesId?: number
}

export type CreateCustomerRelation = {
  relationTypeId: number
  title: string
  firstName: string
  lastName: string
  email: string
  contactNumber: string
}

export type CreateCustomerInput = {
  assignedTo: string
  countryId: number
  maritalStatusId: number
  wishesId: number
  title: string
  email: string
  firstName: string
  lastName: string
  idNumber: string
  contactNumber: string
  occupation: string
  highestEducation: string
  monthlyIncome: number
  isSmoker: boolean
  registeredDonor: boolean
  willDonate: boolean
  dateOfBirth: string
  relations: CreateCustomerRelation[]
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

export const customersApi = {
  list: (params: CustomerListParams = {}) =>
    api.get<Paginated<CustomerListItem>>(`/customers${toQueryString(params)}`),

  get: (id: number) => api.get<CustomerDetail>(`/customers/${id}`),

  create: (input: CreateCustomerInput) =>
    api.post<{ id: number }>("/customers", input),

  assignBroker: (id: number, userId: string) =>
    api.post<{ ok: true }>(`/customers/${id}/assign-broker`, { userId }),
}