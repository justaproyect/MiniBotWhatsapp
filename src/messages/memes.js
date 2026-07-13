const axios = require('axios');
const memesData = require('./data/memes.json');

let usedMemeIds = [];

function getDailyMeme() {
  const available = memesData.filter((m) => !usedMemeIds.includes(m.id));

  if (available.length === 0) {
    usedMemeIds = [];
    return getDailyMeme();
  }

  const meme = available[Math.floor(Math.random() * available.length)];
  usedMemeIds.push(meme.id);

  return {
    type: 'image-url',
    imageUrl: meme.url,
    caption: meme.caption,
  };
}

async function getDailyMemeWithBuffer() {
  const meme = getDailyMeme();

  try {
    const response = await axios.get(meme.imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    return { type: 'image', imageBuffer, caption: meme.caption };
  } catch (err) {
    console.error('[MEMES] Error descargando imagen:', err.message);
    return { type: 'text', message: meme.caption };
  }
}

module.exports = { getDailyMeme, getDailyMemeWithBuffer };
