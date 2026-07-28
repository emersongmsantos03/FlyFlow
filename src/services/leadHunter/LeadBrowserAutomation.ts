export interface BrowserAutomationResult {
  ok: boolean
  error?: string
}

const request = <T>(type: string, payload?: unknown, timeoutMs = 45_000) =>
  new Promise<T>((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error('A extensão do bot não respondeu. Verifique se ela está instalada e ativa.'))
    }, timeoutMs)
    function onMessage(event: MessageEvent) {
      if (
        event.source !== window ||
        event.data?.source !== 'flyflow-browser-bot' ||
        event.data?.requestId !== requestId
      ) return
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      if (event.data.ok) resolve(event.data.result as T)
      else reject(new Error(event.data.error || 'A automação do navegador falhou.'))
    }
    window.addEventListener('message', onMessage)
    window.postMessage({ source: 'flyflow-lead-hunter', type, requestId, payload }, window.location.origin)
  })

export const isLeadBrowserAutomationAvailable = async () => {
  try {
    return Boolean((await request<{ installed: boolean; version?: string }>('PING', undefined, 1_500)).installed)
  } catch {
    return false
  }
}

export const getLeadBrowserAutomationVersion = async () => {
  try {
    const result = await request<{ installed: boolean; version?: string }>('PING', undefined, 1_500)
    return result.installed ? result.version || '1.0.2 ou anterior' : ''
  } catch {
    return ''
  }
}

export const sendWhatsAppWithBrowserAutomation = async (input: {
  prospectId: string
  phone: string
  message: string
}) => request<BrowserAutomationResult>('SEND_WHATSAPP', input, 360_000)

export const sendInstagramWithBrowserAutomation = async (input: {
  prospectId: string
  profileUrl: string
  message: string
}) => request<BrowserAutomationResult>('SEND_INSTAGRAM', input, 360_000)
