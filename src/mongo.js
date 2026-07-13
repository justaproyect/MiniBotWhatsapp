const { MongoClient, Binary } = require('mongodb');
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
      connectTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
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

function replacer(key, value) {
  if (value instanceof Buffer) {
    return { $type: 'Buffer', data: Array.from(value) };
  }
  return value;
}

function reviver(key, value) {
  if (value && typeof value === 'object' && value.$type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }
  return value;
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
      if (!doc || !doc.data) return null;
      if (typeof doc.data === 'string') {
        return JSON.parse(doc.data, reviver);
      }
      if (doc.data instanceof Binary || (doc.data && doc.data._bsontype === 'Binary')) {
        const str = doc.data.toString('utf8');
        await collection.updateOne({ _id: key }, { $set: { data: str } });
        return JSON.parse(str, reviver);
      }
      return doc.data;
    } catch (e) {
      return null;
    }
  }

  async function writeData(collection, key, data) {
    try {
      const serialized = JSON.stringify(data, replacer);
      await collection.updateOne(
        { _id: key },
        { $set: { data: serialized } },
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
