export const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export const numberFormatter = new Intl.NumberFormat('pt-BR')

export const percentFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
})

export const formatCurrency = (value: number) => currencyFormatter.format(value || 0)

export const formatNumber = (value: number) => numberFormatter.format(value || 0)

export const formatPercent = (value: number) => `${percentFormatter.format(value || 0)}%`

export const formatDate = (value?: string) => {
  if (!value) return '-'
  return dateFormatter.format(new Date(value))
}

export const formatDateTime = (value?: string) => {
  if (!value) return '-'
  return dateTimeFormatter.format(new Date(value))
}

export const daysUntil = (value?: string) => {
  if (!value) return 0
  const target = new Date(value)
  const today = new Date()
  target.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

export const formatDaysUntil = (value?: string) => {
  const days = daysUntil(value)
  if (days < 0) return `${Math.abs(days)} dia(s) atrasado`
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Amanhã'
  return `Em ${days} dias`
}

export const toDateInputValue = (value?: string) => {
  if (!value) return ''
  return value.slice(0, 10)
}

export const toDateTimeInputValue = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export const phoneLink = (phone: string) => `tel:${phone.replace(/\D/g, '')}`

export const whatsappLink = (phone: string) => {
  const normalized = phone.replace(/\D/g, '')
  return `https://wa.me/${normalized.startsWith('55') ? normalized : `55${normalized}`}`
}

export const mapsLink = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

export const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
