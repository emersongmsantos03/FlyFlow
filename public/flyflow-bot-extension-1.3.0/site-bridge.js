window.addEventListener('message', (event) => {
  if (
    event.source !== window ||
    event.origin !== 'https://flyflow-a97ab.web.app' ||
    event.data?.source !== 'flyflow-lead-hunter'
  ) return
  const { type, requestId, payload } = event.data
  if (!['PING', 'SEND_WHATSAPP', 'SEND_INSTAGRAM'].includes(type) || typeof requestId !== 'string') return
  chrome.runtime.sendMessage({ type, requestId, payload }, (response) => {
    const error = chrome.runtime.lastError?.message
    window.postMessage({
      source: 'flyflow-browser-bot',
      requestId,
      ok: !error && response?.ok !== false,
      result: response?.result,
      error: error || response?.error,
    }, event.origin)
  })
})
