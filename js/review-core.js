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
    return user;
  } catch (error) {
    const el = document.getElementById('headerUserName');
    if (el) el.innerText = 'Гость';

    // If auth error, clear token and return null
    if (error.message && (error.message.includes('401') || error.message.includes('Сессия истекла'))) {
      localStorage.removeItem('access_token');
      return null;
    }
    return null;
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

function getScaleStep(max) {
  if (max <= 10) return 1;
  if (max <= 20) return 2;
  if (max <= 50) return 5;
  if (max <= 100) return 10;
  if (max <= 250) return 25;
  if (max <= 500) return 50;
  if (max <= 1000) return 100;
  if (max <= 2500) return 250;
  if (max <= 5000) return 500;
  if (max <= 10000) return 1000;
  return 2500;
}

function generateScaleSteps(max) {
  if (max <= 10) {
    return Array.from({length: max}, (_, i) => i + 1);
  }

  const step = getScaleStep(max);
  const steps = [1];

  for (let i = step; i < max; i += step) {
    if (i > 1) steps.push(i);
  }

  if (!steps.includes(max)) steps.push(max);

  return steps;
}


function getBallWord(num) {
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'баллов';
  if (lastDigit === 1) return 'балл';
  if (lastDigit >= 2 && lastDigit <= 4) return 'балла';
  return 'баллов';
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
    const steps = generateScaleSteps(max);
    const showAll = max <= 10;
    const isLarge = max > 100;

    const marksHtml = steps.map((value) => {
      const isActive = c.score === value;
      const isFirst = value === 1;
      const isLast = value === max;
      const percent = max === 1 ? 50 : ((value - 1) / (max - 1)) * 100;

      let btnClass = 'scale-btn';
      if (isActive) btnClass += ' active';
      if (isFirst || isLast) btnClass += ' endpoint';
      if (!showAll) btnClass += ' sparse';
      if (isLarge) btnClass += ' large';

      return `
        <div class="${btnClass}"
             data-criteria-id="${c.id}"
             data-score="${value}"
             style="left: ${percent}%;">
          <span class="scale-btn-text">${value}</span>
        </div>
      `;
    }).join('');

    let markerHtml = '';
    if (c.score !== null && c.score >= 1 && c.score <= max) {
      const markerPercent = max === 1 ? 50 : ((c.score - 1) / (max - 1)) * 100;
      markerHtml = `<div class="scale-marker ${isLarge ? 'large' : ''}" style="left: ${markerPercent}%;" data-value="${c.score}"><span class="scale-marker-text">${c.score}</span></div>`;
    }

    const ballWord = getBallWord(max);

    return `
      <div class="criteria-item" data-criteria-id="${c.id}">
        <div class="criteria-header">
          <div class="criteria-header-left">
            <span class="criteria-name">${escapeHtml(c.name)}</span>
            ${c.description ? `<span class="criteria-desc">${escapeHtml(c.description)}</span>` : ''}
          </div>
          <span class="criteria-max">макс. ${max} ${ballWord}</span>
        </div>
        <div class="criteria-scale">
          <div class="scale-track ${isLarge ? 'large' : ''}" data-criteria-id="${c.id}" data-max="${max}">
            <div class="scale-line"></div>
            ${markerHtml}
            <div class="scale-marks">
              ${marksHtml}
            </div>
          </div>
          <div class="scale-input-row">
            <span class="scale-input-label">Точное значение:</span>
            <input type="number"
                   class="scale-input"
                   data-criteria-id="${c.id}"
                   min="1"
                   max="${max}"
                   value="${c.score || ''}"
                   placeholder="1–${max}">
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const criteriaId = parseInt(btn.dataset.criteriaId);
      const score = parseInt(btn.dataset.score);
      setCriteriaScore(criteriaId, score);
      renderCriteriaList(containerId);
      updateTotalScore();
    });
  });

  container.querySelectorAll('.scale-track').forEach(track => {
    track.addEventListener('click', (e) => {
      if (e.target.closest('.scale-btn')) return;

      const criteriaId = parseInt(track.dataset.criteriaId);
      const max = parseInt(track.dataset.max);
      const rect = track.querySelector('.scale-line').getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, clickX / rect.width));
      const score = Math.max(1, Math.min(max, Math.round(1 + percent * (max - 1))));

      setCriteriaScore(criteriaId, score);
      renderCriteriaList(containerId);
      updateTotalScore();
    });
  });

  container.querySelectorAll('.scale-input').forEach(input => {
    input.addEventListener('change', () => {
      const criteriaId = parseInt(input.dataset.criteriaId);
      let score = parseInt(input.value);
      const c = criteria.find(x => x.id === criteriaId);
      if (!c) return;

      if (isNaN(score) || score < 1) score = 1;
      if (score > c.max_score) score = c.max_score;

      setCriteriaScore(criteriaId, score);
      renderCriteriaList(containerId);
      updateTotalScore();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
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

  const invalid = criteria.filter(c => c.score < 1 || c.score > (c.max_score || 10));
  if (invalid.length > 0) {
    showToast('Некоторые оценки выходят за допустимые пределы', true);
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

export function initReviewPage(options) {
  const {
    groupId,
    projectId,
    containerId,
    finishBtnId,
    feedbackId,
    onFinish
  } = options;

  const finishBtn = document.getElementById(finishBtnId);
  if (finishBtn) {
    finishBtn.addEventListener('click', async () => {
      const feedback = document.getElementById(feedbackId)?.value.trim() || '';

      finishBtn.disabled = true;
      finishBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⟳</span> Сохранение...';

      const success = await handleFinishReview(projectId, feedback, groupId, onFinish);

      if (!success) {
        finishBtn.disabled = false;
        finishBtn.innerText = 'Завершить проверку';
      }
    });
  }
}