export function productName(p: unknown): string {
  if (Array.isArray(p)) return p[0]?.name ?? ''
  return (p as { name?: string } | null)?.name ?? ''
}