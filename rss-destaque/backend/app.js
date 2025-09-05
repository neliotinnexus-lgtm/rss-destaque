const express = require('express');
const Parser = require('rss-parser');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const parser = new Parser();
const destaquePath = path.join(__dirname, 'destaque.json');

const feedUrls = [
  'https://www.tecmundo.com.br/rss',
  'https://www.thewindowsclub.com/feed'
];

const tagsFiltro = ['tecnologia', 'programação', 'windows', 'software', 'ia', 'inteligência artificial'];

async function carregarDestaques() {
  try {
    const data = await fs.readFile(destaquePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function salvarDestaques(destaques) {
  await fs.writeFile(destaquePath, JSON.stringify(destaques, null, 2));
}

app.get('/feed', async (req, res) => {
  const destaques = await carregarDestaques();
  let allItems = [];
  const now = new Date();

  for (const url of feedUrls) {
    try {
      const feed = await parser.parseURL(url);

      const filteredItems = feed.items
        .filter(item => {
          return tagsFiltro.some(tag =>
            (item.title && item.title.toLowerCase().includes(tag.toLowerCase())) ||
            (item.content && item.content.toLowerCase().includes(tag.toLowerCase()))
          );
        })
        .map(item => {
          const expiry = destaques[item.link];
          const destacado = expiry ? new Date(expiry) > now : false;
          return {
            ...item,
            destacado,
            destaqueExpiraEm: expiry || null,
          };
        });

      allItems = allItems.concat(filteredItems);
    } catch (err) {
      console.error('Erro ao ler feed', url, err);
    }
  }

  allItems.sort((a, b) => (b.destacado === true) - (a.destacado === true));

  res.json(allItems);
});

app.post('/admin/destaque', async (req, res) => {
  const { link, duracaoHoras } = req.body;
  if (!link || !duracaoHoras) {
    return res.status(400).json({ error: 'Parâmetros faltando' });
  }

  const destaques = await carregarDestaques();

  const expiryDate = new Date(Date.now() + duracaoHoras * 3600 * 1000).toISOString();
  destaques[link] = expiryDate;

  await salvarDestaques(destaques);

  res.json({ sucesso: true, link, expiryDate });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
