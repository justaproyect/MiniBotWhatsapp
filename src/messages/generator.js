const config = require('../config');
const { getDailyTrivia } = require('./trivia');
const { getDailyQuiz } = require('./quiz');
const { getDailyPokemon } = require('./pokemon-dia');
const { getDailyMemeWithBuffer } = require('./memes');
const { getDailyAnuncio } = require('./anuncios');
const { getDailyIntercambio } = require('./intercambios');
const { getDailyRaid } = require('./raids');
const { getDailyTienda } = require('./tienda');
const { getDailySubasta } = require('./subastas');
const { getRandomPokemonWithImage } = require('../pokeapi');
const engagement = require('../engagement');

async function generateDailyContent(tipoGrupo) {
  console.log(`[GENERATOR] Generando contenido para tipo: ${tipoGrupo}`);

  switch (tipoGrupo) {
    case 'general':
      return await getDailyPokemon();

    case 'compra':
      return getDailyIntercambio();

    case 'rifas':
      return getDailySubasta();

    case 'torneos':
      return getDailyRaid();

    case 'subastas':
      return getDailySubasta();

    case 'tienda':
      return getDailyTienda();

    case 'anuncios':
      return getDailyAnuncio();

    default:
      return await getDailyPokemon();
  }
}

function getRankingForGroup(groupId) {
  const ranking = engagement.getRankingSemanal(groupId, 5);
  if (ranking.length === 0) return '';
  return engagement.formatRanking(ranking, 'RANKING SEMANAL');
}

async function generateDailyContentWithRanking(groupId, tipoGrupo) {
  const content = await generateDailyContent(tipoGrupo);
  const ranking = getRankingForGroup(groupId);

  if (content.type === 'image') {
    const caption = (content.formattedMessage || content.caption || '') + '\n\n' + ranking;
    return { ...content, formattedMessage: caption };
  } else if (content.type === 'text') {
    const fullMessage = content.message + '\n\n' + ranking;
    return { ...content, message: fullMessage };
  }

  return content;
}

module.exports = {
  generateDailyContent,
  generateDailyContentWithRanking,
  getRankingForGroup,
};
