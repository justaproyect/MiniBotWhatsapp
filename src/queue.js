const fs = require('fs');
const path = require('path');

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

function addItem(item) {
  const queue = loadQueue();
  const newItem = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    tipo: item.tipo,
    titulo: item.titulo || '',
    contenido: item.contenido || '',
    imageUrl: item.imageUrl || null,
    videoUrl: item.videoUrl || null,
    fecha: item.fecha,
    hora: item.hora || '08:00',
    enviada: false,
    creada: new Date().toISOString(),
  };
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
