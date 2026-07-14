const cron = require('node-cron');
const config = require('./config');
const simpleProducts = require('./simpleProducts');
const { sendText, sendMessage } = require('./baileys');
const fs = require('fs');
const path = require('path');

let productScheduler = null;

async function sendDailyProducts() {
  const sellers = simpleProducts.getAllSellers();
  const testGroup = Object.entries(config.GROUPS).find(([id, g]) => g.tipo === 'prueba');

  if (!testGroup) {
    console.log('[PRODUCT-SCHEDULER] No hay grupo de prueba configurado');
    return;
  }

  const [groupId] = testGroup;

  for (const [sellerId, sellerInfo] of Object.entries(sellers)) {
    try {
      const product = simpleProducts.getNextProduct(sellerId);
      if (!product) {
        console.log(`[PRODUCT-SCHEDULER] ${sellerInfo.name} no tiene productos`);
        continue;
      }

      if (product.imageUrl && fs.existsSync(product.imageUrl)) {
        const imageBuffer = fs.readFileSync(product.imageUrl);
        await sendMessage(groupId, {
          image: imageBuffer,
          caption: `*${sellerInfo.name} - Producto para publicar*\n\n${product.text}`,
        });
      } else {
        await sendText(groupId, `*${sellerInfo.name} - Producto para publicar*\n\n${product.text}`);
      }

      console.log(`[PRODUCT-SCHEDULER] Producto enviado a ${sellerInfo.name}: ${product.id}`);
    } catch (e) {
      console.log(`[PRODUCT-SCHEDULER] Error enviando a ${sellerInfo.name}:`, e.message);
    }
  }
}

function startProductScheduler(hour = 7, minute = 0) {
  stopProductScheduler();

  const cronExpression = `${minute} ${hour} * * *`;

  productScheduler = cron.schedule(cronExpression, () => {
    console.log('[PRODUCT-SCHEDULER] Enviando productos diarios...');
    sendDailyProducts();
  }, { timezone: 'America/Bogota' });

  console.log(`[PRODUCT-SCHEDULER] Programado a las ${hour}:${minute.toString().padStart(2, '0')} diariamente`);
}

function stopProductScheduler() {
  if (productScheduler) {
    productScheduler.stop();
    productScheduler = null;
    console.log('[PRODUCT-SCHEDULER] Detenido');
  }
}

module.exports = {
  startProductScheduler,
  stopProductScheduler,
  sendDailyProducts,
};
