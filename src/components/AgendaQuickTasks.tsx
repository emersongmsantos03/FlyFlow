import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, CheckCircle2, Plus, X } from 'lucide-react'
import type { TaskItem } from '../types'
import './AgendaQuickTasks.css'

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function AgendaQuickTasks({ open, tasks, onClose, onCreate, onOpen, onToggle }: {
  open: boolean
  tasks: TaskItem[]
  onClose: () => void
  onCreate: (title: string, dueAt: string) => Promise<void>
  onOpen: (task: TaskItem) => void
  onToggle: (task: TaskItem) => void
}) {
  const [title, setTitle] = useState('')
  const [day, setDay] = useState<'today' | 'tomorrow'>('today')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) inputRef.current?.focus({ preventScroll: true }) }, [open])
  const today = dayKey(new Date())
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = dayKey(tomorrowDate)
  const pending = tasks.filter((task) => task.status !== 'Concluída' && task.status !== 'Cancelada').sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const completed = tasks.filter((task) => task.status === 'Concluída').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const groups = [
    { label: 'Atrasadas', items: pending.filter((task) => dayKey(new Date(task.dueAt)) < today), late: true },
    { label: 'Hoje', items: pending.filter((task) => dayKey(new Date(task.dueAt)) === today) },
    { label: 'Amanhã', items: pending.filter((task) => dayKey(new Date(task.dueAt)) === tomorrow) },
    { label: 'Próximas', items: pending.filter((task) => dayKey(new Date(task.dueAt)) > tomorrow) },
  ]
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true); setFeedback('')
    const due = new Date()
    if (day === 'tomorrow') due.setDate(due.getDate() + 1)
    // A task created late at night must stay on the selected day.
    if (day === 'tomorrow' || due.getHours() < 9) due.setHours(9, 0, 0, 0)
    else due.setSeconds(0, 0)
    try {
      await onCreate(title.trim(), `${dayKey(due)}T${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`)
      setTitle(''); setFeedback(`Tarefa adicionada para ${day === 'today' ? 'hoje' : 'amanhã'}.`)
      inputRef.current?.focus()
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.') }
    finally { setSaving(false) }
  }
  const row = (task: TaskItem) => <article key={task.id} className={task.status === 'Concluída' ? 'is-complete' : ''}>
    <button className="quick-task-check" type="button" aria-label={`${task.status === 'Concluída' ? 'Reabrir' : 'Concluir'} ${task.title}`} onClick={() => onToggle(task)}><Check size={14} /></button>
    <button className="quick-task-title" type="button" title="Abrir detalhes da tarefa" onClick={() => onOpen(task)}>{task.title}</button>
    <time dateTime={task.dueAt}>{new Date(task.dueAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</time>
  </article>
  return <section id="agenda-quick-tasks" className="agenda-quick-tasks" aria-label="Tarefas rápidas" hidden={!open} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header><div><CheckCircle2 size={20} /><span><h2>Tarefas rápidas <em>{pending.length}</em></h2><p>Organize os próximos passos do seu dia.</p></span></div><button type="button" aria-label="Recolher tarefas rápidas" onClick={onClose}><X size={18} /></button></header>
    <form onSubmit={(event) => void submit(event)}>
      <label className="quick-task-input"><Plus size={18} /><input ref={inputRef} aria-label="Nova tarefa rápida" placeholder="O que precisa ser feito?" maxLength={200} value={title} disabled={saving} onChange={(event) => setTitle(event.target.value)} /></label>
      <div className="quick-task-deadline" role="group" aria-label="Prazo da nova tarefa"><span>Prazo</span><button type="button" aria-pressed={day === 'today'} onClick={() => setDay('today')} disabled={saving}>Hoje</button><button type="button" aria-pressed={day === 'tomorrow'} onClick={() => setDay('tomorrow')} disabled={saving}>Amanhã</button></div>
      <button className="quick-task-add" type="submit" disabled={!title.trim() || saving}><Plus size={16} />{saving ? 'Salvando…' : 'Adicionar tarefa'}</button>
    </form>
    {feedback ? <p className="quick-task-feedback" role="status">{feedback}</p> : null}
    <div className="quick-task-groups">
      {groups.filter((group) => group.items.length).map((group) => <section key={group.label} className={group.late ? 'is-overdue' : ''}><h3>{group.label}<span>{group.items.length}</span></h3>{group.items.map(row)}</section>)}
      {!pending.length ? <p className="quick-task-empty"><CheckCircle2 size={20} /><span><strong>Nenhuma tarefa pendente</strong><small>Adicione uma tarefa e escolha quando fazer.</small></span></p> : null}
    </div>
    {completed.length ? <details className="quick-task-completed"><summary>Concluídas <span>{completed.length}</span></summary><div className="quick-task-groups">{completed.map(row)}</div></details> : null}
  </section>
}
