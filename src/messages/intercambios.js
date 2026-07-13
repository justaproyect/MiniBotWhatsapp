const intercambiosData = require('./data/intercambios.json');

let usedIds = [];

function getDailyIntercambio() {
  const available = intercambiosData.filter(i => !usedIds.includes(i.id));
  if (available.length === 0) {
    usedIds = [];
    return getDailyIntercambio();
  }
  const intercambio = available[Math.floor(Math.random() * available.length)];
  usedIds.push(intercambio.id);

  return {
    type: 'text',
    message: [
      `*Intercambios Pokemon del Día*`,
      '',
      `🔄 *${intercambio.pokemon}* → ${intercambio.buscando}`,
      intercambio.descripcion,
      '',
      `Nivel: ${intercambio.nivel}`,
      `Rareza: ${intercambio.rareza}`,
      '',
      '---',
      'Envía *!damepoke* para ver qué Pokemon puedes ofrecer.',
    ].join('\n'),
  };
}

module.exports = { getDailyIntercambio };
