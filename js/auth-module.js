import { authAPI, usersAPI, saveProfileToStorage } from './api.js';

let lastFocusedElement = null;

function trapFocus(element) {
    const focusable = element.querySelectorAll(
        'a[href], button, textarea, input[type="text"], input[type="email"], input[type="password"], input[type="checkbox"], select'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    element.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === first) {
                last.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === last) {
                first.focus();
                e.preventDefault();
            }
        }
    });
}

function showAuthError(message, isSuccess = false) {
    const errorEl = document.getElementById('auth-error');
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    if (isSuccess) {
        errorEl.className = 'mb-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-600';
    } else {
        errorEl.className = 'mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600';
    }
}

function hideAuthError() {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
        errorEl.classList.add('hidden');
        errorEl.textContent = '';
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function openAuthModal() {
    const modal = document.getElementById('auth-modal-overlay');
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        const firstInput = modal.querySelector('input:not([type="hidden"])');
        if (firstInput) firstInput.focus();
    }, 50);
    trapFocus(modal);
}

export function closeAuthModal() {
    const modal = document.getElementById('auth-modal-overlay');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
    document.body.style.overflow = '';
    hideAuthError();
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    if (lastFocusedElement) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
    }
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const activeClass = "flex-1 pb-2 text-center text-sm font-medium text-orange-500 border-b-2 border-orange-500 transition cursor-pointer";
    const inactiveClass = "flex-1 pb-2 text-center text-sm font-medium text-gray-500 border-b border-gray-300 hover:text-gray-700 transition cursor-pointer";
    hideAuthError();
    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.className = activeClass;
        tabRegister.className = inactiveClass;
        document.getElementById('auth-email')?.focus();
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabLogin.className = inactiveClass;
        tabRegister.className = activeClass;
        document.getElementById('reg-email')?.focus();
    }
}

export async function initAuthHeader() {
  const guestNav = document.getElementById('guestNav');
  const loggedNav = document.getElementById('loggedNav');
  const headerUserName = document.getElementById('headerUserName');
  const logoutBtn = document.getElementById('logoutBtn');

  if (!guestNav || !loggedNav) return;

  if (authAPI.isAuthenticated()) {
    // Показываем авторизованную навигацию
    guestNav.classList.add('hidden');
    loggedNav.classList.remove('hidden');
    loggedNav.classList.add('flex');

    // Загружаем имя пользователя
    try {
      const user = await usersAPI.getMe();
      const displayName = (user.name && user.surname)
        ? `${user.name} ${user.surname}`
        : (user.name || user.email || 'Пользователь');
      if (headerUserName) headerUserName.innerText = displayName;
    } catch (error) {
      if (headerUserName) headerUserName.innerText = 'Пользователь';
    }

    // Обработчик выхода
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        authAPI.logout();
        window.location.reload();
      };
    }

    // Инициализация выпадающего меню профиля
    const profileIconBtn = document.getElementById('profile-btn');
    const profileDropdownMenu = document.getElementById('profileDropdown');

    function toggleProfileMenu() {
      profileDropdownMenu?.classList.toggle('hidden');
    }

    if (profileIconBtn) {
      profileIconBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProfileMenu();
      });
    }

    document.addEventListener('click', (e) => {
      if (profileDropdownMenu && !profileDropdownMenu.contains(e.target) && e.target !== profileIconBtn) {
        profileDropdownMenu.classList.add('hidden');
      }
    });

  } else {
    // Показываем гостевую навигацию
    guestNav.classList.remove('hidden');
    loggedNav.classList.add('hidden');
    loggedNav.classList.remove('flex');

    // Гостевой клик открывает модалку
    const guestNavEl = document.getElementById('guestNav');
    if (guestNavEl) {
      guestNavEl.addEventListener('click', () => {
        openAuthModal();
      });
    }
  }
}

export function initAuthModal() {
    const profileBtn = document.getElementById('profile-btn');
    const profileName = document.getElementById('profile-name');
    const closeBtn = document.getElementById('close-auth-btn');
    const overlay = document.getElementById('auth-modal-overlay');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (profileBtn) profileBtn.addEventListener('click', openAuthModal);
    if (profileName) profileName.addEventListener('click', openAuthModal);
    if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAuthModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) closeAuthModal();
    });
    if (tabLogin) tabLogin.addEventListener('click', () => switchAuthTab('login'));
    if (tabRegister) tabRegister.addEventListener('click', () => switchAuthTab('register'));

    // Привязка ко всем кнопкам входа/регистрации на странице
    document.querySelectorAll('.login-btn-expert').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal();
        });
    });

    // Обработка формы входа
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAuthError();
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            if (!email || !isValidEmail(email)) {
                showAuthError('Введите корректный email');
                return;
            }
            if (!password) {
                showAuthError('Введите пароль');
                return;
            }
            try {
                await authAPI.login(email, password);

                // Проверяем, был ли pending join-токен
                const pendingJoin = localStorage.getItem('pending_join_token');
                if (pendingJoin) {
                    localStorage.removeItem('pending_join_token');
                    window.location.href = `group.html?join=${pendingJoin}`;
                    return;
                }

                window.location.href = 'group.html';
            } catch (err) {
                showAuthError(err.message);
                document.getElementById('auth-password').value = '';
            }
        });
    }

    // Обработка формы регистрации
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAuthError();
            const firstName = document.getElementById('reg-first-name').value.trim();
            const lastName = document.getElementById('reg-last-name').value.trim();
            const patronymic = document.getElementById('reg-patronymic').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const confirm = document.getElementById('reg-password-confirm').value;
            const terms = document.getElementById('reg-terms').checked;

            if (!firstName) {
                showAuthError('Введите имя');
                return;
            }
            if (!lastName) {
                showAuthError('Введите фамилию');
                return;
            }
            if (!patronymic) {
                showAuthError('Введите отчество');
                return;
            }
            if (!email || !isValidEmail(email)) {
                showAuthError('Введите корректный email');
                return;
            }
            // Синхронизировано с бэкендом: min_length=8
            if (!password || password.length < 8) {
                showAuthError('Пароль должен быть не менее 8 символов');
                return;
            }
            if (password !== confirm) {
                showAuthError('Пароли не совпадают');
                return;
            }
            if (!terms) {
                showAuthError('Необходимо согласиться с условиями');
                return;
            }
            try {
                const result = await authAPI.register({ 
                    email, 
                    password, 
                    name: firstName, 
                    surname: lastName,
                    patronymic: patronymic
                });

                // Сохраняем профиль в хранилище (бэкенд не имеет GET /users/me)
                saveProfileToStorage({
                    id: result.id,
                    name: firstName,
                    surname: lastName,
                    patronymic: patronymic,
                    email: email
                });

                // Сохраняем токен из ответа регистрации
                if (result.access_token) {
                    authAPI.logout(); // очистим старый
                    localStorage.setItem('access_token', result.access_token);
                }

                showAuthError('Регистрация успешна! Теперь войдите.', true);
                setTimeout(() => switchAuthTab('login'), 1500);
                document.getElementById('reg-first-name').value = '';
                document.getElementById('reg-last-name').value = '';
                document.getElementById('reg-patronymic').value = '';
                document.getElementById('reg-email').value = '';
                document.getElementById('reg-password').value = '';
                document.getElementById('reg-password-confirm').value = '';
                document.getElementById('reg-terms').checked = false;
            } catch (err) {
                showAuthError(err.message);
            }
        });
    }
}