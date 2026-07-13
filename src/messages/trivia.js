const triviaData = require('./data/trivia.json');

let usedTriviaIds = [];

function getDailyTrivia() {
  const available = triviaData.filter((t) => !usedTriviaIds.includes(t.id));

  if (available.length === 0) {
    usedTriviaIds = [];
    return getDailyTrivia();
  }

  const trivia = available[Math.floor(Math.random() * available.length)];
  usedTriviaIds.push(trivia.id);

  const message = [
    `*Pokemon Trivia del Dia*`,
    '',
    trivia.texto,
    '',
    `Categoria: *${trivia.categoria}*`,
    '',
    '---',
    'Envia tu opinion o dato extra al grupo!',
  ].join('\n');

  return { type: 'text', message };
}

module.exports = { getDailyTrivia };
