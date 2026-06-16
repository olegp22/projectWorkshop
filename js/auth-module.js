import { authAPI, usersAPI, saveProfileToStorage, setAuthToken } from './api.js';
import { userStore } from './user-store.js';

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

const AUTH_MODAL_HTML = `<div id="auth-modal-overlay" class="fixed inset-0 hidden items-center justify-center p-4 z-50 bg-black/50" role="dialog" aria-modal="true">
    <div class="bg-white shadow-2xl max-w-sm w-full relative border border-purple-400 rounded-none">
      <button id="close-auth-btn" class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition" aria-label="Закрыть окно">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
      <div class="p-6 pt-8">
        <div class="flex mb-5">
          <button id="tab-login" class="flex-1 pb-2 text-center text-sm font-medium text-orange-500 border-b-2 border-orange-500 transition cursor-pointer">Вход</button>
          <button id="tab-register" class="flex-1 pb-2 text-center text-sm font-medium text-gray-500 border-b border-gray-300 hover:text-gray-700 transition cursor-pointer">Регистрация</button>
        </div>
        <div id="auth-error" class="hidden mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600"></div>

        <form id="login-form" class="space-y-3" novalidate>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1" for="auth-email">Email</label>
            <input type="email" id="auth-email" placeholder="example@mail.ru" required class="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-orange-400">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1" for="auth-password">Пароль</label>
            <input type="password" id="auth-password" placeholder="Введите пароль" required class="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-orange-400">
          </div>
          <button type="submit" class="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 text-sm font-medium transition">Войти</button>
        </form>

        <form id="register-form" class="space-y-3 hidden" novalidate>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1" for="reg-first-name">Имя</label>
            <input type="text" id="reg-first-name" placeholder="Иван" class="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-orange-400">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1" for="reg-last-name">Фамилия</label>
            <input type="text" id="reg-last-name" placeholder="Иванов" class="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-orange-400">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1" for="reg-patronymic">Отчество</label>
            <input type="text" id="reg-patronymic" placeholder="Иванович" class="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-orange-400">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1" for="reg-email">Email</label>
            <input type="email" id="reg-email" placeholder="example@mail.ru" required class="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-orange-400">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1" for="reg-password">Пароль</label>
            <input type="password" id="reg-password" required class="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-orange-400">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1" for="reg-password-confirm">Подтвердите пароль</label>
            <input type="password" id="reg-password-confirm" required class="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-orange-400">
          </div>
          <div class="flex items-start">
            <input type="checkbox" id="reg-terms" required class="mt-0.5 mr-1.5 w-3.5 h-3.5 text-orange-500">
            <label for="reg-terms" class="text-xs text-gray-600">Я согласен с условиями использования</label>
          </div>
          <button type="submit" class="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 text-sm font-medium transition">Зарегистрироваться</button>
        </form>
      </div>
    </div>
  </div>`;

function createAuthModal() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = AUTH_MODAL_HTML;
    const modal = wrapper.firstElementChild;
    document.body.appendChild(modal);
    initAuthModal();
    return modal;
}

export function openAuthModal() {
    let modal = document.getElementById('auth-modal-overlay');
    if (!modal) {
        modal = createAuthModal();
    }
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


function positionDropdown(button, dropdown) {
  if (!button || !dropdown) return;
  const rect = button.getBoundingClientRect();

  dropdown.style.position = 'fixed';
  dropdown.style.zIndex = '9999';

  dropdown.style.top = (rect.bottom + 8) + 'px';
  dropdown.style.right = (window.innerWidth - rect.right) + 'px';
  dropdown.style.left = 'auto';
}

export async function initAuthHeader() {
  const guestNav = document.getElementById('guestNav');
  const loggedNav = document.getElementById('loggedNav');
  const headerUserName = document.getElementById('headerUserName');
  const logoutBtn = document.getElementById('logoutBtn');
  const logoutBtnBurger = document.getElementById('logoutBtnBurger');

  if (!guestNav || !loggedNav) return;

  if (authAPI.isAuthenticated()) {
    guestNav.classList.add('hidden');
    loggedNav.classList.remove('hidden');
    loggedNav.classList.add('flex');

    try {
      const user = await usersAPI.getMe();
      const displayName = (user.name && user.surname)
        ? `${user.name} ${user.surname}`
        : (user.name || user.email || 'Пользователь');
      if (headerUserName) headerUserName.innerText = displayName;
    } catch (error) {
      if (headerUserName) headerUserName.innerText = 'Пользователь';
    }

    if (logoutBtn) {
      logoutBtn.onclick = () => {
        authAPI.logout();
        window.location.reload();
      };
    }
    if (logoutBtnBurger) {
      logoutBtnBurger.onclick = () => {
        authAPI.logout();
        window.location.reload();
      };
    }

    const burgerBtn = document.getElementById('burgerMenuBtn');
    const burgerDropdown = document.getElementById('burgerDropdown');

    if (burgerBtn && burgerDropdown) {
      burgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = burgerDropdown.classList.contains('hidden');
        document.getElementById('profileDropdown')?.classList.add('hidden');
        document.getElementById('notificationDropdown')?.classList.add('hidden');
        document.getElementById('profile-btn')?.setAttribute('aria-expanded', 'false');

        if (isHidden) {
          burgerDropdown.classList.remove('hidden');
          positionDropdown(burgerBtn, burgerDropdown);
        } else {
          burgerDropdown.classList.add('hidden');
        }
        burgerBtn.setAttribute('aria-expanded', String(isHidden));
      });

      window.addEventListener('resize', () => {
        if (!burgerDropdown.classList.contains('hidden')) {
          positionDropdown(burgerBtn, burgerDropdown);
        }
      });

      document.addEventListener('click', (e) => {
        if (!burgerDropdown.contains(e.target) && e.target !== burgerBtn) {
          burgerDropdown.classList.add('hidden');
          burgerBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const profileBtn = document.getElementById('profile-btn');
    const profileDropdown = document.getElementById('profileDropdown');

    if (profileBtn && profileDropdown) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = profileDropdown.classList.contains('hidden');
        document.getElementById('burgerDropdown')?.classList.add('hidden');
        document.getElementById('notificationDropdown')?.classList.add('hidden');
        document.getElementById('burgerMenuBtn')?.setAttribute('aria-expanded', 'false');

        if (isHidden) {
          profileDropdown.classList.remove('hidden');
          positionDropdown(profileBtn, profileDropdown);
        } else {
          profileDropdown.classList.add('hidden');
        }
        profileBtn.setAttribute('aria-expanded', String(isHidden));
      });

      window.addEventListener('resize', () => {
        if (!profileDropdown.classList.contains('hidden')) {
          positionDropdown(profileBtn, profileDropdown);
        }
      });

      document.addEventListener('click', (e) => {
        if (!profileDropdown.contains(e.target) && e.target !== profileBtn) {
          profileDropdown.classList.add('hidden');
          profileBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

  } else {
    guestNav.classList.remove('hidden');
    loggedNav.classList.add('hidden');
    loggedNav.classList.remove('flex');

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

    document.querySelectorAll('.login-btn-expert').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal();
        });
    });

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

                userStore.setProfile({
                    id: result.id,
                    name: firstName,
                    surname: lastName,
                    patronymic: patronymic,
                    email: email
                });

                if (result.access_token) {
                    setAuthToken(result.access_token);
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