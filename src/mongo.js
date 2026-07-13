const { MongoClient, Binary } = require('mongodb');
const { initAuthCreds } = require('@whiskeysockets/baileys');

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

function serialize(data) {
  return JSON.stringify(data, (key, value) => {
    if (value instanceof Buffer) {
      return { __t: 'Buffer', __v: Array.from(value) };
    }
    if (value instanceof Uint8Array) {
      return { __t: 'Buffer', __v: Array.from(value) };
    }
    if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
      return { __t: 'Buffer', __v: value.data };
    }
    return value;
  });
}

function deserialize(str) {
  return JSON.parse(str, (key, value) => {
    if (value && value.__t === 'Buffer' && Array.isArray(value.__v)) {
      return Buffer.from(value.__v);
    }
    return value;
  });
}

function hasBinaryData(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj instanceof Binary) return true;
  if (obj._bsontype === 'Binary') return true;
  for (const key of Object.keys(obj)) {
    if (hasBinaryData(obj[key])) return true;
  }
  return false;
}

function deepClean(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Binary || obj._bsontype === 'Binary') {
    try {
      const str = obj.toString('utf8');
      return JSON.parse(str, (k, v) => {
        if (v && v.__t === 'Buffer' && Array.isArray(v.__v)) return Buffer.from(v.__v);
        return v;
      });
    } catch (e) {
      return null;
    }
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepClean(item));
  }
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    cleaned[key] = deepClean(value);
  }
  return cleaned;
}

async function useMongoDBAuthState() {
  const database = await connectMongo();

  if (!database) {
    return { state: null, saveCreds: null, useFallback: true };
  }

  const credsCollection = database.collection('baileys_creds');
  const keysCollection = database.collection('baileys_keys');

  const credsDoc = await credsCollection.findOne({ _id: 'creds' });
  if (credsDoc && credsDoc.data && hasBinaryData(credsDoc.data)) {
    console.log('[MONGO] Detectados datos corruptos (Binary). Limpiando...');
    await credsCollection.deleteMany({});
    await keysCollection.deleteMany({});
    console.log('[MONGO] Datos corruptos eliminados. Se creara sesion nueva.');
  }

  async function readData(collection, key) {
    try {
      const doc = await collection.findOne({ _id: key });
      if (!doc || !doc.data) return null;
      if (typeof doc.data === 'string') {
        return deserialize(doc.data);
      }
      if (hasBinaryData(doc.data)) {
        const cleaned = deepClean(doc.data);
        const serialized = serialize(cleaned);
        await collection.updateOne({ _id: key }, { $set: { data: serialized } });
        return cleaned;
      }
      return doc.data;
    } catch (e) {
      return null;
    }
  }

  async function writeData(collection, key, data) {
    try {
      const serialized = serialize(data);
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

  console.log('[MONGO] Estado de autenticacion cargado desde MongoDB');
  return { state, saveCreds };
}

async function closeMongo() {
  if (client) {
    await client.close();
    console.log('[MONGO] Conexion cerrada');
  }
}

module.exports = {
  connectMongo,
  useMongoDBAuthState,
  closeMongo,
};
