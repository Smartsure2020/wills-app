const API_BASE = "/api"

// Stub auth identifier — pointed at the dev admin account.
// Will be replaced with a real Supabase JWT in a later phase.
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001"

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.status = status
    this.body = body
    this.name = "ApiError"
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Dev-User-Id": DEV_USER_ID,
      ...init?.headers,
    },
  })

  if (!res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = await res.text().catch(() => null)
    }
    const message =
      typeof body === "object" && body && "error" in body && typeof body.error === "string"
        ? body.error
        : `${res.status} ${res.statusText}`
    throw new ApiError(res.status, body, message)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}

// ─────────────────────────────────────────────────────────
// Typed response shapes (mirrors server returns)
// ─────────────────────────────────────────────────────────

export type LookupItem = {
  id: number
  description: string
}

export type Dropdowns = {
  accountTypes: LookupItem[]
  calculationItemTypes: LookupItem[]
  countries: LookupItem[]
  flowTypes: LookupItem[]
  maritalStatuses: LookupItem[]
  relationTypes: LookupItem[]
  wishes: LookupItem[]
}

export type CurrentUser = {
  id: string
  accountTypeId: number
  email: string
  firstName: string
  lastName: string
  manageAll: boolean
  customerId: number | null
}

export type Paginated<T> = {
  items: T[]
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
}