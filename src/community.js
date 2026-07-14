const config = require('./config');
const points = require('./points');

const DAILY_CHALLENGES = [
  {
    id: 'adivina_pokemon',
    nombre: 'Adivina el Pokemon',
    generate: () => {
      const pokemon = ['Pikachu', 'Charizard', 'Bulbasaur', 'Squirtle', 'Eevee', 'Gengar', 'Mewtwo', 'Dragonite', 'Snorlax', 'Jigglypuff'];
      const p = pokemon[Math.floor(Math.random() * pokemon.length)];
      const hint = p.split('').map((c, i) => i % 2 === 0 ? c : '_').join('');
      return {
        message: `*RETO DEL DIA - ADIVINA EL POKEMON*\n\n${hint}\n\nResponde con el nombre!\n*+10 puntos* al primero en acertar`,
        type: 'adivinanza',
        answer: p.toLowerCase(),
        reward: 10,
      };
    },
  },
  {
    id: 'completa_frase',
    nombre: 'Completa la frase',
    generate: () => {
      const frases = [
        { incomplete: 'Yo quiero ser el ___ ___!', answer: 'mejor entrenador' },
        { incomplete: 'Pokemon, te ___ ___!', answer: 'voy a encontrar' },
        { incomplete: '___ y un ___!', answer: 'un sol y un corazon' },
        { incomplete: '___ es mi destino!', answer: 'ser el mejor' },
      ];
      const f = frases[Math.floor(Math.random() * frases.length)];
      return {
        message: `*RETO DEL DIA - COMPLETA LA FRASE*\n\n"${f.incomplete}"\n\nCompleta la frase clasica!\n*+10 puntos* al primero`,
        type: 'completar',
        answer: f.answer,
        reward: 10,
      };
    },
  },
  {
    id: 'verdadero_falso',
    nombre: 'Verdadero o Falso',
    generate: () => {
      const preguntas = [
        { q: 'Pikachu es tipo electrico', a: 'verdadero' },
        { q: 'Charizard es tipo fuego y volador', a: 'verdadero' },
        { q: 'Mewtwo es elPokemon mas fuerte', a: 'falso' },
        { q: 'Bulbasaur es de tipo agua', a: 'falso' },
        { q: 'Eevee puede evolucionar en 8 formas', a: 'verdadero' },
        { q: 'Ash nunca fue campeon', a: 'falso' },
      ];
      const p = preguntas[Math.floor(Math.random() * preguntas.length)];
      return {
        message: `*RETO DEL DIA - VERDADERO O FALSO*\n\n${p.q}\n\nResponde: VERDADERO o FALSO\n*+10 puntos* al primero`,
        type: 'vf',
        answer: p.a,
        reward: 10,
      };
    },
  },
  {
    id: 'pokemon_rapido',
    nombre: 'Pokemon Rapido',
    generate: () => {
      const tipos = ['fuego', 'agua', 'planta', 'electrico', 'normal', 'psiquico', 'lucha', 'hada'];
      const tipo = tipos[Math.floor(Math.random() * tipos.length)];
      return {
        message: `*RETO DEL DIA - POKEMON RAPIDO*\n\nNombra un Pokemon tipo *${tipo}*\n\nTienes 30 segundos!\n*+5 puntos* por cada respuesta correcta`,
        type: 'rapido',
        answer: tipo,
        reward: 5,
      };
    },
  },
  {
    id: 'mayor_menor',
    nombre: 'Quien es el Mayor?',
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
        message: `*RETO DEL DIA - QUIEN ES EL MAYOR?*\n\n${par[0]} o ${par[1]}?\n\nResponde el nombre delPokemon mas grande/poderoso\n*+10 puntos* al primero`,
        type: 'mayor',
        answer: par[1].toLowerCase(),
        reward: 10,
      };
    },
  },
  {
    id: 'costumbres',
    nombre: 'Cual es tu costumbre?',
    generate: () => {
      const costumbres = [
        'Cual es tuPokemon favorito y por que?',
        'Que Pokemon usarias para ir al trabajo?',
        'Si pudieras tener unPokemon, cual seria?',
        'Que Pokemon te gustaria que te regalen?',
        'Cual es tu estrategia para las batallas?',
        'QuePokemon llevarias a una isla desierta?',
      ];
      const c = costumbres[Math.floor(Math.random() * costumbres.length)];
      return {
        message: `*RETO DEL DIA - COSTUMBRES POKEMON*\n\n${c}\n\nComparte tu respuesta!\nLa mejor recibe *+15 puntos*`,
        type: 'opinion',
        answer: null,
        reward: 15,
      };
    },
  },
  {
    id: 'memes',
    nombre: 'El meme del dia',
    generate: () => {
      const memes = [
        'Cuando ves una oferta en la tienda y no tienes dinero: *inserte meme de Squirtle llorando*',
        'Yo: "No voy a comprar masPokemon"\nPokemon: *lanza nueva coleccion*\nYo: *abre la billetera*',
        'Mi mama: "Tienes suficientesPokemon"\nYo: *ve nueva figurita*',
        'Cuando tuPokemon favorito evoluciona y se vuelve feo',
        'Yo explicandole a mi amigo por que necesita unPokemon de tipo dragon',
      ];
      const m = memes[Math.floor(Math.random() * memes.length)];
      return {
        message: `*RETO DEL DIA - MEME DEL DIA*\n\n${m}\n\nComparte tu meme favorito dePokemon!\nEl mas gracioso recibe *+10 puntos*`,
        type: 'meme',
        answer: null,
        reward: 10,
      };
    },
  },
];

