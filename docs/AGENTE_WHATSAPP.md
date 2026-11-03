# Agente comercial da Hero Drone: passagem

Estado em 2 de novembro de 2026, às 23h30. Resumo do que foi construído para continuar o trabalho no projeto Hero Drone.

## Objetivo
Atender no WhatsApp da empresa como Emerson, de forma consultiva e natural, sem API oficial, usando Qwen 3 8b no PC próprio. O agente atualiza o CRM FlyFlow, transfere para o Emerson só quando precisa e envia avisos, relatórios e auditorias ao WhatsApp pessoal dele.

Funil desejado: empresa encontrada em dados públicos, e-mail com botão para o cadastro ou WhatsApp direto, lead no CRM, conversa, follow-up em 1 a 2 dias sem resposta e transferência no orçamento. Meta: 15 e-mails e 15 WhatsApps por dia, com fonte registrada, respeitando a LGPD. Quem disser que não tem interesse vira Perdido. O usuário dispensou aprovar a lista de empresas antes do envio.

## O que está no ar
| Fluxo no n8n | Função |
|---|---|
| Agente WhatsApp Hero Drone | Responde, grava no CRM, transfere e avisa |
| Primeiro contato do cadastro | Chama o lead em até 1 minuto, a qualquer hora |
| Follow-up sem resposta | Segunda a sábado, 9h às 18h, de 24 a 72 horas após o contato |
| Relatório diário | Todo dia às 18h30 |
| Envio de e-mail | SMTP direto pelo domínio, com link sem redirecionamento |
| Comandos do Emerson no chat | "Transferir para IA" e "Transferir para atendente" |
| Auditoria diária da IA | Todo dia às 21h30, com notícias às segundas |
| Aprovação de melhorias da IA | "Aprovar N" e "Recusar N" pelo WhatsApp pessoal |

Pilha: PC Windows com Ollama, Docker, n8n 2.45.7 e WAHA gows, mais FlyFlow em Cloudflare Worker com D1, Firebase Hosting e site na Vercel.

## Regras do agente
- Apresenta-se como Emerson e só diz que é IA se o cliente perguntar. Nunca nega ser IA.
- Responde a todas as perguntas da mensagem. Cada pergunta vira um item obrigatório da resposta.
- Vende de forma consultiva, sem prometer resultado, inventar preço, data ou garantia, nem citar estatísticas.
- Se não entender, pergunta uma vez ao cliente e só depois transfere.
- Transfere direto: preço insistente, negociação, data disponível, seguro, litoral, reclamação, cliente atual, pedido de falar com uma pessoa e dados completos de orçamento.
- Área de atendimento por regra: Curitiba, bairros e 29 municípios da Região Metropolitana. Litoral e cidade desconhecida vão para o Emerson.
- O nome vem só do CRM.
- Depois de uma transferência, fica em silêncio por 12 horas. Depois de resposta manual do Emerson, por 30 dias, salvo "Transferir para IA".
- Melhorias só entram com aprovação do Emerson pelo WhatsApp. Elas viram tarefas `[IA aprendizado]` no FlyFlow.
- Os fatos ficam em `ficha-produto.md`. O agente não busca na internet durante a conversa. A pesquisa entra como sugestão para aprovação.

## Mudanças no FlyFlow e no site
- Prazo padrão de 3 dias úteis, cadastro público em `POST /t/cadastro` e janela do contato no CRM corrigida.
- Lead existente recebe objetivo e cidade do cadastro mais recente, sem perder as anotações.
- Site com `privacidade.html`, `cadastro.html` e aviso de privacidade nos formulários.

## Resultados dos testes reais
- E-mail pelo domínio chegou com botão e sem alerta de redirecionamento.
- Cadastro, primeiro contato às 20:33, aviso, conversa e orçamento funcionaram com a contato de teste.
- Orçamento real: resposta em 80 segundos, aviso no WhatsApp pessoal e tarefa criada.
- "Transferir para IA" funcionou na conversa real.
- Três perguntas na mesma mensagem foram respondidas em conversa real, ainda antes da otimização de velocidade.

## Abertura
Às 9h de 3 de novembro de 2026 (12:00 UTC), a trava de números abre sozinha, por decisão do Emerson. Isso está na constante `ABERTO` dos geradores. A abertura só acontece com o PC ligado e o Windows aberto. Grupos seguem fora.

## Pendências, em ordem
1. Conferir o PC na manhã de 3 de novembro. A suspensão precisa estar em Nunca, e ela estava em 15 minutos na tomada. O reinício completo do PC ainda não foi testado.
2. Construir a prospecção de 15 e-mails e 15 WhatsApps: busca de empresas em dados públicos, fonte registrada, intervalos entre envios, horário comercial, descadastro e registro no CRM. Ela ainda não existe.
3. Decidir o Cloudflare Workers Paid. Foram 16 erros 1102 em 2 horas, porque cada consulta lê o CRM inteiro.
4. Testar "Transferir para atendente", "Aprovar N", follow-up real, relatório e nova auditoria.
5. Melhorar a auditoria. A primeira saiu fraca, e a correção de nota e transferências ainda não foi validada.
6. Passar o lead para a etapa de orçamento no CRM, porque hoje fica em Entrada.
7. Criar follow-up 24 horas após a proposta, retenção de dados de 12 e 24 meses e alerta de WhatsApp desconectado.
8. Responder ao que falta no questionário: serviços por prioridade, itens por serviço, quando o saldo é pago e licença de música.
9. Revisão jurídica e atualização do Plano de Voo, que ainda diz que o WhatsApp frio está desligado.

## Riscos conhecidos
- Sem API oficial, o número pode ser bloqueado, principalmente com contato frio.
- Modelo local erra e às vezes faz perguntas forçadas. As regras fixas protegem preço, área, nome e garantia.
- Com o PC desligado ou em suspensão, ninguém é atendido.

Os dados de acesso e o código do agente ficam fora deste repositório público.
