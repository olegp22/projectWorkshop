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

// === ИСПРАВЛЕНИЕ ПУНКТ 2: СПИСОК ПРОЕКТОВ СТУДЕНТА ===
// getMyReviews возвращает работы НА ПРОВЕРКУ (reviewer perspective)
// Для студента используем ТОЛЬКО localStorage (my_submissions)
// Для каждой сохранённой работы загружаем детали через getSubmission

// Сохранить ID отправленной работы в localStorage
export function saveSubmissionId(submissionId, groupId, link) {
  const stored = getStoredSubmissions();
  if (!stored.find(s => s.submission_id === submissionId)) {
    stored.push({
      submission_id: submissionId,
      group_id: groupId,
      link: link,
      created_at: new Date().toISOString()
    });
    localStorage.setItem(MY_SUBMISSIONS_KEY, JSON.stringify(stored));
  }
}

// Получить сохранённые ID работ из localStorage
function getStoredSubmissions() {
  try {
    const raw = localStorage.getItem(MY_SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Очистить сохранённые работы (например, при выходе)
export function clearStoredSubmissions() {
  localStorage.removeItem(MY_SUBMISSIONS_KEY);
}

// === ПОДСЧЁТ ИТОГОВОГО БАЛЛА ===
// Считаем среднее по всем проверкам с учётом max_score каждого критерия

function calculateTotalScore(submission) {
  // Используем reviews (нормализованный api.js)
  const reviews = submission.reviews || [];
  if (reviews.length === 0) return null;

  // Собираем все оценки по критериям
  const criteriaScores = {}; // { criterion_id: { totalScore, totalMax, count } }

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

  // Считаем сумму средних / сумму максимумов
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
  let storedSubmissions = getStoredSubmissions();

  for (const stored of storedSubmissions) {
    try {
      const submission = await groupsAPI.getSubmission(stored.submission_id);
      if (!submission) continue;

      const groups = await groupsAPI.getMyGroups();
      const group = groups.find(g => g.id == stored.group_id);

      const scoreData = calculateTotalScore(submission);
      const isGraded = submission.status === 'graded';

      allProjects.push({
        id: submission.submission_id || submission.id,
        name: `Проект #${submission.submission_id || submission.id}`,
        groupId: stored.group_id,
        groupName: group?.name || 'Неизвестная группа',
        groupMode: (group?.group_mode || 'classic').toLowerCase(),
        deadline: '—',
        status: isGraded ? 'archive' : 'reviewing',
        date: stored.created_at || new Date().toISOString(),
        totalScore: scoreData ? `${scoreData.score}/${scoreData.max}` : '**',
        link: submission.link || stored.link || '#'
      });
    } catch (e) {
      console.warn(`Ошибка загрузки работы ${stored.submission_id}:`, e.message);
      // ИСПРАВЛЕНИЕ: если 404 — работа удалена, убираем из localStorage
      if (e.message && (e.message.includes('404') || e.message.includes('не найдена'))) {
        storedSubmissions = storedSubmissions.filter(s => s.submission_id !== stored.submission_id);
        localStorage.setItem(MY_SUBMISSIONS_KEY, JSON.stringify(storedSubmissions));
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