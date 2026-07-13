const cron = require('node-cron');
const config = require('./config');
const { generateDailyContentWithRanking } = require('./messages/generator');
const { sendMessage, isBotConnected } = require('./baileys');

let scheduledTask = null;

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

  return scheduledTask;
}

function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[SCHEDULER] Programador detenido');
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  sendDailyMessages,
};
