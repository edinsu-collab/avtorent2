// Obračun dana: 1 dan = 24h, svaki započeti sat = novi dan
export function calculateDays(
  pickupDate: string, pickupTime: string,
  returnDate: string, returnTime: string
): number {
  if (!pickupDate || !returnDate) return 1

  const pickup = new Date(`${pickupDate}T${pickupTime || '10:00'}`)
  const returnD = new Date(`${returnDate}T${returnTime || '10:00'}`)

  const diffMs = returnD.getTime() - pickup.getTime()
  if (diffMs <= 0) return 1

  const fullDays = Math.floor(diffMs / 86400000)
  const remainingMs = diffMs % 86400000

  // Svaki započeti sat = novi dan
  return remainingMs > 0 ? fullDays + 1 : fullDays
}
