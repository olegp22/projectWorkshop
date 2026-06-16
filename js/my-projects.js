import { groupsAPI } from './api.js';
import { loadCurrentUser, showToast, escapeHtml } from './review-core.js';

let currentGroupId = null;
let currentGroupMode = 'classic';
let projects = [];
let currentFilter = 'all';
let sortAsc = false;

function getUserIdFromToken() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.user_id || null;
  } catch {
    return null;
  }
}

async function loadMyProjects() {
  try {
    const groups = await groupsAPI.getMyGroups();
    const currentUserId = getUserIdFromToken();

    const allProjects = [];

    for (const group of groups) {
      const groupId = group.id;
      const groupMode = (group.group_mode || 'classic').toLowerCase();

      try {
        // Получаем свою работу в группе
        const myWork = await groupsAPI.getMyWork(groupId);

        if (myWork && myWork.id) {
          // Получаем детали работы для статуса
          let status = 'reviewing';
          let score = myWork.score || 0;

          try {
            const details = await groupsAPI.getSubmission(myWork.id);
            if (details) {
              status = details.status === 'graded' ? 'archive' : 'reviewing';
            }
          } catch (e) {
            // Если не удалось получить детали, используем score
            if (score > 0) status = 'archive';
          }

          allProjects.push({
            id: myWork.id,
            groupId: groupId,
            groupName: group.name,
            groupMode: groupMode,
            link: myWork.link,
            status: status,
            score: score,
            date: new Date().toISOString(),
            deadline: '—'
          });
        }
      } catch (e) {
        // 404 = работа не загружена, пропускаем
        if (!e.message || (!e.message.includes('404') && !e.message.includes('не загрузили'))) {
          console.warn(`Ошибка загрузки работы для группы ${groupId}:`, e.message);
        }
      }
    }

    projects = allProjects;
  } catch (error) {
    console.warn('Не удалось загрузить проекты:', error.message);
    projects = [];
  }
}

function renderProjects() {
  const container = document.getElementById('projectsList');
  if (!container) return;

  container.className = 'projects-grid';

  // Фильтрация
  let filtered = [];

  if (currentFilter === 'all') {
    filtered = projects;
  } else if (currentFilter === 'reviewing') {
    filtered = projects.filter(p => p.status === 'reviewing');
  } else if (currentFilter === 'archive') {
    filtered = projects.filter(p => p.status === 'archive');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: #9ca3af; padding: 48px 0;">
        <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
        <p style="font-size: 16px; font-weight: 600; color: #4b5563; margin-bottom: 8px;">Нет проектов</p>
        <p style="font-size: 14px;">У вас пока нет работ в группах</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const statusText = p.status === 'archive' ? 'Оценена' : 'На проверке';
    const statusClass = p.status === 'archive' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700';
    const scoreText = p.status === 'archive' && p.score > 0 ? `<span class="text-orange-600 font-bold">${p.score.toFixed(1)}</span> баллов` : '';

    return `
    <div class="project-card" data-status="${p.status}" data-id="${p.id}" data-group="${p.groupId}">
      <div class="card-content">
        <p class="card-row"><span class="card-label">Группа:</span> ${escapeHtml(p.groupName)}</p>
        <p class="card-row"><span class="card-label">Ссылка:</span> <a href="${escapeHtml(p.link)}" target="_blank" class="text-purple-600 hover:underline">${escapeHtml(p.link)}</a></p>
        <p class="card-row"><span class="card-label">Статус:</span> <span class="text-xs px-2 py-0.5 rounded ${statusClass}">${statusText}</span></p>
        ${scoreText ? `<p class="card-row"><span class="card-label">Балл:</span> ${scoreText}</p>` : ''}
      </div>
      <button class="review-btn">${p.status === 'archive' ? 'Посмотреть результаты' : 'Посмотреть детали'}</button>
    </div>
  `;
  }).join('');

  container.querySelectorAll('[data-id]').forEach(card => {
    card.addEventListener('click', () => {
      const projectId = card.dataset.id;
      const groupId = card.dataset.group;
      const modeParam = currentGroupMode !== 'classic' ? `&mode=${currentGroupMode}` : '';
      window.location.href = `my-projects-detail.html?group=${groupId}&project=${projectId}${modeParam}`;
    });
  });
}

function setupFilters() {
  const buttons = document.querySelectorAll('#filterContainer .filter-btn');

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

async function init() {
  await loadCurrentUser();
  await loadMyProjects();
  setupFilters();
  setupSort();
  renderProjects();
}

init();