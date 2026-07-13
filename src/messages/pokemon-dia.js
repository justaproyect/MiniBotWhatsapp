const { getRandomPokemonWithImage } = require('../pokeapi');

async function getDailyPokemon() {
  const pokemon = await getRandomPokemonWithImage();
  return { type: 'image', ...pokemon };
}

module.exports = { getDailyPokemon };
