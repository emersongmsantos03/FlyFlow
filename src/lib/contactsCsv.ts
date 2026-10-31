import type { Client } from '../types'

const headers: Array<[keyof Client, string, string[]]> = [
  ['fullName', 'Nome', ['nome', 'name', 'contato', 'nome completo']],
  ['companyName', 'Empresa', ['empresa', 'company', 'razao social']],
  ['jobTitle', 'Cargo', ['cargo', 'funcao', 'job title']],
  ['email', 'E-mail', ['e-mail', 'email', 'mail']],
  ['phone', 'Telefone', ['telefone', 'phone', 'fone']],
  ['whatsapp', 'WhatsApp', ['whatsapp', 'celular', 'whats']],
  ['instagram', 'Instagram', ['instagram', 'insta']],
  ['city', 'Cidade', ['cidade', 'city']],
  ['address', 'Endereço', ['endereco', 'address']],
  ['document', 'Documento', ['documento', 'cpf', 'cnpj', 'cpf/cnpj']],
  ['notes', 'Observações', ['observacoes', 'notas', 'notes']],
]

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

// Planilhas abertas no Excel disparam fórmulas em células iniciadas por estes
// caracteres; o apóstrofo neutraliza sem esconder o conteúdo.
const safeCell = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)

export const contactsToCsv = (clients: Client[]) => {
  const lines = [
    headers.map(([, label]) => label).join(';'),
    ...clients.map((client) => headers.map(([key]) => `"${safeCell(String(client[key] ?? '')).replaceAll('"', '""')}"`).join(';')),
  ]
  return `﻿${lines.join('\n')}`
}

/** Divide o CSV respeitando aspas, inclusive quebras de linha dentro de uma célula. */
export const parseCsv = (content: string) => {
  const text = content.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
      else if (character === '"') quoted = false
      else cell += character
    } else if (character === '"') quoted = true
    else if (character === delimiter) { row.push(cell); cell = '' }
    else if (character === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += character
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row) }
  return rows.filter((items) => items.some((item) => item.trim()))
}

export type ImportedContact = Partial<Pick<Client, 'fullName' | 'companyName' | 'jobTitle' | 'email' | 'phone' | 'whatsapp' | 'instagram' | 'city' | 'address' | 'document' | 'notes'>>

export const importContactsFromCsv = (content: string, existing: Client[]) => {
  const [head, ...rows] = parseCsv(content)
  if (!head) return { contacts: [] as ImportedContact[], skipped: 0, unmapped: true }
  const columns = head.map((label) => headers.find(([, , aliases]) => aliases.includes(normalize(label)))?.[0])
  if (!columns.some(Boolean)) return { contacts: [] as ImportedContact[], skipped: 0, unmapped: true }

  const digits = (value = '') => value.replace(/\D/g, '')
  const emails = new Set(existing.map((client) => client.email.trim().toLowerCase()).filter(Boolean))
  const phones = new Set(existing.flatMap((client) => [digits(client.whatsapp), digits(client.phone)]).filter(Boolean))
  const contacts: ImportedContact[] = []
  let skipped = 0
  rows.forEach((cells) => {
    const contact: ImportedContact = {}
    columns.forEach((key, index) => {
      const value = cells[index]?.trim().replace(/^'(?=[=+\-@])/, '')
      if (key && value) (contact as Record<string, string>)[key] = value
    })
    const email = contact.email?.toLowerCase()
    const phone = digits(contact.whatsapp || contact.phone)
    const hasIdentity = contact.fullName || contact.companyName || email || phone
    if (!hasIdentity || (email && emails.has(email)) || (phone && phones.has(phone))) {
      skipped += 1
      return
    }
    if (email) emails.add(email)
    if (phone) phones.add(phone)
    contacts.push(contact)
  })
  return { contacts, skipped, unmapped: false }
}
