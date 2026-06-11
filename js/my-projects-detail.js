import { groupsAPI } from './api.js';
import { loadCurrentUser, showToast, escapeHtml } from './review-core.js';

let currentGroupId = null;
let currentProjectId = null;
let currentGroupMode = 'classic';
let groupCriteria = [];
let submissionData = null;

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

function getBallWord(num) {
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'баллов';
  if (lastDigit === 1) return 'балл';
  if (lastDigit >= 2 && lastDigit <= 4) return 'балла';
  return 'баллов';
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

// === ПУНКТ 5.2: ИСПРАВЛЕННЫЙ ПОДСЧЁТ СРЕДНИХ БАЛЛОВ ===
// Считаем среднее по всем проверкам для каждого критерия с учётом max_score

function calculateAverageScores(submission, criteria) {
  // Используем reviews (нормализованный api.js)
  const reviews = submission.reviews || [];
  const result = [];

  criteria.forEach(c => {
    const scores = [];
    
    reviews.forEach(review => {
      if (review.grades) {
        // Сопоставляем по criterion_id или criterion_name
        const grade = review.grades.find(g => 
          (g.criterion_id && g.criterion_id === c.id) || 
          (g.criterion_name && g.criterion_name === c.name)
        );
        if (grade && grade.score !== undefined) {
          scores.push({
            score: grade.score,
            maxScore: c.max_score || 10  // бэкенд не возвращает max_score в grade
          });
        }
      }
    });

    const avgScore = scores.length > 0 
      ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
      : null;

    result.push({
      ...c,
      avgScore,
      reviewCount: scores.length,
      allScores: scores
    });
  });

  return result;
}

function renderCriteriaReadonly(criteriaWithAvg) {
  const container = document.getElementById('criteriaList');
  if (!container) return;

  if (criteriaWithAvg.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400">Критерии оценки не настроены</p>';
    return;
  }

  container.innerHTML = criteriaWithAvg.map(c => {
    const max = c.max_score || 10;
    const steps = generateScaleSteps(max);
    const showAll = max <= 10;
    const isLarge = max > 100;
    const avgScore = c.avgScore;

    const marksHtml = steps.map((value) => {
      const isFirst = value === 1;
      const isLast = value === max;
      const percent = max === 1 ? 50 : ((value - 1) / (max - 1)) * 100;

      let btnClass = 'scale-btn';
      if (isFirst || isLast) btnClass += ' endpoint';
      if (!showAll) btnClass += ' sparse';
      if (isLarge) btnClass += ' large';

      return `
        <div class="${btnClass}" style="left: ${percent}%;">
          <span class="scale-btn-text">${value}</span>
        </div>
      `;
    }).join('');

    let markerHtml = '';
    if (avgScore !== null && avgScore >= 1 && avgScore <= max) {
      const markerPercent = max === 1 ? 50 : ((avgScore - 1) / (max - 1)) * 100;
      markerHtml = `<div class="scale-marker ${isLarge ? 'large' : ''}" style="left: ${markerPercent};" data-value="${avgScore}"><span class="scale-marker-text">${avgScore}</span></div>`;
    }

    const ballWord = getBallWord(max);
    const avgDisplay = avgScore !== null ? `${avgScore} ${ballWord}` : 'Нет оценок';

    return `
      <div class="criteria-item" data-criterion-id="${c.id}">
        <div class="criteria-header">
          <div class="criteria-header-left">
            <span class="criteria-name">${escapeHtml(c.name)}</span>
            ${c.description ? `<span class="criteria-desc">${escapeHtml(c.description)}</span>` : ''}
          </div>
          <div class="text-right">
            <span class="criteria-max">макс. ${max} ${ballWord}</span>
            <div class="text-sm text-orange-600 font-semibold mt-1">Средний: ${avgDisplay}</div>
          </div>
        </div>
        <div class="criteria-scale">
          <div class="scale-track ${isLarge ? 'large' : ''}" data-max="${max}">
            <div class="scale-line"></div>
            ${markerHtml}
            <div class="scale-marks">
              ${marksHtml}
            </div>
          </div>
          <div class="scale-input-row" style="display: none;">
            <span class="scale-input-label">Точное значение:</span>
            <input type="number" class="scale-input" min="1" max="${max}" value="${avgScore || ''}" readonly>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// === ПУНКТ 5.2: ИСПРАВЛЕННАЯ ТАБЛИЦА ОТЗЫВОВ ===
// Считаем totalMax из критериев группы — бэкенд не возвращает max_score в grade

function renderReviewsTable(submission, criteria) {
  const tbody = document.getElementById('reviewsTableBody');
  if (!tbody) return;

  // Используем reviews (нормализованный api.js)
  const reviews = submission.reviews || [];

  if (reviews.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="reviews-empty">
          <div style="padding: 48px 24px; text-align: center; color: #9ca3af; font-size: 16px;">
            Пока нет обратной связи от проверяющих
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = reviews.map((review, index) => {
    // Считаем totalMax из grades с fallback на max_score критерия
    let totalScore = 0;
    let totalMax = 0;
    
    if (review.grades && review.grades.length > 0) {
      review.grades.forEach(g => {
        totalScore += g.score || 0;
        // max_score берём ТОЛЬКО из критерия группы — бэкенд не возвращает его в grade
        const criterion = criteria.find(c => c.id === g.criterion_id || c.name === g.criterion_name);
        totalMax += criterion?.max_score || 10;
      });
    }

    const scoreDisplay = totalMax > 0 ? `${totalScore}/${totalMax}` : '—';
    const anonymousName = `Проверяющий ${index + 1}`;

    return `
      <tr>
        <td class="reviewer-name">${escapeHtml(anonymousName)}</td>
        <td class="review-score">${scoreDisplay}</td>
        <td class="review-comment">${escapeHtml(review.comment || '—')}</td>
      </tr>
    `;
  }).join('');
}

// === ПУНКТ 5.2: ИСПРАВЛЕННЫЙ ИТОГОВЫЙ БАЛЛ ===
// Считаем сумму средних / сумму максимумов по всем критериям

function updateAverageTotal(criteriaWithAvg) {
  const avgTotalEl = document.getElementById('avgTotalScore');
  const avgMaxEl = document.getElementById('avgMaxTotalScore');

  if (!avgTotalEl || !avgMaxEl) return;

  if (criteriaWithAvg.length === 0) {
    avgTotalEl.innerText = '**';
    avgMaxEl.innerText = '**';
    return;
  }

  let totalAvgScore = 0;
  let totalMaxScore = 0;
  let countedCriteria = 0;

  criteriaWithAvg.forEach(c => {
    if (c.avgScore !== null) {
      totalAvgScore += c.avgScore;
      totalMaxScore += c.max_score || 10;
      countedCriteria++;
    }
  });

  if (countedCriteria === 0) {
    avgTotalEl.innerText = '**';
    avgMaxEl.innerText = '**';
    return;
  }

  const avgTotal = Math.round(totalAvgScore);
  avgTotalEl.innerText = avgTotal;
  avgMaxEl.innerText = totalMaxScore;
}

async function loadProjectResults() {
  const params = new URLSearchParams(window.location.search);
  currentGroupId = params.get('group');
  currentProjectId = params.get('project');
  currentGroupMode = params.get('mode') || 'classic';

  if (!currentGroupId || !currentProjectId) {
    showToast('Проект или группа не выбраны', true);
    return;
  }

  const modeBadge = document.getElementById('modeBadge');
  if (modeBadge) {
    if (currentGroupMode === 'contest') modeBadge.innerText = '(конкурс)';
    else if (currentGroupMode === 'p2p') modeBadge.innerText = '(peer-to-peer)';
    else modeBadge.innerText = '';
  }

  try {
    // Загружаем submission и критерии параллельно
    const [submission, criteria] = await Promise.all([
      groupsAPI.getSubmission(currentProjectId),
      groupsAPI.getCriteria(currentGroupId).catch(() => [])
    ]);

    submissionData = submission;
    groupCriteria = criteria;

    // Устанавливаем название проекта и ссылку
    document.getElementById('projectName').innerText = `Проект #${submission.id}`;
    const linkEl = document.getElementById('projectDownloadLink');
    if (linkEl) {
      linkEl.href = submission.link || '#';
      linkEl.innerText = submission.link || 'Ссылка недоступна';
    }

    // Используем reviews (нормализованный api.js)
    const hasReviews = submission.reviews && submission.reviews.length > 0;
    const criteriaList = document.getElementById('criteriaList');
    const reviewsTableBlock = document.getElementById('reviewsTableBlock');
    const avgTotalEl = document.getElementById('avgTotalScore');
    const avgMaxEl = document.getElementById('avgMaxTotalScore');

    if (!hasReviews) {
      if (criteriaList) {
        criteriaList.innerHTML = `
          <div class="text-center py-12">
            <div class="text-6xl mb-4">📭</div>
            <p class="text-xl font-semibold text-gray-700 mb-2">Результатов нет</p>
            <p class="text-sm text-gray-500">Ваша работа пока не проверена. Результаты появятся здесь после проверки.</p>
          </div>
        `;
      }
      if (reviewsTableBlock) reviewsTableBlock.style.display = 'none';
      if (avgTotalEl) avgTotalEl.innerText = '—';
      if (avgMaxEl) avgMaxEl.innerText = '—';
      return;
    }

    if (reviewsTableBlock) reviewsTableBlock.style.display = 'block';

    // Считаем средние баллы
    const criteriaWithAvg = calculateAverageScores(submission, criteria);

    // Рендерим шкалы с средними баллами
    renderCriteriaReadonly(criteriaWithAvg);

    // Обновляем итоговый средний балл
    updateAverageTotal(criteriaWithAvg);

    // Рендерим таблицу отзывов — передаём criteria для lookup max_score
    renderReviewsTable(submission, criteria);

  } catch (error) {
    showToast('Ошибка загрузки результатов: ' + error.message, true);
  }
}

async function init() {
  await loadCurrentUser();
  await loadProjectResults();
}

init();