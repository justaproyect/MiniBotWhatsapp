const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.join(__dirname, '..', 'products');

const SELLERS = {
  orlando: {
    id: 'orlando',
    name: 'Orlando',
    order: 'forward',
  },
  luis: {
    id: 'luis',
    name: 'Luis Angel',
    order: 'backward',
  },
};

function getSellerDir(sellerId) {
  return path.join(PRODUCTS_DIR, sellerId);
}

function ensureSellerDir(sellerId) {
  const dir = getSellerDir(sellerId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getProducts(sellerId) {
  const dir = getSellerDir(sellerId);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir);
  const products = [];

  for (const file of files) {
    if (file.endsWith('.txt')) {
      const name = file.replace('.txt', '');
      const txtPath = path.join(dir, file);
      const text = fs.readFileSync(txtPath, 'utf8');

      const possibleImages = [`${name}.jpg`, `${name}.png`, `${name}.jpeg`, `${name}.webp`];
      let imageUrl = null;
      for (const img of possibleImages) {
        const imgPath = path.join(dir, img);
        if (fs.existsSync(imgPath)) {
          imageUrl = imgPath;
          break;
        }
      }

      products.push({
        id: name,
        text: text.trim(),
        imageUrl,
        sellerId,
      });
    }
  }

  return products.sort((a, b) => {
    const numA = parseInt(a.id) || 0;
    const numB = parseInt(b.id) || 0;
    return numA - numB;
  });
}

function getNextProduct(sellerId) {
  const seller = SELLERS[sellerId];
  if (!seller) return null;

  const products = getProducts(sellerId);
  if (products.length === 0) return null;

  const state = loadState();
  const currentIndex = state[sellerId]?.currentIndex || 0;

  let product;
  if (seller.order === 'forward') {
    product = products[currentIndex % products.length];
    state[sellerId] = { currentIndex: (currentIndex + 1) % products.length };
  } else {
    product = products[products.length - 1 - (currentIndex % products.length)];
    state[sellerId] = { currentIndex: (currentIndex + 1) % products.length };
  }

  saveState(state);
  return product;
}

function loadState() {
  const statePath = path.join(PRODUCTS_DIR, 'state.json');
  try {
    if (fs.existsSync(statePath)) {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveState(state) {
  const statePath = path.join(PRODUCTS_DIR, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

function resetState() {
  saveState({});
}

function getSellerInfo(sellerId) {
  return SELLERS[sellerId] || null;
}

function getAllSellers() {
  return SELLERS;
}

function getStats(sellerId) {
  const products = getProducts(sellerId);
  const state = loadState();
  const sent = state[sellerId]?.currentIndex || 0;

  return {
    total: products.length,
    sent,
    pending: products.length - sent,
  };
}

module.exports = {
  SELLERS,
  PRODUCTS_DIR,
  getSellerDir,
  ensureSellerDir,
  getProducts,
  getNextProduct,
  loadState,
  saveState,
  resetState,
  getSellerInfo,
  getAllSellers,
  getStats,
};
