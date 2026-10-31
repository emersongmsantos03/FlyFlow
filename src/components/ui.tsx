import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Info, Loader2, Search, X, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { slugify } from '../lib/format'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export const Button = ({
  children,
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}) => (
  <button className={clsx('app-button', `app-button-${variant}`, className)} {...props}>
    {children}
  </button>
)

const statusTone = (status: string) => {
  const value = status.toLowerCase()
  if (/pago|paga|recebida|finalizado|entregue|convertid|confirmado|aprovad|concluíd|publicado|ativa$|ativo$/.test(value) && !/a pagar/.test(value)) return 'is-positive'
  if (/vencid|perdid|cancelad|atrasad|recusad|falhou|urgente|expirad/.test(value)) return 'is-danger'
  if (/a pagar|pendente|aguardando|negociação|orçamento|edição|alta|agendado|revisão|parcial/.test(value)) return 'is-warning'
  return 'is-neutral'
}

export const StatusBadge = ({ children }: { children: ReactNode }) => (
  <span className={clsx('status-badge', statusTone(String(children)))}>{children}</span>
)

export const Tag = ({ children }: { children: ReactNode }) => <span className="status-badge is-neutral">{children}</span>

export const MetricCard = ({
  label,
  value,
  detail,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  icon: ReactNode
  tone?: 'neutral' | 'positive' | 'warning' | 'danger'
}) => (
  <article className={clsx('metric-card', `is-${tone}`)}>
    <header><span>{label}</span>{icon}</header>
    <strong>{value}</strong>
    {detail ? <p>{detail}</p> : null}
  </article>
)

export const Panel = ({
  title,
  action,
  children,
  className,
  id,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) => (
  <section id={id} className={clsx('panel-surface', className)}>
    <header className="panel-header">
      <h2>{title}</h2>
      {action}
    </header>
    <div className="panel-body">{children}</div>
  </section>
)

export const PageToolbar = ({ title, description, action }: { title: string; description: string; action?: ReactNode }) => (
  <header className="page-toolbar">
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {action ? <div className="page-toolbar-actions">{action}</div> : null}
  </header>
)

const ModalFrame = ({ title, children, onClose, size }: { title: string; children: ReactNode; onClose: () => void; size: string }) => {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      // O dropdown e os diálogos sobrepostos tratam o próprio Esc.
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('.ff-select-panel')) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className={clsx('modal-surface', `is-${size}`)}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button aria-label="Fechar" className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export const Modal = ({
  title,
  children,
  onClose,
  size = 'xl',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) => createPortal(<ModalFrame title={title} size={size} onClose={onClose}>{children}</ModalFrame>, document.body)

export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) => (
  <div className="empty-state">
    <h3>{title}</h3>
    <p>{description}</p>
    {action ? <div>{action}</div> : null}
  </div>
)

export const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="field-error">{message}</p> : null

export const InputField = ({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) => (
  <label className="block">
    <span className="field-label">{label}</span>
    {children}
    <FieldError message={error} />
  </label>
)

export type FeedbackTone = 'success' | 'error' | 'warning' | 'info' | 'loading'

/**
 * Infers the tone of a feedback message from its text, so every existing
 * `setToast('…')` call gets the right color and icon without changes.
 * Order matters: "salvo, mas não foi possível…" is a partial success
 * (warning), not an error.
 */
const feedbackTone = (message: string): FeedbackTone => {
  const text = message.trim()
  if (/(…|\.\.\.)$/.test(text)) return 'loading'
  if (/,\s*mas\b|\breconecte\b|demorando|interrompid|ainda será|continuará/i.test(text)) return 'warning'
  if (/não foi possível|nao foi possivel|falha|erro|inválid|incorret|não pode|já existe|recusou|sem permissão|não tem permissão|não encontrad|muitas tentativas|inativo|nada foi/i.test(text)) return 'error'
  if (/^(selecione|informe|confirme|conclua|aprove|vincule|escolha|para parcelar|uma proposta sem)|precisa|expirou|ainda existe|não há|não possui|nenhum|já está|já enviadas|saldo disponível|aguarde/i.test(text)) return 'warning'
  if (/salv|criad|atualizad|excluíd|removid|enviad|conectad|copiad|adicionad|importad|exportad|concluíd|registrad|arquivad|aprovad|sucesso|baixad|realizad|efetuad|sincronizad|redefinid|cadastrad|limpo|pronto/i.test(text)) return 'success'
  return 'info'
}

const toneTitle: Record<FeedbackTone, string> = {
  success: 'Tudo certo',
  error: 'Não deu certo',
  warning: 'Atenção',
  info: 'Aviso',
  loading: 'Só um instante',
}

const ToneIcon = ({ tone, size = 20 }: { tone: FeedbackTone; size?: number }) => {
  if (tone === 'success') return <CheckCircle2 size={size} />
  if (tone === 'error') return <XCircle size={size} />
  if (tone === 'warning') return <AlertTriangle size={size} />
  if (tone === 'loading') return <Loader2 size={size} className="ff-spin" />
  return <Info size={size} />
}

/**
 * Pop-up de feedback no canto da tela. Fecha sozinho (pausa com o mouse em
 * cima), pode ser dispensado no X e mostra a barra de tempo restante.
 */
export const Toast = ({ message, onClose }: { message: string; onClose?: () => void }) => {
  const tone = feedbackTone(message)
  const duration = tone === 'loading' ? 15_000 : Math.min(9_000, 3_200 + message.length * 35)
  const [paused, setPaused] = useState(false)
  const remaining = useRef(duration)
  const startedAt = useRef(0)

  useEffect(() => {
    if (!onClose || paused) return
    startedAt.current = Date.now()
    const timeout = window.setTimeout(onClose, remaining.current)
    return () => {
      window.clearTimeout(timeout)
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current))
    }
  }, [onClose, paused])

  return createPortal(
    <div
      className={clsx('ff-toast', `is-${tone}`)}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="ff-toast-icon"><ToneIcon tone={tone} size={18} /></span>
      <div className="ff-toast-text">
        <strong>{toneTitle[tone]}</strong>
        <p>{message}</p>
      </div>
      {onClose ? <button className="ff-toast-close" type="button" aria-label="Fechar aviso" onClick={onClose}><X size={15} /></button> : null}
      {onClose ? <span className="ff-toast-timer" style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? 'paused' : 'running' }} /> : null}
    </div>,
    document.body,
  )
}

