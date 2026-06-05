require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const LEADS_FILE = 'leads.json';

function loadLeads() {
  if (fs.existsSync(LEADS_FILE)) {
    try { return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')); }
    catch { return []; }
  }
  return [];
}

function saveLeads() {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

const app = express();
app.use(express.json());

const {
  EVOLUTION_API_URL,
  EVOLUTION_API_KEY,
  EVOLUTION_INSTANCE,
  ASSESSOR_PHONE,
  ASSESSOR_NAME = 'Assessor',
  PORT = 3000,
} = process.env;

// In-memory state: phone -> conversation state
const conversations = {};

let leads = loadLeads();

// Deduplication: messageId -> timestamp
const recentMessages = {};
const DEDUP_WINDOW_MS = 5000;

const STAGES = {
  WELCOME: 'WELCOME',
  NOME: 'NOME',
  INTERESSE: 'INTERESSE',
  PATRIMONIO: 'PATRIMONIO',
  SCORE: 'SCORE',
  OBJETIVO: 'OBJETIVO',
  AGENDAMENTO: 'AGENDAMENTO',
  ENCERRADO: 'ENCERRADO',
};

function initialState(phone) {
  return {
    stage: STAGES.NOME,
    nome: '',
    interesse: '',
    patrimonio: '',
    score: '',
    objetivo: '',
    phone,
  };
}

const INTERESSE_MAP = {
  '1': 'Quero investir meu dinheiro',
  '2': 'Preciso de crédito',
  '3': 'Tenho interesse em consórcio',
  '4': 'Quero organizar minha vida financeira',
};

const PATRIMONIO_MAP = {
  '1': 'Menos de R$ 5.000',
  '2': 'Entre R$ 5.000 e R$ 50.000',
  '3': 'Mais de R$ 50.000',
};

const SCORE_MAP = {
  '1': 'Bom (acima de 700)',
  '2': 'Regular (entre 400 e 700)',
  '3': 'Não sei / Prefiro não informar',
};

const OBJETIVO_MAP = {
  '1': 'Aposentadoria / independência financeira',
  '2': 'Compra de imóvel ou veículo',
  '3': 'Reserva de emergência',
  '4': 'Fazer meu dinheiro crescer',
};

function isQualified(state) {
  const notQualified =
    state.patrimonio === '1' && state.score === '3' && state.interesse === '4';
  return !notQualified;
}

async function sendMessage(to, text) {
  try {
    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      { number: to, text },
      { headers: { apikey: EVOLUTION_API_KEY } }
    );
  } catch (err) {
    console.error(`[sendMessage] Error sending to ${to}:`, err.response?.data ?? err.message);
  }
}

async function notifyAssessor(state) {
  if (!ASSESSOR_PHONE) return;
  const msg =
    `🔔 *Novo lead qualificado*\n\n` +
    `*Nome:* ${state.nome}\n` +
    `*WhatsApp:* ${state.phone}\n` +
    `*Interesse:* ${INTERESSE_MAP[state.interesse] || state.interesse}\n` +
    `*Patrimônio disponível:* ${PATRIMONIO_MAP[state.patrimonio] || state.patrimonio}\n` +
    `*Score:* ${SCORE_MAP[state.score] || state.score}\n` +
    `*Objetivo:* ${OBJETIVO_MAP[state.objetivo] || state.objetivo}\n\n` +
    `Entrar em contato.`;
  await sendMessage(ASSESSOR_PHONE, msg);
}

async function handleMessage(phone, text) {
  const input = text.trim();

  if (!conversations[phone]) {
    conversations[phone] = initialState(phone);
    await sendMessage(
      phone,
      `Olá! Sou a assistente virtual do ${ASSESSOR_NAME}, assessor de investimentos. ` +
        `Estou aqui para entender melhor o que você precisa e ver como podemos te ajudar. ` +
        `Para começar, qual é o seu nome?`
    );
    return;
  }

  const state = conversations[phone];

  if (state.stage === STAGES.ENCERRADO) return;

  switch (state.stage) {
    case STAGES.NOME: {
      state.nome = input;
      state.stage = STAGES.INTERESSE;
      await sendMessage(
        phone,
        `Prazer, ${state.nome}! Me conta, o que te trouxe aqui hoje? Responde com o número da opção:\n` +
          `1 - Quero investir meu dinheiro\n` +
          `2 - Preciso de crédito\n` +
          `3 - Tenho interesse em consórcio\n` +
          `4 - Quero organizar minha vida financeira`
      );
      break;
    }

    case STAGES.INTERESSE: {
      if (!['1', '2', '3', '4'].includes(input)) {
        await sendMessage(phone, 'Não entendi sua resposta. Pode responder com o número da opção?');
        return;
      }
      state.interesse = input;
      if (input === '1') {
        state.stage = STAGES.PATRIMONIO;
        await sendMessage(
          phone,
          `Ótimo! Para te indicar as melhores opções, qual é o valor aproximado que você tem disponível para investir?\n` +
            `1 - Menos de R$ 5.000\n` +
            `2 - Entre R$ 5.000 e R$ 50.000\n` +
            `3 - Mais de R$ 50.000`
        );
      } else if (input === '2' || input === '3') {
        state.stage = STAGES.SCORE;
        await sendMessage(
          phone,
          `Entendido! Para produtos de crédito e consórcio, o score de crédito é importante. Como você avaliaria o seu?\n` +
            `1 - Bom (acima de 700)\n` +
            `2 - Regular (entre 400 e 700)\n` +
            `3 - Não sei / Prefiro não informar`
        );
      } else {
        // interesse 4: pula direto para OBJETIVO
        state.score = '-';
        state.patrimonio = '-';
        state.stage = STAGES.OBJETIVO;
        await sendMessage(
          phone,
          `Quase lá! Qual é o seu principal objetivo financeiro agora?\n` +
            `1 - Aposentadoria / independência financeira\n` +
            `2 - Compra de imóvel ou veículo\n` +
            `3 - Reserva de emergência\n` +
            `4 - Fazer meu dinheiro crescer`
        );
      }
      break;
    }

    case STAGES.PATRIMONIO: {
      if (!['1', '2', '3'].includes(input)) {
        await sendMessage(phone, 'Não entendi sua resposta. Pode responder com o número da opção?');
        return;
      }
      state.patrimonio = input;
      state.stage = STAGES.OBJETIVO;
      await sendMessage(
        phone,
        `Quase lá! Qual é o seu principal objetivo financeiro agora?\n` +
          `1 - Aposentadoria / independência financeira\n` +
          `2 - Compra de imóvel ou veículo\n` +
          `3 - Reserva de emergência\n` +
          `4 - Fazer meu dinheiro crescer`
      );
      break;
    }

    case STAGES.SCORE: {
      if (!['1', '2', '3'].includes(input)) {
        await sendMessage(phone, 'Não entendi sua resposta. Pode responder com o número da opção?');
        return;
      }
      state.score = input;
      state.stage = STAGES.OBJETIVO;
      await sendMessage(
        phone,
        `Quase lá! Qual é o seu principal objetivo financeiro agora?\n` +
          `1 - Aposentadoria / independência financeira\n` +
          `2 - Compra de imóvel ou veículo\n` +
          `3 - Reserva de emergência\n` +
          `4 - Fazer meu dinheiro crescer`
      );
      break;
    }

    case STAGES.OBJETIVO: {
      if (!['1', '2', '3', '4'].includes(input)) {
        await sendMessage(phone, 'Não entendi sua resposta. Pode responder com o número da opção?');
        return;
      }
      state.objetivo = input;
      state.stage = STAGES.ENCERRADO;

      const qualified = isQualified(state);

      leads.push({
        nome: state.nome,
        phone: state.phone,
        interesse: INTERESSE_MAP[state.interesse] || state.interesse,
        patrimonio: PATRIMONIO_MAP[state.patrimonio] || state.patrimonio,
        score: SCORE_MAP[state.score] || state.score,
        objetivo: OBJETIVO_MAP[state.objetivo] || state.objetivo,
        qualified,
        timestamp: new Date().toLocaleString('pt-BR'),
      });
      saveLeads();

      if (qualified) {
        await sendMessage(
          phone,
          `Perfeito, ${state.nome}! Com base no que você me contou, acredito que o ${ASSESSOR_NAME} pode te ajudar muito. ` +
            `Vou passar seu contato para ele agora e em breve ele vai te chamar para uma conversa sem compromisso. ` +
            `Pode aguardar!`
        );
        await notifyAssessor(state);
      } else {
        await sendMessage(
          phone,
          `Obrigada pelo contato, ${state.nome}! No momento pode ser que ainda não seja o momento ideal para nossa assessoria, ` +
            `mas quando você estiver pronto para dar o próximo passo, estaremos aqui. Qualquer dúvida é só chamar!`
        );
      }
      break;
    }

    default:
      break;
  }
}

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/api/leads', (req, res) => {
  res.json(leads);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // responde imediatamente para a Evolution API

  const body = req.body;

  // Filtra apenas eventos de mensagem recebida
  const event = body?.event;
  if (event !== 'messages.upsert') return;

  const data = body?.data;
  if (!data) return;

  // Anti-spam: ignora mensagens de grupo
  const remoteJid = data?.key?.remoteJid ?? '';
  if (remoteJid.includes('@g.us')) return;

  // Ignora mensagens enviadas pelo próprio bot/assessor
  if (data?.key?.fromMe) return;

  // Ignora mensagens do número do assessor
  const phone = remoteJid.replace('@s.whatsapp.net', '');
  const assessorClean = (ASSESSOR_PHONE || '').replace(/\D/g, '');
  if (assessorClean && phone.endsWith(assessorClean)) return;

  // Deduplicação por ID de mensagem
  const msgId = data?.key?.id;
  if (msgId) {
    const now = Date.now();
    if (recentMessages[msgId] && now - recentMessages[msgId] < DEDUP_WINDOW_MS) return;
    recentMessages[msgId] = now;
    // Limpeza periódica do cache de deduplicação
    if (Object.keys(recentMessages).length > 1000) {
      for (const [id, ts] of Object.entries(recentMessages)) {
        if (now - ts > DEDUP_WINDOW_MS * 2) delete recentMessages[id];
      }
    }
  }

  // Extrai texto da mensagem
  const text =
    data?.message?.conversation ||
    data?.message?.extendedTextMessage?.text ||
    '';

  if (!text) return;

  console.log(`[webhook] ${phone}: ${text}`);
  await handleMessage(phone, text);
});

app.listen(PORT, () => {
  console.log(`Bot rodando na porta ${PORT}`);
});
