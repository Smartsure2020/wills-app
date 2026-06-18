import { api } from "../api"

export const CALCULATION_TYPE = {
  ASSET: 1,
  LIABILITY: 2,
  PROPERTY: 3,
} as const

export type CalculationType =
  (typeof CALCULATION_TYPE)[keyof typeof CALCULATION_TYPE]

export type CalculationItem = {
  id: number
  customerId: number
  calculationItemTypeId: CalculationType
  itemTypeName: string
  description: string
  value: string
}

export type CreateCalculationInput = {
  customerId: number
  calculationItemTypeId: CalculationType
  description: string
  value: number
}

export type UpdateCalculationInput = {
  description?: string
  value?: number
}

export const calculationsApi = {
  list: (customerId: number) =>
    api.get<{ items: CalculationItem[] }>(`/calculations?customerId=${customerId}`),

  create: (input: CreateCalculationInput) =>
    api.post<CalculationItem>("/calculations", input),

  update: (id: number, input: UpdateCalculationInput) =>
    api.post<{ ok: true }>(`/calculations/${id}`, input),

  delete: (id: number) =>
    api.delete<{ ok: true }>(`/calculations/${id}`),
}