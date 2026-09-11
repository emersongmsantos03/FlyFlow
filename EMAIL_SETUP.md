# E-mail com domínio próprio

Em Configurações → E-mail com domínio próprio, informe endereço, servidor,
porta, usuário e senha de SMTP e IMAP. O botão **Testar e salvar conexão**
verifica os dois serviços antes de persistir a conta. Não envia mensagem de teste.

- SMTP: 465 com TLS ou 587 com STARTTLS obrigatório.
- IMAP: 993 com TLS ou 143 com STARTTLS obrigatório.
- A conta pertence ao usuário autenticado e ao seu workspace.
- Quando conectada, tem prioridade sobre Gmail no Inbox e nos envios.
- A integração do Google Calendar permanece independente.
- A assinatura de imagem configurada no FlyFlow é incluída no corpo MIME,
  junto com anexos como o PDF da proposta.
- Senhas não são devolvidas pela API, incluídas no estado do CRM nem guardadas
  no navegador. Ficam na coleção privada `privateMailAccounts`, acessível
  somente pelo backend Admin SDK e protegida pela criptografia em repouso do Firestore.
- Desconectar remove as credenciais. Deixar a senha vazia ao editar preserva a anterior.

## Publicação

O frontend publicado pelo GitHub Pages precisa também do backend Firebase
com Node.js 22 (mesma versão usada nos testes e no CI):

```sh
npm ci
npm --prefix functions ci
npm run test
npm run build
firebase login
firebase deploy --only functions:mailApi,firestore:rules,hosting
```

O projeto precisa permitir Cloud Functions e conexões SMTP de saída, e a conta
usada no CLI precisa ter permissão de publicação. A URL padrão da API é
`https://southamerica-east1-flyflow-a97ab.cloudfunctions.net/mailApi`.
Para outro backend, configure `VITE_MAIL_API_URL` no build.

## Limites desta versão

O Inbox carrega as 30 mensagens mais recentes por caixa. O corpo recebido é
convertido em texto, sem executar HTML remoto, e limitado aos primeiros 256 KB
da mensagem. Anexos recebidos devem ser abertos no webmail do provedor.
São aceitos envios de até 10 MB e 20 destinatários. A pasta Enviados é descoberta
pelo atributo IMAP `\\Sent`. Se o SMTP aceitar a mensagem e a cópia IMAP falhar,
o sistema informa que o e-mail foi enviado com um aviso, sem reenviá-lo.
Aceitação pelo SMTP não equivale à confirmação de entrega pelo destinatário.

Referências: [Nodemailer SMTP](https://nodemailer.com/smtp) e
[ImapFlow](https://imapflow.com/docs/api/imapflow-client/).
