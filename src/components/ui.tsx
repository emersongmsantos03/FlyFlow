import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export const Button = ({
  children,
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}) => (
  <button
    className={clsx(
      'app-button focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.82rem] font-semibold transition',
      variant === 'primary' && 'app-button-primary bg-[#171717] text-white hover:bg-black',
      variant === 'secondary' && 'app-button-secondary border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
      variant === 'ghost' && 'app-button-ghost text-gray-700 hover:bg-gray-100',
      variant === 'danger' && 'app-button-danger bg-red-600 text-white hover:bg-red-700',
      className,
    )}
    {...props}
  >
    {children}
  </button>
)

const statusTone = (status: string) => {
  const value = status.toLowerCase()
  if (
    value.includes('pago') ||
    value.includes('paga') ||
    value.includes('recebida') ||
    value.includes('finalizado') ||
    value.includes('entregue') ||
    value.includes('convertido') ||
    value.includes('confirmado') ||
    value.includes('aprovado') ||
    value.includes('concluído')
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (
    value.includes('vencido') ||
    value.includes('vencida') ||
    value.includes('perdido') ||
    value.includes('perdida') ||
    value.includes('cancelado') ||
    value.includes('cancelada') ||
    value.includes('atrasado') ||
    value.includes('atrasada') ||
    value.includes('recusado') ||
    value.includes('recusada')
  ) {
    return 'border-red-200 bg-red-50 text-red-700'
  }
  if (
    value.includes('a pagar') ||
    value.includes('pendente') ||
    value.includes('aguardando') ||
    value.includes('negociação') ||
    value.includes('orçamento') ||
    value.includes('edição')
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  return 'border-gray-200 bg-gray-50 text-gray-700'
}

export const StatusBadge = ({ children }: { children: ReactNode }) => (
  <span
    className={clsx(
      'status-badge inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-bold',
      statusTone(String(children)),
    )}
  >
    {children}
  </span>
)

export const Tag = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
    {children}
  </span>
)

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
  <article className="metric-card glass-surface min-h-24 rounded-xl border border-gray-200 p-3.5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
        <div
          className={clsx(
            'mt-1.5 text-xl font-semibold tracking-normal',
            tone === 'positive' && 'text-emerald-700',
            tone === 'warning' && 'text-amber-700',
            tone === 'danger' && 'text-red-700',
            tone === 'neutral' && 'text-gray-950',
          )}
        >
          {value}
        </div>
      </div>
      <div
        className={clsx(
          'metric-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
          tone === 'positive' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
          tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700',
          tone === 'danger' && 'border-red-200 bg-red-50 text-red-700',
          tone === 'neutral' && 'border-gray-200 bg-gray-50 text-gray-700',
        )}
      >
        {icon}
      </div>
    </div>
    {detail ? <p className="mt-2 text-xs text-gray-500">{detail}</p> : null}
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
  <section id={id} className={clsx('panel-surface rounded-xl border border-gray-200 bg-white shadow-sm', className)}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
      <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
      {action}
    </div>
    <div className="p-3.5">{children}</div>
  </section>
)

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
}) => (
  <div className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-3">
    <div className={clsx(
      'modal-surface max-h-[calc(100vh-1.5rem)] w-full overflow-y-auto overflow-x-hidden rounded-t-2xl bg-white shadow-2xl sm:w-[calc(100vw-1.5rem)] sm:rounded-2xl',
      size === 'sm' && 'max-w-lg',
      size === 'md' && 'max-w-3xl',
      size === 'lg' && 'max-w-5xl',
      size === 'xl' && 'max-w-6xl',
    )}>
      <div className="modal-header sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <h2 className="text-base font-semibold tracking-tight text-gray-950 sm:text-lg">{title}</h2>
        <button
          aria-label="Fechar"
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100"
          type="button"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  </div>
)

export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) => (
  <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
    <h3 className="text-base font-semibold text-gray-950">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-gray-500">{description}</p>
    {action ? <div className="mt-4">{action}</div> : null}
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

export const Toast = ({ message }: { message: string }) => (
  <div className="fixed bottom-24 right-4 z-[60] max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 shadow-lg lg:bottom-6 lg:right-6">
    {message}
  </div>
)
