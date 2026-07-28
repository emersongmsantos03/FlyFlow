const waitFor = async (find, timeoutMs = 35_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const result = find()
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return null
}

const composerSelectors = [
  'footer [contenteditable="true"][role="textbox"]',
  '[contenteditable="true"][data-tab="10"]',
  '[contenteditable="true"][aria-placeholder*="mensagem" i]',
  '[contenteditable="true"][aria-placeholder*="message" i]'
]

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'FLYFLOW_SEND') return false
  ;(async () => {
    const composer = await waitFor(() =>
      composerSelectors.map((selector) => document.querySelector(selector)).find(Boolean),
    )
    if (!composer) throw new Error('A caixa de mensagem não apareceu. Confirme que o WhatsApp Web está conectado.')
    composer.focus()
    document.execCommand('selectAll', false)
    document.execCommand('delete', false)
    document.execCommand('insertText', false, message.text.trim())
    await new Promise((resolve) => setTimeout(resolve, 6_000 + Math.floor(Math.random() * 6_000)))
    const composedText = (composer.innerText || composer.textContent || '').trim()
    if (composedText !== message.text.trim()) {
      throw new Error('O texto no WhatsApp não corresponde à mensagem preparada. Envio cancelado para evitar duplicidade.')
    }
    const sendIcon = document.querySelector('[data-icon="send"]')
    const sendButton = sendIcon?.closest('button, [role="button"]')
    if (sendButton) {
      sendButton.click()
    } else {
      composer.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true,
      }))
      composer.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true,
      }))
    }
    const cleared = await waitFor(() => !(composer.innerText || composer.textContent || '').trim(), 8_000)
    if (!cleared) throw new Error('O WhatsApp Web não confirmou o envio. A mensagem foi mantida para revisão.')
    return { ok: true }
  })().then(
    (result) => sendResponse(result),
    (error) => sendResponse({ ok: false, error: error.message }),
  )
  return true
})
