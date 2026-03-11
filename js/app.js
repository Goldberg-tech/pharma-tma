// ══════════════════════════════════════════════════════════════
//  CONFIG — замени на свой URL Railway бэкенда
// ══════════════════════════════════════════════════════════════
const API = 'https://pharma-tma-backend-production.up.railway.app';

// ══════════════════════════════════════════════════════════════
//  TELEGRAM INIT
// ══════════════════════════════════════════════════════════════
window.addEventListener("DOMContentLoaded", () => {
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    try {
      tg.expand();
      if (typeof tg.requestFullscreen === "function") tg.requestFullscreen();
    } catch(e) {}
    try {
      if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes();
    } catch(e) {}
    try { tg.setHeaderColor("#0d0d0f"); }     catch(e) {}
    try { tg.setBackgroundColor("#0d0d0f"); } catch(e) {}
    if (tg.BackButton) tg.BackButton.hide();

    const exitModal    = document.getElementById("exitModal");
    const exitBackdrop = document.getElementById("exitBackdrop");
    const exitCancel   = document.getElementById("exitCancel");
    const exitConfirm  = document.getElementById("exitConfirm");
    function showExitModal() { exitModal.classList.add("open"); }
    function hideExitModal() { exitModal.classList.remove("open"); }
    tg.onEvent("close", () => showExitModal());
    exitBackdrop.addEventListener("click", hideExitModal);
    exitCancel.addEventListener("click",   hideExitModal);
    exitConfirm.addEventListener("click",  () => tg.close());
  }

  // Enter в поле поиска
  document.getElementById('drug-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); searchByName(); }
  });
});

// ══════════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════════
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

// ══════════════════════════════════════════════════════════════
//  PHOTO HANDLER
// ══════════════════════════════════════════════════════════════
function handlePhoto(input) {
  const file = input.files[0];
  if (!file) return;

  // Показываем превью фото
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('camera-preview');
    preview.innerHTML = `<img src="${e.target.result}" alt="preview">`;
  };
  reader.readAsDataURL(file);

  // Отправляем на распознавание
  recognizePhoto(file);
}

async function recognizePhoto(file) {
  setLoading('Распознаём лекарство...');

  try {
    // Конвертируем в base64
    const base64 = await fileToBase64(file);

    const res = await fetch(`${API}/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64 }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError('Не удалось распознать', data.error || 'Попробуйте сделать более чёткое фото или введите название вручную');
      return;
    }

    // Нашли название — ищем аналоги
    await searchAnalogs(data.name);

  } catch (err) {
    showError('Ошибка соединения', 'Проверьте интернет и попробуйте снова');
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════════════════════════
//  SEARCH BY NAME
// ══════════════════════════════════════════════════════════════
function searchByName() {
  const name = document.getElementById('drug-input').value.trim();
  if (!name) {
    showToast('Введите название лекарства');
    return;
  }
  searchAnalogs(name);
}

function quickSearch(name) {
  document.getElementById('drug-input').value = name;
  searchAnalogs(name);
}

// ══════════════════════════════════════════════════════════════
//  SEARCH ANALOGS
// ══════════════════════════════════════════════════════════════
async function searchAnalogs(name) {
  setLoading('Ищем аналоги...');

  try {
    const res = await fetch(`${API}/analogs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError('Лекарство не найдено', `«${name}» не найдено в базе. Попробуйте другое название.`);
      return;
    }

    renderResults(data);
    showScreen('results');

    // Подгружаем цены после отображения
    loadPrices(data.analogs.map(a => a.name));

  } catch (err) {
    showError('Ошибка соединения', 'Проверьте интернет и попробуйте снова');
  }
}

// ══════════════════════════════════════════════════════════════
//  RENDER RESULTS
// ══════════════════════════════════════════════════════════════
function renderResults(data) {
  // Found card
  document.getElementById('found-card').innerHTML = `
    <div class="found-label">Найдено</div>
    <div class="found-name">${data.original}</div>
    <div class="found-active">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
      ${data.active}
    </div>
  `;

  // Analogs count
  document.getElementById('analogs-count').textContent = `(${data.analogs.length})`;

  // Analogs list
  const list = document.getElementById('analogs-list');
  list.innerHTML = data.analogs.map(a => {
    const isOriginal = a.name === data.original;
    return `
    <div class="analog-card ${isOriginal ? 'is-original' : ''}" id="card-${slugify(a.name)}">
      <div class="analog-info">
        <div class="analog-name">${a.name}</div>
        <div class="analog-meta">
          ${isOriginal ? '<span class="analog-tag original-tag">★ Оригинал</span>' : ''}
          ${a.form ? `<span class="analog-tag">${a.form}</span>` : ''}
          ${a.manufacturer ? `<span class="analog-tag">${a.manufacturer}</span>` : ''}
        </div>
      </div>
      <div class="analog-price" id="price-${slugify(a.name)}">
        <div class="price-loading"></div>
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
//  LOAD PRICES
// ══════════════════════════════════════════════════════════════
async function loadPrices(names) {
  try {
    const res = await fetch(`${API}/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    });

    const data = await res.json();

    for (const [name, info] of Object.entries(data.prices)) {
      const el = document.getElementById(`price-${slugify(name)}`);
      if (!el) continue;
      if (info.price) {
        el.innerHTML = `<div class="price-val">${info.price} ₽</div>`;
      } else {
        el.innerHTML = `<div style="font-size:11px;color:var(--muted)">нет данных</div>`;
      }
    }
  } catch {
    // Тихо — цены не критичны
    document.querySelectorAll('.price-loading').forEach(el => {
      el.parentElement.innerHTML = `<div style="font-size:11px;color:var(--muted)">—</div>`;
    });
  }
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
function setLoading(text) {
  document.getElementById('loading-text').textContent = text;
  showScreen('loading');
}

function showError(title, text) {
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-text').textContent  = text;
  showScreen('error');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '-');
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
