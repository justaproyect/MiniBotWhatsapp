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

const POKEMON_NAMES = {
  'bulbasaur': 1, 'ivysaur': 2, 'venusaur': 3,
  'charmander': 4, 'charmeleon': 5, 'charizard': 6,
  'squirtle': 7, 'wartortle': 8, 'blastoise': 9,
  'caterpie': 10, 'metapod': 11, 'butterfree': 12,
  'weedle': 13, 'kakuna': 14, 'beedrill': 15,
  'pidgey': 16, 'pidgeotto': 17, 'pidgeot': 18,
  'rattata': 19, 'raticate': 20, 'spearow': 21,
  'fearow': 22, 'ekans': 23, 'arbok': 24,
  'pikachu': 25, 'raichu': 26, 'sandshrew': 27,
  'sandslash': 28, 'nidoran♀': 29, 'nidorina': 30,
  'nidoqueen': 31, 'nidoran♂': 32, 'nidorino': 33,
  'nidoking': 34, 'clefairy': 35, 'clefable': 36,
  'vulpix': 37, 'ninetales': 38, 'jigglypuff': 39,
  'wigglytuff': 40, 'zubat': 41, 'golbat': 42,
  'oddish': 43, 'gloom': 44, 'vileplume': 45,
  'paras': 46, 'parasect': 47, 'venonat': 48,
  'venomoth': 49, 'diglett': 50, 'dugtrio': 51,
  'meowth': 52, 'persian': 53, 'psyduck': 54,
  'golduck': 55, 'mankey': 56, 'primeape': 57,
  'growlithe': 58, 'arcanine': 59, 'poliwag': 60,
  'poliwhirl': 61, 'poliwrath': 62, 'abra': 63,
  'kadabra': 64, 'alakazam': 65, 'machop': 66,
  'machoke': 67, 'machamp': 68, 'bellsprout': 69,
  'weepinbell': 70, 'victreebel': 71, 'tentacool': 72,
  'tentacruel': 73, 'geodude': 74, 'graveler': 75,
  'golem': 76, 'ponyta': 77, 'rapidash': 78,
  'slowpoke': 79, 'slowbro': 80, 'magnemite': 81,
  'magneton': 82, 'farfetchd': 83, 'doduo': 84,
  'dodrio': 85, 'seel': 86, 'dewgong': 87,
  'grimer': 88, 'muk': 89, 'shellder': 90,
  'cloyster': 91, 'gastly': 92, 'haunter': 93,
  'gengar': 94, 'onix': 95, 'drowzee': 96,
  'hypno': 97, 'krabby': 98, 'kingler': 99,
  'voltorb': 100, 'electrode': 101, 'exeggcute': 102,
  'exeggutor': 103, 'cubone': 104, 'marowak': 105,
  'hitmonlee': 106, 'hitmonchan': 107, 'lickitung': 108,
  'koffing': 109, 'weezing': 110, 'rhyhorn': 111,
  'rhydon': 112, 'chansey': 113, 'tangela': 114,
  'kangaskhan': 115, 'horsea': 116, 'seadra': 117,
  'goldeen': 118, 'seaking': 119, 'staryu': 120,
  'starmie': 121, 'mr. mime': 122, 'scyther': 123,
  'jynx': 124, 'electabuzz': 125, 'magmar': 126,
  'pinsir': 127, 'tauros': 128, 'magikarp': 129,
  'gyarados': 130, 'lapras': 131, 'ditto': 132,
  'eevee': 133, 'vaporeon': 134, 'jolteon': 135,
  'flareon': 136, 'porygon': 137, 'omanyte': 138,
  'omastar': 139, 'kabuto': 140, 'kabutops': 141,
  'aerodactyl': 142, 'snorlax': 143, 'articuno': 144,
  'zapdos': 145, 'moltres': 146, 'dratini': 147,
  'dragonair': 148, 'dragonite': 149, 'mewtwo': 150,
  'mew': 151,
};

async function getPokemonByName(name) {
  const normalizedName = name.toLowerCase().trim();
  const id = POKEMON_NAMES[normalizedName];
  if (!id) return null;

  try {
    const res = await axios.get(`${BASE_URL}/pokemon/${id}`);
    const pokemon = res.data;
    const artworkUrl =
      pokemon.sprites.other['official-artwork'].front_default ||
      pokemon.sprites.front_default;
    const imageBuffer = artworkUrl ? await getPokemonImageBuffer(artworkUrl) : null;
    return {
      id: pokemon.id,
      name: pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1),
      imageBuffer,
      artworkUrl,
    };
  } catch (e) {
    return null;
  }
}

function findPokemonInText(text) {
  const lower = text.toLowerCase();
  for (const [name, id] of Object.entries(POKEMON_NAMES)) {
    if (lower.includes(name)) {
      return name;
    }
  }
  return null;
}

module.exports = {
  getRandomPokemon,
  getPokemonImageBuffer,
  getRandomPokemonWithImage,
  getPokemonByName,
  findPokemonInText,
  POKEMON_NAMES,
};
