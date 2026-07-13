const quizzesData = require('./data/quizzes.json');

let usedQuizIds = [];

function getDailyQuiz() {
  const available = quizzesData.filter((q) => !usedQuizIds.includes(q.id));

  if (available.length === 0) {
    usedQuizIds = [];
    return getDailyQuiz();
  }

  const quiz = available[Math.floor(Math.random() * available.length)];
  usedQuizIds.push(quiz.id);

  const message = [
    `*Pokemon Quiz del Dia*`,
    '',
    `*${quiz.pregunta}*`,
    '',
    ...quiz.opciones,
    '',
    `Responde con A, B, C o D!`,
    '',
    '---',
    `Respuesta: ||${quiz.respuesta}||`,
    `_${quiz.explicacion}_`,
  ].join('\n');

  return { type: 'text', message };
}

module.exports = { getDailyQuiz };
