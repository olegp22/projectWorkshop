import { authAPI, usersAPI } from './api.js';

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `fixed top-5 right-5 px-5 py-3 rounded-md text-white text-sm z-50 animate-slide-in ${isError ? 'bg-red-600' : 'bg-gray-800'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function loadCurrentUser() {
  try {
    const user = await usersAPI.getMe();
    const displayName = (user.name && user.surname)
      ? `${user.name} ${user.surname}`
      : (user.name || user.email || 'Пользователь');
    
    const headerEl = document.getElementById('headerUserName');
    if (headerEl) headerEl.innerText = displayName;

    const firstNameEl = document.getElementById('profileFirstName');
    if (firstNameEl) firstNameEl.value = user.name || '';

    const lastNameEl = document.getElementById('profileLastName');
    if (lastNameEl) lastNameEl.value = user.surname || '';

    const emailEl = document.getElementById('profileEmail');
    if (emailEl) emailEl.value = user.email || '';

    const patronymicEl = document.getElementById('profilePatronymic');
    if (patronymicEl) patronymicEl.value = user.patronymic || '';
  } catch (error) {
    const headerEl = document.getElementById('headerUserName');
    if (headerEl) headerEl.innerText = 'Гость';
    if (error.message && error.message.includes('Сессия истекла')) {
      return;
    }
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.settings-tab').forEach(t => {
    t.classList.remove('text-orange-500', 'border-orange-500');
    t.classList.add('text-gray-500', 'border-transparent');
  });

  const activeTab = document.querySelector(`.settings-tab[data-tab="${tabName}"]`);
  if (activeTab) {
    activeTab.classList.add('text-orange-500', 'border-orange-500');
    activeTab.classList.remove('text-gray-500', 'border-transparent');
  }

  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });

  const panel = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
  if (panel) {
    panel.classList.remove('hidden');
    panel.classList.add('active');
  }
}

// Привязка табов
document.querySelectorAll('.settings-tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// Сохранение профиля
const saveProfileBtn = document.getElementById('saveProfileBtn');
if (saveProfileBtn) {
  saveProfileBtn.addEventListener('click', async () => {
    const nameEl = document.getElementById('profileFirstName');
    const surnameEl = document.getElementById('profileLastName');
    const emailEl = document.getElementById('profileEmail');
    const patronymicEl = document.getElementById('profilePatronymic');

    const name = nameEl?.value.trim() || '';
    const surname = surnameEl?.value.trim() || '';
    const email = emailEl?.value.trim() || '';
    const patronymic = patronymicEl?.value.trim() || '';

    if (!name || !surname || !email) {
      showToast('Заполните обязательные поля (имя, фамилия, email)', true);
      return;
    }

    try {
      await usersAPI.updateProfile({ name, surname, patronymic, email });
      showToast('Профиль обновлён');
      await loadCurrentUser();
    } catch (error) {
      showToast('Ошибка сохранения: ' + error.message, true);
    }
  });
}

// Смена пароля (заглушка)
const changePasswordBtn = document.getElementById('changePasswordBtn');
if (changePasswordBtn) {
  changePasswordBtn.addEventListener('click', () => {
    const current = document.getElementById('currentPassword')?.value || '';
    const newPass = document.getElementById('newPassword')?.value || '';
    const confirm = document.getElementById('confirmPassword')?.value || '';

    if (!current || !newPass || !confirm) {
      showToast('Заполните все поля', true);
      return;
    }
    if (newPass !== confirm) {
      showToast('Пароли не совпадают', true);
      return;
    }

    showToast('Функция смены пароля временно недоступна', true);
  });
}

async function init() {
  await loadCurrentUser();
  switchTab('personal');
}

init();