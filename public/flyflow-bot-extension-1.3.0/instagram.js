const waitForInstagram = async (find, timeoutMs = 35_000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const result = find()
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return null
}

const normalizedText = (element) => (element?.innerText || element?.textContent || '').trim().toLowerCase()

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'FLYFLOW_SEND_INSTAGRAM') return false
  ;(async () => {
    const messageButton = await waitForInstagram(() =>
      [...document.querySelectorAll('button, [role="button"], a')].find((element) =>
        /^(mensagem|message|enviar mensagem)$/.test(normalizedText(element)),
      ),
    )
    if (!messageButton) throw new Error('O botão de mensagem do Instagram não apareceu. Confirme que a conta está conectada.')
    messageButton.click()
    const composer = await waitForInstagram(() =>
      document.querySelector('textarea[placeholder*="mensagem" i], textarea[placeholder*="message" i], [contenteditable="true"][role="textbox"]'),
    )
    if (!composer) throw new Error('A conversa do Instagram não abriu.')
    composer.focus()
    if (composer instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(composer, '')
      composer.dispatchEvent(new Event('input', { bubbles: true }))
      setter?.call(composer, message.text.trim())
      composer.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      document.execCommand('selectAll', false)
      document.execCommand('delete', false)
      document.execCommand('insertText', false, message.text.trim())
    }
    await new Promise((resolve) => setTimeout(resolve, 8_000 + Math.floor(Math.random() * 7_000)))
    const composedText = String(
      composer instanceof HTMLTextAreaElement ? composer.value : composer.textContent,
    ).trim()
    if (composedText !== message.text.trim()) {
      throw new Error('O texto no Instagram não corresponde à mensagem preparada. Envio cancelado para evitar duplicidade.')
    }
    const sendButton = [...document.querySelectorAll('button, [role="button"]')].find((element) =>
      /^(enviar|send)$/.test(normalizedText(element)),
    )
    if (sendButton) sendButton.click()
    else composer.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true,
    }))
    const cleared = await waitForInstagram(() => {
      const value = composer instanceof HTMLTextAreaElement ? composer.value : composer.textContent
      return !String(value || '').trim()
    }, 8_000)
    if (!cleared) throw new Error('O Instagram não confirmou o envio.')
    return { ok: true }
  })().then(
    (result) => sendResponse(result),
    (error) => sendResponse({ ok: false, error: error.message }),
  )
  return true
})
