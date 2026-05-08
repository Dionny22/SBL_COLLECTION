const API_URL = 'http://localhost:3000/api';
const articlesBody = document.getElementById('articles-body');
const salesBody = document.getElementById('sales-body');
const salesTotal = document.getElementById('sales-total');
const historyBody = document.getElementById('history-body');
const form = document.getElementById('article-form');
const messageBox = document.getElementById('message');
const searchInput = document.getElementById('search');
const articleCount = document.getElementById('article-count');
const formTitle = document.getElementById('form-title');
const resetButton = document.getElementById('reset-button');
const categorySelect = document.getElementById('category');
const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const userInfo = document.getElementById('user-info');
const currentUserDisplay = document.getElementById('current-user');
const logoutButton = document.getElementById('logout-button');
const resetPanel = document.getElementById('reset-panel');
const resetDatabaseForm = document.getElementById('reset-form');
const resetCodeInput = document.getElementById('reset-code');

let articles = [];
let categories = [];
let destockages = [];
let historyEntries = [];
let currentUser = null;
let authToken = null;

function showMessage(text, type = 'success') {
  messageBox.textContent = text;
  messageBox.style.background = type === 'error' ? '#dc2626' : '#16a34a';
  messageBox.classList.add('show');
  setTimeout(() => messageBox.classList.remove('show'), 3000);
}

function getAuthHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function setResetPanelVisible(visible) {
  if (visible) {
    resetPanel.classList.remove('hidden');
  } else {
    resetPanel.classList.add('hidden');
  }
}

function setLoggedIn(user, token) {
  currentUser = user;
  authToken = token;
  localStorage.setItem('inventory-user', user);
  localStorage.setItem('inventory-token', token);
  currentUserDisplay.textContent = user;
  loginForm.classList.add('hidden');
  userInfo.classList.remove('hidden');
  setResetPanelVisible(user === 'Sébastien');
}

function setLoggedOut() {
  currentUser = null;
  authToken = null;
  localStorage.removeItem('inventory-user');
  localStorage.removeItem('inventory-token');
  currentUserDisplay.textContent = '';
  loginForm.classList.remove('hidden');
  userInfo.classList.add('hidden');
  setResetPanelVisible(false);
}

function loadSession() {
  const savedUser = localStorage.getItem('inventory-user');
  const savedToken = localStorage.getItem('inventory-token');
  if (savedUser && savedToken) {
    setLoggedIn(savedUser, savedToken);
  } else {
    setLoggedOut();
  }
}

function requireAuth() {
  if (!currentUser || !authToken) {
    showMessage('Connecte-toi pour effectuer cette action.', 'error');
    throw new Error('Authentification requise');
  }
}

async function fetchCategories() {
  try {
    const response = await fetch(`${API_URL}/categories`);
    categories = await response.json();
    renderCategoryOptions();
  } catch (error) {
    console.error(error);
    categories = ['Bureau', 'Électronique', 'Meubles', 'Divers'];
    renderCategoryOptions();
  }
}

function renderCategoryOptions() {
  categorySelect.innerHTML = '<option value="">Sélectionner une catégorie</option>';
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

async function fetchDestockages() {
  try {
    const response = await fetch(`${API_URL}/destockages`);
    destockages = await response.json();
    renderDestockages();
  } catch (error) {
    console.error(error);
  }
}

async function fetchHistory() {
  try {
    const response = await fetch(`${API_URL}/history`);
    historyEntries = await response.json();
    renderHistory();
  } catch (error) {
    console.error(error);
  }
}

async function fetchArticles() {
  try {
    const response = await fetch(`${API_URL}/articles`);
    articles = await response.json();
    renderArticles();
  } catch (error) {
    console.error(error);
    showMessage('Impossible de charger les articles. Vérifie que le backend est démarré.', 'error');
  }
}

function renderDestockages() {
  salesBody.innerHTML = destockages
    .map((destockage) => {
      const date = new Date(destockage.date).toLocaleDateString('fr-FR');
      const time = new Date(destockage.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return `
      <tr>
        <td>${date} ${time}</td>
        <td>${destockage.articleName}</td>
        <td>${destockage.quantity}</td>
        <td>${destockage.user || '-'} </td>
        <td>${destockage.price} CFA</td>
        <td>${destockage.total} CFA</td>
      </tr>`;
    })
    .join('');

  const total = destockages.reduce((sum, d) => sum + (d.total || 0), 0);
  salesTotal.textContent = total.toLocaleString('fr-FR');
}

function renderHistory() {
  historyBody.innerHTML = historyEntries
    .map((entry) => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString('fr-FR') : '-';
      const time = entry.date ? new Date(entry.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      const actionMap = {
        create: 'Création',
        update: 'Modification',
        delete: 'Suppression',
        destock: 'Destockage',
      };
      const actionLabel = actionMap[entry.type] || entry.type;
      return `
      <tr>
        <td>${date} ${time}</td>
        <td>${actionLabel}</td>
        <td>${entry.articleName || '-'}</td>
        <td>${entry.user || '-'}</td>
        <td>${entry.quantity ?? '-'}</td>
        <td>${entry.price ? `${entry.price} CFA` : '-'}</td>
        <td>${entry.total ? `${entry.total} CFA` : '-'}</td>
        <td>${entry.note || '-'}</td>
      </tr>`;
    })
    .join('');
}

function renderArticles() {
  const filter = searchInput.value.toLowerCase().trim();
  const filtered = articles.filter((article) => {
    return (
      article.name.toLowerCase().includes(filter) ||
      article.category.toLowerCase().includes(filter) ||
      (article.description || '').toLowerCase().includes(filter)
    );
  });

  articlesBody.innerHTML = filtered
    .map((article) => {
      const description = article.description ? article.description : '-';
      const photoHtml = article.photo
        ? `<img src="${API_URL}${article.photo}" alt="${article.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">`
        : '-';
      const priceHtml = article.price ? `${article.price} CFA` : '-';
      return `
      <tr>
        <td>${photoHtml}</td>
        <td>${article.name}</td>
        <td>${article.category}</td>
        <td>${article.quantity}</td>
        <td>${priceHtml}</td>
        <td>${description}</td>
        <td>
          <div class="actions">
            <button class="action-button action-edit" data-id="${article.id}" title="Modifier">
              ✏️ Modifier
            </button>
            <button class="action-button action-delete" data-id="${article.id}" title="Supprimer">
              🗑️ Supprimer
            </button>
            <div class="destock-container">
              <input type="number" min="1" max="${article.quantity}" placeholder="Qté" class="destock-input" data-id="${article.id}" />
              <button class="action-button action-destock" data-id="${article.id}" title="Destocker">
                📤 Destocker
              </button>
            </div>
          </div>
        </td>
      </tr>`;
    })
    .join('');

  articleCount.textContent = filtered.length;
}

function resetArticleForm() {
  form.reset();
  document.getElementById('article-id').value = '';
  formTitle.textContent = 'Ajouter un article';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = loginUsername.value;
  const password = loginPassword.value;

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Échec de la connexion.');
    }

    const data = await response.json();
    setLoggedIn(data.username, data.token);
    showMessage(`Connecté en tant que ${data.username}.`);
    loginPassword.value = '';
  } catch (error) {
    console.error(error);
    showMessage(error.message || 'Impossible de se connecter.', 'error');
  }
});

