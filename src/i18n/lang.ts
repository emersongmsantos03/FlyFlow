// Idioma da interface do FlyFlow. A escolha fica salva no navegador; trocar recarrega a página.
export type AppLang = 'pt' | 'en'

const KEY = 'flyflow-lang'

const readLang = (): AppLang => {
  try {
    if (typeof window === 'undefined') return 'pt'
    const fromUrl = new URLSearchParams(window.location.search).get('lang')
    if (fromUrl === 'en' || fromUrl === 'pt') window.localStorage.setItem(KEY, fromUrl)
    return window.localStorage.getItem(KEY) === 'en' ? 'en' : 'pt'
  } catch {
    return 'pt'
  }
}

export const APP_LANG: AppLang = readLang()
export const APP_LOCALE = APP_LANG === 'en' ? 'en-US' : 'pt-BR'

export const setAppLang = (lang: AppLang) => {
  try {
    window.localStorage.setItem(KEY, lang)
  } catch {
    // Sem armazenamento: a troca vale só para esta visita.
  }
  const url = new URL(window.location.href)
  url.searchParams.set('lang', lang)
  window.location.replace(url.toString())
}
