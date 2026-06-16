/**
 * Extract date of birth from a South African ID number.
 * Returns ISO 8601 date string (YYYY-MM-DD) or null if the ID is invalid.
 *
 * SA ID structure: YYMMDD-SSSS-C-A-Z (13 digits)
 * Year century: if YY <= current year's last 2 digits → 2000s; else 1900s.
 */
export function extractDateOfBirthFromSaId(idNumber: string): string | null {
  const clean = idNumber.replace(/\s/g, "")
  if (clean.length < 6) return null

  const yy = parseInt(clean.slice(0, 2), 10)
  const mm = parseInt(clean.slice(2, 4), 10)
  const dd = parseInt(clean.slice(4, 6), 10)

  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null
  if (mm < 1 || mm > 12) return null
  if (dd < 1 || dd > 31) return null

  const currentYY = new Date().getFullYear() % 100
  const century = yy <= currentYY ? 2000 : 1900
  const year = century + yy

  // Validate the constructed date is real (handles Feb 30 etc)
  const dateStr = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null
  if (date.getUTCDate() !== dd) return null // catches Feb 30 → Mar 2 rollover

  return dateStr
}