// Tradução da interface para inglês sem mexer nos componentes: troca os textos da tela
// pelo dicionário de en.ts e acompanha o que o React desenhar depois. Dados digitados
// pelo usuário (campos de texto, editores) nunca são alterados.
import { EN } from './en'

const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT'])
const done = new WeakMap<Node, string>()

const MONTHS: Record<string, string> = {
  janeiro: 'January', fevereiro: 'February', março: 'March', abril: 'April', maio: 'May', junho: 'June', julho: 'July',
  agosto: 'August', setembro: 'September', outubro: 'October', novembro: 'November', dezembro: 'December',
}

// Textos montados com números ou nomes: o pedaço fixo vem do dicionário.
const PATTERNS: Array<[RegExp, (...parts: string[]) => string]> = [
  [/^(\d[\d.,]*)\s+(.+)$/, (n, rest) => {
    const translated = translateText(rest)
    return translated ? `${n} ${translated}` : ''
  }],
  [/^(.+?):\s*(.*)$/, (label, value) => (EN[label] ? `${EN[label]}: ${translateText(value) ?? value}` : (EN[`${label}:`] ? `${EN[`${label}:`]} ${value}` : ''))],
  [/^(.+?)\s+\((\d[\d.,]*)\)$/, (label, n) => (EN[label] ? `${EN[label]} (${n})` : '')],
  [/^(.+?)\s+·\s+(.+)$/, (a, b) => {
    const left = translateText(a)
    const right = translateText(b)
    return left || right ? `${left ?? a} · ${right ?? b}` : ''
  }],
  [/^(\d{1,2}) de ([a-zç]+)(?: de (\d{4}))?$/i, (d, m, y) => (MONTHS[m.toLowerCase()] ? `${MONTHS[m.toLowerCase()]} ${d}${y ? ', ' + y : ''}` : '')],
]

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1)
const upperFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

export const translateText = (raw: string): string | null => {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text || !/[A-Za-zÀ-ú]/.test(text)) return null
  if (EN[text]) return EN[text]
  // Mesma frase com outra capitalização ou pontuação final.
  const cap = EN[upperFirst(text)]
  if (cap) return /^[a-zà-ú]/.test(text) ? lowerFirst(cap) : cap
  const trail = /^(.*?)([.:!?…]+)$/.exec(text)
  if (trail && EN[trail[1]]) return EN[trail[1]] + trail[2]
  for (const [pattern, build] of PATTERNS) {
    const match = pattern.exec(text)
    if (match) {
      const result = build(...match.slice(1))
      if (result) return result
    }
  }
  // Frases longas dentro de textos montados com nomes ou valores (ex.: "Fulano será removido de…").
  if (text.length > 24) {
    let result = text
    for (const key of longKeys()) {
      if (result.includes(key)) result = result.split(key).join(EN[key])
    }
    if (result !== text) return result
  }
  return null
}

let cachedLongKeys: string[] | null = null
const longKeys = () => {
  cachedLongKeys ??= Object.keys(EN).filter((key) => key.length >= 20).sort((a, b) => b.length - a.length)
  return cachedLongKeys
}

const translateTextNode = (node: Text) => {
  const current = node.nodeValue || ''
  if (done.get(node) === current) return
  const translated = translateText(current)
  if (translated) {
    const lead = /^\s*/.exec(current)?.[0] || ''
    const tail = /\s*$/.exec(current)?.[0] || ''
    const next = lead + translated + tail
    done.set(node, next)
    if (next !== current) node.nodeValue = next
  } else {
    done.set(node, current)
  }
}

const isUserContent = (element: Element) =>
  SKIP_TAGS.has(element.tagName) || (element as HTMLElement).isContentEditable || element.closest('[data-no-translate],[contenteditable="true"]') !== null

const translateElement = (element: Element) => {
  if (isUserContent(element)) return
  for (const attribute of ATTRIBUTES) {
    const value = element.getAttribute(attribute)
    if (!value) continue
    const translated = translateText(value)
    if (translated && translated !== value) element.setAttribute(attribute, translated)
  }
  if (element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type) && element.value) {
    const translated = translateText(element.value)
    if (translated) element.value = translated
  }
}

const walk = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) {
    const parent = root.parentElement
    if (parent && !isUserContent(parent)) translateTextNode(root as Text)
    return
  }
  if (!(root instanceof Element)) return
  if (isUserContent(root)) return
  translateElement(root)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node instanceof Element && isUserContent(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text)
    else translateElement(node as Element)
  }
}

export const startTranslator = () => {
  document.documentElement.lang = 'en'
  const translateTitle = () => {
    const translated = translateText(document.title)
    if (translated) document.title = translated
  }
  translateTitle()
  // Alertas e confirmações do navegador também passam pelo dicionário.
  const nativeAlert = window.alert.bind(window)
  const nativeConfirm = window.confirm.bind(window)
  window.alert = (message?: unknown) => nativeAlert(translateText(String(message ?? '')) ?? message)
  window.confirm = (message?: string) => nativeConfirm(translateText(String(message ?? '')) ?? message)

  walk(document.body)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') walk(mutation.target)
      else if (mutation.type === 'attributes') {
        if (mutation.target instanceof Element) translateElement(mutation.target)
      } else mutation.addedNodes.forEach(walk)
    }
    translateTitle()
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES] })
}
