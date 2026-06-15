import type { Context } from "hono"

export type AppUser = {
  id: string
  accountTypeId: number
  email: string
  firstName: string
  lastName: string
  manageAll: boolean
  customerId: number | null
}

export type AppEnv = {
  Variables: {
    user: AppUser
  }
}

export type AppContext = Context<AppEnv>