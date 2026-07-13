const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const queue = require('./queue');
const multer = require('multer');
const XLSX = require('xlsx');
const cloudinary = require('./cloudinary');

const router = express.Router();
const CONTENT_PATH = path.join(__dirname, 'data', 'custom-content.json');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function loadContent() {
  try {
    if (fs.existsSync(CONTENT_PATH)) {
      return JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveContent(content) {
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2), 'utf8');
}

router.get('/', (req, res) => {
  const content = loadContent();
  const queueItems = queue.getAllItems();
  res.send(getAdminHTML(content, queueItems));
});

router.post('/save', (req, res) => {
  try {
    const content = req.body;
    saveContent(content);
    res.json({ success: true, message: 'Contenido guardado' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/preview/:tipo', (req, res) => {
  try {
    const { tipo } = req.params;
    const content = loadContent();
    const grupo = content[tipo];
    if (!grupo) return res.status(404).json({ error: 'Tipo no encontrado' });
    res.json({ success: true, content: grupo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/test/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    const { generateDailyContent } = require('./messages/generator');
    const { sendMessage, isBotConnected } = require('./baileys');

    if (!isBotConnected()) {
      return res.json({ success: false, error: 'Bot no conectado' });
    }

    const registeredGroups = Object.entries(config.GROUPS).filter(([id, g]) => g.registrado && g.tipo === tipo);
    if (registeredGroups.length === 0) {
      return res.json({ success: false, error: 'No hay grupos registrados de tipo: ' + tipo });
    }

    const content = await generateDailyContent(tipo);
    let enviados = 0;

    for (const [groupId] of registeredGroups) {
      try {
        if (content.type === 'image' && content.imageBuffer) {
          await sendMessage(groupId, {
            image: content.imageBuffer,
            caption: content.formattedMessage || content.caption || '',
          });
        } else {
          await sendMessage(groupId, { text: content.message });
        }
        enviados++;
      } catch (e) {
        console.error('[ADMIN] Error enviando a grupo:', e.message);
      }
    }

    res.json({ success: true, message: 'Enviado a ' + enviados + ' grupo(s)' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/queue/add', async (req, res) => {
  try {
    const item = await queue.addItem(req.body);
    res.json({ success: true, item });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/queue/delete', (req, res) => {
  try {
    const { id } = req.body;
    queue.removeItem(id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/queue/list', (req, res) => {
  try {
    const items = queue.getAllItems();
    res.json({ success: true, items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/upload-media', upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se subio ningun archivo' });
    }

    if (!cloudinary.isAvailable()) {
      return res.status(400).json({ success: false, error: 'Cloudinary no configurado. Agrega las variables de entorno.' });
    }

    const isVideo = req.file.mimetype.startsWith('video/');
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploadStream
        ? null
        : null;

      const cloudinaryV2 = require('cloudinary').v2;
      const stream = cloudinaryV2.uploader.upload_stream(
        {
          folder: 'pokemon-bot',
          public_id: `upload_${Date.now()}`,
          resource_type: isVideo ? 'video' : 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.json({ success: true, url: result.secure_url, type: isVideo ? 'video' : 'image' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/cloudinary-status', (req, res) => {
  res.json({ configured: cloudinary.isAvailable() });
});

router.post('/queue/upload-excel', upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se subio ningun archivo' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'El Excel esta vacio' });
    }

    const tiposValidos = ['general', 'compra', 'rifas', 'torneos', 'subastas', 'tienda', 'anuncios', 'prueba'];
    let agregados = 0;
    let errores = [];

    for (const [index, row] of rows.entries()) {
      const tipo = (row.tipo || row.Tipo || row.GRUPO || row.grupo || '').toLowerCase().trim();
      const titulo = row.titulo || row.Titulo || row.TITULO || '';
      const contenido = row.contenido || row.Contenido || row.CONTENIDO || row.mensaje || row.Mensaje || '';
      const imageUrl = row.imagen || row.Imagen || row.IMAGEN || row.image || row['URL imagen'] || null;
      const videoUrl = row.video || row.Video || row.VIDEO || row['URL video'] || null;
      const fecha = row.fecha || row.Fecha || row.FECHA || '';
      const hora = row.hora || row.Hora || row.HORA || '08:00';

      if (!tipo || !tiposValidos.includes(tipo)) {
        errores.push(`Fila ${index + 1}: Tipo invalido "${tipo}"`);
        continue;
      }
      if (!contenido) {
        errores.push(`Fila ${index + 1}: Sin contenido`);
        continue;
      }
      if (!fecha) {
        errores.push(`Fila ${index + 1}: Sin fecha`);
        continue;
      }

      const fechaStr = String(fecha);
      let fechaFormateada = fechaStr;
      if (fechaStr.includes('/')) {
        const parts = fechaStr.split('/');
        if (parts.length === 3) {
          fechaFormateada = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      await queue.addItem({
        tipo,
        titulo,
        contenido,
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        fecha: fechaFormateada,
        hora: String(hora).length === 5 ? hora : '08:00',
      });
      agregados++;
    }

    let mensaje = `${agregados} items agregados a la cola`;
    if (errores.length > 0) {
      mensaje += `. ${errores.length} errores: ${errores.slice(0, 3).join('; ')}`;
    }

    res.json({ success: true, message: mensaje, agregados, errores });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Error leyendo Excel: ' + e.message });
  }
});

router.get('/queue/template', (req, res) => {
  const wb = XLSX.utils.book_new();
  const data = [
    { tipo: 'general', titulo: 'Pokemon del dia', contenido: 'Hoy te presentamos a un Pokemon especial...', imagen: 'https://i.imgur.com/ejemplo.jpg', video: '', fecha: '2026-07-15', hora: '08:00' },
    { tipo: 'compra', titulo: 'Intercambio', contenido: 'Busco Pokemon tipo fuego para intercambiar...', imagen: '', video: '', fecha: '2026-07-15', hora: '08:00' },
    { tipo: 'rifas', titulo: 'Rifa especial', contenido: 'Rifa de consola Game Boy Color...', imagen: 'https://i.imgur.com/ejemplo2.jpg', video: '', fecha: '2026-07-16', hora: '09:00' },
    { tipo: 'torneos', titulo: 'Raid Hour', contenido: 'Hoy es dia de raid! Organiza tu equipo...', imagen: '', video: '', fecha: '2026-07-16', hora: '16:00' },
    { tipo: 'subastas', titulo: 'Subasta Pokemon', contenido: 'Carta rara Charizard base set...', imagen: '', video: '', fecha: '2026-07-17', hora: '10:00' },
    { tipo: 'tienda', titulo: 'Ofertas', contenido: 'Descuentos en la tienda oficial...', imagen: 'https://i.imgur.com/ejemplo3.jpg', video: '', fecha: '2026-07-17', hora: '08:00' },
    { tipo: 'anuncios', titulo: 'Aviso importante', contenido: 'Mantenimiento programado del bot...', imagen: '', video: '', fecha: '2026-07-18', hora: '08:00' },
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 12 }, { wch: 20 }, { wch: 50 }, { wch: 40 }, { wch: 40 }, { wch: 12 }, { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Contenido');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=plantilla-contenido-bot.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

function getAdminHTML(content, queueItems) {
  const grupos = [
    { tipo: 'general', nombre: 'General', color: '#ffcb05', icon: '🟡' },
    { tipo: 'compra', nombre: 'Compra y Venta', color: '#4caf50', icon: '🟢' },
    { tipo: 'rifas', nombre: 'Rifas', color: '#f44336', icon: '🔴' },
    { tipo: 'torneos', nombre: 'Torneos & Campeonatos', color: '#2196f3', icon: '🔵' },
    { tipo: 'subastas', nombre: 'Subastas', color: '#9c27b0', icon: '🟣' },
    { tipo: 'tienda', nombre: 'Tienda Oficial', color: '#ff9800', icon: '🟠' },
    { tipo: 'anuncios', nombre: 'Anuncios', color: '#00bcd4', icon: 'cyan' },
  ];

  const tabs = grupos.map((g, i) => `
    <button class="tab ${i === 0 ? 'active' : ''}" onclick="showTab('${g.tipo}')" style="border-color: ${g.color}">
      ${g.icon} ${g.nombre}
    </button>
  `).join('');

  const panels = grupos.map((g, i) => {
    const data = content[g.tipo] || { enabled: false, titulo: '', contenido: '' };
    return `
      <div id="panel-${g.tipo}" class="panel ${i === 0 ? 'active' : ''}" style="border-color: ${g.color}">
        <div class="panel-header">
          <h3 style="color: ${g.color}">${g.icon} ${g.nombre}</h3>
          <label class="toggle">
            <input type="checkbox" id="enabled-${g.tipo}" ${data.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="form-group">
          <label>Titulo del mensaje</label>
          <input type="text" id="titulo-${g.tipo}" value="${escapeHtml(data.titulo || '')}" placeholder="Ej: Pokemon del Dia">
        </div>
        <div class="form-group">
          <label>Contenido del mensaje</label>
          <textarea id="contenido-${g.tipo}" rows="8" placeholder="Escribe el contenido...">${escapeHtml(data.contenido || '')}</textarea>
          <p class="help">
            <strong>Variables disponibles:</strong><br>
            {pokemon} - Nombre del Pokemon aleatorio<br>
            {tipo} - Tipo del Pokemon<br>
            {descripcion} - Descripcion del Pokemon<br>
            {evolucion} - Evolucion del Pokemon<br>
            {producto} - Nombre del producto<br>
            {precio} - Precio<br>
            {premio} - Premio de rifa<br>
            {dificultad} - Dificultad del raid<br>
            {mensaje} - Mensaje del anuncio
          </p>
        </div>
        <div class="buttons">
          <button class="btn btn-preview" onclick="previewContent('${g.tipo}')">
            👁️ Vista previa
          </button>
          <button class="btn btn-test" onclick="sendTest('${g.tipo}')">
            📤 Enviar prueba al grupo
          </button>
        </div>
        <div id="preview-${g.tipo}" class="preview-box" style="display:none; border-color: ${g.color}"></div>
      </div>
    `;
  }).join('');

  const queueRows = queueItems.map(item => {
    const statusClass = item.enviada ? 'sent' : 'pending';
    const statusText = item.enviada ? 'Enviada' : 'Pendiente';
    const dateStr = item.fecha + ' ' + item.hora;
    const deleteBtn = !item.enviada
      ? `<button class="btn btn-sm btn-delete" onclick="deleteQueueItem('${item.id}')">🗑️</button>`
      : '';
    const mediaIcons = []
    if (item.imageUrl) mediaIcons.push('<span title="Tiene imagen">🖼️</span>');
    if (item.videoUrl) mediaIcons.push('<span title="Tiene video">🎬</span>');
    return `
      <tr class="${statusClass}">
        <td>${item.titulo || '(Sin titulo)'}</td>
        <td>${item.tipo}</td>
        <td>${dateStr}</td>
        <td><span class="badge badge-${statusClass}">${statusText}</span></td>
        <td>${mediaIcons.join(' ')}</td>
        <td>${deleteBtn}</td>
      </tr>
    `;
  }).join('');

  const tipoOptions = grupos.map(g => `<option value="${g.tipo}">${g.icon} ${g.nombre}</option>`).join('') + '<option value="prueba">🧪 Grupo de prueba</option>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pokemon Bot - Panel Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #eee;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 {
      text-align: center;
      color: #ffcb05;
      font-size: 1.8em;
      margin-bottom: 5px;
      text-shadow: 0 2px 10px rgba(255, 203, 5, 0.3);
    }
    .subtitle {
      text-align: center;
      color: #aaa;
      margin-bottom: 30px;
      font-size: 0.9em;
    }
    .main-nav {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 30px;
    }
    .main-nav-btn {
      padding: 12px 24px;
      border: 2px solid #333;
      background: rgba(255,255,255,0.05);
      color: #aaa;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.95em;
      font-weight: bold;
      transition: all 0.3s;
    }
    .main-nav-btn:hover { background: rgba(255,255,255,0.1); }
    .main-nav-btn.active {
      background: rgba(255, 203, 5, 0.2);
      color: #ffcb05;
      border-color: #ffcb05;
    }
    .section { display: none; }
    .section.active { display: block; }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
      justify-content: center;
    }
    .tab {
      padding: 10px 16px;
      border: 2px solid #333;
      background: rgba(255,255,255,0.05);
      color: #aaa;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.85em;
      transition: all 0.3s;
    }
    .tab:hover { background: rgba(255,255,255,0.1); }
    .tab.active {
      background: rgba(255,255,255,0.15);
      color: #fff;
      font-weight: bold;
    }
    .panel {
      display: none;
      background: rgba(22, 33, 62, 0.95);
      border: 2px solid #333;
      border-radius: 15px;
      padding: 25px;
      margin-bottom: 20px;
    }
    .panel.active { display: block; }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .form-group { margin-bottom: 15px; }
    .form-group label {
      display: block;
      color: #aaa;
      margin-bottom: 5px;
      font-size: 0.9em;
    }
    .form-group input, .form-group textarea, .form-group select {
      width: 100%;
      padding: 12px;
      border: 1px solid #333;
      border-radius: 8px;
      background: rgba(0,0,0,0.3);
      color: #fff;
      font-size: 0.95em;
      font-family: inherit;
    }
    .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
      outline: none;
      border-color: #ffcb05;
    }
    .form-group textarea { resize: vertical; min-height: 120px; }
    .form-group select option { background: #16213e; }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .help {
      margin-top: 8px;
      font-size: 0.75em;
      color: #888;
      line-height: 1.5;
    }
    .buttons {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9em;
      font-weight: bold;
      transition: all 0.3s;
    }
    .btn-preview {
      background: rgba(33, 150, 243, 0.2);
      color: #2196f3;
      border: 1px solid #2196f3;
    }
    .btn-preview:hover { background: rgba(33, 150, 243, 0.3); }
    .btn-test {
      background: rgba(76, 175, 80, 0.2);
      color: #4caf50;
      border: 1px solid #4caf50;
    }
    .btn-test:hover { background: rgba(76, 175, 80, 0.3); }
    .btn-save {
      background: rgba(255, 203, 5, 0.2);
      color: #ffcb05;
      border: 1px solid #ffcb05;
      padding: 12px 30px;
      font-size: 1em;
    }
    .btn-save:hover { background: rgba(255, 203, 5, 0.3); }
    .btn-add {
      background: rgba(76, 175, 80, 0.2);
      color: #4caf50;
      border: 1px solid #4caf50;
      padding: 12px 30px;
      font-size: 1em;
    }
    .btn-add:hover { background: rgba(76, 175, 80, 0.3); }
    .btn-sm {
      padding: 6px 12px;
      font-size: 0.8em;
    }
    .btn-delete {
      background: rgba(244, 67, 54, 0.2);
      color: #f44336;
      border: 1px solid #f44336;
    }
    .btn-delete:hover { background: rgba(244, 67, 54, 0.3); }
    .preview-box {
      margin-top: 15px;
      padding: 15px;
      background: rgba(0,0,0,0.3);
      border: 1px solid #333;
      border-radius: 8px;
      white-space: pre-wrap;
      font-size: 0.9em;
      line-height: 1.5;
    }
    .save-section {
      text-align: center;
      margin-top: 30px;
      padding: 20px;
      background: rgba(22, 33, 62, 0.95);
      border-radius: 15px;
      border: 1px solid #333;
    }
    .queue-section {
      background: rgba(22, 33, 62, 0.95);
      border: 2px solid #333;
      border-radius: 15px;
      padding: 25px;
      margin-bottom: 20px;
    }
    .queue-form {
      background: rgba(0,0,0,0.2);
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .queue-form h3 {
      color: #ffcb05;
      margin-bottom: 15px;
    }
    .queue-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    .queue-table th, .queue-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #333;
    }
    .queue-table th {
      color: #ffcb05;
      font-size: 0.85em;
      text-transform: uppercase;
    }
    .queue-table tr.sent { opacity: 0.5; }
    .queue-table tr:hover { background: rgba(255,255,255,0.05); }
    .badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: bold;
    }
    .badge-pending { background: rgba(255, 152, 0, 0.2); color: #ff9800; }
    .badge-sent { background: rgba(76, 175, 80, 0.2); color: #4caf50; }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #888;
    }
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 15px 25px;
      border-radius: 10px;
      color: #fff;
      font-weight: bold;
      z-index: 1000;
      animation: slideIn 0.3s ease;
    }
    .toast.success { background: #4caf50; }
    .toast.error { background: #f44336; }
    @keyframes slideIn {
      from { transform: translateY(100px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .toggle {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 26px;
    }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #333;
      border-radius: 26px;
      transition: 0.3s;
    }
    .slider:before {
      position: absolute;
      content: '';
      height: 20px;
      width: 20px;
      left: 3px;
      bottom: 3px;
      background: #fff;
      border-radius: 50%;
      transition: 0.3s;
    }
    .toggle input:checked + .slider { background: #4caf50; }
    .toggle input:checked + .slider:before { transform: translateX(24px); }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎮 Pokemon Bot - Panel Admin</h1>
    <p class="subtitle">Administra el contenido de tu bot de WhatsApp</p>

    <div class="main-nav">
      <button class="main-nav-btn active" onclick="showSection('diario')">📅 Contenido Diario</button>
      <button class="main-nav-btn" onclick="showSection('cola')">📋 Cola de Contenido</button>
    </div>

    <div id="section-diario" class="section active">
      <p style="text-align:center; color:#aaa; margin-bottom:20px;">Contenido que se envia automaticamente todos los dias a las 8:00 AM</p>
      <div class="tabs">${tabs}</div>
      ${panels}
      <div class="save-section">
        <button class="btn btn-save" onclick="saveAll()">💾 Guardar todo el contenido</button>
      </div>
    </div>

    <div id="section-cola" class="section">
      <div class="queue-section">
        <div class="queue-form">
          <h3>➕ Agregar contenido a la cola</h3>
          <div class="form-row">
            <div class="form-group">
              <label>Tipo de grupo</label>
              <select id="queue-tipo">${tipoOptions}</select>
            </div>
            <div class="form-group">
              <label>Titulo</label>
              <input type="text" id="queue-titulo" placeholder="Ej: Oferta especial">
            </div>
          </div>
          <div class="form-group">
            <label>Contenido del mensaje</label>
            <textarea id="queue-contenido" rows="4" placeholder="Escribe el contenido que se enviara..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Imagen (URL o archivo)</label>
              <input type="url" id="queue-image" placeholder="https://i.imgur.com/imagen.jpg" style="margin-bottom:8px;">
              <label class="btn btn-preview" style="cursor:pointer; display:inline-block; padding:6px 12px; font-size:0.8em;">
                📁 Subir archivo
                <input type="file" id="queue-image-file" accept="image/*" style="display:none;" onchange="uploadFile('image')">
              </label>
              <span id="queue-image-status" style="font-size:0.75em; margin-left:8px;"></span>
            </div>
            <div class="form-group">
              <label>Video (URL o archivo)</label>
              <input type="url" id="queue-video" placeholder="https://example.com/video.mp4" style="margin-bottom:8px;">
              <label class="btn btn-preview" style="cursor:pointer; display:inline-block; padding:6px 12px; font-size:0.8em;">
                📁 Subir archivo
                <input type="file" id="queue-video-file" accept="video/*" style="display:none;" onchange="uploadFile('video')">
              </label>
              <span id="queue-video-status" style="font-size:0.75em; margin-left:8px;"></span>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Fecha de envio</label>
              <input type="date" id="queue-fecha">
            </div>
            <div class="form-group">
              <label>Hora de envio</label>
              <input type="time" id="queue-hora" value="08:00">
            </div>
          </div>
          <button class="btn btn-add" onclick="addQueueItem()">➕ Agregar a la cola</button>
        </div>

        <div class="queue-form" style="border: 2px dashed #ffcb05; background: rgba(255,203,5,0.05);">
          <h3>📊 Subir Excel con contenido masivo</h3>
          <p style="color:#aaa; font-size:0.85em; margin-bottom:15px;">
            Sube un Excel con todo el contenido programado. Descarga la plantilla primero.
          </p>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <a href="/admin/queue/template" class="btn btn-preview" style="text-decoration:none;">📥 Descargar plantilla</a>
            <label class="btn btn-add" style="cursor:pointer;">
              📁 Seleccionar Excel
              <input type="file" id="excel-file" accept=".xlsx,.xls" style="display:none;" onchange="uploadExcel()">
            </label>
          </div>
          <div id="excel-status" style="margin-top:10px; font-size:0.85em;"></div>
        </div>

        <h3 style="color:#ffcb05; margin-bottom:15px;">📋 Contenido programado</h3>
        <div id="queue-list">
          ${queueItems.length === 0
            ? '<div class="empty-state">No hay contenido en la cola</div>'
            : `<table class="queue-table">
                <thead>
                  <tr>
                    <th>Titulo</th>
                    <th>Tipo</th>
                    <th>Fecha/Hora</th>
                    <th>Estado</th>
                    <th>Media</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>${queueRows}</tbody>
              </table>`
          }
        </div>
      </div>
    </div>
  </div>

  <script>
    function showSection(section) {
      document.querySelectorAll('.main-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('section-' + section).classList.add('active');
    }

    function showTab(tipo) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('panel-' + tipo).classList.add('active');
    }

    function showToast(msg, type) {
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    function getFormData() {
      const tipos = ['general', 'compra', 'rifas', 'torneos', 'subastas', 'tienda', 'anuncios'];
      const data = {};
      tipos.forEach(tipo => {
        data[tipo] = {
          enabled: document.getElementById('enabled-' + tipo).checked,
          titulo: document.getElementById('titulo-' + tipo).value,
          contenido: document.getElementById('contenido-' + tipo).value,
        };
      });
      return data;
    }

    async function saveAll() {
      try {
        const data = getFormData();
        const res = await fetch('/admin/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (result.success) {
          showToast('✅ Contenido guardado!', 'success');
        } else {
          showToast('❌ Error: ' + result.error, 'error');
        }
      } catch (e) {
        showToast('❌ Error de conexion', 'error');
      }
    }

    async function previewContent(tipo) {
      const data = getFormData();
      const grupo = data[tipo];
      const previewBox = document.getElementById('preview-' + tipo);

      if (!grupo.contenido) {
        previewBox.style.display = 'block';
        previewBox.textContent = '(Sin contenido configurado)';
        return;
      }

      let preview = grupo.contenido
        .replace(/{pokemon}/g, 'Pikachu')
        .replace(/{tipo}/g, 'electric')
        .replace(/{descripcion}/g, 'El Pokemon mas iconico de la region de Kanto.')
        .replace(/{evolucion}/g, 'Raichu')
        .replace(/{producto}/g, 'Set de Cartas Pokemon')
        .replace(/{precio}/g, '$12.00')
        .replace(/{premio}/g, 'Consola Game Boy Color')
        .replace(/{dificultad}/g, '5 estrellas')
        .replace(/{mensaje}/g, 'Descuentos de hasta el 50% esta semana!');

      if (grupo.titulo) {
        preview = '* ' + grupo.titulo + ' *\\n\\n' + preview;
      }

      previewBox.style.display = 'block';
      previewBox.textContent = preview;
    }

    async function sendTest(tipo) {
      try {
        showToast('📤 Enviando prueba...', 'success');
        const res = await fetch('/admin/test/' + tipo, { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          showToast('✅ Prueba enviada!', 'success');
        } else {
          showToast('❌ ' + result.error, 'error');
        }
      } catch (e) {
        showToast('❌ Error de conexion', 'error');
      }
    }

    async function uploadFile(type) {
      var fileInput = document.getElementById('queue-' + type + '-file');
      var statusSpan = document.getElementById('queue-' + type + '-status');
      var urlInput = document.getElementById('queue-' + type);
      var file = fileInput.files[0];
      if (!file) return;

      statusSpan.innerHTML = '<span style="color:#ff9800;">⏳ Subiendo...</span>';

      var formData = new FormData();
      formData.append('media', file);

      try {
        var res = await fetch('/admin/upload-media', {
          method: 'POST',
          body: formData,
        });
        var result = await res.json();
        if (result.success) {
          urlInput.value = result.url;
          statusSpan.innerHTML = '<span style="color:#4caf50;">✅ Subido!</span>';
          showToast('✅ Archivo subido a Cloudinary', 'success');
        } else {
          statusSpan.innerHTML = '<span style="color:#f44336;">❌ ' + result.error + '</span>';
        }
      } catch (e) {
        statusSpan.innerHTML = '<span style="color:#f44336;">❌ Error</span>';
      }
      fileInput.value = '';
    }

    async function addQueueItem() {
      const tipo = document.getElementById('queue-tipo').value;
      const titulo = document.getElementById('queue-titulo').value;
      const contenido = document.getElementById('queue-contenido').value;
      const imageUrl = document.getElementById('queue-image').value || null;
      const videoUrl = document.getElementById('queue-video').value || null;
      const fecha = document.getElementById('queue-fecha').value;
      const hora = document.getElementById('queue-hora').value;

      if (!contenido || !fecha) {
        showToast('❌ Completa el contenido y la fecha', 'error');
        return;
      }

      try {
        const res = await fetch('/admin/queue/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo, titulo, contenido, imageUrl, videoUrl, fecha, hora }),
        });
        const result = await res.json();
        if (result.success) {
          showToast('✅ Agregado a la cola!', 'success');
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast('❌ Error', 'error');
        }
      } catch (e) {
        showToast('❌ Error de conexion', 'error');
      }
    }

    async function deleteQueueItem(id) {
      if (!confirm('Eliminar este item de la cola?')) return;
      try {
        const res = await fetch('/admin/queue/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const result = await res.json();
        if (result.success) {
          showToast('✅ Eliminado', 'success');
          setTimeout(() => location.reload(), 1000);
        }
      } catch (e) {
        showToast('❌ Error', 'error');
      }
    }

    async function uploadExcel() {
      const fileInput = document.getElementById('excel-file');
      const status = document.getElementById('excel-status');
      const file = fileInput.files[0];
      if (!file) return;

      status.innerHTML = '<span style="color:#ff9800;">⏳ Subiendo y procesando...</span>';

      const formData = new FormData();
      formData.append('excel', file);

      try {
        const res = await fetch('/admin/queue/upload-excel', {
          method: 'POST',
          body: formData,
        });
        const result = await res.json();
        if (result.success) {
          status.innerHTML = '<span style="color:#4caf50;">✅ ' + result.message + '</span>';
          showToast('✅ Excel procesado!', 'success');
          setTimeout(() => location.reload(), 2000);
        } else {
          status.innerHTML = '<span style="color:#f44336;">❌ ' + result.error + '</span>';
        }
      } catch (e) {
        status.innerHTML = '<span style="color:#f44336;">❌ Error de conexion</span>';
      }
      fileInput.value = '';
    }

    document.getElementById('queue-fecha').valueAsDate = new Date();
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = router;