const WEEKLY_SPECIALS = {
  lunes: { nombre: 'Lunes Pokemon', reward: 5, message: 'Empieza la semana con fuerza! +5 puntos extra por escribir hoy' },
  martes: { nombre: 'Martes de Batallas', reward: 10, message: 'Dia de batallas! +10 puntos extra por participar en !pokebattle' },
  miercoles: { nombre: 'Miercoles de Ofertas', reward: 0, message: 'Dia de ofertas 2x1 en sobres de cartas!' },
  jueves: { nombre: 'Jueves de Trivia', reward: 15, message: 'Trivia avanzada! +15 puntos extra por acertar' },
  viernes: { nombre: 'Viernes de Sorteo', reward: 10, message: 'Sorteo semanal! Participa con !sorteo' },
  sabado: { nombre: 'Sabado de Comunidad', reward: 10, message: 'Comparte tu coleccion con !mifigura' },
  domingo: { nombre: 'Domingo de Ranking', reward: 0, message: 'Ranking semanal! El ganador recibe premio especial' },
};

function getDailyChallenge() {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const index = dayOfYear % DAILY_CHALLENGES.length;
  return DAILY_CHALLENGES[index];
}

function getWeeklySpecial() {
  const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const today = days[new Date().getDay()];
  return WEEKLY_SPECIALS[today];
}

function getRandomChallenge() {
  return DAILY_CHALLENGES[Math.floor(Math.random() * DAILY_CHALLENGES.length)];
}

async function checkChallengeAnswer(challenge, userAnswer, groupId, userId, senderName) {
  if (!challenge.answer) return null;

  const correct = userAnswer.toLowerCase().includes(challenge.answer.toLowerCase());
  if (correct) {
    await points.addPoints(groupId, userId, senderName, 'daily_challenge', challenge.reward);
    return `*CORRECTO!* ${senderName} gana *${challenge.reward} puntos*\n\nTu respuesta: ${userAnswer}\nRespuesta: ${challenge.answer}`;
  }
  return null;
}

function getAllChallenges() {
  return DAILY_CHALLENGES;
}

function getAllWeeklySpecials() {
  return WEEKLY_SPECIALS;
}

module.exports = {
  DAILY_CHALLENGES,
  WEEKLY_SPECIALS,
  getDailyChallenge,
  getWeeklySpecial,
  getRandomChallenge,
  checkChallengeAnswer,
  getAllChallenges,
  getAllWeeklySpecials,
};
