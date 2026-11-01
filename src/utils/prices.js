const integerFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

export function formatPriceInput(value) {
  const price = Number(value)
  return Number.isSafeInteger(price) && price > 0 ? integerFormatter.format(price) : ''
}

export function parsePriceInput(value) {
  const input = String(value).trim().replace(/^rp\s*/i, '').replace(/\s/g, '')
  if (!input) return null

  const digits = /^\d+$/.test(input)
    ? input
    : /^\d{1,3}(?:\.\d{3})+$/.test(input)
      ? input.replaceAll('.', '')
      : ''
  if (!digits) return null

  const price = Number(digits)
  return Number.isSafeInteger(price) && price > 0 ? price : null
}
