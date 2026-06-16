console.log('[notification.js] loaded v4-fix (API integration)');

import { request, authAPI, setAuthToken } from './api.js';

let notifications = [];
let notificationDropdown = null;
let notificationBtn = null;
let notificationBadge = null;


async function loadNotifications() {
  try {
    const rawNotifications = await request('/notification/my', 'GET');

    notifications = (rawNotifications || []).map(n => ({
      id: n.id,
      text: n.text,
      type: n.type_message || n.type_massege || 'new_work',
      read: n.is_read,
      created_at: n.created_at
    }));
  } catch (error) {
    console.error('Ошибка загрузки уведомлений:', error.message);
    notifications = [];
  }
  renderNotifications();
  updateBadge();
}

function renderNotifications() {
  const list = document.getElementById('notificationList');
  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = `
      <div class="notification-empty" style="padding:48px 24px;text-align:center;color:#9ca3af;font-size:16px;min-height:140px;display:flex;align-items:center;justify-content:center;">
        Нет уведомлений
      </div>`;
    return;
  }

  list.innerHTML = notifications.map(n => {
    let text = '';

    if (n.type === 'new_assessment') {
      text = `<strong class="font-semibold text-gray-900">Новая оценка</strong><br>${esc(n.text)}`;
    } else if (n.type === 'change_assessment') {
      text = `<strong class="font-semibold text-gray-900">Изменение оценки</strong><br>${esc(n.text)}`;
    } else if (n.type === 'new_work') {
      text = `<strong class="font-semibold text-gray-900">Новая работа</strong><br>${esc(n.text)}`;
    } else if (n.type === 'new_member') {
      text = `<strong class="font-semibold text-gray-900">Новый участник</strong><br>${esc(n.text)}`;
    } else if (n.type === 'removal_from_the_group') {
      text = `<strong class="font-semibold text-gray-900">Удаление из группы</strong><br>${esc(n.text)}`;
    } else {
      text = esc(n.text || 'Новое уведомление');
    }

    const isUnread = !n.read;

    const dateHtml = '';

    return `
      <div class="px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors hover:bg-orange-50 ${isUnread ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''}"
           data-id="${n.id}">
        <div class="text-sm text-gray-700 leading-relaxed">${text}</div>
        ${dateHtml}
      </div>`;
  }).join('');

  list.querySelectorAll('[data-id]').forEach(item => {
    item.addEventListener('click', () => markAsRead(parseInt(item.dataset.id)));
  });
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(dateValue);
  }
}

async function markAsRead(id) {
  const n = notifications.find(x => x.id === id);
  if (!n || n.read) return;

  n.read = true;

  try {
    await loadNotifications();
  } catch (error) {
    console.error('Ошибка синхронизации уведомлений:', error.message);
  }

  renderNotifications();
  updateBadge();
}

async function markAllAsRead() {
  const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
  if (unreadIds.length === 0) return;

  try {
    notifications.forEach(n => n.read = true);
    await loadNotifications();
  } catch (error) {
    console.error('Ошибка отметки всех прочитанными:', error.message);
  }

  renderNotifications();
  updateBadge();
}

function updateBadge() {
  if (!notificationBadge) return;
  const unread = notifications.filter(n => !n.read).length;
  if (unread > 0) {
    notificationBadge.textContent = unread > 99 ? '99+' : unread;
    notificationBadge.classList.remove('hidden');
  } else {
    notificationBadge.classList.add('hidden');
  }
}

function positionDropdown() {
  if (!notificationBtn || !notificationDropdown) return;
  const rect = notificationBtn.getBoundingClientRect();
  const top = rect.bottom + 8;
  const right = window.innerWidth - rect.right;
  notificationDropdown.style.top = `${top}px`;
  notificationDropdown.style.right = `${right}px`;
}

function toggleDropdown(e) {
  if (e) e.stopPropagation();
  if (!notificationDropdown) return;
  const isHidden = notificationDropdown.classList.contains('hidden');
  if (isHidden) {
    positionDropdown();
    notificationDropdown.classList.remove('hidden');
    loadNotifications();
    const profile = document.getElementById('profileDropdown');
    if (profile) profile.classList.add('hidden');
  } else {
    notificationDropdown.classList.add('hidden');
  }
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
}

function initNotifications() {
  notificationBtn = document.getElementById('notification-btn');
  notificationDropdown = document.getElementById('notificationDropdown');
  notificationBadge = document.getElementById('notificationBadge');

  if (!notificationBtn || !notificationDropdown) {
    console.warn('[notification.js] элементы уведомлений не найдены в DOM');
    return;
  }

  notificationBtn.addEventListener('click', toggleDropdown);

  document.addEventListener('click', (e) => {
    if (!notificationDropdown.classList.contains('hidden') &&
        !notificationDropdown.contains(e.target) &&
        !notificationBtn.contains(e.target)) {
      notificationDropdown.classList.add('hidden');
    }
  });

  const clearBtn = document.getElementById('notificationClearAll');
  if (clearBtn) clearBtn.addEventListener('click', (e) => { e.stopPropagation(); markAllAsRead(); });

  loadNotifications();
  setInterval(loadNotifications, 30000);

  window.addEventListener('resize', () => {
    if (notificationDropdown && !notificationDropdown.classList.contains('hidden')) {
      positionDropdown();
    }
  });
}

document.addEventListener('DOMContentLoaded', initNotifications);

export { initNotifications, loadNotifications, markAllAsRead };