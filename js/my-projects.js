import { groupsAPI } from './api.js';
import {
  loadCurrentUser,
  loadGroupCriteria,
  loadProjectSubmission,
  renderCriteriaList,
  updateTotalScore,
  handleFinishReview,
  showToast,
  escapeHtml,
  criteria
} from './review-core.js';

let currentGroupId = null;
let currentProjectId = null;
let currentGroupMode = 'classic';
let currentUserRole = null;
let currentUserId = null;
let contestScore = null;

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

function initContestScale() {
  const block = document.getElementById('contestScaleBlock');
  const marks = document.getElementById('contestScaleMarks');
  if (!block || !marks) return;

  block.classList.remove('hidden');

  const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  marks.innerHTML = steps.map(v => {
    const percent = ((v - 1) / 9) * 100;
    const isActive = contestScore === v;
    return `
      <div class="contest-scale-btn ${isActive ? 'active' : ''}"
           data-score="${v}"
           style="left: ${percent}%;">
        <span>${v}</span>
      </div>
    `;
  }).join('');

  const marker = document.getElementById('contestMarker');
  const markerValue = document.getElementById('contestMarkerValue');
  const selectedDisplay = document.getElementById('contestSelectedScore');

  if (contestScore !== null) {
    const percent = ((contestScore - 1) / 9) * 100;
    marker.style.left = `${percent}%`;
    marker.classList.remove('hidden');
    markerValue.innerText = contestScore;
    selectedDisplay.innerText = contestScore;
  } else {
    marker.classList.add('hidden');
    selectedDisplay.innerText = '—';
  }

  marks.querySelectorAll('.contest-scale-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      contestScore = parseInt(btn.dataset.score);
      initContestScale();
      updateContestTotal();
    });
  });
}

function updateContestTotal() {
  const totalEl = document.getElementById('totalScore');
  const maxEl = document.getElementById('maxTotalScore');
  if (totalEl) totalEl.innerText = contestScore !== null ? contestScore : '**';
  if (maxEl) maxEl.innerText = '10';
}

function prepareGradesForSubmit() {
  if (currentGroupMode === 'contest') {
    if (contestScore === null) {
      showToast('Выберите оценку на шкале', true);
      return null;
    }

    if (criteria.length > 0) {
      return [{
        criterion_id: criteria[0].id,
        score: contestScore
      }];
    }

    showToast('Конкурсный режим требует настроенных критериев. Обратитесь к организатору.', true);
    return null;
  }

  if (!criteria || criteria.length === 0) {
    showToast('Критерии оценки не настроены организатором', true);
    return null;
  }

  const grades = criteria.map(c => ({
    criterion_id: c.id,
    score: c.score
  })).filter(g => g.score !== null);

  if (grades.length === 0) {
    showToast('Оцените хотя бы один критерий', true);
    return null;
  }

  return grades;
}

