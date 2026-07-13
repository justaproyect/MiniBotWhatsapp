const fs = require('fs');
const path = require('path');
const logrosData = require('./messages/data/logros.json');

const USUARIOS_PATH = path.join(__dirname, 'messages', 'data', 'usuarios.json');

function loadUsuarios() {
  try {
    if (fs.existsSync(USUARIOS_PATH)) {
      return JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveUsuarios(data) {
  fs.writeFileSync(USUARIOS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getUsuario(groupId, userId) {
  const data = loadUsuarios();
  if (!data[groupId]) data[groupId] = {};
  if (!data[groupId][userId]) {
    data[groupId][userId] = {
      nombre: '',
      puntos: 0,
      mensajes: 0,
      quizzesCorrectos: 0,
      quizzesTotales: 0,
      pokebattles: 0,
      pokebattlesGanadas: 0,
      pokemonVistos: [],
      interacciones: 0,
      logros: [],
      semanaActual: 0,
      ultimaSemana: 0,
      semana: getSemanaActual(),
      ultimoMensaje: null,
    };
    saveUsuarios(data);
  }
  const u = data[groupId][userId];
  if (u.semana !== getSemanaActual()) {
    u.ultimaSemana = u.semanaActual;
    u.semanaActual = 0;
    u.semana = getSemanaActual();
    saveUsuarios(data);
  }
  return u;
}

function getSemanaActual() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  const oneWeek = 604800000;
  return Math.ceil(diff / oneWeek);
}

function registrarMensaje(groupId, userId, nombre) {
  const data = loadUsuarios();
  if (!data[groupId]) data[groupId] = {};
  if (!data[groupId][userId]) {
    data[groupId][userId] = {
      nombre: '',
      puntos: 0,
      mensajes: 0,
      quizzesCorrectos: 0,
      quizzesTotales: 0,
      pokebattles: 0,
      pokebattlesGanadas: 0,
      pokemonVistos: [],
      interacciones: 0,
      logros: [],
      semanaActual: 0,
      ultimaSemana: 0,
      semana: getSemanaActual(),
      ultimoMensaje: null,
    };
  }
  const u = data[groupId][userId];
  if (u.semana !== getSemanaActual()) {
    u.ultimaSemana = u.semanaActual;
    u.semanaActual = 0;
    u.semana = getSemanaActual();
  }
  u.nombre = nombre || u.nombre;
  u.mensajes += 1;
  u.semanaActual += 1;
  u.puntos += 1;
  u.ultimoMensaje = new Date().toISOString();
  checkLogros(data, groupId, userId);
  saveUsuarios(data);
  return u;
}

function registrarQuizCorrecto(groupId, userId, nombre) {
  const data = loadUsuarios();
  const u = getUsuario(groupId, userId);
  u.nombre = nombre || u.nombre;
  u.quizzesCorrectos += 1;
  u.quizzesTotales += 1;
  u.puntos += 5;
  u.semanaActual += 5;
  checkLogros(data, groupId, userId);
  saveUsuarios(data);
  return u;
}

function registrarQuizIncorrecto(groupId, userId) {
  const data = loadUsuarios();
  const u = getUsuario(groupId, userId);
  u.quizzesTotales += 1;
  saveUsuarios(data);
  return u;
}

function registrarPokebattle(groupId, userId, ganador) {
  const data = loadUsuarios();
  const u = getUsuario(groupId, userId);
  u.pokebattles += 1;
  if (ganador) {
    u.pokebattlesGanadas += 1;
    u.puntos += 10;
    u.semanaActual += 10;
  } else {
    u.puntos = Math.max(0, u.puntos - 5);
    u.semanaActual = Math.max(0, u.semanaActual - 5);
  }
  checkLogros(data, groupId, userId);
  saveUsuarios(data);
  return u;
}

function registrarPokemonVisto(groupId, userId, pokemonId) {
  const data = loadUsuarios();
  const u = getUsuario(groupId, userId);
  if (!u.pokemonVistos.includes(pokemonId)) {
    u.pokemonVistos.push(pokemonId);
  }
  u.puntos += 1;
  u.semanaActual += 1;
  checkLogros(data, groupId, userId);
  saveUsuarios(data);
  return u;
}

function checkLogros(data, groupId, userId) {
  const u = data[groupId][userId];
  const nuevosLogros = [];

  for (const logro of logrosData) {
    if (u.logros.includes(logro.id)) continue;

    let desbloqueado = false;
    switch (logro.id) {
      case 'primera-vez':
        desbloqueado = u.mensajes >= 1;
        break;
      case 'activo':
        desbloqueado = u.semanaActual >= 50;
        break;
      case 'maestro-pokemon':
        desbloqueado = u.quizzesCorrectos >= 10;
        break;
      case 'leyenda':
        desbloqueado = u.puntos >= 100;
        break;
      case 'estratega':
        desbloqueado = u.pokebattlesGanadas >= 5;
        break;
      case 'coleccionista':
        desbloqueado = u.pokemonVistos.length >= 20;
        break;
      case 'social':
        desbloqueado = u.interacciones >= 10;
        break;
      case 'nocturno': {
        const h = new Date().getHours();
        desbloqueado = h >= 0 && h < 5;
        break;
      }
      case 'matutino': {
        const h2 = new Date().getHours();
        desbloqueado = h2 >= 5 && h2 < 7;
        break;
      }
      case 'rival':
        desbloqueado = u.pokebattles >= 5;
        break;
    }

    if (desbloqueado) {
      u.logros.push(logro.id);
      u.puntos += logro.puntosBonus;
      u.semanaActual += logro.puntosBonus;
      nuevosLogros.push(logro);
    }
  }

  return nuevosLogros;
}

function getRanking(groupId, limit = 10) {
  const data = loadUsuarios();
  if (!data[groupId]) return [];

  return Object.entries(data[groupId])
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, limit);
}

function getRankingSemanal(groupId, limit = 10) {
  const data = loadUsuarios();
  if (!data[groupId]) return [];

  return Object.entries(data[groupId])
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => b.semanaActual - a.semanaActual)
    .slice(0, limit);
}

function formatRanking(ranking, titulo = 'RANKING') {
  if (ranking.length === 0) return `*${titulo}*\n\nAún no hay datos de ranking.`;

  const lines = [`*${titulo}*`, ''];
  ranking.forEach((u, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const logroStr = u.logros.length > 0 ? ` [${u.logros.length} logros]` : '';
    lines.push(`${medal} ${u.nombre || 'Entrenador'} - ${u.puntos} pts${logroStr}`);
  });

  lines.push('');
  lines.push('Envía *!puntos* para ver tu posición');
  return lines.join('\n');
}

function getLogrosUsuario(groupId, userId) {
  const u = getUsuario(groupId, userId);
  const desbloqueados = logrosData.filter(l => u.logros.includes(l.id));
  const pendientes = logrosData.filter(l => !u.logros.includes(l.id));

  const lines = [`*Logros de ${u.nombre || 'Entrenador'}*`, ''];

  if (desbloqueados.length > 0) {
    lines.push('*Desbloqueados:*');
    desbloqueados.forEach(l => {
      lines.push(`  ${l.icono} ${l.nombre} - ${l.descripcion} (+${l.puntosBonus} pts)`);
    });
    lines.push('');
  }

  if (pendientes.length > 0) {
    lines.push('*Por desbloquear:*');
    pendientes.forEach(l => {
      lines.push(`  🔒 ${l.nombre} - ${l.requisito}`);
    });
  }

  return lines.join('\n');
}

function getPuntosUsuario(groupId, userId) {
  const u = getUsuario(groupId, userId);
  return [
    `*Estadísticas de ${u.nombre || 'Entrenador'}*`,
    '',
    `Puntos totales: *${u.puntos}*`,
    `Puntos esta semana: *${u.semanaActual}*`,
    `Mensajes enviados: ${u.mensajes}`,
    `Quizzes correctos: ${u.quizzesCorrectos}/${u.quizzesTotales}`,
    `Pokebattles: ${u.pokebattlesGanadas}/${u.pokebattles}`,
    `Pokemon vistos: ${u.pokemonVistos.length}`,
    `Logros: ${u.logros.length}/${logrosData.length}`,
    '',
    'Envía *!logros* para ver tus logros',
  ].join('\n');
}

module.exports = {
  loadUsuarios,
  saveUsuarios,
  getUsuario,
  registrarMensaje,
  registrarQuizCorrecto,
  registrarQuizIncorrecto,
  registrarPokebattle,
  registrarPokemonVisto,
  getRanking,
  getRankingSemanal,
  formatRanking,
  getLogrosUsuario,
  getPuntosUsuario,
};
