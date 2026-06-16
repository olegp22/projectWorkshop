import { groupsAPI } from './api.js';
import { loadCurrentUser, showToast, escapeHtml } from './review-core.js';

const MY_SUBMISSIONS_KEY = 'my_submissions';

let currentUserId = null;
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


function getStoredSubmissions() {
  try {
    const raw = localStorage.getItem(MY_SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}


function calculateTotalScore(submission) {

  const reviews = submission.reviews || [];
  if (reviews.length === 0) return null;


  const criteriaScores = {};

  reviews.forEach(review => {
    if (review.grades && review.grades.length > 0) {
      review.grades.forEach(g => {
        const cid = g.criterion_id || g.criterion_name;
        if (!cid) return;

        const maxScore = g.max_score || 10;

        if (!criteriaScores[cid]) {
          criteriaScores[cid] = { totalScore: 0, totalMax: maxScore, count: 0 };
        }
        criteriaScores[cid].totalScore += g.score || 0;
        criteriaScores[cid].count += 1;
      });
    }
  });

  if (Object.keys(criteriaScores).length === 0) return null;


  let totalScore = 0;
  let totalMax = 0;

  Object.values(criteriaScores).forEach(cs => {
    totalScore += Math.round(cs.totalScore / cs.count);
    totalMax += cs.totalMax;
  });

  return { score: totalScore, max: totalMax };
}

async function loadMyProjects() {
  currentUserId = getUserIdFromToken();
  if (!currentUserId) {
    showToast('Необходимо авторизоваться', true);
    return;
  }

  const allProjects = [];
  let groups = [];
  try {
    groups = await groupsAPI.getMyGroups();
  } catch (e) {
    console.warn('Ошибка загрузки групп:', e.message);
  }


  for (const group of groups) {
    try {
      const myWork = await groupsAPI.getMyWork(group.id);
      if (!myWork) continue;

      allProjects.push({
        id: myWork.id,
        name: `Проект #${myWork.id}`,
        groupId: group.id,
        groupName: group.name || 'Неизвестная группа',
        groupMode: (group.group_mode || 'classic').toLowerCase(),
        deadline: '—',
        status: myWork.score > 0 ? 'archive' : 'reviewing',
        date: new Date().toISOString(),
        totalScore: myWork.score > 0 ? `${myWork.score.toFixed(1)}/10` : '**',
        link: myWork.link || '#'
      });
    } catch (e) {

      if (!e.message?.includes('404') && !e.message?.includes('еще не загрузили')) {
        console.warn(`Ошибка загрузки работы для группы ${group.id}:`, e.message);
      }
    }
  }

  projects = allProjects;
}

function renderProjects() {
  const container = document.getElementById('projectsList');
  if (!container) return;

  container.className = 'projects-grid';

  const filtered = currentFilter === 'all'
    ? projects
    : projects.filter(p => p.status === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #9ca3af; padding: 32px 0;">У вас пока нет проектов</div>';
    return;
  }

  container.innerHTML = filtered.map(p => `
    <div class="project-card" data-status="${p.status}" data-id="${p.id}" data-group="${p.groupId}">
      <div class="card-content">
        <p class="card-row"><span class="card-label">Группа:</span> ${escapeHtml(p.groupName)}</p>
        <p class="card-row"><span class="card-label">Дедлайн:</span> ${escapeHtml(p.deadline)}</p>
        <p class="card-row"><span class="card-label">Проект:</span> ${escapeHtml(p.name)}</p>
        <p class="card-row"><span class="card-label">Итоговый балл:</span> <span class="font-bold text-orange-600">${escapeHtml(p.totalScore)}</span></p>
      </div>
      <button class="review-btn">Перейти к результатам</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-id]').forEach(card => {
    card.addEventListener('click', () => {
      const projectId = card.dataset.id;
      const groupId = card.dataset.group;
      const modeParam = projects.find(p => p.id == projectId)?.groupMode === 'contest' ? '&mode=contest'
        : projects.find(p => p.id == projectId)?.groupMode === 'p2p' ? '&mode=p2p' : '';
      window.location.href = `my-projects-detail.html?group=${groupId}&project=${projectId}${modeParam}`;
    });
  });
}

function setupFilters() {
  const container = document.getElementById('filterContainer');
  if (!container) return;

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