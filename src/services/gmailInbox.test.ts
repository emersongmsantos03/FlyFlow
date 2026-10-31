import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildEmailDocument, dayGroupLabel, formatFileSize, hasRemoteImages, initialsOf, notifiedMailIds, parseAddress, readMailIds, textToHtml } from './gmailInbox'

describe('apresentação do Inbox', () => {
  it('separa nome e e-mail do remetente', () => {
    expect(parseAddress('"Pousada Serra" <Contato@Pousada.com.br>')).toEqual({ email: 'contato@pousada.com.br', name: 'Pousada Serra' })
    expect(parseAddress('joao@empresa.com')).toEqual({ email: 'joao@empresa.com', name: 'joao' })
    expect(initialsOf('Maria Souza <m@x.com>')).toBe('MS')
  })

  it('agrupa por dia', () => {
    const now = new Date('2026-10-31T15:00:00')
    expect(dayGroupLabel('2026-10-31T09:00:00', now)).toBe('Hoje')
    expect(dayGroupLabel('2026-10-30T09:00:00', now)).toBe('Ontem')
    expect(dayGroupLabel('2026-10-27T09:00:00', now)).toBe('Esta semana')
    expect(dayGroupLabel('2026-09-02T09:00:00', now)).toBe('Setembro')
  })

  it('bloqueia scripts e imagens externas até liberar', () => {
    const html = '<p>Oi</p><script>alert(1)</script><img src="https://tracker.example/pixel.gif">'
    expect(hasRemoteImages(html)).toBe(true)
    const blocked = buildEmailDocument({ html, text: '' }, false)
    expect(blocked).not.toContain('<script>alert')
    expect(blocked).toContain("img-src data:;")
    expect(buildEmailDocument({ html, text: '' }, true)).toContain('img-src data: https: http:')
  })

  it('texto puro vira HTML seguro com links', () => {
    expect(textToHtml('<b>oi</b>\nveja https://herodrone.com.br')).toBe('&lt;b&gt;oi&lt;/b&gt;<br>veja <a href="https://herodrone.com.br">https://herodrone.com.br</a>')
    expect(formatFileSize(2_500_000)).toBe('2,4 MB')
  })
})

describe('estado local dos e-mails', () => {
  beforeEach(() => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) })
    vi.stubGlobal('window', new EventTarget())
  })

  it('lido e avisado são independentes e sobrevivem à releitura', () => {
    readMailIds.add(['a'])
    notifiedMailIds.add(['b'])
    expect(readMailIds.get().has('a')).toBe(true)
    expect(readMailIds.get().has('b')).toBe(false)
    expect(notifiedMailIds.get().has('b')).toBe(true)
  })

  it('avisa o restante do app quando muda', () => {
    const listener = vi.fn()
    window.addEventListener('flyflow-mail-state', listener)
    readMailIds.add(['c'])
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
