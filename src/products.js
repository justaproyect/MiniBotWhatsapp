const config = require('./config');

const SELLERS = {
  orlando: {
    id: 'orlando',
    name: 'Orlando',
    number: null,
  },
  luis: {
    id: 'luis',
    name: 'Luis Angel',
    number: null,
  },
};

async function addProduct(sellerId, product) {
  if (!config.MONGO_URI) return null;
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');

    const newProduct = {
      sellerId,
      name: product.name,
      description: product.description || '',
      price: product.price || '',
      imageUrl: product.imageUrl || '',
      category: product.category || 'general',
      status: 'active',
      daysSent: 0,
      lastSent: null,
      createdAt: new Date(),
    };

    const result = await db.collection('seller_products').insertOne(newProduct);
    await client.close();

    console.log(`[PRODUCTS] Producto agregado: ${product.name} para ${sellerId}`);
    return { ...newProduct, _id: result.insertedId };
  } catch (e) {
    console.log('[PRODUCTS] Error:', e.message);
    return null;
  }
}

async function getProducts(sellerId, category = null) {
  if (!config.MONGO_URI) return [];
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');

    const query = { sellerId, status: 'active' };
    if (category) query.category = category;

    const products = await db.collection('seller_products')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    await client.close();
    return products;
  } catch (e) {
    return [];
  }
}

async function getProductById(productId) {
  if (!config.MONGO_URI) return null;
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');

    const product = await db.collection('seller_products').findOne({ _id: require('mongodb').ObjectId(productId) });
    await client.close();
    return product;
  } catch (e) {
    return null;
  }
}

async function updateProduct(productId, updates) {
  if (!config.MONGO_URI) return false;
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');

    await db.collection('seller_products').updateOne(
      { _id: require('mongodb').ObjectId(productId) },
      { $set: updates }
    );

    await client.close();
    return true;
  } catch (e) {
    return false;
  }
}

async function deleteProduct(productId) {
  return updateProduct(productId, { status: 'deleted' });
}

async function markProductSent(productId) {
  return updateProduct(productId, {
    $inc: { daysSent: 1 },
    $set: { lastSent: new Date() },
  });
}

async function getDailyProducts(sellerId, count = 3) {
  if (!config.MONGO_URI) return [];
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');

    const products = await db.collection('seller_products')
      .find({ sellerId, status: 'active' })
      .sort({ lastSent: 1, daysSent: 1 })
      .limit(count)
      .toArray();

    await client.close();
    return products;
  } catch (e) {
    return [];
  }
}

async function getSellerStats(sellerId) {
  if (!config.MONGO_URI) return null;
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(config.MONGO_URI);
    await client.connect();
    const db = client.db(config.MONGO_DB || 'pokemon_bots');

    const total = await db.collection('seller_products').countDocuments({ sellerId, status: 'active' });
    const sent = await db.collection('seller_products').countDocuments({ sellerId, status: 'active', daysSent: { $gt: 0 } });
    const notSent = total - sent;

    await client.close();
    return { total, sent, notSent };
  } catch (e) {
    return null;
  }
}

function getSellerInfo(sellerId) {
  return SELLERS[sellerId] || null;
}

function getAllSellers() {
  return SELLERS;
}

function getCategories() {
  return [
    'figuras',
    'cartas',
    'accesorios',
    'ropa',
    'juguetes',
    'coleccionables',
    'sobres',
    'cajas',
    'general',
  ];
}

module.exports = {
  SELLERS,
  addProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  markProductSent,
  getDailyProducts,
  getSellerStats,
  getSellerInfo,
  getAllSellers,
  getCategories,
};
