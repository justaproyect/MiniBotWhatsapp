const cron = require('node-cron');
const config = require('./config');
const products = require('./products');
const { sendText, sendMessage } = require('./baileys');
const axios = require('axios');

let productScheduler = null;

async function sendDailyProducts() {
  const sellers = products.getAllSellers();
  const testGroup = Object.entries(config.GROUPS).find(([id, g]) => g.tipo === 'prueba');

  if (!testGroup) {
    console.log('[PRODUCT-SCHEDULER] No hay grupo de prueba configurado');
    return;
  }

  const [groupId] = testGroup;

  for (const [sellerId, sellerInfo] of Object.entries(sellers)) {
    try {
      const dailyProducts = await products.getDailyProducts(sellerId, 3);

      if (dailyProducts.length === 0) {
        console.log(`[PRODUCT-SCHEDULER] ${sellerInfo.name} no tiene productos para enviar`);
        continue;
      }

      let msg = `*PRODUCTOS PARA PUBLICAR HOY - ${sellerInfo.name}*\n\n`;
      msg += `Fecha: ${new Date().toLocaleDateString('es-CO')}\n`;
      msg += `Productos: ${dailyProducts.length}\n\n`;
      msg += `---\n\n`;

      for (const product of dailyProducts) {
        msg += `*${product.name}*\n`;
        if (product.price) msg += `Precio: ${product.price}\n`;
        if (product.description) msg += `${product.description}\n`;
        msg += `Categoria: ${product.category}\n`;
        msg += `\n`;

        if (product.imageUrl) {
          try {
            const imgRes = await axios.get(product.imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
            const imgBuffer = Buffer.from(imgRes.data);
            await sendMessage(groupId, {
              image: imgBuffer,
              caption: `*${product.name}*\n${product.price ? 'Precio: ' + product.price : ''}\n${product.description || ''}\n\n_Publicar en: Facebook, Instagram, TikTok_`,
            });
          } catch (imgErr) {
            console.log(`[PRODUCT-SCHEDULER] Error enviando imagen de ${product.name}:`, imgErr.message);
            await sendText(groupId, msg);
          }

          await products.markProductSent(product._id.toString());
        }
      }

      if (dailyProducts.some(p => !p.imageUrl)) {
        await sendText(groupId, msg);
      }

      console.log(`[PRODUCT-SCHEDULER] Productos enviados a ${sellerInfo.name}: ${dailyProducts.length}`);
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