logoutButton.addEventListener('click', () => {
  setLoggedOut();
  showMessage('Déconnecté.');
});

resetDatabaseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  requireAuth();
  const code = resetCodeInput.value.trim();
  if (!code) {
    showMessage('Entre le code de réinitialisation.', 'error');
    return;
  }

  if (!confirm('Cette action va remettre la base de données à zéro. Continuer ?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/reset`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Code invalide.');
    }

    await response.json();
    showMessage('Base de données réinitialisée.');
    resetCodeInput.value = '';
    await fetchArticles();
    await fetchDestockages();
    await fetchHistory();
  } catch (error) {
    console.error(error);
    showMessage(error.message || 'Erreur lors de la réinitialisation.', 'error');
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  requireAuth();

  const id = document.getElementById('article-id').value;
  const name = document.getElementById('name').value.trim();
  const quantity = Number(document.getElementById('quantity').value);
  const category = document.getElementById('category').value;
  const description = document.getElementById('description').value.trim();
  const price = document.getElementById('price').value;
  const photoFile = document.getElementById('photo').files[0];

  if (!name || category === '' || Number.isNaN(quantity)) {
    showMessage('Remplis tous les champs obligatoires.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('quantity', quantity);
  formData.append('category', category);
  formData.append('description', description);
  if (price) formData.append('price', price);
  if (photoFile) {
    formData.append('photo', photoFile);
  }

  try {
    let response;

    if (id) {
      response = await fetch(`${API_URL}/articles/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: formData,
      });
    } else {
      response = await fetch(`${API_URL}/articles`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de l’enregistrement.');
    }

    await response.json();
    showMessage('Article enregistré avec succès.');
    resetArticleForm();
    await fetchArticles();
  } catch (error) {
    console.error(error);
    showMessage(error.message || 'Erreur lors de l’enregistrement.', 'error');
  }
});

resetButton.addEventListener('click', () => {
  resetArticleForm();
});

articlesBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.dataset.id;

  if (button.classList.contains('action-edit')) {
    const article = articles.find((item) => item.id === id);
    if (!article) return;
    document.getElementById('article-id').value = article.id;
    document.getElementById('name').value = article.name;
    document.getElementById('quantity').value = article.quantity;
    document.getElementById('category').value = article.category;
    document.getElementById('price').value = article.price || '';
    document.getElementById('description').value = article.description;
    formTitle.textContent = 'Modifier l’article';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (button.classList.contains('action-delete')) {
    requireAuth();
    if (!confirm('Supprimer cet article ?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/articles/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Impossible de supprimer cet article.');
      }
      showMessage('Article supprimé.');
      await fetchArticles();
    } catch (error) {
      console.error(error);
      showMessage(error.message || 'Impossible de supprimer cet article.', 'error');
    }
  }

  if (button.classList.contains('action-destock')) {
    requireAuth();
    const input = document.querySelector(`.destock-input[data-id="${id}"]`);
    const quantity = Number(input.value);
    if (!quantity || quantity <= 0) {
      showMessage('Saisis une quantité valide à destocker.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/articles/${id}/destock`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors du destockage.');
      }

      await response.json();
      showMessage(`${quantity} article(s) destocké(s).`);
      input.value = '';
      await fetchArticles();
      await fetchDestockages();
      await fetchHistory();
    } catch (error) {
      console.error(error);
      showMessage(error.message || 'Erreur lors du destockage.', 'error');
    }
  }
});

searchInput.addEventListener('input', renderArticles);

window.addEventListener('load', async () => {
  loadSession();
  await fetchCategories();
  await fetchArticles();
  await fetchDestockages();
  await fetchHistory();

  document.querySelectorAll('.tab-button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));
      const tabId = button.dataset.tab + '-tab';
      document.getElementById(tabId).classList.add('active');
    });
  });

  setInterval(async () => {
    await fetchArticles();
    await fetchDestockages();
    await fetchHistory();
  }, 8000);
});
