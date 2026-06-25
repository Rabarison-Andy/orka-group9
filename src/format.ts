/** Formate un montant en euros (sans décimales), format français. */
export function formatEuros(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

/** Affiche une valeur de cellule, avec repli `—` si vide. */
export function display(value: string | number | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '—'
  return String(value)
}
