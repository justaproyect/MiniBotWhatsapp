const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { esComando, parsearComando, ejecutarComando } = require('./commands');
const engagement = require('./engagement');
const { useMongoDBAuthState, closeMongo } = require('./mongo');
const { handleAIMessage } = require('./ai');

const SESSION_DIR = path.join(__dirname, '..', 'session');
const logger = pino({ level: 'silent' });

let sock = null;
let isConnected = false;
let currentQR = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

function getSocket() { return sock; }
function isBotConnected() { return isConnected; }
function getQR() { return currentQR; }

async function sendMessage(jid, content) {
  if (!sock || !isConnected) {
    console.error('[BAILEYS] No hay conexión activa');
    return null;
  }
  try {
    const result = await sock.sendMessage(jid, content);
    console.log(`[BAILEYS] Mensaje enviado a ${jid}`);
    return result;
  } catch (err) {
    console.error('[BAILEYS] Error enviando mensaje:', err.message);
    return null;
  }
}

async function sendImageWithCaption(jid, imageBuffer, caption) {
  return sendMessage(jid, { image: imageBuffer, caption });
}

async function sendText(jid, text) {
  return sendMessage(jid, { text });
}

async function connectToWhatsApp(onGroupDetected, onReady) {
  const mongoState = await useMongoDBAuthState();
  let state, saveCreds;

  if (!mongoState.useFallback && mongoState.state) {
    console.log('[BAILEYS] Usando MongoDB para sesión persistente');
    state = mongoState.state;
    saveCreds = mongoState.saveCreds;
  } else {
    console.log('[BAILEYS] Usando almacenamiento local (session/)');
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    const localAuth = await useMultiFileAuthState(SESSION_DIR);
    state = localAuth.state;
    saveCreds = localAuth.saveCreds;
  }

  const { version } = await fetchLatestBaileysVersion();
  console.log(`[BAILEYS] Usando versión de WhatsApp Web: ${version.join('.')}`);

  sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    printQRInTerminal: false,
    browser: ['Pokemon Bot', 'Safari', '3.0'],
    markOnlineOnConnect: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      reconnectAttempts = 0;
      console.log(`\n${config.MESSAGES.QR_GENERATED}`);
      qrcodeTerminal.generate(qr, { small: true });
      console.log(`\nO abre http://localhost:${config.PORT || 3000} en tu navegador\n`);
      QRCode.toDataURL(qr, { width: 400, margin: 2 }).then(url => { currentQR = url; }).catch(() => {});
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const lastError = lastDisconnect?.error?.message || 'desconocido';
      console.log(`[BAILEYS] Conexión cerrada. Código: ${statusCode}. Error: ${lastError}`);
      isConnected = false;
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('[BAILEYS] Sesión cerrada permanentemente. Elimina session/ y vuelve a escanear.');
      } else if (reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++;
        const delay = Math.min(reconnectAttempts * 3000, 30000);
        console.log(`[BAILEYS] Reconectando en ${delay / 1000}s (intento ${reconnectAttempts}/${MAX_RECONNECT})...`);
        setTimeout(() => connectToWhatsApp(onGroupDetected, onReady), delay);
      } else {
        console.log('[BAILEYS] Máximo de reintentos alcanzado. Reinicia el bot manualmente.');
      }
    }

    if (connection === 'open') {
      reconnectAttempts = 0;
      isConnected = true;
      currentQR = null;
      console.log(`[BAILEYS] ${config.MESSAGES.CONNECTED}`);
      if (onReady) onReady();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.key.fromMe && msg.message) {
      const chatId = msg.key.remoteJid;
      const isGroup = chatId.endsWith('@g.us');

      if (isGroup) {
        if (!config.GROUPS[chatId]) {
          config.GROUPS[chatId] = { id: chatId, nombre: chatId, tipo: 'general', registrado: false };
          config.saveGroups();
          console.log(`[BAILEYS] ${config.MESSAGES.GROUP_DETECTED} ${chatId}`);
          if (onGroupDetected) onGroupDetected(chatId);
        }

        const senderId = msg.key.participant || msg.key.remoteJid;
        const pushName = msg.pushName || 'Entrenador';
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (!text.startsWith('!')) {
          engagement.registrarMensaje(chatId, senderId, pushName);
        }

        if (esComando(text)) {
          const { comando, args } = parsearComando(text);
          const resultado = await ejecutarComando(comando, chatId, args, pushName, senderId);
          if (resultado) {
            if (typeof resultado === 'object' && resultado.type === 'image') {
              await sendMessage(chatId, { image: resultado.imageBuffer, caption: resultado.caption });
            } else if (typeof resultado === 'object' && resultado.type === 'video') {
              await sendMessage(chatId, { video: resultado.videoBuffer, caption: resultado.caption });
            } else {
              await sendText(chatId, resultado);
            }
          }
        } else if (text.length > 5) {
          const aiResponse = await handleAIMessage(chatId, text, pushName, senderId);
          if (aiResponse) {
            await sendText(chatId, aiResponse);
          }
        }
      }
    }
  });

  return sock;
}

module.exports = {
  connectToWhatsApp,
  sendMessage,
  sendImageWithCaption,
  sendText,
  getSocket,
  isBotConnected,
  getQR,
};
