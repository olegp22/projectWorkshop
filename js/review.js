import { groupsAPI } from './api.js';
import { loadCurrentUser, showToast, escapeHtml } from './review-core.js';

let currentGroupId = null;
let currentGroupMode = 'classic'; // classic | p2p | contest
let projects = [];
let currentFilter = 'all';
let sortAsc = false;

// ── Загрузка информации о группе ──
async function loadGroupInfo() {
  const params = new URLSearchParams(window.location.search);
  currentGroupId = params.get('group');
  currentGroupMode = params.get('mode') || 'classic';

  if (!currentGroupId) {
    showToast('Группа не выбрана', true);
    return;
  }

  try {
    const groups = await groupsAPI.getMyGroups();
    const group = groups.find(g => g.id == currentGroupId);
    if (group) {
      const nameEl = document.getElementById('groupName');
      if (nameEl) {
        if (currentGroupMode === 'contest') {
          nameEl.innerHTML = `${escapeHtml(group.name)} <span class="text-sm text-gray-500">(конкурс)</span>`;
        } else {
          nameEl.innerText = escapeHtml(group.name);
        }
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки группы:', error);
  }
}

// ── Мок-проекты ──
function generateMockProjects() {
  if (currentGroupMode === 'contest') {
    return [
      { id: 1, name: 'Проект «Альфа»', author: 'Иванов И.И.', status: 'pending', date: '2026-05-10', voted: false, score: null },
      { id: 2, name: 'Проект «Бета»', author: 'Петров П.П.', status: 'voted', date: '2026-05-09', voted: true, score: 8 },
      { id: 3, name: 'Проект «Гамма»', author: 'Сидоров С.С.', status: 'pending', date: '2026-05-08', voted: false, score: null },
      { id: 4, name: 'Проект «Дельта»', author: 'Козлова А.А.', status: 'voted', date: '2026-05-11', voted: true, score: 9 },
      { id: 5, name: 'Проект «Эпсилон»', author: 'Новиков Д.Д.', status: 'pending', date: '2026-05-07', voted: false, score: null },
      { id: 6, name: 'Проект «Зета»', author: 'Морозова Е.Е.', status: 'voted', date: '2026-05-06', voted: true, score: 7 },
      { id: 7, name: 'Проект «Эта»', author: 'Волков А.А.', status: 'pending', date: '2026-05-12', voted: false, score: null },
      { id: 8, name: 'Проект «Тета»', author: 'Лебедева О.О.', status: 'voted', date: '2026-05-13', voted: true, score: 10 },
    ];
  }
  return [
    { id: 1, name: 'Проект «Альфа»', author: 'Иванов И.И.', status: 'reviewing', date: '2026-05-10', deadline: '2026-05-15', totalCriteria: 5, scoredCriteria: 2 },
    { id: 2, name: 'Проект «Бета»', author: 'Петров П.П.', status: 'urgent', date: '2026-05-09', deadline: '2026-05-12', totalCriteria: 4, scoredCriteria: 4 },
    { id: 3, name: 'Проект «Гамма»', author: 'Сидоров С.С.', status: 'archive', date: '2026-05-08', deadline: '2026-05-10', totalCriteria: 6, scoredCriteria: 6 },
    { id: 4, name: 'Проект «Дельта»', author: 'Козлова А.А.', status: 'reviewing', date: '2026-05-11', deadline: '2026-05-18', totalCriteria: 5, scoredCriteria: 0 },
    { id: 5, name: 'Проект «Эпсилон»', author: 'Новиков Д.Д.', status: 'urgent', date: '2026-05-07', deadline: '2026-05-11', totalCriteria: 3, scoredCriteria: 3 },
    { id: 6, name: 'Проект «Зета»', author: 'Морозова Е.Е.', status: 'archive', date: '2026-05-06', deadline: '2026-05-09', totalCriteria: 5, scoredCriteria: 5 },
    { id: 7, name: 'Проект «Эта»', author: 'Волков А.А.', status: 'reviewing', date: '2026-05-12', deadline: '2026-05-20', totalCriteria: 4, scoredCriteria: 1 },
    { id: 8, name: 'Проект «Тета»', author: 'Лебедева О.О.', status: 'reviewing', date: '2026-05-13', deadline: '2026-05-19', totalCriteria: 5, scoredCriteria: 3 },
  ];
}

// ── Рендер списка проектов ──
function renderProjects() {
  const container = document.getElementById('projectsList');
  if (!container) return;

  const filtered = currentFilter === 'all'
    ? projects
    : projects.filter(p => {
        if (currentGroupMode === 'contest') {
          return currentFilter === 'pending' ? !p.voted : p.voted;
        }
        return p.status === currentFilter;
      });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #9ca3af; padding: 32px 0;">Нет проектов для отображения</div>';
    updateProgress(0, 0);
    return;
  }

  if (currentGroupMode === 'contest') {
    container.innerHTML = filtered.map(p => `
      <div class="project-card" data-status="${p.voted ? 'voted' : 'pending'}" data-id="${p.id}">
        <div class="card-content">
          <p class="card-row"><span class="card-label">Проект:</span> ${escapeHtml(p.name)}</p>
          <p class="card-row"><span class="card-label">Студент:</span> ${escapeHtml(p.author)}</p>
          ${p.voted 
            ? `<p class="card-row"><span class="card-label">Ваш балл:</span> <span class="text-orange-600 font-bold text-lg">${p.score}/10</span></p>`
            : '<p class="card-row text-orange-600 font-medium">⚡ Ожидает вашего голоса</p>'
          }
        </div>
        <button class="review-btn">${p.voted ? 'Изменить голос' : 'Голосовать'}</button>
      </div>
    `).join('');
  } else {
    container.innerHTML = filtered.map(p => `
      <div class="project-card" data-status="${p.status}" data-id="${p.id}">
        <div class="card-content">
          <p class="card-row"><span class="card-label">Дедлайн:</span> ${escapeHtml(p.deadline)}</p>
          <p class="card-row"><span class="card-label">Проект:</span> ${escapeHtml(p.name)}</p>
          <p class="card-row"><span class="card-label">Студент:</span> ${escapeHtml(p.author)}</p>
          <p class="card-row"><span class="card-label">Прогресс:</span> ${p.scoredCriteria} из ${p.totalCriteria} критериев оценено</p>
        </div>
        <button class="review-btn">Перейти к оценке</button>
      </div>
    `).join('');
  }

  container.querySelectorAll('[data-id]').forEach(card => {
    card.addEventListener('click', () => {
      const projectId = card.dataset.id;
      const modeParam = currentGroupMode === 'contest' ? '&mode=contest' : '';
      window.location.href = `review-detail.html?group=${currentGroupId}&project=${projectId}${modeParam}`;
    });
  });

  const checked = filtered.filter(p => {
    if (currentGroupMode === 'contest') return p.voted;
    return p.scoredCriteria === p.totalCriteria;
  }).length;
  updateProgress(checked, filtered.length);
}

// ── Прогресс-бар ──
function updateProgress(checked, total) {
  const bar = document.getElementById('progressBar');
  const text = document.getElementById('progressText');
  const counter = document.getElementById('progressCounter');
  if (!bar || !text || !counter) return;

  const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
  bar.style.width = `${percent}%`;
  text.innerText = `${percent}%`;
  
  if (currentGroupMode === 'contest') {
    counter.innerText = `${checked} из ${total} проголосовано`;
  } else {
    counter.innerText = `${checked} из ${total} проверено`;
  }
}

// ── Фильтры ──
function setupFilters() {
  const container = document.getElementById('filterContainer');
  if (!container) return;

  // Contest: заменяем фильтры
  if (currentGroupMode === 'contest') {
    container.innerHTML = `
      <button class="filter-btn is-active bg-orange-500 px-4 py-1 rounded text-sm font-medium transition cursor-pointer text-white" data-filter="all">Все</button>
      <button class="filter-btn px-4 py-1 rounded text-sm font-medium transition cursor-pointer bg-orange-500 text-white opacity-70 hover:opacity-100" data-filter="pending">На голосовании</button>
      <button class="filter-btn px-4 py-1 rounded text-sm font-medium transition cursor-pointer bg-orange-500 text-white opacity-70 hover:opacity-100" data-filter="voted">Проголосовано</button>
    `;
  }

  const buttons = container.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => {
        b.classList.remove('is-active');
        b.classList.add('opacity-70');
      });
      btn.classList.add('is-active');
      btn.classList.remove('opacity-70');
      currentFilter = btn.dataset.filter;
      renderProjects();
    });
  });
}

