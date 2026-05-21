async function loadComponent(url, selector) {
  const placeholder = document.querySelector(selector);
  if (!placeholder) {
    console.warn(`[LayoutLoader] Placeholder ${selector} не найден`);
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    placeholder.outerHTML = html;
    console.log(`[LayoutLoader] ${url} загружен успешно`);
  } catch (err) {
    console.error(`[LayoutLoader] Ошибка загрузки ${url}:`, err);
    // Fallback: render minimal header/footer inline
    if (selector === '#layout-header') {
      placeholder.outerHTML = renderFallbackHeader();
    } else if (selector === '#layout-footer') {
      placeholder.outerHTML = renderFallbackFooter();
    } else {
      placeholder.innerHTML = `
        <div style="padding: 12px; background: #fee2e2; border: 1px solid #ef4444;">
          ⚠️ Не удалось загрузить ${url}. Запустите через локальный сервер.
        </div>
      `;
    }
  }
}

function renderFallbackHeader() {
  const isAuth = !!localStorage.getItem('access_token');
  return `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div class="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <a href="index.html" class="text-xl font-bold text-indigo-900">
          Фидбэ<span class="text-orange-500">К</span>
        </a>
        <nav class="flex items-center gap-4">
          ${isAuth ? `
            <a href="group.html" class="text-sm text-gray-700 hover:text-orange-500 transition">Группы</a>
            <a href="calendar.html" class="text-sm text-gray-700 hover:text-orange-500 transition">Календарь</a>
            <div class="relative">
              <button id="profile-btn" class="flex items-center gap-2 text-sm text-gray-700 hover:text-orange-500 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                <span id="headerUserName">Пользователь</span>
              </button>
              <div id="profileDropdown" class="hidden absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50">
                <a href="settings.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50">Настройки</a>
                <button id="logoutBtn" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50">Выйти</button>
              </div>
            </div>
          ` : `
            <button class="login-btn-expert text-sm text-gray-700 hover:text-orange-500 transition">Войти</button>
          `}
        </nav>
      </div>
    </header>
  `;
}

function renderFallbackFooter() {
  return `
    <footer class="bg-gray-50 border-t border-gray-200 mt-auto">
      <div class="max-w-6xl mx-auto px-6 py-6 text-center">
        <p class="text-sm text-gray-500">© 2026 ФидбэК. Сервис экспертной обратной связи.</p>
      </div>
    </footer>
  `;
}

function removeSearchIcon() {
  // Ищем SVG с path лупы (характерные команды: M21, C21, circle)
  const allSvgs = document.querySelectorAll('svg');
  allSvgs.forEach(svg => {
    const paths = svg.querySelectorAll('path');
    const hasSearchPath = Array.from(paths).some(p => {
      const d = p.getAttribute('d') || '';
      // Лупа обычно содержит круг + палку
      return (d.includes('M21') && d.includes('C21')) || 
             (d.includes('m21') && d.includes('c21')) ||
             d.includes('circle') ||
             (d.length > 50 && d.includes('M') && d.includes('L'));
    });

    if (hasSearchPath) {
      const btn = svg.closest('button') || svg.closest('a') || svg.parentElement;
      if (btn) {
        btn.remove();
        console.log('[LayoutLoader] Удалена иконка поиска');
      }
    }
  });

  // Также ищем по aria-label / title
  document.querySelectorAll('button, a').forEach(el => {
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
    if (label.includes('поиск') || label.includes('search')) {
      el.remove();
      console.log('[LayoutLoader] Удалена кнопка поиска по aria-label/title');
    }
  });
}

async function initLayout() {
  console.log('[LayoutLoader] Начинаем загрузку layout...');

  await Promise.all([
    loadComponent('components/header.html', '#layout-header'),
    loadComponent('components/footer.html', '#layout-footer')
  ]);

  // Ждём следующего тика, чтобы DOM точно обновился после outerHTML
  await new Promise(r => setTimeout(r, 0));

  // Удаляем иконку поиска
  removeSearchIcon();

  // Убираем target="_blank" у внутренних ссылок
  document.querySelectorAll('a[target="_blank"]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (
      !href.startsWith('http') ||
      href.includes(window.location.hostname) ||
      href.includes('localhost')
    ) {
      a.removeAttribute('target');
    }
  });

  // Убираем <base target="_blank"> если есть
  const baseTag = document.querySelector('base[target="_blank"]');
  if (baseTag) {
    baseTag.removeAttribute('target');
    console.log('[LayoutLoader] Удален target="_blank" из <base>');
  }

  console.log('[LayoutLoader] guestNav найден?', !!document.getElementById('guestNav'));
  console.log('[LayoutLoader] loggedNav найден?', !!document.getElementById('loggedNav'));
  console.log('[LayoutLoader] access_token в localStorage?', !!localStorage.getItem('access_token'));

  try {
    const { initAuthHeader } = await import('./auth-module.js?v=4');
    await initAuthHeader();
    console.log('[LayoutLoader] initAuthHeader выполнен');
  } catch (err) {
    console.error('[LayoutLoader] Ошибка auth:', err);
  }

  try {
    const { initNotifications } = await import('./notification.js?v=4');
    initNotifications();
    console.log('[LayoutLoader] initNotifications выполнен');
  } catch (err) {
    console.error('[LayoutLoader] Ошибка notifications:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLayout);
} else {
  initLayout();
}