const config = require('./config');
const points = require('./points');

const POKEMON_TYPES = {
  fuego: { fuerte: ['planta', 'hielo', 'bug'], debil: ['agua', 'roca', 'dragon'] },
  agua: { fuerte: ['fuego', 'roca', 'tierra'], debil: ['planta', 'electrico', 'dragon'] },
  planta: { fuerte: ['agua', 'roca', 'tierra'], debil: ['fuego', 'hielo', 'veneno'] },
  electrico: { fuerte: ['agua', 'volador'], debil: ['tierra'] },
  psiquico: { fuerte: ['lucha', 'veneno'], debil: ['bug', 'fantasma', 'siniestro'] },
  dragon: { fuerte: ['dragon'], debil: ['hielo', 'hada'] },
  lucha: { fuerte: ['normal', 'hielo', 'roca'], debil: ['volador', 'psiquico', 'hada'] },
  normal: { fuerte: [], debil: ['lucha'] },
};

const POKEMON_MOVES = [
  { name: 'Impactrueno', type: 'electrico', power: 40 },
  { name: 'Lanzallamas', type: 'fuego', power: 45 },
  { name: 'Burbuja', type: 'agua', power: 35 },
  { name: 'Hojaafilada', type: 'planta', power: 40 },
  { name: 'Psiquico', type: 'psiquico', power: 50 },
  { name: 'Dragonaliento', type: 'dragon', power: 45 },
  { name: 'Puño Karate', type: 'lucha', power: 40 },
  { name: 'Golpe', type: 'normal', power: 35 },
  { name: 'Rayo', type: 'electrico', power: 45 },
  { name: 'Tiro al blanco', type: 'normal', power: 40 },
];

const BATTLE_POKEMON = [
  { name: 'Pikachu', type: 'electrico', attack: 55, defense: 40, hp: 35 },
  { name: 'Charmander', type: 'fuego', attack: 52, defense: 43, hp: 39 },
  { name: 'Squirtle', type: 'agua', attack: 48, defense: 65, hp: 44 },
  { name: 'Bulbasaur', type: 'planta', attack: 49, defense: 49, hp: 45 },
  { name: 'Eevee', type: 'normal', attack: 55, defense: 50, hp: 55 },
  { name: 'Jigglypuff', type: 'normal', attack: 45, defense: 20, hp: 115 },
  { name: 'Gastly', type: 'psiquico', attack: 35, defense: 30, hp: 30 },
  { name: 'Machop', type: 'lucha', attack: 80, defense: 50, hp: 45 },
];

let activeBattles = new Map();

function startBattle(challengerId, challengerName, opponentId, opponentName) {
  const battleId = `${challengerId}_vs_${opponentId}`;

  if (activeBattles.has(battleId)) {
    return { error: 'Ya hay una batalla activa entre ustedes' };
  }

  const challengerPokemon = BATTLE_POKEMON[Math.floor(Math.random() * BATTLE_POKEMON.length)];
  const opponentPokemon = BATTLE_POKEMON[Math.floor(Math.random() * BATTLE_POKEMON.length)];

  const battle = {
    id: battleId,
    challenger: {
      id: challengerId,
      name: challengerName,
      pokemon: challengerPokemon,
      currentHp: challengerPokemon.hp,
    },
    opponent: {
      id: opponentId,
      name: opponentName,
      pokemon: opponentPokemon,
      currentHp: opponentPokemon.hp,
    },
    turn: 'challenger',
    log: [],
    status: 'active',
    createdAt: new Date(),
  };

  activeBattles.set(battleId, battle);

  let msg = `*POKEBATTLE INICIADA!*\n\n`;
  msg += `${challengerName} (${challengerPokemon.name}) vs ${opponentName} (${opponentPokemon.name})\n\n`;
  msg += `${challengerName} ataca primero!\n`;
  msg += `Escribe *!atacar [movimiento]* para atacar\n\n`;
  msg += `Movimientos: ${POKEMON_MOVES.map(m => m.name).join(', ')}`;

  return { success: true, battle, message: msg };
}

