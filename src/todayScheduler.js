const cron = require('node-cron');
const config = require('./config');
const { getTodayActivity, getRandomActivity } = require('./dailyActivity');

let scheduledTask = null;

function startTodayActivity() {
  if (scheduledTask) {
    scheduledTask.stop();
  }

  const groups = config.GROUPS;
  const groupIds = Object.keys(groups);

  if (groupIds.length === 0) {
    console.log('[TODAY] No hay grupos configurados');
    return;
  }

  let messageCount = 0;
  const MAX_MESSAGES = 6;

  scheduledTask = cron.schedule('0 10,12,14,16,18,20 * * *', () => {
    if (messageCount >= MAX_MESSAGES) {
      scheduledTask.stop();
      console.log('[TODAY] Limite de mensajes alcanzado');
      return;
    }

    const activity = messageCount % 2 === 0 ? getTodayActivity() : getRandomActivity();
    const result = activity.generate();

    const targetGroup = groupIds[messageCount % groupIds.length];

    console.log(`[TODAY] Enviando actividad ${messageCount + 1}/${MAX_MESSAGES} a ${targetGroup}`);

    if (typeof global.sendToGroup === 'function') {
      global.sendToGroup(targetGroup, result.message);
    } else {
      console.log('[TODAY] sendToGroup no disponible');
    }

    messageCount++;
  }, {
    timezone: 'America/Bogota',
  });

  console.log('[TODAY] Actividades de hoy programadas (10AM, 12PM, 2PM, 4PM, 6PM, 8PM)');
}

function stopTodayActivity() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[TODAY] Actividades detenidas');
  }
}

module.exports = {
  startTodayActivity,
  stopTodayActivity,
};
