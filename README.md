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
- Conta na OpenAI (chave de API)

## Configuração

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

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `EVOLUTION_API_URL` | URL da sua instância da Evolution API (ex: `https://api.seudominio.com`) |
| `EVOLUTION_API_KEY` | Chave de autenticação da Evolution API |
| `EVOLUTION_INSTANCE` | Nome da instância conectada ao WhatsApp |
| `OPENAI_API_KEY` | Chave da OpenAI (reservada para expansões futuras) |
| `ASSESSOR_PHONE` | Número do assessor que recebe os leads (ex: `5511999999999`) |
| `ASSESSOR_NAME` | Nome do assessor exibido nas mensagens (ex: `João Silva`) |
| `PORT` | Porta do servidor (padrão: `3000`) |

## Rodando localmente

```bash
node server.js
```

## Deploy na Vercel

> **Atenção:** a Vercel é serverless — cada requisição inicia uma nova instância, então o estado em memória **não persiste** entre mensagens do mesmo lead. Para produção, substitua o objeto `conversations` por um banco de dados (Redis, Supabase, etc.).
>
> Para testes rápidos ou MVP, use **Railway** ou **Render** (sempre ativo).

Para fazer o deploy na Vercel:

1. Instale a CLI da Vercel:
   ```bash
   npm i -g vercel
   ```

2. Faça o deploy:
   ```bash
   vercel --prod
   ```

3. Configure as variáveis de ambiente no painel da Vercel:
   `Settings > Environment Variables`

## Configurando o Webhook na Evolution API

Após o deploy, configure o webhook na sua instância da Evolution API para apontar para:

```
POST https://seu-projeto.vercel.app/webhook
```

Evento a ativar: `messages.upsert`

## Fluxo de qualificação

| Estágio | Pergunta |
|---|---|
| NOME | Nome do lead |
| INTERESSE | Investir / Crédito / Consórcio / Organizar finanças |
| PATRIMÔNIO | Faixa de valor disponível para investir |
| SCORE | Score de crédito (para crédito/consórcio) |
| OBJETIVO | Objetivo financeiro principal |

**Lead qualificado:** patrimônio ≥ R$5k, OU score bom, OU qualquer interesse com objetivo definido.

**Lead não qualificado:** patrimônio < R$5k + score desconhecido + quer apenas organizar finanças.

## Notificação ao assessor

Quando um lead é qualificado, o assessor recebe via WhatsApp:

```
🔔 Novo lead qualificado

Nome: João Silva
WhatsApp: 5511999999999
Interesse: Quero investir meu dinheiro
Patrimônio disponível: Entre R$ 5.000 e R$ 50.000
Score: Bom (acima de 700)
Objetivo: Aposentadoria / independência financeira

Entrar em contato.
```
