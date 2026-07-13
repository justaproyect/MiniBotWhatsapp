const config = require('./config');

const AI_RESPONSE_CHANCE = 0.05;
const MAX_RESPONSES_PER_HOUR = 2;
const TRIGGER_KEYWORDS = [
  'oye bot', 'hola bot', 'bot opinion',
];

let responseCount = 0;
let lastResetHour = new Date().getHours();

async function callGroq(prompt, systemPrompt) {
  const GROQ_API_KEY = config.GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return null;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('[AI] Error Groq:', e.message);
    return null;
  }
}

function shouldRespond() {
  const currentHour = new Date().getHours();
  if (currentHour !== lastResetHour) {
    responseCount = 0;
    lastResetHour = currentHour;
  }

  if (responseCount >= MAX_RESPONSES_PER_HOUR) return false;

  if (Math.random() < AI_RESPONSE_CHANCE) {
    responseCount++;
    return true;
  }

  return false;
}

function hasTriggerKeyword(text) {
  const lower = text.toLowerCase();
  return TRIGGER_KEYWORDS.some(kw => lower.includes(kw));
}

const POKEMON_SYSTEM_PROMPT = `Eres un asistente virtual de la comunidad Pokemon de Toytsuky, una tienda de productos Pokemon en Sincelejo, Sucre, Colombia.

REGLAS:
- Responde breve y en español (maximo 2-3 lineas)
- Usa emojis de Pokemon ocasionales
- Si preguntan por precios, di que visiten la tienda o usen !tienda
- Si preguntan por productos, di que usen !pedidos
- Si preguntan por puntos, di que usen !puntos
- Si no sabes algo, di que pregunten en el grupo
- Nunca inventes precios o informacion falsa
- Sé amigable y entusiasta como un entrenador Pokemon
- No des respuestas largas, mantenlo corto y divertido`;

async function generateResponse(messageText, senderName) {
  const prompt = `${senderName} dice: "${messageText}"

Responde como un asistente Pokemon amigable y breve. Si es una pregunta, responde. Si es un saludo, saluda. Si no es relevante, ignora (responde vacio).`;

  const response = await callGroq(prompt, POKEMON_SYSTEM_PROMPT);
  return response;
}

async function handleAIMessage(groupId, messageText, senderName, userId) {
  if (!hasTriggerKeyword(messageText) && !shouldRespond()) {
    return null;
  }

  if (messageText.startsWith('!')) return null;
  if (messageText.length < 5) return null;

  console.log(`[AI] Generando respuesta para: "${messageText.substring(0, 50)}..."`);

  const response = await generateResponse(messageText, senderName);

  if (!response || response.trim() === '' || response.toLowerCase().includes('ignorar')) {
    return null;
  }

  if (response.length > 300) {
    return response.substring(0, 297) + '...';
  }

  return response;
}

function getStats() {
  return {
    responseCount,
    maxPerHour: MAX_RESPONSES_PER_HOUR,
    chance: AI_RESPONSE_CHANCE,
    triggers: TRIGGER_KEYWORDS,
  };
}

module.exports = {
  handleAIMessage,
  getStats,
  shouldRespond,
};
