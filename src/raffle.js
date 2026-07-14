const config = require('./config');
const points = require('./points');

let currentRaffle = null;

const RAFFLE_PRIZES = [
  { name: 'Sticker exclusivo', points: 100, description: 'Sticker de Pokemon para tu telefono' },
  { name: 'Descuento 5%', points: 200, description: '5% de descuento en tu compra' },
  { name: 'Sobre gratis', points: 300, description: 'Sobre de cartas Pokemon gratis' },
  { name: 'Figura basica', points: 500, description: 'Figura Pokemon basica' },
  { name: 'Descuento 10%', points: 400, description: '10% de descuento en tu compra' },
  { name: 'Figura especial', points: 1000, description: 'Figura Pokemon especial' },
];

function createRaffle() {
  const prize = RAFFLE_PRIZES[Math.floor(Math.random() * RAFFLE_PRIZES.length)];
  const winningNumber = Math.floor(Math.random() * 100) + 1;

  currentRaffle = {
    id: Date.now().toString(36),
    prize,
    winningNumber,
    participants: [],
    createdAt: new Date(),
    status: 'active',
  };

  return currentRaffle;
}

function participateRaffle(userId, userName, number) {
  if (!currentRaffle || currentRaffle.status !== 'active') {
    return { error: 'No hay sorteo activo' };
  }

  if (number < 1 || number > 100) {
    return { error: 'El numero debe ser entre 1 y 100' };
  }

  const exists = currentRaffle.participants.find(p => p.userId === userId);
  if (exists) {
    return { error: 'Ya participaste en este sorteo' };
  }

  currentRaffle.participants.push({
    userId,
    userName,
    number,
    createdAt: new Date(),
  });

  return {
    success: true,
    message: `${userName} eligio el numero *${number}*\nTotal participantes: ${currentRaffle.participants.length}`,
  };
}

function drawRaffle() {
  if (!currentRaffle || currentRaffle.status !== 'active') {
    return { error: 'No hay sorteo activo' };
  }

  if (currentRaffle.participants.length === 0) {
    currentRaffle.status = 'closed';
    return { error: 'No hubo participantes' };
  }

  let winner = null;
  let minDiff = Infinity;

  for (const p of currentRaffle.participants) {
    const diff = Math.abs(p.number - currentRaffle.winningNumber);
    if (diff < minDiff) {
      minDiff = diff;
      winner = p;
    }
  }

  currentRaffle.status = 'closed';
  currentRaffle.winner = winner;
  currentRaffle.winningNumberDrawn = currentRaffle.winningNumber;

  return {
    success: true,
    winner,
    winningNumber: currentRaffle.winningNumber,
    prize: currentRaffle.prize,
    totalParticipants: currentRaffle.participants.length,
  };
}

function getCurrentRaffle() {
  return currentRaffle;
}

function getRaffleStatus() {
  if (!currentRaffle || currentRaffle.status !== 'active') {
    return 'No hay sorteo activo';
  }

  let msg = `*SORTEO ACTIVO*\n\n`;
  msg += `Premio: ${currentRaffle.prize.name}\n`;
  msg += `Descripcion: ${currentRaffle.prize.description}\n`;
  msg += `Participantes: ${currentRaffle.participants.length}\n\n`;
  msg += `Para participar escribe:\n*!sorteo [numero del 1 al 100]*\n\n`;
  msg += `El numero mas cercano al ganador se lleva el premio!`;

  return msg;
}

function getRaffleHistory() {
  return [];
}

function getAllPrizes() {
  return RAFFLE_PRIZES;
}

module.exports = {
  RAFFLE_PRIZES,
  createRaffle,
  participateRaffle,
  drawRaffle,
  getCurrentRaffle,
  getRaffleStatus,
  getRaffleHistory,
  getAllPrizes,
};
