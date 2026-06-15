import { z } from "zod"

export const paginationSchema = z.object({
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  searchText: z.string().optional(),
})

export type PaginationInput = z.infer<typeof paginationSchema>

export function paginated<T>(items: T[], totalCount: number, input: PaginationInput) {
  return {
    items,
    pageNumber: input.pageNumber,
    pageSize: input.pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / input.pageSize),
  }
}

export function paginationOffset(input: PaginationInput) {
  return {
    limit: input.pageSize,
    offset: (input.pageNumber - 1) * input.pageSize,
  }
}