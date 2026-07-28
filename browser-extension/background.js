const allowedSite = 'https://flyflow-a97ab.web.app/'
const activeOutreach = new Set()
const OUTREACH_LEDGER_KEY = 'flyflowOutreachLedgerV1'
const DAY_MS = 24 * 60 * 60 * 1000
const DUPLICATE_WINDOW_MS = 30 * DAY_MS
const channelPolicy = {
  WhatsApp: { dailyLimit: 12, minimumDelayMs: 60_000, randomDelayMs: 60_000 },
  Instagram: { dailyLimit: 5, minimumDelayMs: 180_000, randomDelayMs: 120_000 },
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const getLedger = async () => {
  const stored = await chrome.storage.local.get(OUTREACH_LEDGER_KEY)
  const ledger = Array.isArray(stored[OUTREACH_LEDGER_KEY]) ? stored[OUTREACH_LEDGER_KEY] : []
  return ledger.filter((entry) => Date.now() - Number(entry.attemptedAt || 0) < DUPLICATE_WINDOW_MS)
}

const saveLedger = (ledger) => chrome.storage.local.set({ [OUTREACH_LEDGER_KEY]: ledger })

const reserveSafeOutreach = async ({ prospectId, channel, target }) => {
  const policy = channelPolicy[channel]
  const normalizedTarget = String(target || '').trim().toLowerCase()
  const lockKey = `${channel}:${prospectId || normalizedTarget}`
  if (!prospectId || !normalizedTarget) throw new Error('Lead ou destinatário inválido.')
  if (activeOutreach.has(lockKey)) {
    throw new Error('Este lead já está sendo processado. O segundo envio foi bloqueado.')
  }
  activeOutreach.add(lockKey)
  try {
    const ledger = await getLedger()
    const duplicate = ledger.find((entry) =>
      entry.channel === channel &&
      (entry.prospectId === prospectId || entry.target === normalizedTarget),
    )
    if (duplicate) {
      throw new Error('Envio duplicado bloqueado: este lead/destinatário já foi processado nos últimos 30 dias.')
    }
    const todayAttempts = ledger.filter((entry) =>
      entry.channel === channel && Date.now() - Number(entry.attemptedAt || 0) < DAY_MS,
    )
    if (todayAttempts.length >= policy.dailyLimit) {
      throw new Error(`Limite de segurança atingido: no máximo ${policy.dailyLimit} envios de ${channel} por 24 horas.`)
    }
    const lastAttempt = ledger
      .filter((entry) => entry.channel === channel)
      .sort((left, right) => Number(right.attemptedAt) - Number(left.attemptedAt))[0]
    const requiredDelay = policy.minimumDelayMs + Math.floor(Math.random() * policy.randomDelayMs)
    const elapsed = lastAttempt ? Date.now() - Number(lastAttempt.attemptedAt) : Number.POSITIVE_INFINITY
    const cooldown = Math.max(0, requiredDelay - elapsed)
    // Também evita uma ação instantânea na primeira mensagem da sessão.
    await wait(cooldown || 10_000 + Math.floor(Math.random() * 10_000))
    const reservation = {
      prospectId,
      channel,
      target: normalizedTarget,
      attemptedAt: Date.now(),
      status: 'attempted',
    }
    await saveLedger([...ledger, reservation])
    return { lockKey, reservation }
  } catch (error) {
    activeOutreach.delete(lockKey)
    throw error
  }
}

const confirmSafeOutreach = async (reservation) => {
  const ledger = await getLedger()
  await saveLedger(ledger.map((entry) =>
    entry.prospectId === reservation.prospectId &&
    entry.channel === reservation.channel &&
    entry.attemptedAt === reservation.attemptedAt
      ? { ...entry, status: 'sent', sentAt: Date.now() }
      : entry,
  ))
}

const deliverToWhatsApp = async (tabId, command) => {
  const startedAt = Date.now()
  let lastError = ''
  while (Date.now() - startedAt < 55_000) {
    try {
      const tab = await chrome.tabs.get(tabId)
      if (tab.status === 'complete' && tab.url?.startsWith('https://web.whatsapp.com/')) {
        const result = await chrome.tabs.sendMessage(tabId, command)
        if (result) return result
      }
    } catch (error) {
      lastError = error.message || String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 700))
  }
  throw new Error(lastError || 'O WhatsApp Web demorou demais para ficar pronto.')
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.tab?.url?.startsWith(allowedSite)) {
    sendResponse({ ok: false, error: 'Origem não autorizada.' })
    return false
  }
  if (message.type === 'PING') {
    sendResponse({
      ok: true,
      result: {
        installed: true,
        version: chrome.runtime.getManifest().version,
      },
    })
    return false
  }
  if (!['SEND_WHATSAPP', 'SEND_INSTAGRAM'].includes(message.type)) return false

  ;(async () => {
    let safetyReservation
    if (message.type === 'SEND_INSTAGRAM') {
      const profileUrl = String(message.payload?.profileUrl || '')
      const text = String(message.payload?.message || '').trim()
      if (!profileUrl.startsWith('https://www.instagram.com/') || !text) {
        throw new Error('Perfil ou mensagem do Instagram inválidos.')
      }
      safetyReservation = await reserveSafeOutreach({
        prospectId: String(message.payload?.prospectId || ''),
        channel: 'Instagram',
        target: profileUrl.replace(/\/+$/, ''),
      })
      const existing = await chrome.tabs.query({ url: 'https://www.instagram.com/*' })
      const existingIds = existing.map((item) => item.id).filter(Number.isInteger)
      if (existingIds.length) await chrome.tabs.remove(existingIds)
      const tab = await chrome.tabs.create({ url: profileUrl, active: true })
      try {
        const result = await deliverToInstagram(tab.id, { type: 'FLYFLOW_SEND_INSTAGRAM', text })
        if (!result?.ok) throw new Error(result?.error || 'O Instagram não confirmou o envio.')
        await confirmSafeOutreach(safetyReservation.reservation)
        await wait(25_000 + Math.floor(Math.random() * 20_000))
        return result
      } finally {
        activeOutreach.delete(safetyReservation.lockKey)
        await chrome.tabs.remove(tab.id).catch(() => undefined)
      }
    }

    const phone = String(message.payload?.phone || '').replace(/\D/g, '')
    const normalizedPhone = phone.startsWith('55') ? phone : `55${phone}`
    const text = String(message.payload?.message || '').trim()
    if (normalizedPhone.length < 12 || !text) throw new Error('Número ou mensagem inválidos.')
    safetyReservation = await reserveSafeOutreach({
      prospectId: String(message.payload?.prospectId || ''),
      channel: 'WhatsApp',
      target: normalizedPhone,
    })
    // A mensagem não vai na URL. Isso impede que o WhatsApp a preencha uma vez
    // e o script a insira novamente.
    const url = `https://web.whatsapp.com/send?phone=${normalizedPhone}`
    const existing = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' })
    const existingIds = existing.map((item) => item.id).filter(Number.isInteger)
    if (existingIds.length) await chrome.tabs.remove(existingIds)
    const tab = await chrome.tabs.create({ url, active: true })
    try {
      const result = await deliverToWhatsApp(tab.id, {
        type: 'FLYFLOW_SEND',
        phone: normalizedPhone,
        text,
      })
      if (!result?.ok) throw new Error(result?.error || 'O WhatsApp Web não confirmou o envio.')
      await confirmSafeOutreach(safetyReservation.reservation)
      await wait(20_000 + Math.floor(Math.random() * 20_000))
      return result
    } finally {
      activeOutreach.delete(safetyReservation.lockKey)
      await chrome.tabs.remove(tab.id).catch(() => undefined)
    }
  })().then(
    (result) => sendResponse({ ok: true, result }),
    (error) => sendResponse({ ok: false, error: error.message }),
  )
  return true
})

async function deliverToInstagram(tabId, command) {
  const startedAt = Date.now()
  let lastError = ''
  while (Date.now() - startedAt < 55_000) {
    try {
      const tab = await chrome.tabs.get(tabId)
      if (tab.status === 'complete' && tab.url?.startsWith('https://www.instagram.com/')) {
        const result = await chrome.tabs.sendMessage(tabId, command)
        if (result) return result
      }
    } catch (error) {
      lastError = error.message || String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 700))
  }
  throw new Error(lastError || 'O Instagram demorou demais para ficar pronto.')
}
