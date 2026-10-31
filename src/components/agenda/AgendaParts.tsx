import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, ContactRound, ExternalLink, MapPin, MessageCircle, Pencil, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { capitalize, mapsLink, whatsappLink } from '../../lib/format'
import type { Appointment, TaskItem } from '../../types'

export type AnchorRect = Pick<DOMRect, 'top' | 'left' | 'right' | 'bottom'>

const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const weekdayInitials = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** Calendário pequeno da lateral: navega sozinho e só muda a data principal ao clicar num dia. */
export function MiniMonth({ selected, busyDays, onSelect }: { selected: Date; busyDays: Set<string>; onSelect: (date: Date) => void }) {
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1))
  useEffect(() => { setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1)) }, [selected])
  const start = new Date(month)
  start.setDate(1 - month.getDay())
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
  const today = keyOf(new Date())
  const selectedKey = keyOf(selected)
  return (
    <section className="gcal-mini" aria-label="Minicalendário">
      <header>
        <strong>{capitalize(month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</strong>
        <span>
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={15} /></button>
          <button type="button" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={15} /></button>
        </span>
      </header>
      <div className="gcal-mini__grid">
        {weekdayInitials.map((label, index) => <small key={index}>{label}</small>)}
        {days.map((day) => {
          const key = keyOf(day)
          return (
            <button
              key={key}
              type="button"
              aria-label={day.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
              className={[day.getMonth() !== month.getMonth() ? 'is-outside' : '', key === today ? 'is-today' : '', key === selectedKey ? 'is-selected' : ''].join(' ')}
              onClick={() => onSelect(day)}
            >
              {day.getDate()}{busyDays.has(key) ? <i /> : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Balão preso ao ponto clicado, como no Google Agenda; vira para o lado com mais espaço. */
function Popover({ anchor, width, onClose, children }: { anchor: AnchorRect; width: number; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 240
    const margin = 12
    const fitsRight = anchor.right + width + margin * 2 < window.innerWidth
    const left = fitsRight ? anchor.right + margin : Math.max(margin, anchor.left - width - margin)
    setPosition({ left, top: Math.max(margin, Math.min(anchor.top, window.innerHeight - height - margin)) })
  }, [anchor, width])

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return createPortal(<>
    <button className="gcal-popover-backdrop" type="button" tabIndex={-1} aria-label="Fechar" onClick={onClose} />
    <div ref={ref} className="gcal-popover" role="dialog" style={{ width, top: position?.top ?? anchor.top, left: position?.left ?? anchor.right, visibility: position ? 'visible' : 'hidden' }}>{children}</div>
  </>, document.body)
}

const formatSlot = (startAt: string, endAt: string) => {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const time = (date: Date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${capitalize(start.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))} · ${time(start)} – ${time(end)}`
}

export function QuickCreatePopover({ anchor, startAt, endAt, onClose, onSaveEvent, onSaveTask, onMoreOptions }: {
  anchor: AnchorRect
  startAt: string
  endAt: string
  onClose: () => void
  onSaveEvent: (title: string) => void
  onSaveTask: (title: string) => void
  onMoreOptions: (kind: 'event' | 'task', title: string) => void
}) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'event' | 'task'>('event')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    if (kind === 'event') onSaveEvent(title.trim())
    else onSaveTask(title.trim())
  }
  return (
    <Popover anchor={anchor} width={340} onClose={onClose}>
      <form className="gcal-quick" onSubmit={submit}>
        <div className="gcal-popover__bar"><button type="button" aria-label="Fechar" onClick={onClose}><X size={16} /></button></div>
        <input autoFocus aria-label="Título" placeholder="Adicionar título" value={title} onChange={(event) => setTitle(event.target.value)} />
        <div className="gcal-quick__kinds">
          <button className={kind === 'event' ? 'is-active' : ''} type="button" onClick={() => setKind('event')}>Evento</button>
          <button className={kind === 'task' ? 'is-active' : ''} type="button" onClick={() => setKind('task')}>Tarefa</button>
        </div>
        <p className="gcal-quick__when"><Clock size={15} /> {formatSlot(startAt, endAt)}</p>
        <footer>
          <button className="app-button app-button-ghost" type="button" onClick={() => onMoreOptions(kind, title.trim())}>Mais opções</button>
          <button className="app-button app-button-primary" disabled={!title.trim()} type="submit">Salvar</button>
        </footer>
      </form>
    </Popover>
  )
}

export function EventPeek({ anchor, appointment, task, contactName, whatsapp, onClose, onEdit, onToggleTask }: {
  anchor: AnchorRect
  appointment: Appointment
  task?: TaskItem
  contactName: string
  whatsapp: string
  onClose: () => void
  onEdit: () => void
  onToggleTask: (task: TaskItem) => void
}) {
  const completed = task?.status === 'Concluída'
  return (
    <Popover anchor={anchor} width={360} onClose={onClose}>
      <div className="gcal-peek">
        <div className="gcal-popover__bar">
          <button type="button" aria-label="Editar" onClick={onEdit}><Pencil size={15} /></button>
          <button type="button" aria-label="Fechar" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="gcal-peek__title">
          <i style={{ background: appointment.color || 'var(--series-1)' }} />
          <div>
            <h3 className={completed ? 'is-completed' : ''}>{appointment.title}</h3>
            <p>{formatSlot(appointment.startAt, appointment.endAt)}</p>
          </div>
        </div>
        <ul>
          <li><CalendarDays size={15} /> {appointment.appointmentType} · {appointment.status}</li>
          {contactName ? <li><ContactRound size={15} /> {contactName}</li> : null}
          {appointment.address ? <li><MapPin size={15} /> <a href={mapsLink(appointment.address)} target="_blank" rel="noreferrer">{appointment.address}</a></li> : null}
          {whatsapp ? <li><MessageCircle size={15} /> <a href={whatsappLink(whatsapp)} target="_blank" rel="noreferrer">Abrir WhatsApp</a></li> : null}
          {appointment.calendarUrl ? <li><ExternalLink size={15} /> <a href={appointment.calendarUrl} target="_blank" rel="noreferrer">Abrir no Google Calendar</a></li> : null}
        </ul>
        {appointment.notes ? <p className="gcal-peek__notes">{appointment.notes}</p> : null}
        {task ? <footer><button className="app-button app-button-secondary" type="button" onClick={() => { onToggleTask(task); onClose() }}><Check size={15} /> {completed ? 'Reabrir tarefa' : 'Marcar como concluída'}</button></footer> : null}
      </div>
    </Popover>
  )
}
