const raidsData = require('./data/raids.json');

let usedIds = [];

function getDailyRaid() {
  const available = raidsData.filter(r => !usedIds.includes(r.id));
  if (available.length === 0) {
    usedIds = [];
    return getDailyRaid();
  }
  const raid = available[Math.floor(Math.random() * available.length)];
  usedIds.push(raid.id);

  return {
    type: 'text',
    message: [
      `*Raid Pokemon del Día*`,
      '',
      `⚔️ *${raid.pokemon}* - ${raid.nivel}`,
      raid.descripcion,
      '',
      `⏰ Hora: ${raid.hora}`,
      `🎁 Recompensa: ${raid.recompensa}`,
      '',
      '---',
      '¡Organiza tu equipo y derrota al boss!',
    ].join('\n'),
  };
}

module.exports = { getDailyRaid };
