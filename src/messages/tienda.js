const tiendaData = require('./data/tienda.json');

let usedIds = [];

function getDailyTienda() {
  const available = tiendaData.filter(t => !usedIds.includes(t.id));
  if (available.length === 0) {
    usedIds = [];
    return getDailyTienda();
  }
  const producto = available[Math.floor(Math.random() * available.length)];
  usedIds.push(producto.id);

  return {
    type: 'text',
    message: [
      `*Tienda Oficial Pokemon*`,
      '',
      `🛒 *${producto.producto}*`,
      `💰 Precio: ${producto.precio}`,
      producto.descripcion,
      '',
      `Categoría: ${producto.categoria}`,
      `Disponible: ${producto.disponible ? 'Sí' : 'No'}`,
      '',
      '---',
      '¡Visita la tienda para ver todos los productos!',
    ].join('\n'),
  };
}

module.exports = { getDailyTienda };