// ── Сортировка ──
function setupSort() {
  const sortToggle = document.getElementById('sortToggle');
  if (!sortToggle) return;

  sortToggle.addEventListener('click', () => {
    sortAsc = !sortAsc;
    projects.sort((a, b) => {
      const da = new Date(a.date), db = new Date(b.date);
      return sortAsc ? da - db : db - da;
    });
    const label = sortToggle.querySelector('span');
    if (label) label.innerText = sortAsc ? 'Сначала старые' : 'Сначала новые';
    renderProjects();
  });
}

// ── Инициализация ──
async function init() {
  await loadCurrentUser();
  await loadGroupInfo();

  try {
    const reviews = await groupsAPI.getMyReviews();
    projects = reviews.map(r => ({
      id: r.submission_id,
      name: `Проект #${r.submission_id}`,
      author: `Студент #${r.student_id}`,
      status: r.status === 'graded' ? 'archive' : 'reviewing',
      date: new Date().toISOString(),
      deadline: '—',
      totalCriteria: 5,
      scoredCriteria: r.status === 'graded' ? 5 : 0
    }));
  } catch (error) {
    console.warn('Не удалось загрузить работы, используем моки:', error.message);
    projects = generateMockProjects();
  }

  setupFilters();
  setupSort();
  renderProjects();
}

init();