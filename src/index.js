const express = require('express');
const config = require('./config');
const { connectToWhatsApp, isBotConnected, getQR, sendText } = require('./baileys');
const { startScheduler, sendDailyMessages } = require('./scheduler');
const engagement = require('./engagement');
const adminRouter = require('./admin');
const cloudinary = require('./cloudinary');

cloudinary.configure();

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

const server = app.listen(config.PORT, () => {
  console.log(`\n[EXPRESS] Servidor corriendo en puerto ${config.PORT}`);
  console.log(`[EXPRESS] Abre http://localhost:${config.PORT} en tu navegador para ver el QR`);
  console.log(`[EXPRESS] Health check: http://localhost:${config.PORT}/health\n`);

  connectToWhatsApp(
    (groupId) => {
      console.log(`[MAIN] Grupo detectado: ${groupId}`);
    },
    () => {
      console.log('[MAIN] Bot listo. Iniciando programador...');
      startScheduler();
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
