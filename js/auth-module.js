import { authAPI, usersAPI } from './api.js';

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

    // === ИСПРАВЛЕНИЕ: привязка к кнопкам с классами login-btn-student и login-btn-expert ===
    const studentBtn = document.querySelector('.login-btn-student');
    const expertBtn = document.querySelector('.login-btn-expert');
    if (studentBtn) {
        studentBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal();
        });
    }
    if (expertBtn) {
        expertBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal();
        });
    }

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
                window.location.href = 'Front/expert.html';
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
            if (!password || password.length < 3) {
                showAuthError('Пароль должен быть не менее 3 символов');
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
                await authAPI.register({ 
                    email, 
                    password, 
                    name: firstName, 
                    surname: lastName,
                    patronymic: patronymic
                });
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

export function requireAuth() {
    if (!authAPI.isAuthenticated()) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}