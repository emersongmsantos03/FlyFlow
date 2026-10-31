import { AlertTriangle, Briefcase, CalendarDays, FileText, Mail, MessageCircle, Pencil, Plus, Target, Wallet } from 'lucide-react'
import { Button, Modal, StatusBadge } from '../ui'
import { avatarTint, formatCurrency, formatDate, formatDateTime, initials, whatsappLink } from '../../lib/format'
import { getPaymentCashEffect } from '../../lib/financial'
import type { AppState, Client, Lead, Project } from '../../types'

/** Visão 360 do contato: tudo o que já aconteceu com ele, sem abrir cada módulo. */
export function ContactDetail({ client, state, onClose, onEdit, onCreateOpportunity, onCreateTask, onOpenLead, onOpenProject }: {
  client: Client
  state: AppState
  onClose: () => void
  onEdit: () => void
  onCreateOpportunity: () => void
  onCreateTask: () => void
  onOpenLead: (lead: Lead) => void
  onOpenProject: (project: Project) => void
}) {
  const name = client.fullName || client.companyName || 'Contato sem nome'
  const leads = state.leads.filter((lead) => lead.contactId === client.id && !lead.deletedAt)
  const leadIds = new Set(leads.map((lead) => lead.id))
  const projects = state.projects.filter((project) => !project.deletedAt && !project.archivedAt && (project.clientId === client.id || (project.leadId && leadIds.has(project.leadId))))
  const payments = state.payments.filter((payment) => !payment.deletedAt && !payment.archivedAt && (payment.clientId === client.id || (payment.leadId && leadIds.has(payment.leadId))))
  const tasks = state.tasks.filter((task) => !['Concluída', 'Cancelada'].includes(task.status) && (task.clientId === client.id || task.clientIds?.includes(client.id) || (task.leadId && leadIds.has(task.leadId))))
  const received = payments.filter((payment) => payment.status === 'Recebida').reduce((total, payment) => total + getPaymentCashEffect(payment), 0)
  const open = payments.filter((payment) => !['Recebida', 'Cancelada', 'Reembolsada'].includes(payment.status)).reduce((total, payment) => total + payment.amount, 0)
  const replied = leads.some((lead) => lead.emailEngagement === 'Respondeu')
  const clicked = leads.some((lead) => lead.emailEngagement === 'Clicou')
  const doNotContact = client.doNotContact || leads.some((lead) => lead.doNotContact)
  const timeline = [
    ...state.leadInteractions.filter((item) => leadIds.has(item.leadId)).map((item) => ({ id: item.id, at: item.interactionDate, title: item.interactionType, details: item.description })),
    ...state.statusHistory.filter((item) => item.entityType === 'Contato' && leadIds.has(item.entityId)).map((item) => ({ id: item.id, at: item.createdAt, title: item.action, details: item.details })),
  ].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 25)

  return (
    <Modal title="Contato" size="lg" onClose={onClose}>
      <div className="contact-detail">
        <header className="contact-detail__head">
          <span className="avatar-chip" data-tint={avatarTint(client.id)}>{initials(name)}</span>
          <div>
            <h2>{name}</h2>
            <p>{[client.jobTitle, client.companyName, client.city].filter(Boolean).join(' · ') || 'Sem detalhes'}</p>
            {replied || clicked || doNotContact ? <div className="contact-flags">
              {doNotContact ? <StatusBadge>Não contatar</StatusBadge> : null}
              {replied ? <span className="status-badge is-positive">Respondeu</span> : clicked ? <span className="status-badge is-warning">Clicou</span> : null}
            </div> : null}
          </div>
          <div className="contact-detail__actions">
            {client.whatsapp || client.phone ? <a className="app-button app-button-secondary" href={whatsappLink(client.whatsapp || client.phone)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a> : null}
            {client.email ? <a className="app-button app-button-secondary" href={`mailto:${client.email}`}><Mail size={15} /> E-mail</a> : null}
            <Button variant="secondary" type="button" onClick={onEdit}><Pencil size={15} /> Editar</Button>
          </div>
        </header>

        {replied && tasks.some((task) => task.priority === 'Urgente') ? <p className="inline-alert"><AlertTriangle size={15} /><span>Este contato respondeu à prospecção. Priorize o retorno.</span></p> : null}
        {doNotContact ? <p className="inline-alert is-danger"><AlertTriangle size={15} /><span>Pediu para não receber mais contatos. Não envie mensagens.</span></p> : null}

        <section className="stat-strip">
          <div><span>Recebido</span><strong>{formatCurrency(received)}</strong></div>
          <div><span>Em aberto</span><strong>{formatCurrency(open)}</strong></div>
          <div><span>Oportunidades</span><strong>{leads.length}</strong></div>
          <div><span>Projetos</span><strong>{projects.length}</strong></div>
        </section>

        <div className="contact-detail__columns">
          <div className="stack">
            <section className="detail-section">
              <header><h3><Target size={15} /> Oportunidades</h3><Button variant="ghost" type="button" onClick={onCreateOpportunity}><Plus size={14} /> Nova</Button></header>
              {leads.map((lead) => <button key={lead.id} className="detail-row" type="button" onClick={() => onOpenLead(lead)}><span>{lead.serviceInterest}<small>{formatCurrency(lead.estimatedValue)}</small></span><StatusBadge>{lead.pipelineStage}</StatusBadge></button>)}
              {!leads.length ? <p className="muted-note">Nenhuma oportunidade.</p> : null}
            </section>
            <section className="detail-section">
              <header><h3><Briefcase size={15} /> Projetos</h3></header>
              {projects.map((project) => <button key={project.id} className="detail-row" type="button" onClick={() => onOpenProject(project)}><span>{project.name}<small>{project.projectCode}</small></span><StatusBadge>{project.projectStatus}</StatusBadge></button>)}
              {!projects.length ? <p className="muted-note">Nenhum projeto.</p> : null}
            </section>
            <section className="detail-section">
              <header><h3><Wallet size={15} /> Financeiro</h3></header>
              {payments.slice(0, 8).map((payment) => <div key={payment.id} className="detail-row"><span>{payment.paymentType}<small>{formatCurrency(payment.amount)} · vence {formatDate(payment.dueDate)}</small></span><StatusBadge>{payment.status}</StatusBadge></div>)}
              {!payments.length ? <p className="muted-note">Nenhum lançamento.</p> : null}
            </section>
          </div>
          <div className="stack">
            <section className="detail-section">
              <header><h3><CalendarDays size={15} /> Tarefas abertas</h3><Button variant="ghost" type="button" onClick={onCreateTask}><Plus size={14} /> Nova</Button></header>
              {tasks.map((task) => <div key={task.id} className="detail-row"><span>{task.title}<small>{formatDateTime(task.dueAt)}</small></span><StatusBadge>{task.priority}</StatusBadge></div>)}
              {!tasks.length ? <p className="muted-note">Nada pendente.</p> : null}
            </section>
            <section className="detail-section">
              <header><h3><FileText size={15} /> Dados</h3></header>
              <dl className="detail-list">
                {[['E-mail', client.email], ['Telefone', client.phone], ['WhatsApp', client.whatsapp], ['Instagram', client.instagram], ['Documento', client.document], ['Endereço', [client.address, client.city].filter(Boolean).join(' · ')], ['Origem', client.source]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
              {client.notes ? <p className="detail-notes">{client.notes}</p> : null}
            </section>
            <section className="detail-section">
              <header><h3>Histórico</h3></header>
              <ol className="timeline">{timeline.map((item) => <li key={item.id}><strong>{item.title}</strong><small>{formatDateTime(item.at)}</small><p>{item.details}</p></li>)}</ol>
              {!timeline.length ? <p className="muted-note">Sem interações registradas.</p> : null}
            </section>
          </div>
        </div>
      </div>
    </Modal>
  )
}
