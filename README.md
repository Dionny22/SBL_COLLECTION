# 📦 INVENTAIRE - Application de Gestion d'Inventaire

Application multi-plateforme pour la gestion d'inventaires avec synchronisation entre mobile et web.

## 🏗️ Architecture

```
INVENTAIRE/
├── backend/          # API Node.js + Express + MongoDB
├── web/             # Application React (Web)
├── mobile/          # Application React Native (Mobile)
└── shared/          # Types et utilitaires partagés
```

## 🚀 Stack Technologique

- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Frontend Web**: React, TypeScript, TailwindCSS
- **Mobile**: React Native, TypeScript
- **API**: RESTful API avec authentification JWT

## 📱 Fonctionnalités

- ✅ Gestion des articles (CRUD)
- ✅ Catégorisation des produits
- ✅ Suivi des quantités en stock
- ✅ Recherche et filtrage
- ✅ Synchronisation temps réel
- ✅ Authentification utilisateur
- ✅ Interface responsive

## 🛠️ Installation

### Backend
```bash
cd backend
npm install
npm run dev
```

> Important: crée un fichier `backend/.env` à partir de `backend/.env.example` et ne le pousse pas sur GitHub.

### Web
```bash
cd web
npm install
npm start
```

### Mobile
```bash
cd mobile
npm install
npx react-native run-android  # ou run-ios
```

## 📡 API Endpoints

- `GET /api/articles` - Lister tous les articles
- `POST /api/articles` - Créer un article
- `PUT /api/articles/:id` - Modifier un article
- `DELETE /api/articles/:id` - Supprimer un article
- `GET /api/categories` - Lister les catégories

## 🔐 Authentification

L'application utilise des tokens JWT pour l'authentification entre le client et le serveur.

## 📊 Base de Données

MongoDB avec les collections suivantes :
- `users` - Utilisateurs
- `articles` - Articles en inventaire
- `categories` - Catégories d'articles
