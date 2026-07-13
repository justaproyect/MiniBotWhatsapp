# Pokemon WhatsApp Bot - Guia de Setup

## Instalacion Local

1. Clonar el repositorio
2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno (crear archivo .env):
```
ADMIN_NUMBER=573001234567
SEND_HOUR=8
SEND_MINUTE=0
TIMEZONE=America/Bogota
MONGO_URI=mongodb+srv://usuario:contraseña@cluster0.xxxxx.mongodb.net/pokemon-bot
```

4. Ejecutar el bot:
```bash
npm start
```

5. Escanear el QR que aparece en la consola con tu WhatsApp

6. Unir al grupo de WhatsApp y el bot detectara automaticamente

## Configurar MongoDB Atlas (Persistencia de Sesion)

1. Crear cuenta en [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Crear cluster gratuito (M0 Sandbox)
3. Crear usuario y contrasena
4. En "Network Access" agregar `0.0.0.0/0`
5. En "Database" copiar la URL de conexion
6. Agregar la URL como variable `MONGO_URI` en Render o .env

## Despliegue en Render

1. Subir el codigo a GitHub
2. Crear un nuevo Web Service en Render
3. Conectar el repositorio de GitHub
4. Render detectara automaticamente el `render.yaml`
5. Configurar variables de entorno:
   - `MONGO_URI`: URL de MongoDB Atlas
   - `ADMIN_NUMBER`: Tu numero con codigo de pais
   - `TIMEZONE`: America/Bogota, America/Mexico_City, etc.

### Keep-Alive (Importante para Render Free)

1. Crear cuenta en [UptimeRobot](https://uptimerobot.com/) (gratis)
2. Agregar un monitor HTTP
3. URL: `https://tu-app.onrender.com/health`
4. Intervalo: 5 minutos

## 7 Grupos Configurados

| Grupo | Tipo | Contenido Diario |
|-------|------|-----------------|
| General | general | Pokemon del dia (imagen + datos) |
| Compra y venta | compra | Pokemon para intercambiar |
| Rifas y sorteos | rifas | Subastas y sorteos activos |
| Torneos & Campeonatos | torneos | Raids y coordinacion |
| Subastas | subastas | Subastas con precios |
| Tienda Oficial | tienda | Productos disponibles |
| Anuncios | anuncios | Noticias oficiales |

### Como registrar grupos

1. Agrega el bot a cada grupo
2. Alguien escribe algo
3. Tu (admin) escribes: `!registrar general`

## Comandos del Bot

| Comando | Descripcion |
|---------|-------------|
| `!ayuda` | Lista de comandos |
| `!pokemon` | Pokemon random con imagen |
| `!damepoke` | Pokemon random sin imagen |
| `!ping` | Verificar si el bot esta activo |
| `!trivia` | Trivia interactiva |
| `!quiz` | Quiz con respuesta |
| `!pokebattle @user` | Desafio Pokemon |
| `!puntos` | Ver tus puntos |
| `!top` | Ranking general |
| `!top-semana` | Ranking semanal |
| `!logros` | Ver tus logros |
| `!horario` | Calendario semanal |
| `!registrar <tipo>` | Registrar grupo (admin) |
| `!grupos` | Ver grupos (admin) |
| `!anuncio <msg>` | Enviar anuncio (admin) |

## Sistema de Engagement

- **Puntos**: +1 por mensaje, +5 por quiz correcto, +10 por pokebattle ganada
- **Ranking**: Semanal, se resetea cada domingo
- **Logros**: 12 logros desbloqueables

## Estructura

```
src/
├── index.js              # Entry point + pagina web QR
├── config.js             # Configuracion (7 grupos)
├── baileys.js            # WhatsApp + comandos
├── pokeapi.js            # PokeAPI
├── scheduler.js          # Envio a 7 grupos
├── commands.js           # 15 comandos
├── engagement.js         # Puntos/ranking/logros
├── mongo.js              # Persistencia MongoDB
└── messages/
    ├── generator.js      # Generador multi-grupo
    ├── trivia.js
    ├── quiz.js
    ├── pokemon-dia.js
    ├── memes.js
    ├── anuncios.js
    ├── intercambios.js
    ├── raids.js
    ├── tienda.js
    ├── subastas.js
    └── data/
        ├── trivia.json
        ├── quizzes.json
        ├── memes.json
        ├── anuncios.json
        ├── intercambios.json
        ├── raids.json
        ├── tienda.json
        ├── subastas.json
        ├── torneos.json
        ├── casual.json
        ├── logros.json
        ├── usuarios.json
        └── grupos.json
```

## Solucion de Problemas

- **QR no aparece**: Verificar que el puerto este abierto y que `npm install` se ejecuto correctamente
- **Grupo no detectado**: Enviar un mensaje al grupo (cualquier miembro puede hacerlo)
- **Mensaje no se envia**: Verificar que el bot este conectado (`!ping` en el grupo)
- **Sesion perdida**: Verificar que MONGO_URI este configurado correctamente
- **Render se apaga**: Configurar UptimeRobot para keep-alive
- **MongoDB no conecta**: Verificar que la IP este en whitelist (0.0.0.0/0)
