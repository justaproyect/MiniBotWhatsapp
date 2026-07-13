const cron = require('node-cron');
const config = require('./config');
const { generateDailyContentWithRanking } = require('./messages/generator');
const { sendMessage, isBotConnected } = require('./baileys');
const queue = require('./queue');
const axios = require('axios');

let scheduledTask = null;
let queueTask = null;

async function sendDailyMessages() {
  const registeredGroups = Object.entries(config.GROUPS).filter(([id, g]) => g.registrado);

  if (registeredGroups.length === 0) {
    console.log('[SCHEDULER] No hay grupos registrados. Esperando...');
    return;
  }

  if (!isBotConnected()) {
    console.log('[SCHEDULER] Bot no conectado. No se puede enviar.');
    return;
  }

  console.log(`[SCHEDULER] Enviando contenido a ${registeredGroups.length} grupos...`);
  let enviados = 0;

  for (const [groupId, group] of registeredGroups) {
    try {
      const content = await generateDailyContentWithRanking(groupId, group.tipo);

      if (content.type === 'image' && content.imageBuffer) {
        await sendMessage(groupId, {
          image: content.imageBuffer,
          caption: content.formattedMessage || content.caption || '',
        });
      } else if (content.type === 'text') {
        await sendMessage(groupId, { text: content.message });
      }

      enviados++;
      console.log(`[SCHEDULER] ✓ ${group.nombre} (${group.tipo})`);
    } catch (err) {
      console.error(`[SCHEDULER] ✗ ${group.nombre}: ${err.message}`);
    }
  }

  console.log(`[SCHEDULER] Envío completado: ${enviados}/${registeredGroups.length} grupos`);
}

async function downloadMedia(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    return Buffer.from(response.data);
  } catch (e) {
    console.error('[SCHEDULER] Error descargando media:', e.message);
    return null;
  }
}

async function processQueue() {
  if (!isBotConnected()) return;

  const pendingItems = queue.getPendingItems();
  if (pendingItems.length === 0) return;

  console.log(`[QUEUE] Procesando ${pendingItems.length} items de la cola...`);

  for (const item of pendingItems) {
    let registeredGroups = Object.entries(config.GROUPS).filter(([id, g]) => g.registrado && g.tipo === item.tipo);

    if (item.tipo === 'prueba') {
      registeredGroups = Object.entries(config.GROUPS).filter(([id, g]) => g.registrado);
    }

    if (registeredGroups.length === 0) {
      console.log(`[QUEUE] No hay grupos tipo ${item.tipo}, saltando...`);
      queue.markAsSent(item.id);
      continue;
    }

    for (const [groupId, group] of registeredGroups) {
      try {
        let message = item.contenido;
        if (item.titulo) {
          message = `*${item.titulo}*\n\n${message}`;
        }

        if (item.imageUrl) {
          const imageBuffer = await downloadMedia(item.imageUrl);
          if (imageBuffer) {
            await sendMessage(groupId, { image: imageBuffer, caption: message });
          } else {
            await sendMessage(groupId, { text: message });
          }
        } else if (item.videoUrl) {
          const videoBuffer = await downloadMedia(item.videoUrl);
          if (videoBuffer) {
            await sendMessage(groupId, { video: videoBuffer, caption: message });
          } else {
            await sendMessage(groupId, { text: message });
          }
        } else {
          await sendMessage(groupId, { text: message });
        }

        console.log(`[QUEUE] ✓ Enviado a ${group.nombre}`);
      } catch (err) {
        console.error(`[QUEUE] ✗ Error enviando a ${group.nombre}:`, err.message);
      }
    }

    queue.markAsSent(item.id);
  }

  console.log(`[QUEUE] Cola procesada`);
}

function startScheduler() {
  const minute = config.SEND_MINUTE.toString().padStart(2, '0');
  const hour = config.SEND_HOUR.toString().padStart(2, '0');
  const cronExpression = `${minute} ${hour} * * *`;

  console.log(`[SCHEDULER] Horario configurado: ${cronExpression} (${config.TIMEZONE})`);
  console.log(`[SCHEDULER] Próximo envío: ${hour}:${minute} diariamente`);

  scheduledTask = cron.schedule(cronExpression, () => {
    console.log(`[SCHEDULER] Ejecutando envío programado...`);
    sendDailyMessages();
  }, { timezone: config.TIMEZONE });

  queueTask = cron.schedule('* * * * *', () => {
    processQueue();
  }, { timezone: config.TIMEZONE });

  return scheduledTask;
}

function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[SCHEDULER] Programador detenido');
  }
  if (queueTask) {
    queueTask.stop();
    queueTask = null;
    console.log('[QUEUE] Cola detenida');
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  sendDailyMessages,
  processQueue,
};
