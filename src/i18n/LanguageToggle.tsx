import { APP_LANG, setAppLang } from './lang'

// Bandeirinha que troca o FlyFlow entre português e inglês.
export function LanguageToggle({ className = 'app-header-icon' }: { className?: string }) {
  const toEnglish = APP_LANG !== 'en'
  return (
    <button
      className={`${className} language-toggle`}
      type="button"
      data-no-translate
      onClick={() => setAppLang(toEnglish ? 'en' : 'pt')}
      aria-label={toEnglish ? 'Switch to English' : 'Mudar para português'}
      title={toEnglish ? 'English' : 'Português'}
    >
      <span aria-hidden="true">{toEnglish ? '🇺🇸' : '🇧🇷'}</span>
      <small>{toEnglish ? 'EN' : 'PT'}</small>
    </button>
  )
}
