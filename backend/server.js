require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_sbl2026';

const USERS = [
  { username: process.env.SBL_USER_SEBASTIEN, password: process.env.SBL_PASS_SEBASTIEN },
  { username: process.env.SBL_USER_BLESSING, password: process.env.SBL_PASS_BLESSING },
  { username: process.env.SBL_USER_JAABIR, password: process.env.SBL_PASS_JAABIR },
].filter((user) => user.username && user.password);

if (USERS.length === 0) {
  console.warn('Aucun utilisateur configuré. Crée un fichier backend/.env à partir de backend/.env.example');
}

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

const WEB_DIR = path.join(__dirname, '..', 'web');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(WEB_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    data.categories = data.categories || ['Bureau', 'Électronique', 'Meubles', 'Divers'];
    data.destockages = data.destockages || [];
    data.history = data.history || [];
    return data;
  } catch (error) {
    return {
      articles: [],
      categories: ['Bureau', 'Électronique', 'Meubles', 'Divers'],
      destockages: [],
      history: [],
    };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getArticleById(id) {
  const data = readData();
  return data.articles.find((article) => article.id === id);
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload.username;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide.' });
  }
}

function addHistory(data, entry) {
  if (!data.history) data.history = [];
  data.history.push(entry);
}

function createHistoryEntry(type, article, user, extra = {}) {
  return {
    id: String(Date.now()) + Math.floor(Math.random() * 1000),
    type,
    articleId: article?.id || null,
    articleName: article?.name || extra.articleName || null,
    user,
    date: new Date().toISOString(),
    ...extra,
  };
}

app.get('/api/categories', (req, res) => {
  const data = readData();
  const categories = Array.from(new Set([...data.categories, ...data.articles.map((article) => article.category)]));
  res.json(categories);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Nom d’utilisateur et mot de passe requis.' });
  }

  const user = USERS.find((item) => item.username === String(username).trim());
  if (!user || user.password !== String(password).trim()) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }

  const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, username: user.username });
});

app.get('/api/articles', (req, res) => {
  const data = readData();
  const sorted = [...data.articles].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(sorted);
});

app.get('/api/destockages', (req, res) => {
  const data = readData();
  const sorted = [...(data.destockages || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(sorted);
});

app.get('/api/history', (req, res) => {
  const data = readData();
  const sorted = [...(data.history || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(sorted);
});

app.post('/api/articles', authenticate, upload.single('photo'), (req, res) => {
  const { name, category, quantity, description, price } = req.body;
  if (!name || !category || quantity === undefined) {
    return res.status(400).json({ error: 'Nom, catégorie et quantité sont requis.' });
  }

  const data = readData();
  const article = {
    id: String(Date.now()) + Math.floor(Math.random() * 1000),
    name: String(name).trim(),
    category: String(category).trim(),
    quantity: Number(quantity),
    price: price ? Number(price) : 0,
    description: String(description || '').trim(),
    photo: req.file ? `/uploads/${req.file.filename}` : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: req.user,
    updatedBy: req.user,
  };

  data.articles.push(article);
  addHistory(data, createHistoryEntry('create', article, req.user, {
    quantity: article.quantity,
    price: article.price,
    note: 'Article créé',
  }));

  saveData(data);
  res.status(201).json(article);
});

app.put('/api/articles/:id', authenticate, upload.single('photo'), (req, res) => {
  const { id } = req.params;
  const { name, category, quantity, description, price } = req.body;
  if (!name || !category || quantity === undefined) {
    return res.status(400).json({ error: 'Nom, catégorie et quantité sont requis.' });
  }

  const data = readData();
  const index = data.articles.findIndex((article) => article.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Article non trouvé.' });
  }

  if (req.file && data.articles[index].photo) {
    const oldPhotoPath = path.join(__dirname, data.articles[index].photo);
    if (fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }
  }

  const previous = { ...data.articles[index] };

  data.articles[index] = {
    ...data.articles[index],
    name: String(name).trim(),
    category: String(category).trim(),
    quantity: Number(quantity),
    price: price ? Number(price) : data.articles[index].price || 0,
    description: String(description || '').trim(),
    photo: req.file ? `/uploads/${req.file.filename}` : data.articles[index].photo,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user,
  };

  addHistory(data, createHistoryEntry('update', data.articles[index], req.user, {
    quantity: data.articles[index].quantity,
    price: data.articles[index].price,
    note: `Article modifié (avant: quantité ${previous.quantity}, prix ${previous.price})`,
  }));

  saveData(data);
  res.json(data.articles[index]);
});

app.delete('/api/articles/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const data = readData();
  const article = getArticleById(id);
  if (!article) {
    return res.status(404).json({ error: 'Article non trouvé.' });
  }

  if (article.photo) {
    const photoPath = path.join(__dirname, article.photo);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }
  }

  data.articles = data.articles.filter((item) => item.id !== id);
  addHistory(data, createHistoryEntry('delete', article, req.user, {
    quantity: article.quantity,
    price: article.price,
    note: 'Article supprimé',
  }));

  saveData(data);
  res.json({ success: true });
});

app.patch('/api/articles/:id/destock', authenticate, (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  const qtyToRemove = Number(quantity);

  if (!quantity || qtyToRemove <= 0 || Number.isNaN(qtyToRemove)) {
    return res.status(400).json({ error: 'Quantité à retirer invalide.' });
  }

  const data = readData();
  const index = data.articles.findIndex((article) => article.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Article non trouvé.' });
  }

  if (data.articles[index].quantity < qtyToRemove) {
    return res.status(400).json({ error: 'Quantité insuffisante en stock.' });
  }

  const article = data.articles[index];
  const destockage = {
    id: String(Date.now()) + Math.floor(Math.random() * 1000),
    articleId: article.id,
    articleName: article.name,
    quantity: qtyToRemove,
    price: article.price || 0,
    total: (article.price || 0) * qtyToRemove,
    user: req.user,
    date: new Date().toISOString(),
  };

  if (!data.destockages) data.destockages = [];
  data.destockages.push(destockage);

  data.articles[index].quantity -= qtyToRemove;
  data.articles[index].updatedAt = new Date().toISOString();

  addHistory(data, createHistoryEntry('destock', article, req.user, {
    quantity: qtyToRemove,
    price: article.price || 0,
    total: destockage.total,
    note: 'Destockage réalisé',
  }));

  saveData(data);
  res.json({ article: data.articles[index], destockage });
});

app.post('/api/reset', authenticate, (req, res) => {
  const { code } = req.body;
  if (code !== 'SBLCOLLECTIONSHOP') {
    return res.status(403).json({ error: 'Code de réinitialisation invalide.' });
  }

  const defaultData = {
    articles: [],
    categories: ['Bureau', 'Électronique', 'Meubles', 'Divers'],
    destockages: [],
    history: [],
  };

  // Supprimer les images uploadées
  if (fs.existsSync(UPLOADS_DIR)) {
    fs.readdirSync(UPLOADS_DIR).forEach((file) => {
      const filePath = path.join(UPLOADS_DIR, file);
      if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
  }

  saveData(defaultData);
  res.json({ success: true, message: 'Base de données réinitialisée.' });
});

app.listen(PORT, () => {
  console.log(`Inventaire API démarrée : http://localhost:${PORT}`);
});
