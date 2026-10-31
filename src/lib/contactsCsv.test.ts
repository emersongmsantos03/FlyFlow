import { describe, expect, it } from 'vitest'
import { contactsToCsv, importContactsFromCsv, parseCsv } from './contactsCsv'
import type { Client } from '../types'

const client = (overrides: Partial<Client>): Client => ({
  id: 'c', fullName: 'Ana', companyName: '', document: '', phone: '', whatsapp: '', email: '', instagram: '', address: '', city: '',
  source: 'Site', notes: '', tags: [], archived: false, createdAt: '', updatedAt: '', ...overrides,
})

describe('CSV de contatos', () => {
  it('entende aspas, ponto e vírgula e quebra de linha na célula', () => {
    expect(parseCsv('Nome;Notas\n"Ana; Maria";"linha 1\nlinha 2"\n')).toEqual([['Nome', 'Notas'], ['Ana; Maria', 'linha 1\nlinha 2']])
  })

  it('aceita vírgula como separador e cabeçalho com acento ou sem', () => {
    const { contacts } = importContactsFromCsv('Nome,E-mail,Endereco\nAna,ana@x.com,Rua 1', [])
    expect(contacts).toEqual([{ fullName: 'Ana', email: 'ana@x.com', address: 'Rua 1' }])
  })

  it('ignora duplicados da base e do próprio arquivo', () => {
    const result = importContactsFromCsv('Nome;Email;WhatsApp\nAna;ana@x.com;\nBia;BIA@x.com;\nBia 2;bia@x.com;\nCaio;;(41) 99999-0000', [client({ email: 'ana@x.com', whatsapp: '41999990000' })])
    expect(result.contacts.map((item) => item.fullName)).toEqual(['Bia'])
    expect(result.skipped).toBe(3)
  })

  it('avisa quando nenhuma coluna é reconhecida', () => {
    expect(importContactsFromCsv('foo;bar\n1;2', []).unmapped).toBe(true)
  })

  it('exporta neutralizando fórmula e volta sem o apóstrofo', () => {
    const csv = contactsToCsv([client({ fullName: '=HYPERLINK("x")', email: 'a@b.com' })])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(importContactsFromCsv(csv, []).contacts[0].fullName).toBe('=HYPERLINK("x")')
  })
})
