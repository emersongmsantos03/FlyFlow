import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import type { AppState, Quote } from '../types'
import { firebaseDb } from './firebase'

export interface PublicProposal {
  token: string
  quoteId: string
  quoteNumber: string
  title: string
  companyName: string
  customerName: string
  customerEmail: string
  issueDate: string
  expirationDate: string
  deliveryDeadline: string
  paymentTerms: string
  serviceLocation?: string
  notes: string
  subtotal: number
  discount: number
  travelFee: number
  urgencyFee: number
  totalValue: number
  depositValue: number
  status: string
  items: Array<{ description: string; quantity: number; unitPrice: number; totalPrice: number; pricingLabel?: 'Incluso' | 'Gratuito' }>
  viewedAt?: string
  acceptedAt?: string
  acceptedBy?: string
  acceptanceDocument?: string
}

const ensureDb = () => {
  if (!firebaseDb) throw new Error('Firebase indisponível.')
  return firebaseDb
}

export const createProposalToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const proposalUrl = (token: string) => `${window.location.origin}/?proposal=${encodeURIComponent(token)}`

export const publishProposal = async (state: AppState, quote: Quote, token: string) => {
  const lead = quote.leadId ? state.leads.find((item) => item.id === quote.leadId) : undefined
  const client = quote.clientId ? state.clients.find((item) => item.id === quote.clientId) : undefined
  const items = state.quoteItems.filter((item) => item.quoteId === quote.id)
  const payload: PublicProposal = {
    token,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    title: items[0]?.description || `Proposta ${quote.quoteNumber}`,
    companyName: state.companySettings.companyName || 'Hero Drone',
    customerName: client?.fullName || lead?.fullName || client?.companyName || lead?.companyName || 'Cliente',
    customerEmail: client?.email || lead?.email || '',
    issueDate: quote.issueDate,
    expirationDate: quote.expirationDate,
    deliveryDeadline: quote.deliveryDeadline,
    paymentTerms: quote.paymentTerms,
    serviceLocation: quote.serviceLocation,
    notes: quote.notes,
    subtotal: quote.subtotal,
    discount: quote.discount,
    travelFee: quote.travelFee,
    urgencyFee: quote.urgencyFee,
    totalValue: quote.totalValue,
    depositValue: quote.depositValue,
    status: quote.status === 'Rascunho' ? 'Gerada' : quote.status,
    items: items.map(({ description, quantity, unitPrice, totalPrice, pricingLabel }) => ({ description, quantity, unitPrice, totalPrice, pricingLabel })),
  }
  await setDoc(doc(ensureDb(), 'publicProposals', token), { ...payload, updatedAt: serverTimestamp() }, { merge: true })
  return proposalUrl(token)
}

export const loadPublicProposal = async (token: string) => {
  const snapshot = await getDoc(doc(ensureDb(), 'publicProposals', token))
  return snapshot.exists() ? snapshot.data() as PublicProposal : null
}

export const deletePublicProposal = async (token: string) => {
  if (!token) return
  await deleteDoc(doc(ensureDb(), 'publicProposals', token))
}

/** Stamps the moment a client first opens the public link — only advances
 * `Enviada` to `Visualizada`, never overrides a further-along status (e.g. a
 * proposal already negotiated or approved should not regress). */
export const markProposalViewed = async (token: string) => {
  const ref = doc(ensureDb(), 'publicProposals', token)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return
  const data = snapshot.data() as PublicProposal
  if (data.viewedAt || data.status !== 'Enviada') return
  await updateDoc(ref, { status: 'Visualizada', viewedAt: new Date().toISOString() })
}

export const acceptPublicProposal = async (token: string, acceptedBy: string, acceptanceDocument: string) => {
  const acceptedAt = new Date().toISOString()
  await updateDoc(doc(ensureDb(), 'publicProposals', token), {
    status: 'Aprovada',
    acceptedAt,
    acceptedBy: acceptedBy.trim(),
    acceptanceDocument: acceptanceDocument.trim(),
    acceptanceIpNotice: 'Aceite eletrônico registrado pelo navegador do cliente.',
  })
  return acceptedAt
}

export const reconcilePublicProposalAcceptances = async (state: AppState): Promise<AppState> => {
  const linked = state.quotes.filter((quote) => quote.publicToken && !quote.approvedAt)
  if (!linked.length) return state
  const resolved = await Promise.all(linked.map(async (quote) => ({
    quote,
    proposal: await loadPublicProposal(quote.publicToken || ''),
  })))
  const acceptedUpdates = new Map(resolved.filter(({ proposal }) => proposal?.status === 'Aprovada').map(({ quote, proposal }) => [quote.id, proposal!]))
  const viewedUpdates = new Map(
    resolved
      .filter(({ quote, proposal }) => proposal?.viewedAt && !quote.viewedAt && !acceptedUpdates.has(quote.id))
      .map(({ quote, proposal }) => [quote.id, proposal!]),
  )
  if (!acceptedUpdates.size && !viewedUpdates.size) return state
  return {
    ...state,
    quotes: state.quotes.map((quote) => {
      const acceptedProposal = acceptedUpdates.get(quote.id)
      if (acceptedProposal) {
        return {
          ...quote,
          status: 'Aprovada',
          approvedAt: acceptedProposal.acceptedAt || new Date().toISOString(),
          approvedBy: acceptedProposal.acceptedBy || 'Cliente',
          approvalDocument: acceptedProposal.acceptanceDocument,
          approvalMethod: 'Aceite eletrônico',
          updatedAt: acceptedProposal.acceptedAt || new Date().toISOString(),
        }
      }
      const viewedProposal = viewedUpdates.get(quote.id)
      if (viewedProposal) {
        return {
          ...quote,
          status: quote.status === 'Enviada' ? 'Visualizada' : quote.status,
          viewedAt: viewedProposal.viewedAt,
          updatedAt: viewedProposal.viewedAt || new Date().toISOString(),
        }
      }
      return quote
    }),
  }
}
