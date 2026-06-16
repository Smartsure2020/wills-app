const moneyFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
})

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  year: "numeric",
  month: "long",
  day: "numeric",
})

const dateShortFormatter = new Intl.DateTimeFormat("en-ZA", {
  year: "numeric",
  month: "short",
  day: "numeric",
})

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (Number.isNaN(num)) return "—"
  return moneyFormatter.format(num)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  return dateFormatter.format(new Date(value))
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "—"
  return dateShortFormatter.format(new Date(value))
}

export function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No"
}