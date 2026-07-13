const subastasData = require('./data/subastas.json');

let usedIds = [];

function getDailySubasta() {
  const available = subastasData.filter(s => !usedIds.includes(s.id));
  if (available.length === 0) {
    usedIds = [];
    return getDailySubasta();
  }
  const subasta = available[Math.floor(Math.random() * available.length)];
  usedIds.push(subasta.id);

  return {
    type: 'text',
    message: [
      `*Subasta Pokemon del Día*`,
      '',
      `🏷️ *${subasta.producto}*`,
      subasta.descripcion,
      '',
      `💰 Precio inicial: $${subasta.precioInicial}`,
      `📈 Puja actual: $${subasta.pujaActual}`,
      `👤 Vendedor: ${subasta.vendedor}`,
      `⏰ Tiempo restante: ${subasta.tiempoRestante}`,
      '',
      '---',
      '¡Haz tu puja y lleva tu item favorito!',
    ].join('\n'),
  };
}

module.exports = { getDailySubasta };
