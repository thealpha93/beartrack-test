export function formatDays(n) {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}
