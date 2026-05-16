export function formatAmount(amount: number | string | undefined | null): string {
  if (amount === null || amount === undefined || amount === "") return "0"
  const numValue = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(numValue)) return "0"

  const absValue = Math.abs(numValue)
  const sign = numValue < 0 ? "-" : ""
  const formatted = absValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return sign + formatted
}

export function formatDate(dateStr: string): string {
  try {
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateStr.split("-").map(Number)
      const date = new Date(year, month - 1, day)
      if (isNaN(date.getTime())) return dateStr
      const dayStr = date.getDate().toString().padStart(2, "0")
      const monthStr = (date.getMonth() + 1).toString().padStart(2, "0")
      const yearStr = date.getFullYear()
      return `${dayStr}/${monthStr}/${yearStr}`
    }

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateStr
  }
}

export function getTodayLocalDate(): string {
  const today = new Date()
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
  return localDate.toISOString().split("T")[0]
}
