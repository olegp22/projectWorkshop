// notification.js — модуль уведомлений v3
console.log('[notification.js] loaded v3');

let notifications = [];
let notificationDropdown = null;
let notificationBtn = null;
let notificationBadge = null;

const API_BASE = 'http://localhost:8000';
let authToken = localStorage.getItem('access_token') || '';

async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || `Ошибка ${response.status}`);
  return data;
}

async function loadNotifications() {
  try {
    notifications = [];
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
    // inline-стили + класс из notification.css — работает в любом случае
    list.innerHTML = `
      <div class="notification-empty" style="padding:48px 24px;text-align:center;color:#9ca3af;font-size:16px;min-height:140px;display:flex;align-items:center;justify-content:center;">
        Нет уведомлений
      </div>`;
    return;
  }

  list.innerHTML = notifications.map(n => {
    let text = '';
    if (n.type === 'review') {
      text = `<strong class="font-semibold text-gray-900">${esc(n.expert_name || n.expertName)}</strong> проверил(а) Ваш проект<br>
              Вы получили <strong class="font-semibold text-gray-900">${n.score}</strong> баллов из <strong class="font-semibold text-gray-900">${n.max_score || n.maxScore}</strong>`;
    } else if (n.type === 'added_to_group') {
      text = `<strong class="font-semibold text-gray-900">${esc(n.organizer_name || n.organizerName)}</strong> добавил(а) Вас в группу<br>
              <strong class="font-semibold text-gray-900">«${esc(n.group_name || n.groupName)}»</strong>`;
    } else {
      text = esc(n.text || n.message || 'Новое уведомление');
    }

    const isUnread = !n.read;
    return `
      <div class="px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors hover:bg-orange-50 ${isUnread ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''}"
           data-id="${n.id}">
        <div class="text-sm text-gray-700 leading-relaxed">${text}</div>
        <div class="text-xs text-gray-400 mt-1">${esc(n.created_at || n.date || '')}${n.time ? ', ' + esc(n.time) : ''}</div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-id]').forEach(item => {
    item.addEventListener('click', () => markAsRead(parseInt(item.dataset.id)));
  });
}

async function markAsRead(id) {
  const n = notifications.find(x => x.id === id);
  if (!n || n.read) return;
  try { n.read = true; } catch (error) { console.error('Ошибка отметки прочитанным:', error.message); }
  renderNotifications();
  updateBadge();
}

async function markAllAsRead() {
  const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
  if (unreadIds.length === 0) return;
  try { notifications.forEach(n => n.read = true); } catch (error) { console.error('Ошибка отметки всех прочитанными:', error.message); }
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
  return String(str).replace(/[&<>]/g, m => ({'&':'&amp;','<<':'&lt;','>':'&gt;'}[m]));
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