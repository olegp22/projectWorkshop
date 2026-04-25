// "База данных" пользователей (пароли в base64 для демо)
var usersDb = [
  { email: 'student@test.ru', password: btoa('123'), url: 'student.html', role: 'student' },
  { email: 'expert@test.ru', password: btoa('123'), url: 'expert.html', role: 'expert' }
];

// Управление фокусом
var lastFocusedElement = null;

function trapFocus(element) {
  var focusableElements = element.querySelectorAll(
    'a[href], button, textarea, input[type="text"], input[type="email"], input[type="password"], input[type="checkbox"], select'
  );
  var firstFocusable = focusableElements[0];
  var lastFocusable = focusableElements[focusableElements.length - 1];

  element.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  });
}

// Показ/скрытие ошибок
function showAuthError(message) {
  var errorEl = document.getElementById('auth-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
}

function hideAuthError() {
  var errorEl = document.getElementById('auth-error');
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }
}

// Открытие модального окна
window.openAuthModal = function() {
  var modal = document.getElementById('auth-modal-overlay');
  if (!modal) return;

  lastFocusedElement = document.activeElement;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Фокус на первое поле
  setTimeout(function() {
    var firstInput = modal.querySelector('input:not([type="hidden"])');
    if (firstInput) firstInput.focus();
  }, 50);

  trapFocus(modal);
};

// Закрытие модального окна
window.closeAuthModal = function() {
  var modal = document.getElementById('auth-modal-overlay');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.style.display = 'none';
  document.body.style.overflow = '';
  hideAuthError();

  // Сброс форм
  var loginForm = document.getElementById('login-form');
  var registerForm = document.getElementById('register-form');
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();

  // Возврат фокуса
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
};

// Переключение вкладок
window.switchAuthTab = function(tab) {
  var loginForm = document.getElementById('login-form');
  var registerForm = document.getElementById('register-form');
  var tabLogin = document.getElementById('tab-login');
  var tabRegister = document.getElementById('tab-register');

  var activeClass = "flex-1 pb-2 text-center text-sm font-medium text-orange-500 border-b-2 border-orange-500 transition cursor-pointer";
  var inactiveClass = "flex-1 pb-2 text-center text-sm font-medium text-gray-500 border-b border-gray-300 hover:text-gray-700 transition cursor-pointer";

  hideAuthError();

  if (tab === 'login') {
    if (loginForm) loginForm.classList.remove('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (tabLogin) tabLogin.className = activeClass;
    if (tabRegister) tabRegister.className = inactiveClass;
    setTimeout(function() {
      var emailInput = document.getElementById('auth-email');
      if (emailInput) emailInput.focus();
    }, 50);
  } else {
    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.remove('hidden');
    if (tabLogin) tabLogin.className = inactiveClass;
    if (tabRegister) tabRegister.className = activeClass;
    setTimeout(function() {
      var emailInput = document.getElementById('reg-email');
      if (emailInput) emailInput.focus();
    }, 50);
  }
};

// Валидация email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Логика обработки форм
document.addEventListener('DOMContentLoaded', function() {
  // Привязка кнопок к модалке
  var profileBtn = document.getElementById('profile-btn');
  var profileName = document.getElementById('profile-name');
  var studentBtn = document.getElementById('student-login-btn');
  var expertBtn = document.getElementById('expert-login-btn');
  var closeBtn = document.getElementById('close-auth-btn');

  [profileBtn, profileName, studentBtn, expertBtn].forEach(function(btn) {
    if (btn) btn.addEventListener('click', openAuthModal);
  });
  if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);

  // Обработка формы входа
  var loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      hideAuthError();

      var emailInput = document.getElementById('auth-email');
      var passwordInput = document.getElementById('auth-password');

      if (!emailInput || !passwordInput) return;

      var email = emailInput.value.trim();
      var password = passwordInput.value;

      // Валидация
      if (!email) {
        showAuthError('Введите email');
        emailInput.focus();
        return;
      }
      if (!isValidEmail(email)) {
        showAuthError('Введите корректный email');
        emailInput.focus();
        return;
      }
      if (!password) {
        showAuthError('Введите пароль');
        passwordInput.focus();
        return;
      }

      var foundUser = usersDb.find(function(user) {
        return user.email === email && user.password === btoa(password);
      });

      if (foundUser) {
        window.location.href = foundUser.url;
      } else {
        showAuthError('Неверный email или пароль');
        passwordInput.value = '';
        passwordInput.focus();
      }
    });
  }

  // Обработка формы регистрации
  var registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      hideAuthError();

      var emailInput = document.getElementById('reg-email');
      var passwordInput = document.getElementById('reg-password');
      var confirmInput = document.getElementById('reg-password-confirm');
      var termsInput = document.getElementById('reg-terms');

      if (!emailInput || !passwordInput || !confirmInput || !termsInput) return;

      var email = emailInput.value.trim();
      var password = passwordInput.value;
      var confirm = confirmInput.value;

      if (!email) {
        showAuthError('Введите email');
        emailInput.focus();
        return;
      }
      if (!isValidEmail(email)) {
        showAuthError('Введите корректный email');
        emailInput.focus();
        return;
      }
      if (!password) {
        showAuthError('Введите пароль');
        passwordInput.focus();
        return;
      }
      if (password.length < 3) {
        showAuthError('Пароль должен быть не менее 3 символов');
        passwordInput.focus();
        return;
      }
      if (password !== confirm) {
        showAuthError('Пароли не совпадают');
        confirmInput.focus();
        return;
      }
      if (!termsInput.checked) {
        showAuthError('Необходимо согласиться с условиями использования');
        termsInput.focus();
        return;
      }

      // Проверка на существующий email
      var existingUser = usersDb.find(function(user) { return user.email === email; });
      if (existingUser) {
        showAuthError('Пользователь с таким email уже существует');
        emailInput.focus();
        return;
      }

      // Демо: добавляем пользователя
      usersDb.push({
        email: email,
        password: btoa(password),
        url: 'student.html',
        role: 'student'
      });

      showAuthError('Регистрация успешна! Теперь вы можете войти.');
      document.getElementById('auth-error').classList.remove('bg-red-50', 'border-red-200', 'text-red-600');
      document.getElementById('auth-error').classList.add('bg-green-50', 'border-green-200', 'text-green-600');

      setTimeout(function() {
        switchAuthTab('login');
        document.getElementById('auth-email').value = email;
        document.getElementById('auth-error').classList.add('bg-red-50', 'border-red-200', 'text-red-600');
        document.getElementById('auth-error').classList.remove('bg-green-50', 'border-green-200', 'text-green-600');
        hideAuthError();
      }, 1500);
    });
  }

  // Закрытие модалки при клике на оверлей
  var overlay = document.getElementById('auth-modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        closeAuthModal();
      }
    });
  }

  // Закрытие на Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var modal = document.getElementById('auth-modal-overlay');
      if (modal && !modal.classList.contains('hidden')) {
        closeAuthModal();
      }
    }
  });

  // Переключение вкладок
  var tabLogin = document.getElementById('tab-login');
  var tabRegister = document.getElementById('tab-register');
  if (tabLogin) tabLogin.addEventListener('click', function() { switchAuthTab('login'); });
  if (tabRegister) tabRegister.addEventListener('click', function() { switchAuthTab('register'); });
});