export type DialogTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

/**
 * Moldura única dos pop-ups de confirmação, aviso e entrada de texto.
 * Substitui os alert/confirm/prompt nativos do navegador.
 */
export const AppDialog = ({
  title,
  description,
  tone = 'info',
  children,
  actions,
  onClose,
  as = 'div',
  onSubmit,
  role = 'dialog',
}: {
  title: string
  description?: ReactNode
  tone?: DialogTone
  children?: ReactNode
  actions: ReactNode
  onClose: () => void
  as?: 'div' | 'form'
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
  role?: 'dialog' | 'alertdialog'
}) => {
  const titleId = useId()
  const surfaceRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  useLayoutEffect(() => { closeRef.current = onClose })

  // Roda só ao abrir: foca o campo/botão principal, prende o Tab no pop-up e devolve o foco ao fechar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const surface = surfaceRef.current
    // Em ações destrutivas o foco vai para "Cancelar", para um Enter distraído não apagar nada.
    const preferred = surface?.querySelector<HTMLElement>('[autofocus], input, textarea')
      ?? surface?.querySelector<HTMLElement>(tone === 'danger' ? '.ff-dialog-actions .app-button-secondary' : '.ff-dialog-actions .app-button-primary')
    preferred?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !surface) return
      const focusable = [...surface.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    // Captura para tratar o Esc antes do modal que estiver por baixo.
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      previous?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir
  }, [])

  const iconTone: FeedbackTone = tone === 'danger' ? 'error' : tone === 'neutral' ? 'info' : tone
  const surfaceProps = {
    className: clsx('ff-dialog', `is-${tone}`),
    role,
    'aria-modal': true,
    'aria-labelledby': titleId,
  } as const
  const content = <>
    <button className="ff-dialog-close" type="button" aria-label="Fechar" onClick={onClose}><X size={16} /></button>
    <div className="ff-dialog-head">
      <span className="ff-dialog-icon"><ToneIcon tone={iconTone} size={22} /></span>
      <div className="min-w-0">
        <h2 id={titleId}>{title}</h2>
        {description ? <div className="ff-dialog-description">{description}</div> : null}
      </div>
    </div>
    {children ? <div className="ff-dialog-body">{children}</div> : null}
    <div className="ff-dialog-actions">{actions}</div>
  </>
  return createPortal(
    <div className="ff-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      {as === 'form'
        ? <form ref={surfaceRef as React.RefObject<HTMLFormElement>} {...surfaceProps} onSubmit={onSubmit}>{content}</form>
        : <div ref={surfaceRef as React.RefObject<HTMLDivElement>} {...surfaceProps}>{content}</div>}
    </div>,
    document.body,
  )
}

