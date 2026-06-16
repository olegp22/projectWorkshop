import { groupsAPI } from './api.js';
import { loadCurrentUser, showToast, escapeHtml, loadGroupCriteria } from './review-core.js';

let currentGroupId = null;
let currentGroupMode = 'classic';
let currentUserRole = null;
let currentUserId = null;
let groupCriteria = [];
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

async function loadGroupInfo() {
  const params = new URLSearchParams(window.location.search);
  currentGroupId = params.get('group');
  currentUserId = getUserIdFromToken();

  if (!currentGroupId) {
    showToast('Группа не выбрана', true);
    return;
  }

  try {
    const groups = await groupsAPI.getMyGroups();
    const group = groups.find(g => g.id == currentGroupId);
    if (group) {

      currentGroupMode = (group.group_mode || 'classic').toLowerCase();
      const urlMode = params.get('mode');
      if (urlMode && !group.group_mode) {
        currentGroupMode = urlMode;
      }

      currentUserRole = (group.role || 'member').toLowerCase();
      const nameEl = document.getElementById('groupName');
      if (nameEl) {
        if (currentGroupMode === 'contest') {
          nameEl.innerHTML = `${escapeHtml(group.name)} <span class="text-sm text-gray-500">(конкурс)</span>`;
        } else if (currentGroupMode === 'p2p') {
          nameEl.innerHTML = `${escapeHtml(group.name)} <span class="text-sm text-gray-500">(peer-to-peer)</span>`;
        } else {
          nameEl.innerText = escapeHtml(group.name);
        }
      }
    }

    try {
      groupCriteria = await groupsAPI.getCriteria(currentGroupId);
    } catch (e) {
      console.warn('Не удалось загрузить критерии:', e.message);
      groupCriteria = [];
    }
  } catch (error) {
    console.error('Ошибка загрузки группы:', error);
  }
}

function renderProjects() {
  const container = document.getElementById('projectsList');
  if (!container) return;

  container.className = 'projects-grid';

  const filtered = currentFilter === 'all'
    ? projects
    : projects.filter(p => p.status === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #9ca3af; padding: 32px 0;">Нет проектов для отображения</div>';
    updateProgress(0, 0);
    return;
  }

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

  container.querySelectorAll('[data-id]').forEach(card => {
    card.addEventListener('click', () => {
      const projectId = card.dataset.id;
      const modeParam = currentGroupMode !== 'classic' ? `&mode=${currentGroupMode}` : '';
      window.location.href = `review-detail.html?group=${currentGroupId}&project=${projectId}${modeParam}`;
    });
  });

  const checked = filtered.filter(p => p.status === 'archive').length;
  updateProgress(checked, filtered.length);
}

function updateProgress(checked, total) {
  const bar = document.getElementById('progressBar');
  const text = document.getElementById('progressText');
  const counter = document.getElementById('progressCounter');
  if (!bar || !text || !counter) return;

  const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
  bar.style.width = `${percent}%`;
  text.innerText = `${percent}%`;
  counter.innerText = `${checked} из ${total} проверено`;
}

function setupFilters() {
  const container = document.getElementById('filterContainer');
  if (!container) return;


  container.innerHTML = `
    <button class="filter-btn is-active bg-orange-500 px-4 py-1 rounded text-sm font-medium transition cursor-pointer text-white" data-filter="all">Все</button>
    <button class="filter-btn px-4 py-1 rounded text-sm font-medium transition cursor-pointer bg-orange-500 text-white opacity-70 hover:opacity-100" data-filter="reviewing">На проверке</button>
    <button class="filter-btn px-4 py-1 rounded text-sm font-medium transition cursor-pointer bg-orange-500 text-white opacity-70 hover:opacity-100" data-filter="archive">Архив</button>
  `;

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


async function loadProjectsWithProgress() {
  try {
    const reviews = await groupsAPI.getMyReviews();
    const totalCriteriaCount = groupCriteria.length || 0;


    const groupReviews = reviews.filter(r => r.group_id == currentGroupId);


    const projectsWithDetails = await Promise.all(
      groupReviews.map(async (r) => {
        let myReviewStatus = 'pending';
        let scoredCount = 0;

        try {
          const submission = await groupsAPI.getSubmission(r.submission_id);

          const myReview = submission.reviews?.find(
            rev => rev.reviewer_id === currentUserId
          );
          if (myReview) {
            myReviewStatus = myReview.status || 'pending';

            if (myReview.grades && Array.isArray(myReview.grades)) {
              const uniqueCriteria = new Set(
                myReview.grades.map(g => g.criterion_id).filter(Boolean)
              );
              scoredCount = uniqueCriteria.size;
            }
          }
        } catch (e) {
          console.warn(`Не удалось загрузить детали работы ${r.submission_id}:`, e.message);

          if (r.status === 'graded') {
            myReviewStatus = 'graded';
            scoredCount = totalCriteriaCount;
          }
        }

        const isFullyReviewed = myReviewStatus === 'graded' || scoredCount >= totalCriteriaCount;

        return {
          id: r.submission_id,
          name: `Проект #${r.submission_id}`,
          author: `${r.surname || ""} ${r.name || ""} (ID ${r.student_id})`,
          status: isFullyReviewed ? 'archive' : 'reviewing',
          date: new Date().toISOString(),
          deadline: '—',
          totalCriteria: totalCriteriaCount,
          scoredCriteria: scoredCount
        };
      })
    );

    projects = projectsWithDetails;
  } catch (error) {
    console.warn('Не удалось загрузить работы:', error.message);
    projects = [];
  }
}

async function init() {
  await loadCurrentUser();
  await loadGroupInfo();
  await loadProjectsWithProgress();
  setupFilters();
  setupSort();
  renderProjects();
}

init();