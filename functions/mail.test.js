import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), createTransport: vi.fn(), imap: vi.fn() }))
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }))
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }))
vi.mock('imapflow', () => ({ ImapFlow: class { constructor(options) { return mocks.imap(options) } } }))
import { validateAccount, publicAccount, verifyAccount, sendMail, listMail } from './mail.js'

const input = () => ({ email: 'contato@example.com', smtp: { host: 'smtp.example.com', port: 465, pass: 'secret' }, imap: { host: 'imap.example.com', port: 993, pass: 'secret' } })
const account = () => validateAccount(input())
const raw = Buffer.from('To: client@example.com\r\nSubject: Proposta\r\n\r\nOlá').toString('base64')
let client, transport
beforeEach(() => {
  vi.clearAllMocks()
  mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
  transport = { verify: vi.fn().mockResolvedValue(true), close: vi.fn(), sendMail: vi.fn().mockResolvedValue({ accepted: ['client@example.com'], rejected: [], messageId: 'sent-1' }) }
  client = { on: vi.fn(), connect: vi.fn(), close: vi.fn(), logout: vi.fn().mockResolvedValue(true), list: vi.fn().mockResolvedValue([{ path: 'Sent', specialUse: '\\Sent' }]), append: vi.fn(), getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }), mailbox: { exists: 0 } }
  mocks.createTransport.mockReturnValue(transport)
  mocks.imap.mockReturnValue(client)
})
describe('SMTP / IMAP account', () => {
  it('never returns passwords and preserves saved passwords on edit', () => {
    const saved = account()
    const updated = input(); updated.smtp.pass = ''; updated.imap.pass = ''
    expect(validateAccount(updated, saved).smtp.pass).toBe('secret')
    expect(JSON.stringify(publicAccount(saved))).not.toContain('secret')
    expect(publicAccount(saved).smtp).not.toHaveProperty('pass')
  })
  it('rejects unencrypted ports and invalid addresses', () => {
    expect(() => validateAccount({ ...input(), smtp: { ...input().smtp, port: 25 } })).toThrow()
    expect(() => validateAccount({ ...input(), email: 'a@example.com\r\nBcc: victim@example.com' })).toThrow()
  })
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1'])('rejects private SMTP / IMAP targets: %s', async (address) => {
    mocks.lookup.mockResolvedValue([{ address }])
    await expect(verifyAccount(account())).rejects.toThrow('público')
    expect(mocks.createTransport).not.toHaveBeenCalled()
  })
  it('pins public addresses and requires verified TLS without STARTTLS on 993', async () => {
    await verifyAccount(account())
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: '93.184.216.34', requireTLS: true, disableFileAccess: true, disableUrlAccess: true }))
    expect(mocks.imap).toHaveBeenCalledWith(expect.objectContaining({ host: '93.184.216.34', servername: 'imap.example.com', secure: true }))
    expect(mocks.imap.mock.calls[0][0]).not.toHaveProperty('doSTARTTLS')
    expect(client.logout).toHaveBeenCalled()
  })
  it('requires STARTTLS on IMAP 143', async () => {
    const value = account(); value.imap.port = 143
    await verifyAccount(value)
    expect(mocks.imap).toHaveBeenCalledWith(expect.objectContaining({ secure: false, doSTARTTLS: true }))
  })
  it('treats a failure to archive as sent, avoiding duplicate sends', async () => {
    client.append.mockRejectedValue(new Error('IMAP offline'))
    const result = await sendMail(account(), { to: ['client@example.com'], raw })
    expect(result.id).toBe('sent-1')
    expect(result.warning).toContain('enviado')
    expect(transport.sendMail).toHaveBeenCalledTimes(1)
    expect(transport.sendMail.mock.calls[0][0].raw.toString()).toMatch(/^From: contato@example.com\r\n/)
  })
  it('blocks sender spoofing and invalid recipients before opening a socket', async () => {
    await expect(sendMail(account(), { to: ['client@example.com'], raw: Buffer.from('From: fake@example.com\r\n\r\nbody').toString('base64') })).rejects.toThrow('remetente')
    await expect(sendMail(account(), { to: ['invalid'], raw })).rejects.toThrow('Destinatários')
    expect(mocks.lookup).not.toHaveBeenCalled()
  })
  it('returns an empty inbox without issuing an invalid IMAP range', async () => {
    expect(await listMail(account(), 'inbox')).toEqual([])
    expect(client.logout).toHaveBeenCalled()
  })
})
