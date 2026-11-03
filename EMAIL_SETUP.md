# E-mail com domínio próprio

No Inbox, clique no cartão da conta (embaixo, à esquerda) → **Adicionar
contato@…**, ou vá em Configurações → E-mail com domínio próprio, e informe endereço, servidor,
porta, usuário e senha de SMTP e IMAP. O botão **Testar e salvar conexão**
verifica os dois serviços antes de persistir a conta. Não envia mensagem de teste.

- SMTP: 465 com TLS ou 587 com STARTTLS obrigatório.
- IMAP: 993 com TLS ou 143 com STARTTLS obrigatório.
- A conta pertence ao usuário autenticado e ao seu workspace.
- O Inbox mostra as duas caixas (Gmail e domínio). A troca fica no cartão da
  conta, embaixo da lista de pastas (no celular, nas abas do topo).
- Envios sem caixa escolhida (propostas, por exemplo) saem pelo domínio quando
  ele está conectado. Responder a partir de uma caixa usa essa mesma caixa.
- A integração do Google Calendar permanece independente.
- A assinatura de imagem configurada no FlyFlow é incluída no corpo MIME,
  junto com anexos como o PDF da proposta.
- Senhas não são devolvidas pela API, incluídas no estado do CRM nem guardadas
  no navegador. Ficam no KV do Worker (`mail:account:<workspace>`), cifradas com
  AES-GCM. A chave vem do secret `MAIL_ENCRYPTION_KEY` ou, sem ele, do secret
  `FIREBASE_SERVICE_ACCOUNT_JSON` que o Worker já tem. Trocar a chave exige
  conectar a conta de novo.
- Desconectar remove as credenciais. Deixar a senha vazia ao editar preserva a anterior.

## Publicação

O e-mail do domínio roda no Worker do Cloudflare (`worker/mail.ts`, rotas
`/mail/*`), com `cloudflare:sockets` para IMAP e SMTP. Depois do merge:

```sh
git pull
npx wrangler deploy
```

O frontend usa `${VITE_API_URL}/mail`. `VITE_MAIL_API_URL` ainda sobrescreve,
e sem nenhum dos dois cai na Cloud Function antiga `mailApi` (pasta `functions/`),
que não é mais necessária.

## Limites desta versão

O Inbox carrega as 30 mensagens mais recentes por caixa (24 KB de cada uma na
lista; a mensagem aberta é buscada de novo, até 256 KB). O corpo recebido é
convertido em texto, sem executar HTML remoto. Anexos recebidos devem ser abertos no webmail do provedor.
São aceitos envios de até 10 MB e 20 destinatários. A pasta Enviados é descoberta
pelo atributo IMAP `\\Sent`. Se o SMTP aceitar a mensagem e a cópia IMAP falhar,
o sistema informa que o e-mail foi enviado com um aviso, sem reenviá-lo.
Aceitação pelo SMTP não equivale à confirmação de entrega pelo destinatário.

Referências: [TCP sockets no Workers](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
e [postal-mime](https://github.com/postalsys/postal-mime).
