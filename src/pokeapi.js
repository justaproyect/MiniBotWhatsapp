const axios = require('axios');
const config = require('./config');

const BASE_URL = 'https://pokeapi.co/api/v2';

async function getRandomPokemon() {
  const id = Math.floor(Math.random() * config.MAX_POKEMON_ID) + 1;
  const [pokemonRes, speciesRes] = await Promise.all([
    axios.get(`${BASE_URL}/pokemon/${id}`),
    axios.get(`${BASE_URL}/pokemon-species/${id}`),
  ]);

  const pokemon = pokemonRes.data;
  const species = speciesRes.data;

  const flavorEntry = species.flavor_text_entries.find(
    (e) => e.language.name === 'es'
  ) || species.flavor_text_entries.find(
    (e) => e.language.name === 'en'
  );

  const flavorText = flavorEntry
    ? flavorEntry.flavor_text.replace(/[\n\f\r]/g, ' ')
    : 'Sin descripcion disponible.';

  const types = pokemon.types.map((t) => t.type.name).join(' / ');
  const stats = pokemon.stats.map((s) => `  ${s.stat.name}: ${s.base_stat}`).join('\n');

  const artworkUrl =
    pokemon.sprites.other['official-artwork'].front_default ||
    pokemon.sprites.front_default;

  return {
    id: pokemon.id,
    name: pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1),
    types,
    height: (pokemon.height / 10).toFixed(1),
    weight: (pokemon.weight / 10).toFixed(1),
    flavorText,
    stats,
    artworkUrl,
    abilities: pokemon.abilities.map((a) => a.ability.name).join(', '),
    baseExperience: pokemon.base_experience,
    speciesName: species.genera.find((g) => g.language.name === 'es')?.genus ||
                 species.genera.find((g) => g.language.name === 'en')?.genus ||
                 'Pokemon',
  };
}

async function getPokemonImageBuffer(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

async function getRandomPokemonWithImage() {
  const pokemon = await getRandomPokemon();
  const imageBuffer = await getPokemonImageBuffer(pokemon.artworkUrl);

  const formattedMessage = [
    `*Pokemon del Dia #${pokemon.id}*`,
    '',
    `*${pokemon.name}* - ${pokemon.speciesName}`,
    `Tipo: ${pokemon.types}`,
    `Altura: ${pokemon.height}m | Peso: ${pokemon.weight}kg`,
    '',
    `_${pokemon.flavorText}_`,
    '',
    `*Habilidades:* ${pokemon.abilities}`,
    `*Exp. Base:* ${pokemon.baseExperience}`,
    '',
    '---',
    'Envia *!pokemon* para ver otro Pokemon',
  ].join('\n');

  return { ...pokemon, imageBuffer, formattedMessage };
}

module.exports = {
  getRandomPokemon,
  getPokemonImageBuffer,
  getRandomPokemonWithImage,
};