async function loadProject() {
  const params = new URLSearchParams(window.location.search);
  currentGroupId = params.get('group');
  currentProjectId = params.get('project');
  currentUserId = getUserIdFromToken();

  if (!currentGroupId || !currentProjectId) {
    showToast('Проект или группа не выбраны', true);
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
    } else {
      currentGroupMode = params.get('mode') || 'classic';
    }

    const modeBadge = document.getElementById('modeBadge');
    if (modeBadge) {
      if (currentGroupMode === 'contest') modeBadge.innerText = '(конкурс)';
      else if (currentGroupMode === 'p2p') modeBadge.innerText = '(peer-to-peer)';
      else modeBadge.innerText = '';
    }

    const submission = await loadProjectSubmission(currentProjectId);
    if (!submission) {
        showToast('Работа не найдена', true);
        document.getElementById('projectName').innerText = 'Работа не найдена';
        document.getElementById('projectDownloadLink').style.display = 'none';
        document.getElementById('finishReviewBtn').style.display = 'none';
        return;
    }
    if (submission) {
      document.getElementById('projectName').innerText = `Проект #${submission.id}`;
      const linkEl = document.getElementById('projectDownloadLink');
      linkEl.href = submission.link;
      linkEl.innerText = submission.link;

      await loadGroupCriteria(currentGroupId);

      const feedbackBlock = document.getElementById('feedbackBlock');
      const criteriaListBlock = document.getElementById('criteriaList');
      const contestScaleBlock = document.getElementById('contestScaleBlock');
      const finishBtn = document.getElementById('finishReviewBtn');

      if (currentGroupMode === 'contest') {
        if (feedbackBlock) feedbackBlock.classList.add('hidden');
        if (criteriaListBlock) criteriaListBlock.classList.add('hidden');

        if (!criteria || criteria.length === 0) {
          if (contestScaleBlock) {
            contestScaleBlock.innerHTML = `
              <div class="text-center py-8">
                <div class="text-5xl mb-4">⚠️</div>
                <p class="text-lg font-semibold text-gray-700 mb-2">Критерии не настроены</p>
                <p class="text-sm text-gray-500">Организатор должен добавить хотя бы один критерий оценки для конкурсного режима.</p>
                <p class="text-xs text-orange-600 mt-2">💡 Совет: создайте критерий с макс. баллом 10 для корректной работы шкалы 1-10</p>
              </div>
            `;
            contestScaleBlock.classList.remove('hidden');
          }
          if (finishBtn) {
            finishBtn.disabled = true;
            finishBtn.classList.add('opacity-50', 'cursor-not-allowed');
            finishBtn.innerText = 'Оценка недоступна';
          }

          const totalScoreEl = document.getElementById('totalScore');
          const maxTotalEl = document.getElementById('maxTotalScore');
          if (totalScoreEl) totalScoreEl.innerText = '—';
          if (maxTotalEl) maxTotalEl.innerText = '—';
          return;
        }

        if (contestScaleBlock) {
          contestScaleBlock.classList.remove('hidden');

          contestScaleBlock.innerHTML = `
            <label class="block text-sm text-gray-700 mb-4">Ваша оценка (1–10):</label>
            <div class="contest-scale" id="contestScale">
              <div class="contest-scale-line"></div>
              <div class="contest-scale-marks" id="contestScaleMarks"></div>
              <div class="contest-scale-marker hidden" id="contestMarker">
                <span id="contestMarkerValue">5</span>
              </div>
            </div>
            <div class="contest-score-display mt-4 text-center">
              <span class="text-sm text-gray-600">Выбрано:</span>
              <span id="contestSelectedScore" class="text-2xl font-bold text-orange-500 ml-2">—</span>
              <span class="text-sm text-gray-500">/ 10</span>
            </div>
          `;
          initContestScale();
        }
        updateContestTotal();
      } else {
        if (feedbackBlock) feedbackBlock.classList.remove('hidden');
        if (criteriaListBlock) criteriaListBlock.classList.remove('hidden');
        if (contestScaleBlock) contestScaleBlock.classList.add('hidden');

        if (!criteria || criteria.length === 0) {
          if (criteriaListBlock) {
            criteriaListBlock.innerHTML = `
              <div class="text-center py-8">
                <div class="text-5xl mb-4">⚠️</div>
                <p class="text-lg font-semibold text-gray-700 mb-2">Критерии не настроены</p>
                <p class="text-sm text-gray-500">Организатор должен добавить критерии оценки.</p>
              </div>
            `;
          }
          if (finishBtn) {
            finishBtn.disabled = true;
            finishBtn.classList.add('opacity-50', 'cursor-not-allowed');
            finishBtn.innerText = 'Оценка недоступна';
          }
          const totalScoreEl = document.getElementById('totalScore');
          const maxTotalEl = document.getElementById('maxTotalScore');
          if (totalScoreEl) totalScoreEl.innerText = '—';
          if (maxTotalEl) maxTotalEl.innerText = '—';
          return;
        }

        renderCriteriaList('criteriaList');
        updateTotalScore('totalScore', 'maxTotalScore');
      }

      const myReview = submission.reviews?.find(r => r.reviewer_id === currentUserId);
      const commentText = myReview?.reviewer_comment || myReview?.comment || '';
      if (commentText) {
        document.getElementById('feedbackText').value = commentText;
      }
      if (myReview?.grades?.length > 0) {
        if (currentGroupMode === 'contest') {
          const firstGrade = myReview.grades[0];
          if (firstGrade && firstGrade.score !== undefined) {
            contestScore = firstGrade.score;
            initContestScale();
            updateContestTotal();
          }
        } else {
          myReview.grades.forEach(g => {
            const c = criteria.find(x => x.name === g.criterion_name);
            if (c) c.score = g.score;
          });
          renderCriteriaList('criteriaList');
          updateTotalScore('totalScore', 'maxTotalScore');
        }
      }

      if (submission.status === 'graded') {
        showToast('Эта работа уже оценена. Вы можете изменить свою оценку.');
      }
    }

    const finishBtn = document.getElementById('finishReviewBtn');
    if (finishBtn) {
      const isReadonly = params.get('readonly') === 'true';
      if (isReadonly) {
        finishBtn.style.display = 'none';
      } else {
        finishBtn.addEventListener('click', async () => {
          if (finishBtn.disabled) return;

          finishBtn.disabled = true;
          finishBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⟳</span> Сохранение...';

          const feedback = currentGroupMode === 'contest'
            ? null
            : document.getElementById('feedbackText')?.value.trim() || null;

          const grades = prepareGradesForSubmit();
          if (!grades) {
            finishBtn.disabled = false;
            finishBtn.innerText = 'Завершить проверку';
            return;
          }

          try {
            await groupsAPI.reviewWork(currentProjectId, feedback, grades);
            showToast('Оценка успешно сохранена!');

            // Сохраняем в localStorage что работа оценена
            try {
              const reviewed = JSON.parse(localStorage.getItem('reviewed_submissions') || '[]');
              if (!reviewed.includes(currentProjectId)) {
                reviewed.push(currentProjectId);
                localStorage.setItem('reviewed_submissions', JSON.stringify(reviewed));
              }
            } catch (e) {}

            // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: принудительно очищаем кэш работ
            localStorage.removeItem('my_reviews_cache');
            localStorage.removeItem('my_reviews_cache_time');

            setTimeout(() => {
              const modeParam = currentGroupMode !== 'classic' ? `&mode=${currentGroupMode}` : '';
              window.location.href = `review.html?group=${currentGroupId}${modeParam}`;
            }, 1000);
          } catch (error) {
            showToast('Ошибка сохранения: ' + error.message, true);
            finishBtn.disabled = false;
            finishBtn.innerText = 'Завершить проверку';
          }
        });
      }
    }

    const voiceBtn = document.getElementById('voiceFeedbackBtn');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        showToast('Голосовые сообщения в разработке', true);
      });
    }

  } catch (error) {
    showToast('Ошибка загрузки проекта: ' + error.message, true);
  }
}

async function init() {
  await loadCurrentUser();
  await loadProject();
}

init();