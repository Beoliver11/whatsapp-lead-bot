# WhatsApp Lead Bot — Assessor de Investimentos

Bot de qualificação de leads via WhatsApp, usando **Evolution API** + **Node.js**.

## Como funciona

O bot conversa com o lead em etapas, coleta informações relevantes e, ao final, notifica o assessor com um resumo se o lead for qualificado.

```
Lead entra → Nome → Interesse → Patrimônio / Score → Objetivo → Notifica assessor
```

## Pré-requisitos

- Node.js 18+
- Instância da [Evolution API](https://github.com/EvolutionAPI/evolution-api) rodando e conectada ao WhatsApp

## Configuração local

1. Clone o repositório:
   ```bash
   git clone https://github.com/Beoliver11/whatsapp-lead-bot
   cd whatsapp-lead-bot
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Copie o arquivo de exemplo e preencha as variáveis:
   ```bash
   cp .env.example .env
   ```

4. Rode o servidor:
   ```bash
   node server.js
   ```

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `EVOLUTION_API_URL` | URL da instância da Evolution API (ex: `https://api.seudominio.com`) |
| `EVOLUTION_API_KEY` | Chave de autenticação da Evolution API |
| `EVOLUTION_INSTANCE` | Nome da instância conectada ao WhatsApp |
| `OPENAI_API_KEY` | Chave da OpenAI (reservada para expansões futuras) |
| `ASSESSOR_PHONE` | Número do assessor que recebe os leads (ex: `5511999999999`) |
| `ASSESSOR_NAME` | Nome do assessor exibido nas mensagens (ex: `João Silva`) |
| `PORT` | Porta do servidor (padrão: `3000`) |

---

## Deploy no EasyPanel (Docker)

O projeto inclui um `Dockerfile` pronto para deploy.

### Passo a passo

1. No EasyPanel, crie um novo serviço do tipo **App**.
2. Conecte ao repositório GitHub `Beoliver11/whatsapp-lead-bot`.
3. O EasyPanel detecta o `Dockerfile` automaticamente.
4. Em **Environment Variables**, adicione todas as variáveis listadas acima.
5. Defina a porta exposta como `3000`.
6. Faça o deploy.

### Webhook

Após o deploy, configure o webhook na sua instância da Evolution API:

- **URL:** `https://seu-dominio.easypanel.host/webhook`
- **Evento:** `messages.upsert`

---

## Dashboard de leads

Acesse o dashboard em:

```
https://seu-dominio.easypanel.host/dashboard
```

Exibe todos os leads capturados com nome, WhatsApp, interesse, patrimônio, score, objetivo, status (qualificado / não qualificado) e horário. Atualiza automaticamente a cada 30 segundos.

> Os dados ficam em memória — reiniciar o container limpa os leads. Para persistência, conecte um banco de dados.

---

## Fluxo de qualificação

| Estágio | Pergunta |
|---|---|
| NOME | Nome do lead |
| INTERESSE | Investir / Crédito / Consórcio / Organizar finanças |
| PATRIMÔNIO | Faixa de valor disponível para investir |
| SCORE | Score de crédito (para crédito/consórcio) |
| OBJETIVO | Objetivo financeiro principal |

**Qualificado:** patrimônio >= R$5k, OU score bom, OU qualquer interesse com objetivo definido.

**Não qualificado:** patrimônio < R$5k + score desconhecido + quer apenas organizar finanças.

---

## Notificação ao assessor

Quando um lead é qualificado, o assessor recebe via WhatsApp:

```
Novo lead qualificado

Nome: João Silva
WhatsApp: 5511999999999
Interesse: Quero investir meu dinheiro
Patrimônio disponível: Entre R$ 5.000 e R$ 50.000
Score: Bom (acima de 700)
Objetivo: Aposentadoria / independência financeira

Entrar em contato.
```
