import { useEffect, useState } from 'react'
import { disconnectDomainMail, refreshDomainMail, saveDomainMail, type MailAccount } from '../services/domainMail'
import { Button, Panel } from './ui'

const empty: MailAccount = { connected: false, email: '', name: '', smtp: { host: '', port: 465, user: '', pass: '' }, imap: { host: '', port: 993, user: '', pass: '' } }
export function MailAccountSettings() {
  const [account, setAccount] = useState<MailAccount>(empty)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { let active = true; void refreshDomainMail().then((value) => { if (active && value.connected) setAccount(value) }).catch(() => { if (active) setMessage('Não foi possível consultar a conexão de e-mail. Entre novamente ou tente mais tarde.') }); return () => { active = false } }, [])
  const save = async () => {
    setBusy(true); setMessage('Testando SMTP e IMAP…')
    try { await saveDomainMail(account); setAccount(await refreshDomainMail()); setMessage('Conta conectada. O Inbox e o envio de propostas usarão este e-mail e a assinatura cadastrada.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a conta.') }
    finally { setBusy(false) }
  }
  const disconnect = async () => {
    setBusy(true)
    try { await disconnectDomainMail(); setAccount(empty); setMessage('Conta desconectada e credenciais removidas.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível desconectar.') }
    finally { setBusy(false) }
  }
  return <Panel title="E-mail com domínio próprio" id="settings-mail">
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Conecte SMTP para enviar e IMAP para receber. Quando conectada, esta conta será usada no Inbox e nas propostas. A agenda Google continua independente.</p>
      <label className="block text-sm">Endereço de e-mail<input className="field-input" type="email" autoComplete="email" disabled={busy} value={account.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} placeholder="contato@suaempresa.com.br" /></label>
      {(['smtp', 'imap'] as const).map((protocol) => <fieldset key={protocol} disabled={busy} className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-bold">{protocol === 'smtp' ? 'SMTP — envio' : 'IMAP — caixa de entrada'}</legend>
        <label className="text-sm">Servidor<input className="field-input" value={account[protocol]?.host || ''} onChange={(event) => setAccount({ ...account, [protocol]: { ...account[protocol], host: event.target.value } })} placeholder={`${protocol}.seuprovedor.com`} /></label>
        <label className="text-sm">Porta / segurança<select className="field-input" value={account[protocol]?.port || (protocol === 'smtp' ? 465 : 993)} onChange={(event) => setAccount({ ...account, [protocol]: { ...account[protocol], port: Number(event.target.value) } })}>{(protocol === 'smtp' ? [465, 587] : [993, 143]).map((port) => <option key={port} value={port}>{port} — {port === 465 || port === 993 ? 'TLS' : 'STARTTLS'}</option>)}</select></label>
        <label className="text-sm">Usuário<input className="field-input" autoComplete="username" value={account[protocol]?.user || ''} placeholder={account.email || 'Seu e-mail completo'} onChange={(event) => setAccount({ ...account, [protocol]: { ...account[protocol], user: event.target.value } })} /></label>
        <label className="text-sm">Senha<input className="field-input" type="password" autoComplete="new-password" value={account[protocol]?.pass || ''} placeholder={account.connected ? 'Vazio mantém a senha salva' : 'Senha do e-mail ou de aplicativo'} onChange={(event) => setAccount({ ...account, [protocol]: { ...account[protocol], pass: event.target.value } })} /></label>
      </fieldset>)}
      <p className="text-xs text-gray-500">Use os servidores informados pelo provedor. A conexão exige TLS. A senha fica restrita ao servidor e à sua conta FlyFlow.</p>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy || !account.email} onClick={() => void save()}>{busy ? 'Aguarde…' : 'Testar e salvar conexão'}</Button>{account.connected ? <Button type="button" variant="secondary" disabled={busy} onClick={() => void disconnect()}>Desconectar</Button> : null}</div>
      {message ? <p role="status" className="text-sm text-gray-500">{message}</p> : null}
    </div>
  </Panel>
}
