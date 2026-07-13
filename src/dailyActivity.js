const DAILY_ACTIVITIES = [
  {
    id: 'adivina',
    name: 'Adivina el Pokemon',
    generate: () => {
      const pokemon = ['Pikachu', 'Charizard', 'Bulbasaur', 'Squirtle', 'Eevee', 'Gengar', 'Mewtwo', 'Dragonite', 'Jigglypuff', 'Snorlax'];
      const p = pokemon[Math.floor(Math.random() * pokemon.length)];
      const hint = p.split('').map((c, i) => i % 2 === 0 ? c : '_').join('');
      return {
        message: `*RETRO - ADIVINA EL POKEMON*\n\n${hint}\n\nResponde con el nombre del Pokemon!\n*+10 puntos* al primero en acertar`,
      };
    },
  },
  {
    id: 'completa',
    name: 'Completa la frase',
    generate: () => {
      const frases = [
        { incomplete: 'Yo quiero ser el ___ ___!', answer: 'MEJOR ENTRENADOR' },
        { incomplete: 'Pokemon, te ___ ___!', answer: 'VOY A ENCONTRAR' },
        { incomplete: '___ y un ___!', answer: 'UN SOL Y UN CORAZON' },
      ];
      const f = frases[Math.floor(Math.random() * frases.length)];
      return {
        message: `*RETRO - COMPLETA LA FRASE*\n\n"${f.incomplete}"\n\nCompleta la frase clasica!\n*+10 puntos* al primero`,
      };
    },
  },
  {
    id: 'verdadero',
    name: 'Verdadero o Falso',
    generate: () => {
      const preguntas = [
        { q: 'Pikachu es tipo electrico', a: 'VERDADERO' },
        { q: 'Charizard es tipo fuego y volador', a: 'VERDADERO' },
        { q: 'Mewtwo es elPokemon mas fuerte', a: 'FALSO (es Arceus)' },
        { q: 'Bulbasaur es de tipo agua', a: 'FALSO (es planta/veneno)' },
        { q: 'Eevee puede evolucionar en 8 formas', a: 'VERDADERO' },
      ];
      const p = preguntas[Math.floor(Math.random() * preguntas.length)];
      return {
        message: `*RETRO - VERDADERO O FALSO*\n\n${p.q}\n\nResponde: VERDADERO o FALSO\n*+10 puntos* al primero`,
      };
    },
  },
  {
    id: 'rapido',
    name: 'Pokemon Rapido',
    generate: () => {
      const tipos = ['fuego', 'agua', 'planta', 'electrico', 'normal'];
      const tipo = tipos[Math.floor(Math.random() * tipos.length)];
      return {
        message: `*RETRO - POKEMON RAPIDO*\n\nNombra un Pokemon tipo *${tipo}*\n\nTienes 30 segundos!\n*+5 puntos* por cada respuesta correcta`,
      };
    },
  },
  {
    id: 'mayor',
    name: 'Quien es el Mayor?',
    generate: () => {
      const pares = [
        ['Pikachu', 'Raichu'],
        ['Charmander', 'Charmeleon'],
        ['Squirtle', 'Wartortle'],
        ['Eevee', 'Vaporeon'],
        ['Bulbasaur', 'Ivysaur'],
      ];
      const par = pares[Math.floor(Math.random() * pares.length)];
      return {
        message: `*RETRO - QUIEN ES EL MAYOR?*\n\n${par[0]} o ${par[1]}?\n\nResponde el nombre delPokemon mas grande/poderoso\n*+10 puntos* al primero`,
      };
    },
  },
  {
    id: 'costumbres',
    name: 'Cual es tu costumbre?',
    generate: () => {
      const costumbres = [
        'Cual es tuPokemon favorito y por que?',
        'Que Pokemon usarias para ir al trabajo?',
        'Si pudieras tener unPokemon, cual seria?',
        'Que Pokemon te gustaria que te regalen?',
        'Cual es tu estrategia para las batallas?',
      ];
      const c = costumbres[Math.floor(Math.random() * costumbres.length)];
      return {
        message: `*RETRO - COSTUMBRES POKEMON*\n\n${c}\n\nComparte tu respuesta!\nLa mejor recibe *+15 puntos*`,
      };
    },
  },
  {
    id: 'memes',
    name: 'El meme del dia',
    generate: () => {
      const memes = [
        'Cuando ves una oferta en la tienda y no tienes dinero: *inserte meme de Squirtle llorando*',
        'Yo: "No voy a comprar masPokemon"\nPokemon: *lanza nueva coleccion*\nYo: *abre la billetera*',
        'Mi mama: "Tienes suficientesPokemon"\nYo: *ve nueva figurita*',
      ];
      const m = memes[Math.floor(Math.random() * memes.length)];
      return {
        message: `*RETRO - MEME DEL DIA*\n\n${m}\n\nComparte tu meme favorito dePokemon!\nEl mas gracioso recibe *+10 puntos*`,
      };
    },
  },
];

function getTodayActivity() {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const index = dayOfYear % DAILY_ACTIVITIES.length;
  return DAILY_ACTIVITIES[index];
}

function getActivityById(id) {
  return DAILY_ACTIVITIES.find(a => a.id === id);
}

function getRandomActivity() {
  return DAILY_ACTIVITIES[Math.floor(Math.random() * DAILY_ACTIVITIES.length)];
}

module.exports = {
  DAILY_ACTIVITIES,
  getTodayActivity,
  getActivityById,
  getRandomActivity,
};
