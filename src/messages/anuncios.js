const anunciosData = require('./data/anuncios.json');

let usedIds = [];

function getDailyAnuncio() {
  const available = anunciosData.filter(a => !usedIds.includes(a.id));
  if (available.length === 0) {
    usedIds = [];
    return getDailyAnuncio();
  }
  const anuncio = available[Math.floor(Math.random() * available.length)];
  usedIds.push(anuncio.id);

  return {
    type: 'text',
    message: [
      `*Noticias Pokemon*`,
      '',
      `📰 *${anuncio.titulo}*`,
      anuncio.descripcion,
      '',
      `Categoría: ${anuncio.categoria}`,
      '---',
      'Mantente informado con las últimas noticias Pokemon.',
    ].join('\n'),
  };
}

module.exports = { getDailyAnuncio };
