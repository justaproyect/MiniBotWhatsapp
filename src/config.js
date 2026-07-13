const fs = require('fs');
const path = require('path');

let groups = {};

async function loadGroups() {
  if (!process.env.MONGO_URI) {
    const GROUPS_PATH = path.join(__dirname, 'messages', 'data', 'grupos.json');
    try {
      if (fs.existsSync(GROUPS_PATH)) {
        const data = JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
        Object.assign(groups, data);
      }
    } catch (e) {}
    return;
  }

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    const db = client.db(process.env.MONGO_DB || 'pokemon_bots');
    const doc = await db.collection('groups_config').findOne({ _id: 'groups' });
    if (doc && doc.groups) {
      Object.assign(groups, doc.groups);
      console.log('[CONFIG] Grupos cargados:', Object.keys(doc.groups).length);
    }
    await client.close();
  } catch (e) {
    console.log('[CONFIG] Error cargando grupos de MongoDB:', e.message);
  }
}

async function saveGroupsToMongo() {
  if (!process.env.MONGO_URI) {
    const GROUPS_PATH = path.join(__dirname, 'messages', 'data', 'grupos.json');
    fs.writeFileSync(GROUPS_PATH, JSON.stringify(groups, null, 2), 'utf8');
    return;
  }

  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    const db = client.db(process.env.MONGO_DB || 'pokemon_bots');
    await db.collection('groups_config').updateOne(
      { _id: 'groups' },
      { $set: { groups, updatedAt: new Date() } },
      { upsert: true }
    );
    await client.close();
    console.log('[CONFIG] Grupos guardados en MongoDB');
  } catch (e) {
    console.log('[CONFIG] Error guardando grupos en MongoDB:', e.message);
  }
}

module.exports = {
  get GROUPS() { return groups; },

  saveGroups: () => saveGroupsToMongo(),
  loadGroups,

  MONGO_URI: process.env.MONGO_URI || null,
  MONGO_DB: process.env.MONGO_DB || 'pokemon_bots',

  ORCHESTRATOR_URL: process.env.ORCHESTRATOR_URL || 'https://pokemon-orchestrator.onrender.com',

  ADMIN_NUMBER: process.env.ADMIN_NUMBER || null,

  SEND_HOUR: parseInt(process.env.SEND_HOUR) || 8,
  SEND_MINUTE: parseInt(process.env.SEND_MINUTE) || 0,
  TIMEZONE: process.env.TIMEZONE || 'America/Bogota',

  PORT: process.env.PORT || 3000,

  MAX_POKEMON_ID: 1025,

  GROQ_API_KEY: process.env.GROQ_API_KEY || null,

  CONTENT_SCHEDULE: {
    0: 'pokemon-dia',
    1: 'trivia',
    2: 'quiz',
    3: 'imagen-texto',
    4: 'memes',
    5: 'pokemon-dia',
    6: 'quiz',
  },

  MESSAGES: {
    BOT_STARTED: 'Pokemon Bot iniciado correctamente',
    GROUP_DETECTED: 'Grupo detectado:',
    SENT_MESSAGE: 'Mensaje enviado al grupo:',
    ERROR: 'Error:',
    QR_GENERATED: 'Escanea el QR con tu WhatsApp:',
    CONNECTED: 'WhatsApp conectado correctamente',
    SCHEDULE_SET: 'Horario de envío configurado:',
  },
};
