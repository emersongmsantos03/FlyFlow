import { describe, expect, it } from 'vitest'
import { applySiteLead, AWAITING_CONTACT_TAG, normalizeWhatsapp, parseSiteLead } from './siteLeads'

const now = '2026-11-02T12:00:00.000Z'
const ids = () => { let n = 0; return () => `id-${++n}` }
const valid = { nome: 'Ana', whatsapp: '(42) 98427-5772', autorizacao: true, cidade: 'Campo Largo', tipo: 'Chalé', objetivo: 'Airbnb' }

describe('cadastro do site', () => {
  it('normaliza telefones brasileiros', () => {
    expect(normalizeWhatsapp('(42) 98427-5772')).toBe('5542984275772')
    expect(normalizeWhatsapp('+55 41 98453-7827')).toBe('5541984537827')
    expect(normalizeWhatsapp('12345')).toBe('')
  })

  it('exige nome, WhatsApp e autorização', () => {
    expect(parseSiteLead(valid)?.whatsapp).toBe('5542984275772')
    expect(parseSiteLead({ ...valid, autorizacao: false })).toBeNull()
    expect(parseSiteLead({ ...valid, nome: '' })).toBeNull()
    expect(parseSiteLead({ ...valid, email: 'invalido' })).toBeNull()
  })

  it('cria lead aguardando o primeiro contato', () => {
    const { record, state } = applySiteLead({ leads: [] }, parseSiteLead(valid)!, now, ids())
    expect(record).toMatchObject({ source: 'Site', pipelineStage: 'Entrada', whatsappConsentAt: now })
    expect(record.tags).toContain(AWAITING_CONTACT_TAG)
    expect(state.leadInteractions).toHaveLength(1)
  })

  it('atualiza o lead existente sem duplicar, mesmo sem o nono dígito', () => {
    const leads = [{ id: 'a', fullName: 'Ana Antiga', whatsapp: '554284275772', tags: ['x'] }]
    const { record, state } = applySiteLead({ leads }, parseSiteLead(valid)!, now, ids())
    expect(record.id).toBe('a')
    expect(record.fullName).toBe('Ana Antiga')
    expect(state.leads).toHaveLength(1)
    expect(record.tags).toEqual(expect.arrayContaining(['x', AWAITING_CONTACT_TAG]))
  })

  it('usa o objetivo e a cidade do cadastro mais recente sem perder as anotações', () => {
    const leads = [{ id: 'a', whatsapp: '5542984275772', city: 'Curitiba', notes: 'Espaço: Casa · Objetivo: Vender\nCliente prefere manhã', tags: [] }]
    const { record } = applySiteLead({ leads }, parseSiteLead(valid)!, now, ids())
    expect(record.city).toBe('Campo Largo')
    expect(String(record.notes).match(/Objetivo: ([^·\n]+)/)?.[1].trim()).toBe('Airbnb')
    expect(record.notes).toContain('Cliente prefere manhã')
  })

  it('não repete as notas quando o mesmo cadastro chega de novo', () => {
    const first = applySiteLead({ leads: [{ id: 'a', whatsapp: '5542984275772', notes: 'Cliente prefere manhã', tags: [] }] }, parseSiteLead(valid)!, now, ids())
    const second = applySiteLead(first.state, parseSiteLead(valid)!, now, ids())
    expect(second.record.notes).toBe(first.record.notes)
  })

  it('não agenda contato para quem pediu para sair', () => {
    const leads = [{ id: 'a', whatsapp: '5542984275772', doNotContact: true, tags: [] }]
    expect(applySiteLead({ leads }, parseSiteLead(valid)!, now, ids()).record.tags).not.toContain(AWAITING_CONTACT_TAG)
  })
})