/** Pop-up de confirmação pronto para uso local (substitui window.confirm). */
export const ConfirmPopup = ({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'warning',
  onCancel,
  onConfirm,
}: {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'warning' | 'danger' | 'info'
  onCancel: () => void
  onConfirm: () => void
}) => (
  <AppDialog
    role="alertdialog"
    title={title}
    description={description}
    tone={tone}
    onClose={onCancel}
    actions={<>
      <Button variant="secondary" type="button" onClick={onCancel}>{cancelLabel}</Button>
      <Button variant={tone === 'danger' ? 'danger' : 'primary'} type="button" onClick={onConfirm}>{confirmLabel}</Button>
    </>}
  />
)

/** Pop-up com um campo de texto (substitui window.prompt). */
export const PromptPopup = ({
  title,
  description,
  label,
  placeholder,
  initialValue = '',
  inputType = 'text',
  required = true,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'info',
  validate,
  onCancel,
  onSubmit,
}: {
  title: string
  description?: ReactNode
  label: string
  placeholder?: string
  initialValue?: string
  inputType?: 'text' | 'password' | 'url' | 'textarea'
  required?: boolean
  confirmLabel?: string
  cancelLabel?: string
  tone?: DialogTone
  /** Returns an error message, or '' when the value is acceptable. */
  validate?: (value: string) => string
  onCancel: () => void
  onSubmit: (value: string) => void
}) => {
  const [value, setValue] = useState(initialValue)
  const [touched, setTouched] = useState(false)
  const trimmed = value.trim()
  const error = trimmed && validate ? validate(trimmed) : ''
  const invalid = Boolean((required && !trimmed) || error)
  return (
    <AppDialog
      as="form"
      title={title}
      description={description}
      tone={tone}
      onClose={onCancel}
      onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); setTouched(true); if (!invalid) onSubmit(trimmed) }}
      actions={<>
        <Button variant="secondary" type="button" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} disabled={invalid} type="submit">{confirmLabel}</Button>
      </>}
    >
      <label className="block">
        <span className="field-label">{label}{required ? '' : ' (opcional)'}</span>
        {inputType === 'textarea'
          ? <textarea autoFocus className="field-input mt-1 min-h-28" placeholder={placeholder} value={value} onBlur={() => setTouched(true)} onChange={(event) => setValue(event.target.value)} />
          : <input autoFocus className="field-input mt-1" type={inputType} placeholder={placeholder} value={value} onBlur={() => setTouched(true)} onChange={(event) => setValue(event.target.value)} />}
      </label>
      {touched && error ? <p className="field-error">{error}</p> : null}
    </AppDialog>
  )
}

export type SelectOption = {
  value: string
  label: string
  description?: string
  /** Extra text matched by search but not shown (e.g. a company's legal name). */
  keywords?: string
  icon?: ReactNode
  group?: string
  disabled?: boolean
}

/**
 * Custom dropdown used everywhere a native <select> used to be. Controlled
 * via value/onChange so it composes with both plain state and RHF's
 * Controller. The option panel renders through a portal so it never gets
 * clipped by a scrolling modal, and search is opt-in (or automatic once the
 * option list is long enough that scanning it stops being convenient).
 */
