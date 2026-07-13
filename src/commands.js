const config = require('./config');
const engagement = require('./engagement');
const { getRandomPokemonWithImage } = require('./pokeapi');
const { getDailyTrivia } = require('./messages/trivia');
const { getDailyQuiz } = require('./messages/quiz');
const { getDailyMemeWithBuffer } = require('./messages/memes');

const COMANDOS = {
  ayuda: {
    desc: 'Lista todos los comandos disponibles',
    ejecutar: () => {
      return [
        '*Comandos Pokemon Bot*',
        '',
        '*Generales:*',
        '!ayuda - Lista de comandos',
        '!pokemon - Pokemon random con imagen',
        '!damepoke - Pokemon random sin imagen',
        '!ping - Verificar si el bot está activo',
        '!horario - Calendario semanal de contenido',
        '',
        '*Interacción:*',
        '!trivia - Trivia interactiva',
        '!pokebattle @usuario - Desafío Pokemon',
        '',
        '*Estadísticas:*',
        '!puntos - Ver tus puntos',
        '!top - Ranking general',
        '!top-semana - Ranking de la semana',
        '!logros - Ver tus logros',
        '',
        '*Admin:*',
        '!registrar <tipo> - Registrar grupo',
        '!grupos - Ver grupos registrados',
        '!anuncio <mensaje> - Enviar anuncio',
        '!evento <fecha> <desc> - Crear evento',
        '!test - Enviar contenido de prueba',
        '!testimage - Probar envio de imagen',
      ].join('\n');
    },
  },

  ayuda_con_grupo: {
    desc: 'Lista comandos con info del grupo',
    ejecutar: (groupId) => {
      const grupo = config.GROUPS[groupId];
      const lines = [
        '*Comandos Pokemon Bot*',
        '',
        `Grupo actual: *${grupo?.nombre || 'No registrado'}*`,
        `Tipo: *${grupo?.tipo || 'Sin tipo'}*`,
        '',
        '*Generales:*',
        '!ayuda - Lista de comandos',
        '!pokemon - Pokemon random con imagen',
        '!damepoke - Pokemon random sin imagen',
        '!ping - Verificar si el bot está activo',
        '',
        '*Interacción:*',
        '!trivia - Trivia interactiva',
        '!pokebattle @usuario - Desafío Pokemon',
        '',
        '*Estadísticas:*',
        '!puntos - Ver tus puntos',
        '!top - Ranking general',
        '!top-semana - Ranking de la semana',
        '!logros - Ver tus logros',
      ];
      return lines.join('\n');
    },
  },

  ping: {
    desc: 'Verificar bot activo',
    ejecutar: () => 'Pokemon Bot activo! Ash Ketchum está en línea.',
  },

  registrar: {
    desc: 'Registrar grupo',
    esAdmin: true,
    necesitaArgs: true,
   ejecutar: (groupId, args) => {
      const tipo = args[0]?.toLowerCase();
      const tiposValidos = ['general', 'compra', 'rifas', 'torneos', 'subastas', 'tienda', 'anuncios', 'prueba'];
      if (!tipo || !tiposValidos.includes(tipo)) {
        return `Tipo inválido. Tipos válidos: ${tiposValidos.join(', ')}`;
      }
      config.GROUPS[groupId] = {
        id: groupId,
        nombre: config.GROUPS[groupId]?.nombre || tipo,
        tipo: tipo,
        registrado: true,
      };
      config.saveGroups();
      return `Grupo registrado como tipo: *${tipo}*`;
    },
  },

  grupos: {
    desc: 'Ver grupos registrados',
    esAdmin: true,
    ejecutar: () => {
      const lines = ['*Grupos Registrados*', ''];
      let count = 0;
      for (const [id, g] of Object.entries(config.GROUPS)) {
        if (g.registrado) {
          count++;
          lines.push(`${count}. ${g.nombre} (${g.tipo})`);
        }
      }
      if (count === 0) return 'No hay grupos registrados.';
      lines.push(`\nTotal: ${count}/7 grupos`);
      return lines.join('\n');
    },
  },

  anuncio: {
    desc: 'Enviar anuncio',
    esAdmin: true,
    necesitaArgs: true,
    ejecutar: (groupId, args, senderName) => {
      const mensaje = args.join(' ');
      return `📢 *ANUNCIO OFICIAL*\n\n${mensaje}\n\n_Enviado por: ${senderName || 'Admin'}_`;
    },
  },

  evento: {
    desc: 'Crear evento',
    esAdmin: true,
    necesitaArgs: true,
    ejecutar: (groupId, args) => {
      const fecha = args[0] || 'Por definir';
      const desc = args.slice(1).join(' ') || 'Sin descripción';
      return [
        '*Nuevo Evento Pokemon*',
        '',
        `📅 Fecha: *${fecha}*`,
        `📝 Descripción: ${desc}`,
        '',
        '¡Participa y gana premios!',
      ].join('\n');
    },
  },

  horario: {
    desc: 'Calendario semanal',
    ejecutar: () => {
      return [
        '*Calendario Semanal Pokemon*',
        '',
        '📅 *Lunes:* Trivia Pokemon',
        '📅 *Martes:* Quiz interactivo',
        '📅 *Miércoles:* Reflexión del día',
        '📅 *Jueves:* Meme/Random',
        '📅 *Viernes:* Pokemon del día',
        '📅 *Sábado:* Quiz avanzado',
        '📅 *Domingo:* Ranking semanal',
        '',
        '⏰ Envío automático: 8:00 AM',
      ].join('\n');
    },
  },

  pokemon: {
    desc: 'Pokemon random con imagen',
    ejecutar: async (groupId, args, senderName, userId) => {
      try {
        const pokemon = await getRandomPokemonWithImage();
        engagement.registrarPokemonVisto(groupId, userId, pokemon.id);
        return { type: 'image', imageBuffer: pokemon.imageBuffer, caption: pokemon.formattedMessage };
      } catch (e) {
        return 'Error al obtener el Pokemon. Intenta de nuevo.';
      }
    },
  },

  damepoke: {
    desc: 'Pokemon random sin imagen',
    ejecutar: async (groupId, args, senderName, userId) => {
      try {
        const pokemon = await require('./pokeapi').getRandomPokemon();
        engagement.registrarPokemonVisto(groupId, userId, pokemon.id);
        return [
          `*${pokemon.name}* #${pokemon.id}`,
          `Tipo: ${pokemon.types}`,
          `Altura: ${pokemon.height}m | Peso: ${pokemon.weight}kg`,
          `_${pokemon.flavorText}_`,
        ].join('\n');
      } catch (e) {
        return 'Error al obtener el Pokemon. Intenta de nuevo.';
      }
    },
  },

  trivia: {
    desc: 'Trivia interactiva',
    ejecutar: async () => {
      const trivia = getDailyTrivia();
      return trivia.message;
    },
  },

  quiz: {
    desc: 'Quiz interactivo',
    ejecutar: async (groupId, args, senderName, userId) => {
      const quiz = getDailyQuiz();
      if (args.length > 0) {
        const respuesta = args[0].toUpperCase();
        if (respuesta === quiz.respuesta) {
          engagement.registrarQuizCorrecto(groupId, userId, senderName);
          return `✅ *¡Correcto!* ${quiz.explicacion}\n\n+5 puntos!`;
        } else {
          engagement.registrarQuizIncorrecto(groupId, userId);
          return `❌ *Incorrecto.* La respuesta era *${quiz.respuesta}*\n\n${quiz.explicacion}`;
        }
      }
      return quiz.message;
    },
  },

  pokebattle: {
    desc: 'Desafío Pokemon',
    ejecutar: async (groupId, args, senderName, userId) => {
      if (args.length === 0) return 'Usa: *!pokebattle @usuario*';
      return [
        '*¡POKEBATTLE!*',
        '',
        `⚔️ ${senderName} desafía a ${args[0]}!`,
        '',
        'Reglas:',
        '• Cada uno elige 3 Pokemon',
        '• Tipo, ventaja y estrategia cuentan',
        '• El ganador recibe +10 puntos',
        '• El perdedor pierde -5 puntos',
        '',
        '¡Que gane el mejor entrenador!',
      ].join('\n');
    },
  },

  puntos: {
    desc: 'Ver puntos',
    ejecutar: (groupId, userId) => {
      return engagement.getPuntosUsuario(groupId, userId);
    },
  },

  top: {
    desc: 'Ranking general',
    ejecutar: (groupId) => {
      const ranking = engagement.getRanking(groupId);
      return engagement.formatRanking(ranking, 'RANKING GENERAL');
    },
  },

  'top-semana': {
    desc: 'Ranking semanal',
    ejecutar: (groupId) => {
      const ranking = engagement.getRankingSemanal(groupId);
      return engagement.formatRanking(ranking, 'RANKING SEMANAL');
    },
  },

  logros: {
    desc: 'Ver logros',
    ejecutar: (groupId, userId) => {
      return engagement.getLogrosUsuario(groupId, userId);
    },
  },

  test: {
    desc: 'Enviar contenido de prueba',
    ejecutar: async (groupId) => {
      const { generateDailyContentWithRanking } = require('./messages/generator');
      const grupo = config.GROUPS[groupId];
      if (!grupo || !grupo.registrado) return 'Primero registra el grupo con !registrar prueba';
      const content = await generateDailyContentWithRanking(groupId, grupo.tipo);
      if (content.type === 'image' && content.imageBuffer) {
        return { type: 'image', imageBuffer: content.imageBuffer, caption: content.formattedMessage || content.caption || '' };
      }
      return content.message;
    },
  },

  testimage: {
    desc: 'Probar envio de imagen',
    ejecutar: async () => {
      const axios = require('axios');
      const fs = require('fs');
      const path = require('path');
      const cacheDir = path.join(__dirname, '..', 'cache');
      const cacheFile = path.join(cacheDir, 'test-image.jpg');
      try {
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        if (fs.existsSync(cacheFile)) {
          const data = fs.readFileSync(cacheFile);
          return { type: 'image', imageBuffer: data, caption: '*Prueba de imagen (cache)*\n\nSi ves esta imagen, el bot puede enviar imagenes!' };
        }
        const res = await axios.get('https://i.imgur.com/aWrt2dx.jpg', { responseType: 'arraybuffer', timeout: 15000 });
        fs.writeFileSync(cacheFile, Buffer.from(res.data));
        return { type: 'image', imageBuffer: Buffer.from(res.data), caption: '*Prueba de imagen*\n\nSi ves esta imagen, el bot puede enviar imagenes desde URLs!' };
      } catch (e) {
        if (fs.existsSync(cacheFile)) {
          const data = fs.readFileSync(cacheFile);
          return { type: 'image', imageBuffer: data, caption: '*Prueba de imagen (cache)*' };
        }
        try {
          const res = await axios.get('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png', { responseType: 'arraybuffer', timeout: 15000 });
          return { type: 'image', imageBuffer: Buffer.from(res.data), caption: '*Prueba de imagen (fallback)*\n\nPikachu dice hola!' };
        } catch (e2) {
          return 'Error: No se pudo descargar ninguna imagen';
        }
      }
    },
  },

  testvideo: {
    desc: 'Probar envio de video',
    ejecutar: async () => {
      const axios = require('axios');
      const fs = require('fs');
      const path = require('path');
      const cacheDir = path.join(__dirname, '..', 'cache');
      const cacheFile = path.join(cacheDir, 'test-video.mp4');
      try {
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        if (fs.existsSync(cacheFile)) {
          const data = fs.readFileSync(cacheFile);
          return { type: 'video', videoBuffer: data, caption: '*Prueba de video (cache)*' };
        }
        const res = await axios.get('https://i.imgur.com/aWrt2dx.mp4', { responseType: 'arraybuffer', timeout: 60000 });
        fs.writeFileSync(cacheFile, Buffer.from(res.data));
        return { type: 'video', videoBuffer: Buffer.from(res.data), caption: '*Prueba de video*\n\nSi ves este video, el bot puede enviar videos!' };
      } catch (e) {
        if (fs.existsSync(cacheFile)) {
          const data = fs.readFileSync(cacheFile);
          return { type: 'video', videoBuffer: data, caption: '*Prueba de video (cache)*' };
        }
        return 'Error: No se pudo descargar el video (' + e.message + ')';
      }
    },
  },
};

async function ejecutarComando(comando, groupId, args = [], senderName = '', userId = '') {
  const cmd = COMANDOS[comando];
  if (!cmd) return null;
  try {
    return await cmd.ejecutar(groupId, args, senderName, userId);
  } catch (e) {
    return `Error al ejecutar el comando: ${e.message}`;
  }
}

function esComando(texto) {
  return texto.startsWith('!');
}

function parsearComando(texto) {
  const parts = texto.trim().split(/\s+/);
  const comando = parts[0].substring(1).toLowerCase();
  const args = parts.slice(1);
  return { comando, args };
}

module.exports = {
  COMANDOS,
  ejecutarComando,
  esComando,
  parsearComando,
};
