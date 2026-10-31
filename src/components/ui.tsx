import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
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

const isErrorMessage = (message: string) => /não foi possível|falha|erro|inválid|incorret|não pode|já existe|recusou|sem permissão/i.test(message)

export const Toast = ({ message }: { message: string }) => (
  <div className={clsx('app-toast', isErrorMessage(message) && 'is-error')} role="status">{message}</div>
)

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