export const Select = ({
  value,
  onChange,
  options,
  placeholder = 'Selecionar',
  clearable = false,
  searchable,
  searchPlaceholder = 'Buscar…',
  emptyMessage = 'Nenhum resultado encontrado.',
  disabled = false,
  size = 'md',
  className,
  triggerClassName,
  panelClassName,
  leadingIcon,
  name,
  ariaLabel,
  id,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  /** Injects a leading "clear" option (value '') labeled with `placeholder`. */
  clearable?: boolean
  /** Defaults to true once there are more than 8 options. */
  searchable?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
  /** Extra classes on the trigger button itself, e.g. a status color fill. */
  triggerClassName?: string
  panelClassName?: string
  /** Decorative icon shown at the start of the trigger, e.g. a field icon in a filter bar. */
  leadingIcon?: ReactNode
  name?: string
  ariaLabel?: string
  id?: string
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const [position, setPosition] = useState<{ left: number; width: number; top?: number; bottom?: number; openUp: boolean } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const allOptions = useMemo<SelectOption[]>(
    () => (clearable ? [{ value: '', label: placeholder }, ...options] : options),
    [clearable, options, placeholder],
  )
  const isSearchable = searchable ?? options.length > 8
  const selected = allOptions.find((option) => option.value === value)
  const filteredOptions = useMemo(() => {
    if (!isSearchable || !query.trim()) return allOptions
    const needle = slugify(query)
    return allOptions.filter((option) => slugify(`${option.label} ${option.keywords ?? ''}`).includes(needle))
  }, [allOptions, isSearchable, query])

  const updatePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const bounds = trigger.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - bounds.bottom
    const spaceAbove = bounds.top
    const openUp = spaceBelow < 280 && spaceAbove > spaceBelow
    setPosition({
      left: bounds.left,
      width: bounds.width,
      openUp,
      top: openUp ? undefined : bounds.bottom + 4,
      bottom: openUp ? viewportHeight - bounds.top + 4 : undefined,
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const handle = () => updatePosition()
    window.addEventListener('scroll', handle, true)
    window.addEventListener('resize', handle)
    return () => {
      window.removeEventListener('scroll', handle, true)
      window.removeEventListener('resize', handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    setQuery('')
    const initialIndex = allOptions.findIndex((option) => option.value === value)
    setHighlighted(Math.max(initialIndex, 0))
    const focusTarget = isSearchable ? searchRef.current : panelRef.current
    const timer = window.setTimeout(() => focusTarget?.focus(), 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    setHighlighted(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>(`[data-option-index="${highlighted}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, open])

  const commit = (option: SelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const moveHighlight = (direction: 1 | -1) => {
    setHighlighted((current) => {
      let next = current
      for (let step = 0; step < filteredOptions.length; step += 1) {
        next = (next + direction + filteredOptions.length) % filteredOptions.length
        if (!filteredOptions[next]?.disabled) return next
      }
      return current
    })
  }

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      setOpen(true)
    }
  }

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); moveHighlight(1); return }
    if (event.key === 'ArrowUp') { event.preventDefault(); moveHighlight(-1); return }
    if (event.key === 'Enter') { event.preventDefault(); const option = filteredOptions[highlighted]; if (option) commit(option); return }
    if (event.key === 'Tab') setOpen(false)
  }

  let lastGroup: string | undefined

  return (
    <div className={clsx('ff-select', className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        disabled={disabled}
        className={clsx('ff-select-trigger', size === 'sm' && 'is-sm', open && 'is-open', !selected && 'is-placeholder', triggerClassName)}
        onClick={() => !disabled && setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        {leadingIcon ? <span className="ff-select-trigger__leading-icon">{leadingIcon}</span> : null}
        <span className="ff-select-trigger__label">
          {selected?.icon}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} className="ff-select-trigger__chevron" />
      </button>
      {open && position ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          className={clsx('ff-select-panel', position.openUp && 'is-open-up', panelClassName)}
          style={{ position: 'fixed', top: position.top, bottom: position.bottom, left: position.left, width: Math.max(position.width, 200) }}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
        >
          {isSearchable ? (
            <div className="ff-select-search">
              <Search size={14} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
              {query ? <button type="button" aria-label="Limpar busca" onClick={() => setQuery('')}><X size={13} /></button> : null}
            </div>
          ) : null}
          <div className="ff-select-options">
            {filteredOptions.length ? filteredOptions.map((option, index) => {
              const showGroupLabel = Boolean(option.group) && option.group !== lastGroup
              lastGroup = option.group
              return (
                <div key={option.value || '__clear__'}>
                  {showGroupLabel ? <p className="ff-select-group-label">{option.group}</p> : null}
                  <button
                    type="button"
                    role="option"
                    data-option-index={index}
                    aria-selected={option.value === value}
                    disabled={option.disabled}
                    className={clsx(
                      'ff-select-option',
                      index === highlighted && 'is-highlighted',
                      option.value === value && 'is-selected',
                      !option.value && 'is-clear',
                    )}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => commit(option)}
                  >
                    {option.icon}
                    <span className="ff-select-option__body">
                      <span className="ff-select-option__label">{option.label}</span>
                      {option.description ? <span className="ff-select-option__description">{option.description}</span> : null}
                    </span>
                    {option.value === value ? <Check size={14} /> : null}
                  </button>
                </div>
              )
            }) : <p className="ff-select-empty">{emptyMessage}</p>}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
