# 🛒 LastBite / My Grocery — Backend API

Multi-tenant SaaS backend pour la plateforme marchande UAE.

## Stack
- **Node.js** + **Express**
- **PostgreSQL** via **Supabase**
- **Prisma** ORM
- **JWT** Authentication

---

## 🚀 Installation rapide

### 1. Cloner et installer
```bash
cd merchant-backend
npm install
```

### 2. Configurer l'environnement
```bash
cp .env.example .env
# Édite .env avec ta DATABASE_URL Supabase
```

### 3. Connecter Supabase
Dans Supabase → Settings → Database → Connection string → URI
Copie-le dans `.env` comme `DATABASE_URL`

### 4. Initialiser la base de données
```bash
npm run db:generate    # Génère le client Prisma
npm run db:migrate     # Crée toutes les tables
npm run db:seed        # Données de test
```

### 5. Lancer le serveur
```bash
npm run dev
```
Le serveur tourne sur **http://localhost:5000**

---

## 📡 API Routes

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Inscription marchand |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/auth/me` | Profil connecté |

### Dashboard
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/dashboard/stats` | Today Revenue, Active Products, Orders Today, Expiring |
| GET | `/api/dashboard/action-needed` | Alerts section |

### Products
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/products` | Liste (filter: category, status, search) |
| GET | `/api/products/expiring` | Produits expirant dans 48h |
| GET | `/api/products/:id` | Détail produit |
| POST | `/api/products` | Créer produit |
| PUT | `/api/products/:id` | Modifier |
| DELETE | `/api/products/:id` | Supprimer |
| PATCH | `/api/products/:id/toggle-featured` | Toggle featured |

### Orders
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/orders` | Liste (filter: status=NEW,PREPARING,READY...) |
| GET | `/api/orders/history` | Historique |
| GET | `/api/orders/:id` | Détail |
| PATCH | `/api/orders/:id/status` | Changer status (Accept, Preparing, Ready, Deliver...) |

### Users (Team)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/users` | Liste équipe |
| GET | `/api/users/:id` | Détail + activité |
| POST | `/api/users` | Ajouter membre (Enterprise plan) |
| PUT | `/api/users/:id` | Modifier |
| DELETE | `/api/users/:id` | Désactiver |

### Analytics
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/analytics/overview` | Revenue, Orders, Food waste, Best sellers |

### Messages
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/messages/unread-count` | Badge count |
| GET | `/api/messages/conversations` | Liste conversations |
| GET | `/api/messages/conversations/:id` | Messages d'une conv |
| POST | `/api/messages/conversations/:id/send` | Envoyer message |

### Settings
| Method | Route | Description |
|--------|-------|-------------|
| GET/PUT | `/api/settings/profile` | Profil utilisateur |
| GET/PUT | `/api/settings/store` | Info boutique, Store Status |
| PUT | `/api/settings/language` | en ou ar |
| PUT | `/api/settings/appearance` | Dark mode |
| PUT | `/api/settings/notifications` | Email, Push, Marketing |
| GET | `/api/settings/billing` | Plan actuel + invoices |
| POST | `/api/settings/billing/upgrade` | Upgrader plan |

### Super Admin
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/merchants` | Liste marchands |
| GET | `/api/admin/merchants/:id` | Détail marchand |
| PATCH | `/api/admin/merchants/:id/status` | Activer/désactiver |
| PATCH | `/api/admin/merchants/:id/subscription` | Modifier plan |
| GET | `/api/admin/stats` | Stats globales SaaS |
| GET | `/api/admin/audit-logs` | CRM / historique |

---

## 🔐 Comptes de test (après seed)

| Rôle | Email | Password |
|------|-------|----------|
| Super Admin | admin@lastbite.ae | Admin@123456 |
| Merchant Owner | joe@mygrocery.ae | Password@123 |

---

## 📦 Plans d'abonnement

| Plan | Prix | Commission | Multi-users | API externe |
|------|------|-----------|------------|------------|
| FREE | 0 AED | 5% par vente | ❌ | ❌ |
| PROFESSIONAL | 99 AED/mois | 0% | ❌ | ❌ |
| ENTERPRISE | 299 AED/mois | 0% | ✅ | ✅ |

---

## 🔗 Connecter le front-end React

Dans ton projet React, crée un fichier `.env`:
```
REACT_APP_API_URL=http://localhost:5000/api
```

Exemple d'appel API:
```javascript
const response = await fetch(`${process.env.REACT_APP_API_URL}/dashboard/stats`, {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});
```
