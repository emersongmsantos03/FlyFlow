import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ currentUser: { uid: 'test-user', getIdToken: vi.fn().mockResolvedValue('test-token') } }))
vi.mock('./firebase', () => ({ firebaseAuth: auth, firebaseConfig: { projectId: 'test-project' } }))
import { domainMailRequest, MailServiceUnavailableError, saveDomainMail } from './domainMail'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('window', new EventTarget())
})
afterEach(() => vi.unstubAllGlobals())
describe('mail service availability', () => {
  it('explains a failed browser fetch without blaming SMTP credentials', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(domainMailRequest('/account')).rejects.toBeInstanceOf(MailServiceUnavailableError)
    await expect(domainMailRequest('/account')).rejects.toThrow('não indica senha inválida')
  })
  it.each([404, 503])('detects a missing or unavailable backend (%s)', async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response('<html>Unavailable</html>', { status }))
    await expect(domainMailRequest('/account')).rejects.toBeInstanceOf(MailServiceUnavailableError)
  })
  it('rejects HTML from a wrong API URL, even with a 200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('<html>Frontend</html>'))
    await expect(domainMailRequest('/account')).rejects.toBeInstanceOf(MailServiceUnavailableError)
  })
  it('keeps provider validation errors distinct from availability errors', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: 'Porta SMTP inválida.' }, { status: 400 }))
    await expect(domainMailRequest('/account', { method: 'POST' })).rejects.toThrow('Porta SMTP inválida.')
  })
  it('uses the saved account returned by POST instead of failing a second fetch', async () => {
    const saved = { connected: true, email: 'test@example.com' }
    vi.mocked(fetch).mockResolvedValue(Response.json(saved))
    expect(await saveDomainMail(saved)).toEqual(saved)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not suggest blindly retrying an email when send confirmation is lost', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(domainMailRequest('/send', { method: 'POST' })).rejects.toThrow('Confira a pasta Enviados')
  })
})