function executeAttack(battleId, attackerId, moveName) {
  const battle = activeBattles.get(battleId);
  if (!battle) return { error: 'Batalla no encontrada' };
  if (battle.status !== 'active') return { error: 'Batalla terminada' };

  const attacker = battle.challenger.id === attackerId ? battle.challenger : battle.opponent;
  const defender = battle.challenger.id === attackerId ? battle.opponent : battle.challenger;

  if (battle.turn !== (battle.challenger.id === attackerId ? 'challenger' : 'opponent')) {
    return { error: 'No es tu turno' };
  }

  const move = POKEMON_MOVES.find(m => m.name.toLowerCase() === moveName.toLowerCase());
  if (!move) {
    return { error: `Movimiento no encontrado. Usa: ${POKEMON_MOVES.map(m => m.name).join(', ')}` };
  }

  let damage = move.power + Math.floor(Math.random() * 20);

  const typeEffectiveness = POKEMON_TYPES[move.type];
  if (typeEffectiveness && typeEffectiveness.fuerte.includes(defender.pokemon.type)) {
    damage = Math.floor(damage * 1.5);
    battle.log.push(`${attacker.name} uso ${move.name} - SUPER EFECTIVO!`);
  } else if (typeEffectiveness && typeEffectiveness.debil.includes(defender.pokemon.type)) {
    damage = Math.floor(damage * 0.5);
    battle.log.push(`${attacker.name} uso ${move.name} - no es muy efectivo...`);
  } else {
    battle.log.push(`${attacker.name} uso ${move.name}`);
  }

  defender.currentHp = Math.max(0, defender.currentHp - damage);

  let msg = `*${attacker.name}* uso *${move.name}*\n`;
  msg += `${defender.name} recibio ${damage} de dano\n`;
  msg += `HP: ${defender.currentHp}/${defender.pokemon.hp}\n\n`;

  if (defender.currentHp <= 0) {
    battle.status = 'finished';
    battle.winner = attacker.id;
    msg += `*${attacker.name} GANO LA BATALLA!*\n`;
    msg += `+15 puntos para ${attacker.name}\n`;
    msg += `+5 puntos para ${defender.name} (participacion)`;

    activeBattles.delete(battleId);
  } else {
    battle.turn = battle.turn === 'challenger' ? 'opponent' : 'challenger';
    msg += `Turno de ${battle.turn === 'challenger' ? battle.challenger.name : battle.opponent.name}`;
  }

  return { success: true, message: msg, battle };
}

function getBattleStatus(battleId) {
  const battle = activeBattles.get(battleId);
  if (!battle) return null;

  let msg = `*BATALLA ACTIVA*\n\n`;
  msg += `${battle.challenger.name} (${battle.challenger.pokemon.name}) - HP: ${battle.challenger.currentHp}/${battle.challenger.pokemon.hp}\n`;
  msg += `vs\n`;
  msg += `${battle.opponent.name} (${battle.opponent.pokemon.name}) - HP: ${battle.opponent.currentHp}/${battle.opponent.pokemon.hp}\n\n`;
  msg += `Turno de: ${battle.turn === 'challenger' ? battle.challenger.name : battle.opponent.name}\n\n`;
  msg += `Movimientos: ${POKEMON_MOVES.map(m => m.name).join(', ')}`;

  return msg;
}

function getActiveBattles() {
  return Array.from(activeBattles.values());
}

function cancelBattle(battleId) {
  const battle = activeBattles.get(battleId);
  if (battle) {
    battle.status = 'cancelled';
    activeBattles.delete(battleId);
    return true;
  }
  return false;
}

function getAllPokemon() {
  return BATTLE_POKEMON;
}

function getAllMoves() {
  return POKEMON_MOVES;
}

module.exports = {
  POKEMON_TYPES,
  POKEMON_MOVES,
  BATTLE_POKEMON,
  startBattle,
  executeAttack,
  getBattleStatus,
  getActiveBattles,
  cancelBattle,
  getAllPokemon,
  getAllMoves,
};
