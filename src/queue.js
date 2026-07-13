const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cloudinary = require('./cloudinary');

const QUEUE_PATH = path.join(__dirname, 'data', 'content-queue.json');

function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_PATH)) {
      return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
    }
  } catch (e) {}
  return { items: [] };
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf8');
}

async function downloadMedia(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    return Buffer.from(res.data);
  } catch (e) {
    console.error('[QUEUE] Error descargando media:', e.message);
    return null;
  }
}

async function addItem(item) {
  const queue = loadQueue();
  const newItem = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    tipo: item.tipo,
    titulo: item.titulo || '',
    contenido: item.contenido || '',
    imageUrl: null,
    videoUrl: null,
    fecha: item.fecha,
    hora: item.hora || '08:00',
    enviada: false,
    creada: new Date().toISOString(),
  };

  const isCloudinaryUrl = (url) => url && url.includes('cloudinary.com');

  if (item.imageUrl) {
    if (isCloudinaryUrl(item.imageUrl)) {
      newItem.imageUrl = item.imageUrl;
      console.log('[QUEUE] Imagen ya esta en Cloudinary, guardando URL');
    } else if (cloudinary.isAvailable()) {
      console.log('[QUEUE] Subiendo imagen a Cloudinary...');
      const cloudUrl = await cloudinary.uploadFromUrl(item.imageUrl, `queue_${newItem.id}`);
      if (cloudUrl) {
        newItem.imageUrl = cloudUrl;
        console.log('[QUEUE] Imagen guardada en Cloudinary');
      } else {
        newItem.imageUrl = item.imageUrl;
        console.log('[QUEUE] Cloudinary fallo, usando URL original');
      }
    } else {
      newItem.imageUrl = item.imageUrl;
    }
  }

  if (item.videoUrl) {
    if (isCloudinaryUrl(item.videoUrl)) {
      newItem.videoUrl = item.videoUrl;
      console.log('[QUEUE] Video ya esta en Cloudinary, guardando URL');
    } else if (cloudinary.isAvailable()) {
      console.log('[QUEUE] Subiendo video a Cloudinary...');
      const cloudUrl = await cloudinary.uploadFromUrl(item.videoUrl, `queue_${newItem.id}`);
      if (cloudUrl) {
        newItem.videoUrl = cloudUrl;
        console.log('[QUEUE] Video guardado en Cloudinary');
      } else {
        newItem.videoUrl = item.videoUrl;
        console.log('[QUEUE] Cloudinary fallo, usando URL original');
      }
    } else {
      newItem.videoUrl = item.videoUrl;
    }
  }

  queue.items.push(newItem);
  saveQueue(queue);
  return newItem;
}

function removeItem(id) {
  const queue = loadQueue();
  queue.items = queue.items.filter(item => item.id !== id);
  saveQueue(queue);
  return true;
}

function markAsSent(id) {
  const queue = loadQueue();
  const item = queue.items.find(i => i.id === id);
  if (item) {
    item.enviada = true;
    item.enviadaEn = new Date().toISOString();
    saveQueue(queue);
  }
  return true;
}

function getPendingItems(tipo) {
  const queue = loadQueue();
  const now = new Date();
  return queue.items.filter(item => {
    if (item.enviada) return false;
    if (tipo && item.tipo !== tipo) return false;
    const itemDate = new Date(item.fecha + 'T' + item.hora);
    return itemDate <= now;
  });
}

function getAllItems(filtro) {
  const queue = loadQueue();
  let items = queue.items;
  if (filtro) {
    items = items.filter(i => i.tipo === filtro);
  }
  return items.sort((a, b) => {
    const dateA = new Date(a.fecha + 'T' + a.hora);
    const dateB = new Date(b.fecha + 'T' + b.hora);
    return dateA - dateB;
  });
}

function getUpcomingItems(dias = 7) {
  const queue = loadQueue();
  const now = new Date();
  const maxDate = new Date(now.getTime() + dias * 24 * 60 * 60 * 1000);
  return queue.items.filter(item => {
    const itemDate = new Date(item.fecha + 'T' + item.hora);
    return itemDate >= now && itemDate <= maxDate && !item.enviada;
  }).sort((a, b) => {
    const dateA = new Date(a.fecha + 'T' + a.hora);
    const dateB = new Date(b.fecha + 'T' + b.hora);
    return dateA - dateB;
  });
}

module.exports = {
  addItem,
  removeItem,
  markAsSent,
  getPendingItems,
  getAllItems,
  getUpcomingItems,
  loadQueue,
  saveQueue,
};
