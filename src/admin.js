const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const queue = require('./queue');

const router = express.Router();
const CONTENT_PATH = path.join(__dirname, 'data', 'custom-content.json');

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

router.post('/queue/add', (req, res) => {
  try {
    const item = queue.addItem(req.body);
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
    return `
      <tr class="${statusClass}">
        <td>${item.titulo || '(Sin titulo)'}</td>
        <td>${item.tipo}</td>
        <td>${dateStr}</td>
        <td><span class="badge badge-${statusClass}">${statusText}</span></td>
        <td>
          ${item.imageUrl ? '<span title="Tiene imagen">🖼️</span>' : ''}
          ${item.videoUrl ? '<span title="Tiene video">🎬</span>' : ''}
        </td>
        <td>
          ${!item.enviada ? '<button class="btn btn-sm btn-delete" onclick="deleteQueueItem(\\'' + item.id + '\\')">🗑️</button>' : ''}
        </td>
      </tr>
    `;
  }).join('');

  const tipoOptions = grupos.map(g => `<option value="${g.tipo}">${g.icon} ${g.nombre}</option>`).join('');

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
              <label>URL de imagen (opcional)</label>
              <input type="url" id="queue-image" placeholder="https://i.imgur.com/imagen.jpg">
            </div>
            <div class="form-group">
              <label>URL de video (opcional)</label>
              <input type="url" id="queue-video" placeholder="https://example.com/video.mp4">
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

    document.getElementById('queue-fecha').valueAsDate = new Date();
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = router;
