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
const MEDIA_LIB_PATH = path.join(__dirname, 'data', 'media-library.json');
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

function loadMediaLibrary() {
  try {
    if (fs.existsSync(MEDIA_LIB_PATH)) {
      return JSON.parse(fs.readFileSync(MEDIA_LIB_PATH, 'utf8'));
    }
  } catch (e) {}
  return { items: [] };
}

function saveMediaLibrary(lib) {
  fs.writeFileSync(MEDIA_LIB_PATH, JSON.stringify(lib, null, 2), 'utf8');
}

router.get('/', (req, res) => {
  const content = loadContent();
  const queueItems = queue.getAllItems();
  const mediaLib = loadMediaLibrary();
  res.send(getAdminHTML(content, queueItems, mediaLib));
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
    console.log('[ADMIN] Agregando item a la cola:', JSON.stringify(req.body).substring(0, 200));
    const item = await queue.addItem(req.body);
    console.log('[ADMIN] Item guardado:', item.id);
    res.json({ success: true, item });
  } catch (e) {
    console.error('[ADMIN] Error agregando item:', e.message);
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

router.get('/media-library', (req, res) => {
  try {
    const lib = loadMediaLibrary();
    res.json({ success: true, items: lib.items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/media-library/upload', upload.array('media', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No se subieron archivos' });
    }
    if (!cloudinary.isAvailable()) {
      return res.status(400).json({ success: false, error: 'Cloudinary no configurado' });
    }

    const cloudinaryV2 = require('cloudinary').v2;
    const lib = loadMediaLibrary();
    const uploaded = [];

    for (const file of req.files) {
      const isVideo = file.mimetype.startsWith('video/');
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinaryV2.uploader.upload_stream(
          {
            folder: 'pokemon-bot/media',
            public_id: `lib_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            resource_type: isVideo ? 'video' : 'image',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      const item = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        nombre: file.originalname,
        url: result.secure_url,
        tipo: isVideo ? 'video' : 'imagen',
        tamano: (file.size / 1024).toFixed(1) + ' KB',
        subida: new Date().toISOString(),
      };
      lib.items.push(item);
      uploaded.push(item);
    }

    saveMediaLibrary(lib);
    res.json({ success: true, items: uploaded, total: lib.items.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/media-library/delete', (req, res) => {
  try {
    const { id } = req.body;
    const lib = loadMediaLibrary();
    lib.items = lib.items.filter(i => i.id !== id);
    saveMediaLibrary(lib);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
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

  const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: 'FFCB05' } } };

  const data = [
    { tipo: 'general', titulo: 'Pokemon del dia', contenido: 'Hoy te presentamos a un Pokemon especial...', imagen: '(Pega aqui la URL de Cloudinary)', video: '', fecha: '2026-07-15', hora: '08:00' },
    { tipo: 'compra', titulo: 'Intercambio', contenido: 'Busco Pokemon tipo fuego para intercambiar...', imagen: '', video: '', fecha: '2026-07-15', hora: '08:00' },
    { tipo: 'rifas', titulo: 'Rifa especial', contenido: 'Rifa de consola Game Boy Color...', imagen: '(Pega aqui la URL de Cloudinary)', video: '', fecha: '2026-07-16', hora: '09:00' },
    { tipo: 'torneos', titulo: 'Raid Hour', contenido: 'Hoy es dia de raid! Organiza tu equipo...', imagen: '', video: '', fecha: '2026-07-16', hora: '16:00' },
    { tipo: 'subastas', titulo: 'Subasta Pokemon', contenido: 'Carta rara Charizard base set...', imagen: '', video: '(Pega aqui la URL de Cloudinary)', fecha: '2026-07-17', hora: '10:00' },
    { tipo: 'tienda', titulo: 'Ofertas', contenido: 'Descuentos en la tienda oficial...', imagen: '(Pega aqui la URL de Cloudinary)', video: '', fecha: '2026-07-17', hora: '08:00' },
    { tipo: 'anuncios', titulo: 'Aviso importante', contenido: 'Mantenimiento programado del bot...', imagen: '', video: '', fecha: '2026-07-18', hora: '08:00' },
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 12 }, { wch: 20 }, { wch: 50 }, { wch: 45 }, { wch: 45 }, { wch: 12 }, { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Contenido');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=plantilla-contenido-bot.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

router.get('/queue/template-full', (req, res) => {
  const wb = XLSX.utils.book_new();

  const publicaciones = [
    // SEMANA 1 - LUNES
    { fecha: '2026-07-14', hora: '08:00', tipo: 'general', titulo: 'Lunes Pokemon', contenido: 'Buenos dias entrenadores! Empieza la semana con fuerza. Hoy toca retodia: Adivina el Pokemon!\n\n_ _ _ _ _ _\n\nResponde con el nombre! +10 puntos al primero', imagen: '', video: '' },
    { fecha: '2026-07-14', hora: '12:00', tipo: 'tienda', titulo: 'Ofertas del Lunes', contenido: 'TOYTSUKY - OFERTAS DEL LUNES\n\nSobres basicos: $3.000\nSobres elite: $8.000\nFiguras basicas: $15.000\n\nVisitanos! Sincelejo, Sucre\n10AM - 8PM', imagen: '', video: '' },
    { fecha: '2026-07-14', hora: '18:00', tipo: 'compra', titulo: 'Dato Curioso', contenido: 'Sabias que?\nPikachu fue originalmente llamado "Pika" en el desarrollo temprano del juego.\n\nCual es tu dato favorito de Pokemon?', imagen: '', video: '' },

    // SEMANA 1 - MARTES
    { fecha: '2026-07-15', hora: '08:00', tipo: 'torneos', titulo: 'Martes de Batallas', contenido: 'Hoy es dia de batallas! +10 puntos extra por participar\n\nEscribe !batalla @usuario para desafiar a alguien\n\nPokemon del dia: PIKACHU\nBatalla con estrategia y gana puntos!', imagen: '', video: '' },
    { fecha: '2026-07-15', hora: '12:00', tipo: 'general', titulo: 'Trivia Pokemon', contenido: 'TRIVIA POKEMON\n\nQue tipo es Bulbasaur?\nA) Fuego\nB) Agua\nC) Planta\nD) Normal\n\nResponde con la letra! +10 puntos', imagen: '', video: '' },
    { fecha: '2026-07-15', hora: '18:00', tipo: 'rifas', titulo: 'Rifa Semanal', contenido: 'SORTEO SEMANAL TOYTSUKY\n\nPremio: Sobre de cartas Pokemon gratis!\n\nPara participar escribe:\n!sorteo [numero del 1 al 100]\n\nEl numero mas cercano gana!', imagen: '', video: '' },

    // SEMANA 1 - MIERCOLES
    { fecha: '2026-07-16', hora: '08:00', tipo: 'tienda', titulo: 'Miercoles de Ofertas 2x1', contenido: 'HOY ES MIERCOLES DE OFERTAS!\n\n2x1 en sobres de cartas\nSolo por hoy! Visitanos\n\n+Sobres basicos: $3.000\n+Sobres elite: $8.000\n\n10AM - 8PM', imagen: '', video: '' },
    { fecha: '2026-07-16', hora: '12:00', tipo: 'anuncios', titulo: 'Cupon de Descuento', contenido: 'CODIGO DE DESCUENTO\n\nUsa el codigo: POKEMON5\ny obtén 5% de descuento\n\nVálido hasta el viernes\nSolo en tienda fisica', imagen: '', video: '' },
    { fecha: '2026-07-16', hora: '18:00', tipo: 'general', titulo: 'Comparte tu Favorito', contenido: 'Escribe !comparte [tu Pokemon favorito]\ny gana +10 puntos!\n\nComparte con la comunidad\ncual es tu Pokemon favorito y por que', imagen: '', video: '' },

    // SEMANA 1 - JUEVES
    { fecha: '2026-07-17', hora: '08:00', tipo: 'subastas', titulo: 'Jueves de Trivia Avanzada', contenido: 'TRIVIA AVANZADA\n\nEn que generacion fue introducido el tipo Hada?\nA) Generacion 1\nB) Generacion 2\nC) Generacion 6\nD) Generacion 7\n\n+15 puntos por acertar!', imagen: '', video: '' },
    { fecha: '2026-07-17', hora: '12:00', tipo: 'torneos', titulo: 'PokeBattle Challenge', contenido: 'DESAFIO POKEBATTLE\n\nEscribe !batalla @usuario\npara desafiar a un amigo\n\nGanador: +15 puntos\nPerdedor: +5 puntos\n\nBatallas con tipo y estrategia!', imagen: '', video: '' },
    { fecha: '2026-07-17', hora: '18:00', tipo: 'general', titulo: 'Costumbres Pokemon', contenido: 'COSTUMBRES POKEMON\n\nCual es tu Pokemon favorito y por que?\n\nComparte tu respuesta\nLa mejor recibe +15 puntos!', imagen: '', video: '' },

    // SEMANA 1 - VIERNES
    { fecha: '2026-07-18', hora: '08:00', tipo: 'tienda', titulo: 'Viernes de Descuentos', contenido: 'HOY ES VIERNES DE DESCUENTOS!\n\n15% OFF en todas las figuras\nSolo por hoy! Visitanos\n\nFiguras basicas: $15.000 -> $12.750\nFiguras especiales: $35.000 -> $29.750', imagen: '', video: '' },
    { fecha: '2026-07-18', hora: '12:00', tipo: 'rifas', titulo: 'Sorteo Especial', contenido: 'SORTEO ESPECIAL VIERNES\n\nPremio: Figura basica de Pokemon!\n\nParticipa con !sorteo [numero]\nEl numero mas cercano gana!\n\n+10 puntos extra por participar', imagen: '', video: '' },
    { fecha: '2026-07-18', hora: '18:00', tipo: 'general', titulo: 'Meme del Dia', contenido: 'MEME DEL DIA\n\nYo: "No voy a comprar mas Pokemon"\nPokemon: *lanza nueva coleccion*\nYo: *abre la billetera*\n\nComparte tu meme favorito!\nEl mas gracioso: +10 puntos', imagen: '', video: '' },

    // SEMANA 1 - SABADO
    { fecha: '2026-07-19', hora: '08:00', tipo: 'compra', titulo: 'Sabado de Comunidad', contenido: 'SABADO DE COMUNIDAD\n\nComparte tu coleccion con !mifigura\nMuestra tus figuras y cartas!\n\n+10 puntos por compartir\nLa mejor coleccion gana +20 puntos extra', imagen: '', video: '' },
    { fecha: '2026-07-19', hora: '12:00', tipo: 'tienda', titulo: 'Ofertas del Sabado', contenido: 'OFERTAS DEL SABADO\n\nCajas completas: $120.000\nSobres elite: $8.000\nFiguras especiales: $35.000\n\nEnvio gratis en compras +$50.000', imagen: '', video: '' },
    { fecha: '2026-07-19', hora: '18:00', tipo: 'anuncios', titulo: 'Proximo Evento', contenido: 'PROXIMO EVENTO\n\nFecha: Sabado proximo\nLugar: Toytsuky, Sincelejo\n\nEncuentro Pokemon\nIntercambios y batallas\n\nParticipa y gana premios!', imagen: '', video: '' },

    // SEMANA 1 - DOMINGO
    { fecha: '2026-07-20', hora: '10:00', tipo: 'general', titulo: 'Ranking Semanal', contenido: 'RANKING SEMANAL\n\nLos mejores entrenadores de la semana:\n\n1. [Ganador] - [puntos] pts\n2. [Segundo] - [puntos] pts\n3. [Tercero] - [puntos] pts\n\nFelicidades a los ganadores!', imagen: '', video: '' },
    { fecha: '2026-07-20', hora: '14:00', tipo: 'tienda', titulo: 'Domingo de Descanso', contenido: 'DOMINGO DE DESCANSO\n\nHoy la tienda esta cerrada\nPero manana volvemos con mas ofertas!\n\nRecuerda:\nLunes a Sabado: 10AM - 8PM\nDomingo: Cerrado', imagen: '', video: '' },
    { fecha: '2026-07-20', hora: '18:00', tipo: 'general', titulo: 'Vista Previa Semana', contenido: 'VISTA PREVIA DE LA SEMANA\n\nLunes: Retos y trivia\nMartes: Batallas\nMiercoles: Ofertas 2x1\nJueves: Trivia avanzada\nViernes: Sorteo especial\nSabado: Comunidad\nDomingo: Ranking', imagen: '', video: '' },
  ];

  const ws = XLSX.utils.json_to_sheet(publicaciones);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 14 },
    { wch: 25 },
    { wch: 80 },
    { wch: 50 },
    { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Semana 1');

  const instrucciones = [
    { paso: 1, accion: 'Sube imagenes a Cloudinary desde el admin (/admin)', nota: 'Cada imagen genera una URL permanente' },
    { paso: 2, accion: 'Copia la URL de Cloudinary y pegala en la columna "imagen"', nota: 'Formato: https://res.cloudinary.com/...' },
    { paso: 3, accion: 'Edita el contenido segun necesites', nota: 'Puedes cambiar textos, fechas y horas' },
    { paso: 4, accion: 'Guarda el archivo Excel', nota: 'Formato .xlsx' },
    { paso: 5, accion: 'Ve a /admin y sube el Excel', nota: 'Click en "Subir Excel" en la seccion Cola' },
    { paso: 6, accion: 'Revisa la cola en "Cola de Contenido"', nota: 'Verifica fechas, horas y grupos' },
    { paso: 7, accion: 'El bot envia automaticamente segun la programmed', nota: 'Los posts se envian a las 8:00 AM diariamente' },
  ];
  const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
  wsInstrucciones['!cols'] = [{ wch: 6 }, { wch: 60 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');

  const grupos = [
    { tipo: 'general', nombre: 'General', descripcion: ' contenido variado, trivia, datos curiosos' },
    { tipo: 'compra', nombre: 'Compra y Venta', descripcion: ' intercambios, ventas, compras' },
    { tipo: 'rifas', nombre: 'Rifas', descripcion: ' sorteos, rifas, premios' },
    { tipo: 'torneos', nombre: 'Torneos', descripcion: ' batallas, competencias, eventos' },
    { tipo: 'subastas', nombre: 'Subastas', descripcion: ' subastas de cartas y figuras raras' },
    { tipo: 'tienda', nombre: 'Tienda', descripcion: ' ofertas, descuentos, productos' },
    { tipo: 'anuncios', nombre: 'Anuncios', descripcion: ' avisos oficiales, eventos, novedades' },
  ];
  const wsGrupos = XLSX.utils.json_to_sheet(grupos);
  wsGrupos['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsGrupos, 'Grupos');

  const comandos = [
    { comando: '!retodia', descripcion: 'Reto del dia', puntos: '10 pts', uso: 'Escribe !retodia en el grupo' },
    { comando: '!reto', descripcion: 'Reto random', puntos: '10 pts', uso: 'Escribe !reto en el grupo' },
    { comando: '!especial', descripcion: 'Actividad especial del dia', puntos: 'Varia', uso: 'Escribe !especial en el grupo' },
    { comando: '!batalla @user', descripcion: 'Iniciar batalla Pokemon', puntos: '15/5 pts', uso: 'Escribe !batalla @usuario' },
    { comando: '!atacar [mov]', descripcion: 'Atacar en batalla', puntos: '-', uso: 'Escribe !atacar [movimiento]' },
    { comando: '!sorteo [num]', descripcion: 'Participar en sorteo', puntos: '10 pts', uso: 'Escribe !sorteo [1-100]' },
    { comando: '!comparte [poke]', descripcion: 'Compartir favorito', puntos: '10 pts', uso: 'Escribe !comparte Pikachu' },
    { comando: '!mifigura', descripcion: 'Compartir coleccion', puntos: '10 pts', uso: 'Escribe !mifigura' },
    { comando: '!puntos', descripcion: 'Ver puntos', puntos: '-', uso: 'Escribe !puntos' },
    { comando: '!top', descripcion: 'Ranking', puntos: '-', uso: 'Escribe !top' },
    { comando: '!canjear', descripcion: 'Canjear puntos', puntos: '-', uso: 'Escribe !canjear [num]' },
    { comando: '!tienda', descripcion: 'Ver tienda', puntos: '-', uso: 'Escribe !tienda' },
    { comando: '!referir', descripcion: 'Codigo referido', puntos: '50 pts', uso: 'Escribe !referir' },
  ];
  const wsComandos = XLSX.utils.json_to_sheet(comandos);
  wsComandos['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsComandos, 'Comandos');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=plantilla-completa-toytsuky.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

function getAdminHTML(content, queueItems, mediaLib) {
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
    .media-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .media-card {
      background: rgba(0,0,0,0.3);
      border: 1px solid #333;
      border-radius: 10px;
      overflow: hidden;
      transition: all 0.3s;
    }
    .media-card:hover { border-color: #ffcb05; }
    .media-preview {
      height: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.2);
      overflow: hidden;
    }
    .media-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .media-info { padding: 10px; }
    .media-name {
      font-size: 0.8em;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }
    .media-meta { font-size: 0.7em; color: #888; margin-bottom: 8px; }
    .media-actions { display: flex; gap: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎮 Pokemon Bot - Panel Admin</h1>
    <p class="subtitle">Administra el contenido de tu bot de WhatsApp</p>

    <div class="main-nav">
      <button class="main-nav-btn active" onclick="showSection('diario')">📅 Contenido Diario</button>
      <button class="main-nav-btn" onclick="showSection('cola')">📋 Cola de Contenido</button>
      <button class="main-nav-btn" onclick="showSection('media')">📚 Biblioteca de Media</button>
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
            <a href="/admin/queue/template" class="btn btn-preview" style="text-decoration:none;">📥 Descargar plantilla basica</a>
            <a href="/admin/queue/template-full" class="btn btn-success" style="text-decoration:none;">📥 Plantilla completa (7 dias)</a>
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

    <div id="section-media" class="section">
      <div class="queue-section">
        <div class="queue-form">
          <h3>📚 Subir imagenes y videos</h3>
          <p style="color:#aaa; font-size:0.85em; margin-bottom:15px;">
            Sube tus archivos aqui. Las URLs de Cloudinary se generan automaticamente. Copialas al Excel para programar contenido.
          </p>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <label class="btn btn-add" style="cursor:pointer;">
              📁 Seleccionar archivos
              <input type="file" id="media-files" accept="image/*,video/*" multiple style="display:none;" onchange="uploadMediaFiles()">
            </label>
            <span id="media-upload-status" style="font-size:0.85em;"></span>
          </div>
        </div>

        <h3 style="color:#ffcb05; margin-bottom:15px;">📂 Archivos subidos (${(mediaLib.items || []).length})</h3>
        ${(mediaLib.items || []).length === 0
          ? '<div class="empty-state">No hay archivos subidos aun</div>'
          : `<div class="media-grid">
              ${(mediaLib.items || []).map(item => `
                <div class="media-card">
                  <div class="media-preview">
                    ${item.tipo === 'video'
                      ? '<div style="font-size:2em;">🎬</div>'
                      : `<img src="${item.url}" alt="${item.nombre}" loading="lazy">`
                    }
                  </div>
                  <div class="media-info">
                    <div class="media-name" title="${item.nombre}">${item.nombre}</div>
                    <div class="media-meta">${item.tipo} • ${item.tamano}</div>
                    <div class="media-actions">
                      <button class="btn btn-sm btn-preview" onclick="copyMediaUrl('${item.url}')">📋 Copiar URL</button>
                      <button class="btn btn-sm btn-delete" onclick="deleteMediaItem('${item.id}')">🗑️</button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>`
        }
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

    async function uploadMediaFiles() {
      var fileInput = document.getElementById('media-files');
      var status = document.getElementById('media-upload-status');
      var files = fileInput.files;
      if (!files.length) return;

      status.innerHTML = '<span style="color:#ff9800;">⏳ Subiendo ' + files.length + ' archivo(s)...</span>';

      var formData = new FormData();
      for (var i = 0; i < files.length; i++) {
        formData.append('media', files[i]);
      }

      try {
        var res = await fetch('/admin/media-library/upload', {
          method: 'POST',
          body: formData,
        });
        var result = await res.json();
        if (result.success) {
          status.innerHTML = '<span style="color:#4caf50;">✅ ' + result.items.length + ' archivo(s) subido(s)!</span>';
          showToast('✅ Archivos subidos a Cloudinary', 'success');
          setTimeout(() => location.reload(), 1500);
        } else {
          status.innerHTML = '<span style="color:#f44336;">❌ ' + result.error + '</span>';
        }
      } catch (e) {
        status.innerHTML = '<span style="color:#f44336;">❌ Error de conexion</span>';
      }
      fileInput.value = '';
    }

    function copyMediaUrl(url) {
      navigator.clipboard.writeText(url).then(function() {
        showToast('📋 URL copiada!', 'success');
      }).catch(function() {
        var input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('📋 URL copiada!', 'success');
      });
    }

    async function deleteMediaItem(id) {
      if (!confirm('Eliminar este archivo de la biblioteca?')) return;
      try {
        var res = await fetch('/admin/media-library/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id }),
        });
        var result = await res.json();
        if (result.success) {
          showToast('✅ Eliminado', 'success');
          setTimeout(() => location.reload(), 1000);
        }
      } catch (e) {
        showToast('❌ Error', 'error');
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const products = require('./products');

router.get('/products', async (req, res) => {
  const sellers = products.getAllSellers();
  const categories = products.getCategories();

  let productsBySeller = {};
  for (const sellerId of Object.keys(sellers)) {
    productsBySeller[sellerId] = await products.getProducts(sellerId);
  }

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Productos - Vendedores</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #ffcb05; margin-bottom: 20px; }
        .seller-section { background: rgba(22, 33, 62, 0.95); border-radius: 15px; padding: 20px; margin-bottom: 20px; border: 1px solid rgba(255, 203, 5, 0.2); }
        .seller-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .seller-name { color: #ffcb05; font-size: 1.5em; }
        .btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; text-decoration: none; display: inline-block; }
        .btn-primary { background: #ffcb05; color: #1a1a2e; }
        .btn-success { background: #4caf50; color: white; }
        .btn-danger { background: #f44336; color: white; }
        .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
        .product-card { background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; }
        .product-card img { width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 10px; }
        .product-name { font-weight: bold; margin-bottom: 5px; }
        .product-price { color: #4caf50; font-weight: bold; }
        .product-category { color: #aaa; font-size: 0.85em; }
        .product-actions { margin-top: 10px; display: flex; gap: 5px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; color: #ffcb05; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #333; border-radius: 8px; background: #16213e; color: #eee; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1000; }
        .modal-content { background: #16213e; max-width: 500px; margin: 50px auto; padding: 30px; border-radius: 15px; }
        .stats { display: flex; gap: 20px; margin-bottom: 15px; }
        .stat { text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; color: #ffcb05; }
        .stat-label { color: #aaa; font-size: 0.85em; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Productos para Vendedores</h1>
        <p style="color:#aaa; margin-bottom:20px;">Sube los productos que Luis y Orlando deben publicar cada dia</p>
        
        <div style="margin-bottom:20px;">
          <a href="/admin" class="btn btn-primary">Volver al Admin</a>
          <button class="btn btn-success" onclick="openAddModal()">+ Agregar Producto</button>
        </div>`;

  for (const [sellerId, sellerInfo] of Object.entries(sellers)) {
    const sellerProducts = productsBySeller[sellerId] || [];
    const stats = await products.getSellerStats(sellerId);

    html += `
        <div class="seller-section">
          <div class="seller-header">
            <span class="seller-name">${sellerInfo.name}</span>
            <div class="stats">
              <div class="stat">
                <div class="stat-value">${stats?.total || 0}</div>
                <div class="stat-label">Total</div>
              </div>
              <div class="stat">
                <div class="stat-value">${stats?.sent || 0}</div>
                <div class="stat-label">Enviados</div>
              </div>
              <div class="stat">
                <div class="stat-value">${stats?.notSent || 0}</div>
                <div class="stat-label">Pendientes</div>
              </div>
            </div>
          </div>
          <div class="products-grid">`;

    for (const product of sellerProducts) {
      html += `
            <div class="product-card">
              ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}">` : '<div style="height:150px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;">Sin imagen</div>'}
              <div class="product-name">${product.name}</div>
              ${product.price ? `<div class="product-price">${product.price}</div>` : ''}
              <div class="product-category">${product.category}</div>
              <div class="product-actions">
                <button class="btn btn-danger" onclick="deleteProduct('${product._id}')">Eliminar</button>
              </div>
            </div>`;
    }

    html += `
          </div>
        </div>`;
  }

  html += `
      </div>

      <div id="addModal" class="modal">
        <div class="modal-content">
          <h2 style="margin-bottom:20px;">Agregar Producto</h2>
          <form id="productForm">
            <div class="form-group">
              <label>Vendedor</label>
              <select id="sellerId" required>
                ${Object.entries(sellers).map(([id, s]) => `<option value="${id}">${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Nombre del Producto</label>
              <input type="text" id="productName" required placeholder="Ej: Figura Pikachu">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Precio</label>
                <input type="text" id="productPrice" placeholder="Ej: $35.000">
              </div>
              <div class="form-group">
                <label>Categoria</label>
                <select id="productCategory">
                  ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Descripcion</label>
              <textarea id="productDescription" rows="3" placeholder="Descripcion del producto..."></textarea>
            </div>
            <div class="form-group">
              <label>URL de Imagen (Cloudinary)</label>
              <input type="text" id="productImage" placeholder="https://res.cloudinary.com/...">
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
              <button type="button" class="btn btn-danger" onclick="closeAddModal()">Cancelar</button>
              <button type="submit" class="btn btn-success">Guardar</button>
            </div>
          </form>
        </div>
      </div>

      <script>
        function openAddModal() {
          document.getElementById('addModal').style.display = 'block';
        }
        function closeAddModal() {
          document.getElementById('addModal').style.display = 'none';
        }
        document.getElementById('productForm').onsubmit = async (e) => {
          e.preventDefault();
          const data = {
            sellerId: document.getElementById('sellerId').value,
            name: document.getElementById('productName').value,
            price: document.getElementById('productPrice').value,
            category: document.getElementById('productCategory').value,
            description: document.getElementById('productDescription').value,
            imageUrl: document.getElementById('productImage').value,
          };
          const res = await fetch('/admin/products/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          const result = await res.json();
          if (result.success) {
            alert('Producto agregado!');
            location.reload();
          } else {
            alert('Error: ' + result.error);
          }
        };
        async function deleteProduct(id) {
          if (!confirm('Eliminar este producto?')) return;
          const res = await fetch('/admin/products/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          const result = await res.json();
          if (result.success) {
            alert('Eliminado!');
            location.reload();
          }
        }
      </script>
    </body>
    </html>`;

  res.send(html);
});

router.post('/products/add', async (req, res) => {
  try {
    const { sellerId, name, price, category, description, imageUrl } = req.body;
    const product = await products.addProduct(sellerId, { name, price, category, description, imageUrl });
    if (product) {
      res.json({ success: true, product });
    } else {
      res.json({ success: false, error: 'Error al agregar producto' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/products/delete', async (req, res) => {
  try {
    const { id } = req.body;
    const result = await products.deleteProduct(id);
    res.json({ success: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/products/send-now', async (req, res) => {
  try {
    const { sendDailyProducts } = require('./productScheduler');
    await sendDailyProducts();
    res.json({ success: true, message: 'Productos enviados' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
