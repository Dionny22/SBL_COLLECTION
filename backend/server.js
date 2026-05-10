require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_sbl2026';
const MONGODB_URI = process.env.MONGODB_URI;
const USE_MONGO = Boolean(MONGODB_URI);

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

mongoose.set('strictQuery', false);

const defaultCategories = ['Bureau', 'Électronique', 'Meubles', 'Divers'];

const articleSchema = new mongoose.Schema({
  id: String,
  name: String,
  category: String,
  quantity: Number,
  price: Number,
  description: String,
  photo: String,
  createdAt: Date,
  updatedAt: Date,
  createdBy: String,
  updatedBy: String,
});

const destockageSchema = new mongoose.Schema({
  id: String,
  articleId: String,
  articleName: String,
  quantity: Number,
  price: Number,
  total: Number,
  user: String,
  date: Date,
});

const historySchema = new mongoose.Schema({
  id: String,
  type: String,
  articleId: String,
  articleName: String,
  user: String,
  date: Date,
  quantity: Number,
  price: Number,
  total: Number,
  note: String,
});

const Article = mongoose.model('Article', articleSchema);
const Destockage = mongoose.model('Destockage', destockageSchema);
const History = mongoose.model('History', historySchema);

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
    data.categories = data.categories || defaultCategories;
    data.destockages = data.destockages || [];
    data.history = data.history || [];
    return data;
  } catch (error) {
    return {
      articles: [],
      categories: defaultCategories,
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

async function connectMongo() {
  if (!USE_MONGO) return;
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Atlas connecté');
  } catch (error) {
    console.error('Erreur de connexion à MongoDB Atlas :', error.message);
    process.exit(1);
  }
}

async function getMongoCategories() {
  const articles = await Article.find({}).lean();
  return Array.from(new Set([...defaultCategories, ...articles.map((article) => article.category)]));
}

async function getMongoArticles() {
  return await Article.find({}).sort({ updatedAt: -1 }).lean();
}

async function getMongoDestockages() {
  return await Destockage.find({}).sort({ date: -1 }).lean();
}

async function getMongoHistory() {
  return await History.find({}).sort({ date: -1 }).lean();
}

async function getMongoArticleById(id) {
  return await Article.findOne({ id }).lean();
}

async function createMongoHistory(entry) {
  return await History.create(entry);
}

async function createMongoDestockage(entry) {
  return await Destockage.create(entry);
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

app.get('/api/categories', async (req, res) => {
  try {
    if (USE_MONGO) {
      const categories = await getMongoCategories();
      return res.json(categories);
    }
    const data = readData();
    const categories = Array.from(new Set([...data.categories, ...data.articles.map((article) => article.category)]));
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
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

app.get('/api/articles', async (req, res) => {
  try {
    if (USE_MONGO) {
      const articles = await getMongoArticles();
      return res.json(articles);
    }
    const data = readData();
    const sorted = [...data.articles].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.get('/api/destockages', async (req, res) => {
  try {
    if (USE_MONGO) {
      const destockages = await getMongoDestockages();
      return res.json(destockages);
    }
    const data = readData();
    const sorted = [...(data.destockages || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    if (USE_MONGO) {
      const history = await getMongoHistory();
      return res.json(history);
    }
    const data = readData();
    const sorted = [...(data.history || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.post('/api/articles', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const { name, category, quantity, description, price } = req.body;
    if (!name || !category || quantity === undefined) {
      return res.status(400).json({ error: 'Nom, catégorie et quantité sont requis.' });
    }

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

    if (USE_MONGO) {
      const created = await Article.create(article);
      await createMongoHistory(createHistoryEntry('create', created, req.user, {
        quantity: created.quantity,
        price: created.price,
        note: 'Article créé',
      }));
      return res.status(201).json(created);
    }

    const data = readData();
    data.articles.push(article);
    addHistory(data, createHistoryEntry('create', article, req.user, {
      quantity: article.quantity,
      price: article.price,
      note: 'Article créé',
    }));

    saveData(data);
    res.status(201).json(article);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.put('/api/articles/:id', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, quantity, description, price } = req.body;
    if (!name || !category || quantity === undefined) {
      return res.status(400).json({ error: 'Nom, catégorie et quantité sont requis.' });
    }

    if (USE_MONGO) {
      const article = await Article.findOne({ id });
      if (!article) {
        return res.status(404).json({ error: 'Article non trouvé.' });
      }

      if (req.file && article.photo) {
        const oldPhotoPath = path.join(__dirname, article.photo);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }

      const previous = { ...article.toObject() };
      article.name = String(name).trim();
      article.category = String(category).trim();
      article.quantity = Number(quantity);
      article.price = price ? Number(price) : article.price || 0;
      article.description = String(description || '').trim();
      article.photo = req.file ? `/uploads/${req.file.filename}` : article.photo;
      article.updatedAt = new Date().toISOString();
      article.updatedBy = req.user;

      const updated = await article.save();
      await createMongoHistory(createHistoryEntry('update', updated, req.user, {
        quantity: updated.quantity,
        price: updated.price,
        note: `Article modifié (avant: quantité ${previous.quantity}, prix ${previous.price})`,
      }));
      return res.json(updated);
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
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.delete('/api/articles/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (USE_MONGO) {
      const article = await Article.findOne({ id });
      if (!article) {
        return res.status(404).json({ error: 'Article non trouvé.' });
      }

      if (article.photo) {
        const photoPath = path.join(__dirname, article.photo);
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
        }
      }

      await Article.deleteOne({ id });
      await createMongoHistory(createHistoryEntry('delete', article.toObject(), req.user, {
        quantity: article.quantity,
        price: article.price,
        note: 'Article supprimé',
      }));
      return res.json({ success: true });
    }

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
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.patch('/api/articles/:id/destock', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const qtyToRemove = Number(quantity);

    if (!quantity || qtyToRemove <= 0 || Number.isNaN(qtyToRemove)) {
      return res.status(400).json({ error: 'Quantité à retirer invalide.' });
    }

    if (USE_MONGO) {
      const article = await Article.findOne({ id });
      if (!article) {
        return res.status(404).json({ error: 'Article non trouvé.' });
      }

      if (article.quantity < qtyToRemove) {
        return res.status(400).json({ error: 'Quantité insuffisante en stock.' });
      }

      article.quantity -= qtyToRemove;
      article.updatedAt = new Date().toISOString();
      await article.save();

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

      await createMongoDestockage(destockage);
      await createMongoHistory(createHistoryEntry('destock', article.toObject(), req.user, {
        quantity: qtyToRemove,
        price: article.price || 0,
        total: destockage.total,
        note: 'Destockage réalisé',
      }));

      return res.json({ article, destockage });
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
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.post('/api/reset', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (code !== 'SBLCOLLECTIONSHOP') {
      return res.status(403).json({ error: 'Code de réinitialisation invalide.' });
    }

    const defaultData = {
      articles: [],
      categories: defaultCategories,
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

    if (USE_MONGO) {
      await Article.deleteMany({});
      await Destockage.deleteMany({});
      await History.deleteMany({});
      return res.json({ success: true, message: 'Base de données réinitialisée.' });
    }

    saveData(defaultData);
    res.json({ success: true, message: 'Base de données réinitialisée.' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

if (USE_MONGO) {
  connectMongo().then(() => {
    app.listen(PORT, () => {
      console.log(`Inventaire API démarrée : http://localhost:${PORT}`);
    });
  });
} else {
  app.listen(PORT, () => {
    console.log(`Inventaire API démarrée : http://localhost:${PORT}`);
  });
}
