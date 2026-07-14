const express = require('express');
const config = require('./config');
const { connectToWhatsApp, isBotConnected, getQR, sendMessage, sendText } = require('./baileys');
const { startScheduler, sendDailyMessages } = require('./scheduler');
const { startTodayActivity } = require('./todayScheduler');
const { startProductScheduler } = require('./simpleProductScheduler');
const engagement = require('./engagement');
const adminRouter = require('./admin');
const cloudinary = require('./cloudinary');

cloudinary.configure();

global.sendToGroup = async (groupId, text) => {
  try {
    await sendText(groupId, text);
    console.log(`[GLOBAL] Mensaje enviado a ${groupId}`);
  } catch (err) {
    console.error(`[GLOBAL] Error enviando a ${groupId}:`, err.message);
  }
};

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  const registeredGroups = Object.entries(config.GROUPS).filter(([id, g]) => g.registrado);
  res.status(200).json({
    status: 'ok',
    botConnected: isBotConnected(),
    gruposRegistrados: registeredGroups.length,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/admin', adminRouter);

app.get('/hoy', (req, res) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const dayName = days[today.getDay()];

  const queue = require('./queue');
  const items = queue.getAllItems();
  const todayItems = items.filter(i => i.fecha === todayStr && !i.enviada);

  const community = require('./community');
  const special = community.getWeeklySpecial();
  const challenge = community.getDailyChallenge();

  const grupos = Object.entries(config.GROUPS).filter(([id, g]) => g.registrado);

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contenido de Hoy - Toytsuky</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: #eee; min-height: 100vh; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #ffcb05; font-size: 2em; margin-bottom: 10px; }
        .header .date { color: #aaa; font-size: 1.1em; }
        .card { background: rgba(22, 33, 62, 0.95); border-radius: 15px; padding: 20px; margin-bottom: 20px; border: 1px solid rgba(255, 203, 5, 0.2); }
        .card h2 { color: #ffcb05; margin-bottom: 15px; font-size: 1.3em; }
        .special { background: rgba(255, 203, 5, 0.1); border-left: 4px solid #ffcb05; }
        .challenge { background: rgba(76, 175, 80, 0.1); border-left: 4px solid #4caf50; }
        .queue-item { background: rgba(33, 150, 243, 0.1); border-left: 4px solid #2196f3; margin-bottom: 10px; padding: 15px; border-radius: 8px; }
        .queue-item .time { color: #ffcb05; font-weight: bold; }
        .queue-item .group { color: #aaa; font-size: 0.9em; }
        .queue-item .title { font-weight: bold; margin: 5px 0; }
        .queue-item .content { color: #ccc; font-size: 0.9em; white-space: pre-line; }
        .no-content { color: #aaa; text-align: center; padding: 20px; }
        .groups { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; }
        .group-badge { background: rgba(255, 203, 5, 0.2); padding: 5px 12px; border-radius: 15px; font-size: 0.85em; }
        .refresh { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #ffcb05; color: #1a1a2e; border-radius: 8px; text-decoration: none; font-weight: bold; }
        .refresh:hover { background: #e6b800; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TOYTSUKY</h1>
          <div class="date">${dayName} ${todayStr}</div>
        </div>

        <div class="card special">
          <h2>Actividad Especial del Dia</h2>
          <p><strong>${special.nombre}</strong></p>
          <p>${special.message}</p>
        </div>

        <div class="card challenge">
          <h2>Reto del Dia</h2>
          <p><strong>${challenge.nombre}</strong></p>
          <p>Escribe <code>!retodia</code> en el grupo para ver el reto</p>
        </div>

        <div class="card">
          <h2>Contenido Programado para Hoy</h2>
          ${todayItems.length > 0 ? todayItems.map(item => {
            const grupo = grupos.find(([id, g]) => g.tipo === item.tipo);
            const groupName = grupo ? grupo[1].nombre : item.tipo;
            return `
              <div class="queue-item">
                <span class="time">${item.hora}</span>
                <span class="group">${groupName}</span>
                <div class="title">${item.titulo || '(Sin titulo)'}</div>
                <div class="content">${item.contenido.substring(0, 200)}${item.contenido.length > 200 ? '...' : ''}</div>
                ${item.imageUrl ? '<p style="color:#4caf50;">Tiene imagen</p>' : ''}
              </div>
            `;
          }).join('') : '<p class="no-content">No hay contenido programado para hoy</p>'}
        </div>

        <div class="card">
          <h2>Grupos Activos</h2>
          <div class="groups">
            ${grupos.map(([id, g]) => `<span class="group-badge">${g.nombre}</span>`).join('')}
          </div>
        </div>

        <div style="text-align: center;">
          <a href="/hoy" class="refresh">Actualizar</a>
          <a href="/admin" class="refresh" style="margin-left: 10px; background: #333; color: #fff;">Admin Panel</a>
        </div>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

app.get('/qr', (req, res) => {
  const qr = getQR();
  if (qr) res.json({ qr });
  else if (isBotConnected()) res.json({ connected: true });
  else res.json({ waiting: true });
});

app.get('/', (req, res) => {
  const qr = getQR();
  const connected = isBotConnected();
  const grupos = Object.entries(config.GROUPS).filter(([id, g]) => g.registrado);
  const qrImage = qr ? `<img src="${qr}" alt="QR Code" style="width:300px;height:300px;border-radius:10px;" />` : '';
  const statusText = connected ? 'Conectado' : (qr ? 'Escanea el QR' : 'Esperando QR...');
  const statusColor = connected ? '#4caf50' : (qr ? '#ff9800' : '#f44336');

  const gruposHtml = grupos.length > 0
    ? grupos.map(([id, g]) => `<div style="padding:8px;margin:4px 0;background:rgba(255,255,255,0.05);border-radius:8px;border-left:3px solid ${statusColor};">✅ ${g.nombre} <span style="color:#aaa;">(${g.tipo})</span></div>`).join('')
    : '<p style="color:#aaa;">No hay grupos registrados aún</p>';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pokemon WhatsApp Bot</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          color: #eee;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .card {
          background: rgba(22, 33, 62, 0.95);
          padding: 40px;
          border-radius: 20px;
          text-align: center;
          box-shadow: 0 10px 40px rgba(0,0,0,0.4);
          max-width: 600px;
          width: 100%;
          border: 1px solid rgba(255, 203, 5, 0.2);
        }
        h1 { color: #ffcb05; font-size: 1.8em; margin-bottom: 5px; text-shadow: 0 2px 10px rgba(255, 203, 5, 0.3); }
        .subtitle { color: #aaa; margin-bottom: 25px; font-size: 0.9em; }
        .status-badge {
          display: inline-block;
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: bold;
          margin: 10px 0;
          font-size: 0.95em;
        }
        .connected { background: rgba(76, 175, 80, 0.2); color: #4caf50; border: 1px solid #4caf50; }
        .waiting { background: rgba(255, 152, 0, 0.2); color: #ff9800; border: 1px solid #ff9800; }
        .disconnected { background: rgba(244, 67, 54, 0.2); color: #f44336; border: 1px solid #f44336; }
        .qr-section {
          margin: 25px 0;
          padding: 20px;
          background: rgba(255,255,255,0.05);
          border-radius: 15px;
        }
        .qr-section img { display: block; margin: 0 auto; }
        .qr-label { color: #aaa; margin-top: 15px; font-size: 0.85em; }
        .info-box {
          margin-top: 20px;
          padding: 15px;
          background: rgba(255,203,5,0.08);
          border-radius: 10px;
          border-left: 3px solid #ffcb05;
          text-align: left;
          font-size: 0.85em;
          line-height: 1.6;
        }
        .info-box code {
          background: rgba(255,255,255,0.1);
          padding: 2px 6px;
          border-radius: 4px;
          color: #ffcb05;
        }
        .pokeball {
          width: 60px; height: 60px; margin: 0 auto 15px; border-radius: 50%;
          background: linear-gradient(180deg, #ff1a1a 0%, #ff1a1a 45%, #333 45%, #333 55%, #fff 55%, #fff 100%);
          position: relative; border: 3px solid #333;
        }
        .pokeball::after {
          content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 15px; height: 15px; background: #fff; border-radius: 50%; border: 3px solid #333;
        }
        .pokeball::before {
          content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 3px; background: #333; transform: translateY(-50%);
        }
        .groups-section { margin-top: 20px; text-align: left; }
        .groups-title { color: #ffcb05; font-size: 1em; margin-bottom: 10px; }
        .schedule { color: #aaa; margin-top: 15px; font-size: 0.8em; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .loading { animation: pulse 1.5s infinite; }
        .commands { margin-top: 15px; font-size: 0.8em; color: #888; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="pokeball"></div>
        <h1>Pokemon Bot</h1>
        <p class="subtitle">Bot de WhatsApp para tu comunidad Pokemon (7 grupos)</p>

        <div class="status-badge ${connected ? 'connected' : (qr ? 'waiting' : 'disconnected')}">
          ${statusText}
        </div>

        ${!connected ? `
        <div class="qr-section">
          ${qrImage || '<p class="loading" style="color:#aaa;">Generando QR...</p>'}
          <p class="qr-label">Abre WhatsApp > Configuraciones > Dispositivos vinculados > Vincular dispositivo</p>
        </div>
        ` : ''}

        <div class="groups-section">
          <div class="groups-title">Grupos Registrados (${grupos.length}/7)</div>
          ${gruposHtml}
        </div>

        ${connected ? `
        <div class="commands">
          Comandos: <code>!ayuda</code> <code>!pokemon</code> <code>!ping</code> <code>!trivia</code> <code>!top</code>
        </div>
        ` : ''}

        <div class="schedule">
          Envío automático: ${config.SEND_HOUR}:${config.SEND_MINUTE.toString().padStart(2, '0')} (${config.TIMEZONE})
        </div>
      </div>
      ${!connected ? '<script>setTimeout(() => location.reload(), 3000);</script>' : ''}
    </body>
    </html>
  `);
});

app.get('/send-now', async (req, res) => {
  try {
    await sendDailyMessages();
    res.json({ success: true, message: 'Mensajes enviados a todos los grupos' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/probar', async (req, res) => {
  try {
    const { message, imageUrl, groupId } = req.body;

    if (!groupId) {
      return res.status(400).json({ success: false, error: 'Falta groupId del grupo de prueba' });
    }

    const registeredGroups = config.GROUPS;
    const groupEntry = Object.values(registeredGroups).find(g => g.id === groupId);
    if (!groupEntry) {
      return res.status(400).json({ success: false, error: 'Grupo no registrado en MiniBot' });
    }

    if (imageUrl) {
      const axios = require('axios');
      try {
        const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const imgBuffer = Buffer.from(imgRes.data);
        await sendMessage(groupId, { image: imgBuffer, caption: message || '' });
      } catch (imgErr) {
        console.error('[PROBAR] Error descargando imagen:', imgErr.message);
        await sendText(groupId, message || '(Error al cargar imagen)');
      }
    } else {
      await sendText(groupId, message || '(Sin mensaje)');
    }

    console.log(`[PROBAR] Post de prueba enviado a grupo ${groupId}`);
    res.json({ success: true, message: 'Post enviado al grupo de prueba' });
  } catch (err) {
    console.error('[PROBAR] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const server = app.listen(config.PORT, async () => {
  console.log(`\n[EXPRESS] Servidor corriendo en puerto ${config.PORT}`);
  console.log(`[EXPRESS] Abre http://localhost:${config.PORT} en tu navegador para ver el QR`);
  console.log(`[EXPRESS] Health check: http://localhost:${config.PORT}/health\n`);

  await config.loadGroups();
  console.log('[MAIN] Grupos cargados desde MongoDB');

  connectToWhatsApp(
    (groupId) => {
      console.log(`[MAIN] Grupo detectado: ${groupId}`);
    },
    () => {
      console.log('[MAIN] Bot listo. Iniciando programador...');
      startScheduler();
      startProductScheduler(7, 0);
    }
  );
});

process.on('SIGINT', () => {
  console.log('\n[MAIN] Cerrando bot...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[MAIN] Cerrando bot...');
  server.close();
  process.exit(0);
});
