const config = require('./config');

const POINTS_PER_ACTION = {
  mensaje: 1,
  trivia_correcta: 10,
  pokemon_visto: 5,
  pokebattle_ganada: 15,
  pokebattle_perdida: 5,
  quiz_correcto: 20,
  referido: 50,
  referido_nuevo: 25,
  daily_login: 5,
  compra: 100,
};

const REWARDS = [
  { name: 'Sticker Pokemon', points: 100, description: 'Sticker exclusivo de Pokemon' },
  { name: 'Descuento 5%', points: 200, description: 'Descuento del 5% en tu compra' },
  { name: 'Figura basica', points: 500, description: 'Figura Pokemon basica' },
  { name: 'Sobre de cartas', points: 300, description: 'Sobre de cartas Pokemon aleatorio' },
  { name: 'Descuento 10%', points: 400, description: 'Descuento del 10% en tu compra' },
  { name: 'Figura especial', points: 1000, description: 'Figura Pokemon especial' },
  { name: 'Manga Pokemon', points: 800, description: 'Manga Pokemon volumen 1' },
  { name: 'Envio gratis', points: 600, description: 'Envio gratis en tu proxima compra' },
];

async function getPoints(userId) {
  if (!config.MONGO_URI) return 0;
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');
    const doc = await db.collection('user_points').findOne({ userId });
    await client.close();
    return doc?.points || 0;
  } catch (e) {
    return 0;
  }
}

async function addPoints(userId, userName, action, amount) {
  if (!config.MONGO_URI) return;
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');

    const points = amount || POINTS_PER_ACTION[action] || 0;
    if (points === 0) {
      await client.close();
      return;
    }

    await db.collection('user_points').updateOne(
      { userId },
      {
        $inc: { points },
        $setOnInsert: { userName, createdAt: new Date() },
        $set: { lastActive: new Date() },
        $push: {
          history: { action, points, date: new Date() },
        },
      },
      { upsert: true }
    );

    await client.close();
    console.log(`[POINTS] +${points} a ${userName} (${userId}) por ${action}`);
  } catch (e) {
    console.log('[POINTS] Error:', e.message);
  }
}

async function removePoints(userId, amount) {
  if (!config.MONGO_URI) return;
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');

    const doc = await db.collection('user_points').findOne({ userId });
    if (!doc || doc.points < amount) {
      await client.close();
      return false;
    }

    await db.collection('user_points').updateOne(
      { userId },
      { $inc: { points: -amount } }
    );

    await client.close();
    return true;
  } catch (e) {
    return false;
  }
}

async function getTopUsers(limit = 10) {
  if (!config.MONGO_URI) return [];
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');
    const top = await db.collection('user_points')
      .find({})
      .sort({ points: -1 })
      .limit(limit)
      .toArray();
    await client.close();
    return top;
  } catch (e) {
    return [];
  }
}

async function useReferral(referrerId, newUserId, newUserName) {
  if (!config.MONGO_URI) return null;
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');

    const existing = await db.collection('referrals').findOne({ newUserId });
    if (existing) {
      await client.close();
      return { error: 'Ya fuiste referido anteriormente' };
    }

    const referrer = await db.collection('user_points').findOne({ userId: referrerId });
    if (!referrer) {
      await client.close();
      return { error: 'El usuario que te referio no esta registrado' };
    }

    await db.collection('referrals').insertOne({
      referrerId,
      referrerName: referrer.userName,
      newUserId,
      newUserName,
      createdAt: new Date(),
    });

    await addPoints(referrerId, referrer.userName, 'referido', POINTS_PER_ACTION.referido);
    await addPoints(newUserId, newUserName, 'referido_nuevo', POINTS_PER_ACTION.referido_nuevo);

    await client.close();
    return {
      success: true,
      referrerName: referrer.userName,
      pointsEarned: POINTS_PER_ACTION.referido,
    };
  } catch (e) {
    return null;
  }
}

async function getReferralCount(referrerId) {
  if (!config.MONGO_URI) return 0;
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');
    const count = await db.collection('referrals').countDocuments({ referrerId });
    await client.close();
    return count;
  } catch (e) {
    return 0;
  }
}

function getRewards() {
  return REWARDS;
}

module.exports = {
  POINTS_PER_ACTION,
  REWARDS,
  getPoints,
  addPoints,
  removePoints,
  getTopUsers,
  useReferral,
  getReferralCount,
  getRewards,
};
