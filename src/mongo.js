const { MongoClient } = require('mongodb');
const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

const MONGO_URI = process.env.MONGO_URI || null;

let client = null;
let db = null;

async function connectMongo() {
  if (!MONGO_URI) {
    console.log('[MONGO] No hay MONGO_URI configurada. Usando almacenamiento local.');
    return null;
  }

  try {
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db();
    console.log('[MONGO] Conectado a MongoDB Atlas');
    return db;
  } catch (err) {
    console.error('[MONGO] Error conectando a MongoDB:', err.message);
    console.log('[MONGO] Usando almacenamiento local como respaldo');
    return null;
  }
}

async function useMongoDBAuthState() {
  const database = await connectMongo();

  if (!database) {
    return { state: null, saveCreds: null, useFallback: true };
  }

  const credsCollection = database.collection('baileys_creds');
  const keysCollection = database.collection('baileys_keys');

  async function readData(collection, key) {
    try {
      const doc = await collection.findOne({ _id: key });
      return doc ? doc.data : null;
    } catch (e) {
      return null;
    }
  }

  async function writeData(collection, key, data) {
    try {
      await collection.updateOne(
        { _id: key },
        { $set: { data } },
        { upsert: true }
      );
    } catch (e) {
      console.error('[MONGO] Error escribiendo datos:', e.message);
    }
  }

  const creds = await readData(credsCollection, 'creds');
  const state = {
    creds: creds || initAuthCreds(),
    keys: {
      get: async (table, ids) => {
        const result = {};
        for (const id of ids) {
          const data = await readData(keysCollection, `${table}:${id}`);
          result[id] = data;
        }
        return result;
      },
      set: async (data) => {
        for (const [table, entries] of Object.entries(data)) {
          for (const [id, value] of Object.entries(entries)) {
            if (value) {
              await writeData(keysCollection, `${table}:${id}`, value);
            } else {
              try {
                await keysCollection.deleteOne({ _id: `${table}:${id}` });
              } catch (e) {}
            }
          }
        }
      },
    },
  };

  async function saveCreds() {
    await writeData(credsCollection, 'creds', state.creds);
  }

  console.log('[MONGO] Estado de autenticación cargado desde MongoDB');
  return { state, saveCreds };
}

async function closeMongo() {
  if (client) {
    await client.close();
    console.log('[MONGO] Conexión cerrada');
  }
}

module.exports = {
  connectMongo,
  useMongoDBAuthState,
  closeMongo,
};
