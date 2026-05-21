import { groupsAPI } from './api.js';
import {
  loadCurrentUser,
  loadGroupCriteria,
  loadProjectSubmission,
  renderCriteriaList,
  updateTotalScore,
  initReviewPage,
  showToast,
  escapeHtml,
  criteria
} from './review-core.js';

let currentGroupId = null;
let currentProjectId = null;
let isContest = false;

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

async function loadProject() {
  const params = new URLSearchParams(window.location.search);
  currentGroupId = params.get('group');
  currentProjectId = params.get('project');
  isContest = params.get('mode') === 'contest';

  if (!currentGroupId || !currentProjectId) {
    showToast('Проект или группа не выбраны', true);
    return;
  }

  try {
    const groups = await groupsAPI.getMyGroups();
    const group = groups.find(g => g.id == currentGroupId);
    if (group) {
      const nameEl = document.getElementById('groupName');
      if (nameEl) {
        if (isContest) {
          nameEl.innerHTML = `Проект #${currentProjectId} <span class="text-sm text-gray-500">(конкурс)</span>`;
        }
      }
    }

    if (isContest) {
      // Contest: скрываем критерии, показываем голосование
      document.getElementById('criteriaList').classList.add('hidden');
      document.getElementById('contestVoting').classList.remove('hidden');
      document.getElementById('totalScore').parentElement.classList.add('hidden'); // скрываем "Итоговый балл"
      
      // Загружаем submission для проверки статуса
      const submission = await loadProjectSubmission(currentProjectId);
      if (submission) {
        document.getElementById('projectName').innerText = `Проект #${submission.id}`;
        const linkEl = document.getElementById('projectDownloadLink');
        linkEl.href = submission.link;
        linkEl.innerText = submission.link;
        
        const currentUserId = getUserIdFromToken();
        const myReview = submission.reviews?.find(r => r.reviewer_id === currentUserId);
        if (myReview?.comment) {
          document.getElementById('feedbackText').value = myReview.comment;
        }
        if (myReview?.grades?.length > 0) {
          const score = myReview.grades[0].score;
          highlightContestScore(score);
        }
      } else {
        document.getElementById('projectName').innerText = 'Проект «Конкурс»';
        const linkEl = document.getElementById('projectDownloadLink');
        linkEl.href = 'https://example.com/project-contest';
        linkEl.innerText = 'https://example.com/project-contest';
      }

      initContestVoting();
      return;
    }

    // Classic/P2P: стандартная логика
    await loadGroupCriteria(currentGroupId);

    const submission = await loadProjectSubmission(currentProjectId);
    if (submission) {
      document.getElementById('projectName').innerText = `Проект #${submission.id}`;
      const linkEl = document.getElementById('projectDownloadLink');
      linkEl.href = submission.link;
      linkEl.innerText = submission.link;

      const currentUserId = getUserIdFromToken();
      const myReview = submission.reviews?.find(r => r.reviewer_id === currentUserId);
      
      if (myReview?.comment) {
        document.getElementById('feedbackText').value = myReview.comment;
      }

      if (myReview?.grades?.length > 0) {
        myReview.grades.forEach(g => {
          const c = criteria.find(x => x.id === g.criterion_id || x.name === g.criterion_name);
          if (c) c.score = g.score;
        });
      }

      if (submission.status === 'graded') {
        showToast('Эта работа уже оценена. Вы можете изменить свою оценку.');
      }
    } else {
      document.getElementById('projectName').innerText = 'Проект «Альфа»';
      const linkEl = document.getElementById('projectDownloadLink');
      linkEl.href = 'https://example.com/project-alpha';
      linkEl.innerText = 'https://example.com/project-alpha';
    }

    renderCriteriaList('criteriaList');
    updateTotalScore('totalScore', 'maxTotalScore');

    initReviewPage({
      groupId: currentGroupId,
      projectId: currentProjectId,
      containerId: 'criteriaList',
      finishBtnId: 'finishReviewBtn',
      feedbackId: 'feedbackText',
      onFinish: () => {
        setTimeout(() => {
          window.location.href = `review.html?group=${currentGroupId}`;
        }, 1000);
      }
    });

  } catch (error) {
    showToast('Ошибка загрузки проекта: ' + error.message, true);
  }
}

function highlightContestScore(score) {
  document.querySelectorAll('.contest-score').forEach(btn => {
    const btnScore = parseInt(btn.dataset.score);
    if (btnScore === score) {
      btn.classList.add('bg-purple-500', 'text-white');
      btn.classList.remove('text-purple-700');
    } else {
      btn.classList.remove('bg-purple-500', 'text-white');
      btn.classList.add('text-purple-700');
    }
  });
}

function initContestVoting() {
  let selectedScore = null;

  document.querySelectorAll('.contest-score').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedScore = parseInt(btn.dataset.score);
      highlightContestScore(selectedScore);
    });
  });

  const finishBtn = document.getElementById('finishReviewBtn');
  finishBtn.innerText = 'Сохранить голос';
  
  finishBtn.addEventListener('click', async () => {
    if (!selectedScore) {
      showToast('Выберите балл от 1 до 10', true);
      return;
    }

    const feedback = document.getElementById('feedbackText')?.value.trim() || '';
    
    finishBtn.disabled = true;
    finishBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⟳</span> Сохранение...';

    try {
      await groupsAPI.reviewWork(currentProjectId, feedback, [{
        criterion_id: 0,
        score: selectedScore
      }]);
      showToast('Голос сохранён!');
      setTimeout(() => {
        window.location.href = `review.html?group=${currentGroupId}&mode=contest`;
      }, 1000);
    } catch (error) {
      showToast('Ошибка: ' + error.message, true);
      finishBtn.disabled = false;
      finishBtn.innerText = 'Сохранить голос';
    }
  });
}

async function init() {
  await loadCurrentUser();
  await loadProject();
}

init();