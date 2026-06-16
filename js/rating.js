console.log('[rating.js] loaded v2');

import { groupsAPI } from './api.js';
import { loadCurrentUser, showToast, escapeHtml } from './review-core.js';

let currentUserId = null;
let currentGroupId = null;

async function initRating() {
  try {
    await loadCurrentUser();

    // Check auth via token instead of relying on loadCurrentUser return value
    const token = localStorage.getItem('access_token');
    if (!token) {
      showToast('Необходимо авторизоваться', true);
      setTimeout(() => window.location.href = 'index.html', 1500);
      return;
    }

    // Get user ID from token
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      currentUserId = payload.user_id;
    } catch {
      showToast('Ошибка авторизации', true);
      setTimeout(() => window.location.href = 'index.html', 1500);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    currentGroupId = params.get('group');
    if (!currentGroupId) {
      showToast('Группа не указана', true);
      return;
    }

    const groups = await groupsAPI.getMyGroups();
    const group = groups.find(g => g.id == currentGroupId);
    if (!group) {
      showToast('Группа не найдена', true);
      return;
    }

    document.getElementById('groupName').innerText = group.name || 'Рейтинг';

    if (group.group_mode === 'contest') {
      await loadContestRating();
    } else {
      document.getElementById('ratingTable').innerHTML = `
        <div class="text-center py-12 text-gray-500">
          Рейтинг доступен только для конкурсных групп
        </div>
      `;
    }
  } catch (error) {
    console.error('Ошибка инициализации рейтинга:', error);
    showToast('Ошибка загрузки рейтинга', true);
  }
}

async function loadContestRating() {
  try {
    const data = await groupsAPI.getRating(currentGroupId);

    if (!data || data.length === 0) {
      document.getElementById('ratingTable').innerHTML = `
        <div class="text-center py-12 text-gray-500">
          Пока нет оцененных работ
        </div>
      `;
      return;
    }

    const tbody = document.getElementById('ratingTable');
    document.getElementById('totalWorks').innerText = data.length;

    const totalScore = data.reduce((sum, p) => sum + (p.total_score || 0), 0);
    const avg = data.length > 0 ? (totalScore / data.length).toFixed(2) : '0.00';
    document.getElementById('avgScore').innerText = avg;

    tbody.innerHTML = data.map((p, i) => {
      const score = typeof p.total_score === 'number' ? p.total_score.toFixed(1) : p.total_score || '0.0';
      return `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="px-6 py-4 text-sm text-gray-900">${i + 1}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${escapeHtml(p.surname || '')} ${escapeHtml(p.name || '')} ${escapeHtml(p.patronymic || '')}</td>
          <td class="px-6 py-4 text-sm font-semibold text-orange-600">${score}</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Ошибка загрузки рейтинга:', error);
    showToast('Ошибка загрузки рейтинга', true);
  }
}

document.addEventListener('DOMContentLoaded', initRating);