import { authAPI, usersAPI, groupsAPI } from './api.js';

export function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `fixed top-5 right-5 px-5 py-3 rounded-md text-white text-sm z-50 animate-slide-in ${isError ? 'bg-red-600' : 'bg-gray-800'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
}

export async function loadCurrentUser() {
  try {
    const user = await usersAPI.getMe();
    const displayName = (user.name && user.surname)
      ? `${user.name} ${user.surname}`
      : (user.name || user.email || 'Пользователь');
    const el = document.getElementById('headerUserName');
    if (el) el.innerText = displayName;
  } catch (error) {
    const el = document.getElementById('headerUserName');
    if (el) el.innerText = 'Гость';
  }
}

export let criteria = [];

export function setCriteria(newCriteria) {
  criteria = newCriteria;
}

export async function loadGroupCriteria(groupId) {
  try {
    const serverCriteria = await groupsAPI.getCriteria(groupId);
    criteria = serverCriteria.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      score: null,
      max_score: c.max_score || 10
    }));
  } catch (error) {
    console.warn('Не удалось загрузить критерии с бэкенда:', error.message);
    criteria = [];
  }
}

export async function loadProjectSubmission(projectId) {
  try {
    return await groupsAPI.getSubmission(projectId);
  } catch (error) {
    console.warn('Не удалось загрузить submission:', error.message);
    return null;
  }
}

export function renderCriteriaList(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (criteria.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400">Нет критериев оценки. Организатор группы ещё не настроил критерии.</p>';
    return;
  }

  container.innerHTML = criteria.map(c => {
    const max = c.max_score || 10;
    const scoresHtml = Array.from({ length: max }, (_, i) => {
      const score = i + 1;
      const isActive = c.score === score;
      return `
        <div class="score-circle ${isActive ? 'active' : ''}" data-criteria-id="${c.id}" data-score="${score}" title="${score} балл${score===1?'':'ов'}">
          ${score}
        </div>
        ${score < max ? '<div class="score-line"></div>' : ''}
      `;
    }).join('');

    return `
      <div class="criteria-item" data-criteria-id="${c.id}">
        <h3 class="text-base font-medium text-gray-800 mb-1">${escapeHtml(c.name)}</h3>
        ${c.description ? `<p class="text-xs text-gray-500 mb-3">${escapeHtml(c.description)}</p>` : ''}
        <div class="flex items-center">
          ${scoresHtml}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.score-circle').forEach(circle => {
    circle.addEventListener('click', () => {
      const criteriaId = parseInt(circle.dataset.criteriaId);
      const score = parseInt(circle.dataset.score);
      setCriteriaScore(criteriaId, score);
      renderCriteriaList(containerId);
      updateTotalScore();
    });
  });
}

export function setCriteriaScore(criteriaId, score) {
  const c = criteria.find(x => x.id === criteriaId);
  if (!c) return;
  c.score = score;
}

export function updateTotalScore(totalId = 'totalScore', maxTotalId = 'maxTotalScore') {
  const totalEl = document.getElementById(totalId);
  const maxEl = document.getElementById(maxTotalId);
  if (!totalEl || !maxEl) return;

  if (criteria.length === 0) {
    totalEl.innerText = '**';
    maxEl.innerText = '**';
    return;
  }
  const total = criteria.reduce((sum, c) => sum + (c.score || 0), 0);
  const max = criteria.reduce((sum, c) => sum + (c.max_score || 10), 0);
  totalEl.innerText = total;
  maxEl.innerText = max;
}

export async function handleFinishReview(projectId, feedback, groupId, onSuccess) {
  if (criteria.length === 0) {
    showToast('Критерии оценки не настроены организатором', true);
    return false;
  }

  const unscored = criteria.filter(c => c.score === null);
  if (unscored.length > 0) {
    showToast(`Оцените все критерии (осталось: ${unscored.length})`, true);
    return false;
  }

  const grades = criteria.map(c => ({
    criterion_id: c.id,
    score: c.score
  }));

  try {
    await groupsAPI.reviewWork(projectId, feedback, grades);
    showToast('Оценка успешно сохранена!');
    if (onSuccess) onSuccess();
    return true;
  } catch (error) {
    showToast('Ошибка сохранения: ' + error.message, true);
    return false;
  }
}

// Упрощённая инициализация — только оценка, без управления критериями
export function initReviewPage(options) {
  const {
    groupId,
    projectId,
    containerId,
    finishBtnId,
    feedbackId,
    onFinish
  } = options;

  // ── Завершение оценки ──
  const finishBtn = document.getElementById(finishBtnId);
  if (finishBtn) {
    finishBtn.addEventListener('click', async () => {
      const feedback = document.getElementById(feedbackId)?.value.trim() || '';

      finishBtn.disabled = true;
      finishBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⟳</span> Сохранение...';

      const success = await handleFinishReview(projectId, feedback, groupId, onFinish);

      if (!success) {
        finishBtn.disabled = false;
        finishBtn.innerText = 'Завершить оценку';
      }
    });
  }
}