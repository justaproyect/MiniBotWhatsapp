const config = require('./config');
const engagement = require('./engagement');
const { getRandomPokemonWithImage } = require('./pokeapi');
const { getDailyTrivia } = require('./messages/trivia');
const { getDailyQuiz } = require('./messages/quiz');
const { getDailyMemeWithBuffer } = require('./messages/memes');
const points = require('./points');
const { getTodayActivity, getRandomActivity } = require('./dailyActivity');
const ai = require('./ai');
const community = require('./community');
const raffle = require('./raffle');
const battles = require('./battles');
const sellerProducts = require('./products');

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
        '!ping - Verificar si el bot esta activo',
        '!horario - Calendario semanal de contenido',
        '',
        '*Interaccion:*',
        '!trivia - Trivia interactiva',
        '!quiz - Quiz interactivo',
        '!pokebattle @usuario - Desafio Pokemon',
        '',
        '*Retos y Actividades:*',
        '!retodia - Reto del dia',
        '!reto - Reto random',
        '!especial - Actividad especial del dia',
        '',
        '*Batallas:*',
        '!batalla @usuario - Iniciar batalla',
        '!atacar [movimiento] - Atacar en batalla',
        '!misbatallas - Ver batallas activas',
        '',
        '*Sorteos:*',
        '!sorteo [numero] - Participar en sorteo',
        '!premios - Ver premios disponibles',
        '',
        '*Comunidad:*',
        '!comparte [pokemon] - Compartir favorito',
        '!mifigura - Compartir tu coleccion',
        '',
        '*Puntos y Tienda:*',
        '!puntos - Ver puntos acumulados',
        '!top - Ranking de entrenadores',
        '!canjear - Canjear puntos por premios',
        '!tienda - Productos y ofertas Toytsuky',
        '!ofertas - Ofertas de la semana',
        '!pedidos - Hacer pedido por WhatsApp',
        '',
        '*Referidos:*',
        '!referir - Obtener codigo de referido',
        '!fuiinvitadopor [codigo] - Registrarte como referido',
        '',
        '*Vendedores:*',
        '!productos [orlando/luis] - Ver productos de un vendedor',
        '!misproductos - Ver mis productos pendientes',
        '!verproducto [numero] - Ver detalles de producto',
        '',
        '*Admin:*',
        '!registrar <tipo> - Registrar grupo',
        '!grupos - Ver grupos registrados',
        '!anuncio <mensaje> - Enviar anuncio',
        '!evento <fecha> <desc> - Crear evento',
        '!iniciar_sorteo - Iniciar sorteo semanal',
        '!cerrar_sorteo - Cerrar sorteo y elegir ganador',
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
    ejecutar: () => 'Pikachu!',
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
      return `*ANUNCIO OFICIAL*\n\n${mensaje}\n\n_Enviado por: ${senderName || 'Admin'}_`;
    },
  },

  evento: {
    desc: 'Crear evento',
    esAdmin: true,
    necesitaArgs: true,
    ejecutar: (groupId, args) => {
      const fecha = args[0] || 'Por definir';
      const desc = args.slice(1).join(' ') || 'Sin descripcion';
      return [
        '*Nuevo Evento Pokemon*',
        '',
        `Fecha: *${fecha}*`,
        `Descripcion: ${desc}`,
        '',
        'Participa y gana premios!',
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

  puntos: {
    desc: 'Ver tus puntos acumulados',
    ejecutar: async (groupId, args, senderName, userId) => {
      const userPoints = await points.getPoints(userId);
      const referralCount = await points.getReferralCount(userId);

      let msg = `*TUS PUNTOS*\n\n`;
      msg += `Hola ${senderName}!\n`;
      msg += `Tienes *${userPoints} puntos*\n`;
      msg += `Referidos: ${referralCount}\n\n`;
      msg += `*Como ganar puntos:*\n`;
      msg += `- Escribir: 0.3 puntos\n`;
      msg += `- Trivia correcta: 10 pts\n`;
      msg += `- Pokemon visto: 5 pts\n`;
      msg += `- Pokebattle ganada: 15 pts\n`;
      msg += `- Referir amigo: 50 pts\n`;
      msg += `- Compra en tienda: 100 pts\n\n`;
      msg += `Usa *!canjear* para ver premios`;
      return msg;
    },
  },

  top: {
    desc: 'Ranking de puntos',
    ejecutar: async () => {
      const topUsers = await points.getTopUsers(10);
      if (topUsers.length === 0) {
        return 'Aun no hay usuarios con puntos.';
      }

      let msg = `*TOP ENTRENADORES*\n\n`;
      const medals = ['🥇', '🥈', '🥉'];
      topUsers.forEach((user, i) => {
        const medal = medals[i] || `${i + 1}.`;
        msg += `${medal} ${user.userName} - ${user.points} pts\n`;
      });
      return msg;
    },
  },

  canjear: {
    desc: 'Canjear puntos por premios',
    ejecutar: async (groupId, args, senderName, userId) => {
      const userPoints = await points.getPoints(userId);
      const rewards = points.getRewards();

      if (args.length > 0) {
        const rewardIndex = parseInt(args[0]) - 1;
        if (rewardIndex < 0 || rewardIndex >= rewards.length) {
          return 'Numero de premio invalido.';
        }

        const reward = rewards[rewardIndex];
        if (userPoints < reward.points) {
          return `No tienes suficientes puntos. Necesitas ${reward.points} puntos, tienes ${userPoints}.`;
        }

        const success = await points.removePoints(userId, reward.points);
        if (!success) {
          return 'Error al canjear puntos.';
        }

        return `*CANJE EXITOSO*\n\nPremio: ${reward.name}\nDescripción: ${reward.description}\nPuntos gastados: ${reward.points}\nPuntos restantes: ${userPoints - reward.points}\n\nPresenta este mensaje en la tienda para reclamar tu premio.`;
      }

      let msg = `*PREMIOS DISPONIBLES*\n\nTus puntos: *${userPoints}*\n\n`;
      rewards.forEach((reward, i) => {
        const status = userPoints >= reward.points ? '✅' : '❌';
        msg += `${i + 1}. ${status} ${reward.name} - ${reward.points} pts\n`;
        msg += `   ${reward.description}\n\n`;
      });
      msg += `Para canjear: *!canjear [numero]*`;
      return msg;
    },
  },

  tienda: {
    desc: 'Ver productos y ofertas de Toytsuky',
    ejecutar: () => {
      let msg = `*TOYTSUKY - TIENDA POKEMON*\n`;
      msg += `📍 Sincelejo, Sucre\n\n`;
      msg += `*Productos disponibles:*\n`;
      msg += `- Figuras Pokemon\n`;
      msg += `- Cartas Pokemon (sobres, cajas, singles)\n`;
      msg += `- Accesorios (funda, estuche, album)\n`;
      msg += `- Ropa Pokemon\n`;
      msg += `- Juguetes y coleccionables\n\n`;
      msg += `*Ofertas especiales:*\n`;
      msg += `- 2x1 en sobres de cartas (miercoles)\n`;
      msg += `- 15% OFF en figuras (viernes)\n`;
      msg += `- Envio gratis en compras +$50.000\n\n`;
      msg += `*Horario:*\n`;
      msg += `Lunes a Sabado: 10:00 AM - 8:00 PM\n`;
      msg += `Domingo: Cerrado\n\n`;
      msg += `Usa *!canjear* para canjear tus puntos\n`;
      msg += `Visitanos o escribe *!pedidos* para pedir por WhatsApp`;
      return msg;
    },
  },

  referir: {
    desc: 'Invitar amigos y ganar puntos',
    ejecutar: async (groupId, args, senderName, userId) => {
      const referralCode = userId.replace(/[^0-9]/g, '').slice(-6);

      let msg = `*PROGRAMA DE REFERIDOS*\n\n`;
      msg += `Hola ${senderName}!\n\n`;
      msg += `Tu codigo de referido es:\n`;
      msg += `*${referralCode}*\n\n`;
      msg += `*Como funciona:*\n`;
      msg += `1. Comparte tu codigo con amigos\n`;
      msg += `2. El amigo escribe *!fuiinvitadopor ${referralCode}*\n`;
      msg += `3. Tu ganas *50 puntos* y el amigo *25 puntos*\n\n`;
      msg += `*Beneficios por referir:*\n`;
      msg += `- 3 amigos: 100 pts extra + sticker\n`;
      msg += `- 5 amigos: 250 pts extra + 5% descuento\n`;
      msg += `- 10 amigos: 500 pts extra + envio gratis\n\n`;
      msg += `Comparte tu codigo y gana premios!`;
      return msg;
    },
  },

  fuiinvitadopor: {
    desc: 'Registrarse como referido',
    ejecutar: async (groupId, args, senderName, userId) => {
      if (args.length === 0) {
        return 'Usa: *!fuiinvitadopor [codigo]*\nEjemplo: !fuiinvitadopor 123456';
      }

      const referrerCode = args[0];
      const referrerId = '120363' + referrerCode + '@g.us';

      const result = await points.useReferral(referrerId, userId, senderName);

      if (result?.error) {
        return result.error;
      }

      if (result?.success) {
        return `*BIENVENIDO A LA COMUNIDAD!*\n\nFuiste referido por ${result.referrerName}\nGanaste *${points.POINTS_PER_ACTION.referido_nuevo} puntos* de bienvenida!\n\nUsa *!puntos* para ver tu saldo`;
      }

      return 'Error al procesar el referido. Intenta de nuevo.';
    },
  },

  ofertas: {
    desc: 'Ver ofertas de la semana',
    ejecutar: () => {
      const today = new Date().getDay();

      let msg = `*OFERTAS DE LA SEMANA*\n\n`;

      if (today === 3) {
        msg += `*HOY ES MIERCOLES DE OFERTAS!*\n`;
        msg += `2x1 en sobres de cartas\n`;
        msg += `Solo por hoy! Visitanos\n\n`;
      } else if (today === 5) {
        msg += `*HOY ES VIERNES DE DESCUENTOS!*\n`;
        msg += `15% OFF en todas las figuras\n`;
        msg += `Solo por hoy! Visitanos\n\n`;
      }

      msg += `*Ofertas fijas:*\n`;
      msg += `- Sobre basico: $3.000\n`;
      msg += `- Sobre elite: $8.000\n`;
      msg += `- Figura basica: $15.000\n`;
      msg += `- Figura especial: $35.000\n`;
      msg += `- Caja completa: $120.000\n\n`;
      msg += `*Promocion referidos:*\n`;
      msg += `Invita amigos y gana puntos extra\nUsa *!referir* para tu codigo`;
      return msg;
    },
  },

  pedidos: {
    desc: 'Hacer pedido por WhatsApp',
    ejecutar: () => {
      let msg = `*HACER PEDIDO*\n\n`;
      msg += `Para hacer tu pedido:\n\n`;
      msg += `1. Escribe el producto que quieres\n`;
      msg += `2. Indica cantidad\n`;
      msg += `3. Envia tu direccion de envio\n\n`;
      msg += `*Opciones de pago:*\n`;
      msg += `- Efectivo (en tienda)\n`;
      msg += `- Nequi\n`;
      msg += `- Daviplata\n\n`;
      msg += `*Envios:*\n`;
      msg += `- Sincelejo: Gratis compras +$50.000\n`;
      msg += `- Fuera de Sincelejo: Coordinar\n\n`;
      msg += `O visita nuestra tienda:\n📍 Sincelejo, Sucre\n⏰ 10AM - 8PM`;
      return msg;
    },
  },

  actividad: {
    desc: 'Actividad del dia',
    ejecutar: () => {
      const activity = getTodayActivity();
      const result = activity.generate();
      return result.message;
    },
  },

  reto: {
    desc: 'Reto random Pokemon',
    ejecutar: () => {
      const activity = getRandomActivity();
      const result = activity.generate();
      return result.message;
    },
  },

  ia: {
    desc: 'Ver estado de la IA',
    ejecutar: () => {
      const stats = ai.getStats();
      let msg = `*ESTADO DE LA IA*\n\n`;
      msg += `Respuestas esta hora: ${stats.responseCount}/${stats.maxPerHour}\n`;
      msg += `Probabilidad de responder: ${Math.round(stats.chance * 100)}%\n\n`;
      msg += `*Palabras clave que activan la IA:*\n`;
      msg += stats.triggers.join(', ') + '\n\n';
      msg += `La IA responde cuando:\n`;
      msg += `- Escribe una palabra clave\n`;
      msg += `- O aleatoriamente (15% de probabilidad)\n\n`;
      msg += `Maximo 5 respuestas por hora para no ser molesto`;
      return msg;
    },
  },

  retodia: {
    desc: 'Reto del dia',
    ejecutar: () => {
      const challenge = community.getDailyChallenge();
      const result = challenge.generate();
      return result.message;
    },
  },

  reto: {
    desc: 'Reto random Pokemon',
    ejecutar: () => {
      const challenge = community.getRandomChallenge();
      const result = challenge.generate();
      return result.message;
    },
  },

  especial: {
    desc: 'Actividad especial del dia',
    ejecutar: () => {
      const special = community.getWeeklySpecial();
      return `*${special.nombre}*\n\n${special.message}`;
    },
  },

  sorteo: {
    desc: 'Participar en el sorteo semanal',
    ejecutar: (groupId, args, senderName, userId) => {
      if (args.length === 0) {
        return raffle.getRaffleStatus();
      }

      const number = parseInt(args[0]);
      if (isNaN(number)) {
        return 'Usa: *!sorteo [numero del 1 al 100]*';
      }

      const result = raffle.participateRaffle(userId, senderName, number);
      if (result.error) return result.error;
      return result.message;
    },
  },

  iniciar_sorteo: {
    desc: 'Iniciar sorteo semanal',
    esAdmin: true,
    ejecutar: () => {
      const r = raffle.createRaffle();
      let msg = `*SORTEO SEMANAL INICIADO!*\n\n`;
      msg += `Premio: *${r.prize.name}*\n`;
      msg += `${r.prize.description}\n\n`;
      msg += `Para participar escribe:\n*!sorteo [numero del 1 al 100]*\n\n`;
      msg += `El numero mas cercano al ganador se lleva el premio!`;
      return msg;
    },
  },

  cerrar_sorteo: {
    desc: 'Cerrar sorteo y elegir ganador',
    esAdmin: true,
    ejecutar: () => {
      const result = raffle.drawRaffle();
      if (result.error) return result.error;

      let msg = `*SORTEO CERRADO!*\n\n`;
      msg += `Numero ganador: *${result.winningNumber}*\n`;
      msg += `Total participantes: ${result.totalParticipants}\n\n`;
      msg += `*GANADOR: ${result.winner.userName}*\n`;
      msg += `Su numero: ${result.winner.number}\n`;
      msg += `Premio: ${result.prize.name}\n\n`;
      msg += `Felicidades! Presenta este mensaje en la tienda`;
      return msg;
    },
  },

  batalla: {
    desc: 'Iniciar batalla Pokemon con otro usuario',
    ejecutar: (groupId, args, senderName, userId) => {
      if (args.length === 0) {
        return 'Usa: *!batalla @usuario* para desafiar a alguien';
      }

      const opponentName = args[0];
      const opponentId = args[0].replace(/[^0-9]/g, '') + '@g.us';

      if (opponentId === userId) {
        return 'No puedes batallar contra ti mismo!';
      }

      const result = battles.startBattle(userId, senderName, opponentId, opponentName);
      if (result.error) return result.error;
      return result.message;
    },
  },

  atacar: {
    desc: 'Atacar en batalla activa',
    ejecutar: (groupId, args, senderName, userId) => {
      if (args.length === 0) {
        return 'Usa: *!atacar [movimiento]*\nMovimientos: ' + battles.getAllMoves().map(m => m.name).join(', ');
      }

      const activeBattles = battles.getActiveBattles();
      const myBattle = activeBattles.find(b =>
        (b.challenger.id === userId || b.opponent.id === userId) && b.status === 'active'
      );

      if (!myBattle) {
        return 'No tienes ninguna batalla activa. Usa *!batalla @usuario* para iniciar una';
      }

      const moveName = args.join(' ');
      const result = battles.executeAttack(myBattle.id, userId, moveName);
      if (result.error) return result.error;
      return result.message;
    },
  },

  misbatallas: {
    desc: 'Ver tus batallas activas',
    ejecutar: (groupId, args, senderName, userId) => {
      const activeBattles = battles.getActiveBattles();
      const myBattles = activeBattles.filter(b =>
        b.challenger.id === userId || b.opponent.id === userId
      );

      if (myBattles.length === 0) {
        return 'No tienes batallas activas. Usa *!batalla @usuario* para iniciar una';
      }

      let msg = '*TUS BATALLAS ACTIVAS*\n\n';
      for (const b of myBattles) {
        msg += `${b.challenger.name} (${b.challenger.pokemon.name}) vs ${b.opponent.name} (${b.opponent.pokemon.name})\n`;
        msg += `HP: ${b.challenger.currentHp}/${b.challenger.pokemon.hp} vs ${b.opponent.currentHp}/${b.opponent.pokemon.hp}\n\n`;
      }
      return msg;
    },
  },

  mifigura: {
    desc: 'Compartir tu figura/coleccion',
    ejecutar: async (groupId, args, senderName, userId) => {
      await points.addPoints(groupId, userId, senderName, 'compartir_coleccion', 10);
      return `*${senderName} compartio su coleccion!*\n\nMuestra tu figura o coleccion Pokemon en el grupo!\n+10 puntos por compartir`;
    },
  },

  comparte: {
    desc: 'Compartir tu Pokemon favorito',
    ejecutar: async (groupId, args, senderName, userId) => {
      if (args.length === 0) {
        return 'Usa: *!comparte [tu Pokemon favorito]*\nEjemplo: !comparte Charizard';
      }
      const pokemon = args.join(' ');
      await points.addPoints(groupId, userId, senderName, 'compartir_favorito', 10);
      return `*${senderName} compartio su Pokemon favorito: ${pokemon}!*\n\n+10 puntos por compartir`;
    },
  },

  premios: {
    desc: 'Ver premios disponibles',
    ejecutar: () => {
      const prizes = raffle.getAllPrizes();
      let msg = `*PREMIOS DISPONIBLES*\n\n`;
      prizes.forEach((p, i) => {
        msg += `${i + 1}. ${p.name} - ${p.points} pts\n`;
        msg += `   ${p.description}\n\n`;
      });
      msg += `Canjea con *!canjear [numero]*`;
      return msg;
    },
  },

  productos: {
    desc: 'Ver productos de un vendedor',
    ejecutar: async (groupId, args, senderName, userId) => {
      const sellerId = args[0]?.toLowerCase();
      if (!sellerId || !['orlando', 'luis'].includes(sellerId)) {
        return 'Usa: *!productos [orlando/luis]*\nEjemplo: !productos orlando';
      }

      const sellerProductsList = await sellerProducts.getProducts(sellerId);
      const sellerInfo = sellerProducts.getSellerInfo(sellerId);

      if (sellerProductsList.length === 0) {
        return `${sellerInfo.name} no tiene productos registrados`;
      }

      let msg = `*PRODUCTOS DE ${sellerInfo.name}*\n\n`;
      sellerProductsList.forEach((p, i) => {
        msg += `${i + 1}. ${p.name}\n`;
        if (p.price) msg += `   Precio: ${p.price}\n`;
        if (p.description) msg += `   ${p.description}\n`;
        msg += `   Categoria: ${p.category}\n\n`;
      });
      msg += `Total: ${sellerProductsList.length} productos`;
      return msg;
    },
  },

  misproductos: {
    desc: 'Ver mis productos pendientes',
    ejecutar: async (groupId, args, senderName, userId) => {
      let sellerId = null;
      if (userId.includes('orlando')) sellerId = 'orlando';
      else if (userId.includes('luis')) sellerId = 'luis';

      if (!sellerId) {
        return 'No estas registrado como vendedor. Contacta al admin.';
      }

      const dailyProducts = await sellerProducts.getDailyProducts(sellerId, 5);
      const sellerInfo = sellerProducts.getSellerInfo(sellerId);

      if (dailyProducts.length === 0) {
        return `${sellerInfo.name}, no tienes productos pendientes para publicar`;
      }

      let msg = `*PRODUCTOS PARA PUBLICAR - ${sellerInfo.name}*\n\n`;
      dailyProducts.forEach((p, i) => {
        msg += `${i + 1}. *${p.name}*\n`;
        if (p.price) msg += `   Precio: ${p.price}\n`;
        if (p.description) msg += `   ${p.description}\n`;
        msg += `   Dias enviado: ${p.daysSent}\n\n`;
      });
      msg += `Usa *!verproducto [numero]* para ver detalles`;
      return msg;
    },
  },

  verproducto: {
    desc: 'Ver detalles de un producto',
    ejecutar: async (groupId, args, senderName, userId) => {
      if (args.length === 0) {
        return 'Usa: *!verproducto [numero]*';
      }

      const index = parseInt(args[0]) - 1;
      let sellerId = null;
      if (userId.includes('orlando')) sellerId = 'orlando';
      else if (userId.includes('luis')) sellerId = 'luis';

      if (!sellerId) {
        return 'No estas registrado como vendedor.';
      }

      const productsList = await sellerProducts.getProducts(sellerId);
      if (index < 0 || index >= productsList.length) {
        return 'Numero de producto invalido';
      }

      const product = productsList[index];
      let msg = `*${product.name}*\n\n`;
      if (product.price) msg += `Precio: ${product.price}\n`;
      if (product.description) msg += `Descripcion: ${product.description}\n`;
      msg += `Categoria: ${product.category}\n`;
      msg += `Veces enviado: ${product.daysSent}\n`;
      if (product.imageUrl) msg += `\nTiene imagen para publicar`;
      return msg;
    },
  },
};

async function ejecutarComando(comando, groupId, args = [], senderName = '', userId = '') {
  const cmd = COMANDOS[comando];
  if (!cmd) return null;

  if (cmd.esAdmin) {
    const config = require('./config');
    const adminNumber = config.ADMIN_NUMBER;
    if (!adminNumber) {
      console.log('[CMDS] ADMIN_NUMBER no configurado, bloqueando comando admin');
      return 'Este comando es solo para administradores.';
    }
    const cleanUserId = userId.replace(/[^0-9]/g, '');
    const cleanAdmin = adminNumber.replace(/[^0-9]/g, '');
    if (cleanUserId !== cleanAdmin) {
      console.log(`[CMDS] Usuario ${cleanUserId} no es admin (${cleanAdmin})`);
      return 'Este comando es solo para administradores.';
    }
  }

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
