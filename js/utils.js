export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}


export function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `fixed top-5 right-5 px-5 py-3 rounded-md text-white text-sm z-50 animate-slide-in ${isError ? 'bg-red-600' : 'bg-gray-800'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}


export async function loadCurrentUser(usersAPI) {
  try {
    const user = await usersAPI.getMe();
    const displayName = (user.name && user.surname)
      ? `${user.name} ${user.surname}`
      : (user.name || user.email || 'Пользователь');
    const el = document.getElementById('headerUserName');
    if (el) el.innerText = displayName;
    return user;
  } catch (error) {
    const el = document.getElementById('headerUserName');
    if (el) el.innerText = 'Гость';
    if (error.message && error.message.includes('Сессия истекла')) {
      return null;
    }
    throw error;
  }
}


export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}


export function formatDateForInput(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


export function getErrorMessage(error) {
  const msg = error.message || '';

  if (msg.includes('400')) return 'Некорректный запрос. Проверьте данные.';
  if (msg.includes('401')) return 'Сессия истекла. Войдите снова.';
  if (msg.includes('403')) return 'Недостаточно прав для этой операции.';
  if (msg.includes('404')) return 'Данные не найдены.';
  if (msg.includes('409')) return 'Конфликт данных. Возможно, объект уже существует.';
  if (msg.includes('422')) return 'Ошибка валидации. Проверьте формат данных.';
  if (msg.includes('500')) return 'Ошибка сервера. Попробуйте позже.';
  if (msg.includes('502') || msg.includes('503') || msg.includes('504')) {
    return 'Сервер временно недоступен. Попробуйте позже.';
  }
  if (msg.includes('NetworkError') || msg.includes('fetch')) {
    return 'Нет подключения к интернету. Проверьте сеть.';
  }
  if (msg.includes('JSON') || msg.includes('Unexpected token')) {
    return 'Ошибка сервера. Получен некорректный ответ.';
  }

  return msg || 'Произошла ошибка. Попробуйте снова.';
}


export async function withRetry(asyncFn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await asyncFn();
    } catch (error) {
      const msg = error.message || '';

      if (msg.includes('400') || msg.includes('401') || msg.includes('403') || msg.includes('404') || msg.includes('422')) {
        throw error;
      }
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
}


export function showSkeleton(container, count = 4) {
  container.innerHTML = Array.from({ length: count }, () => `
    <div class="project-card animate-pulse">
      <div class="card-content space-y-3">
        <div class="h-3 bg-gray-200 rounded w-3/4"></div>
        <div class="h-3 bg-gray-200 rounded w-1/2"></div>
        <div class="h-3 bg-gray-200 rounded w-2/3"></div>
        <div class="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
      <div class="h-8 bg-gray-200 rounded mt-4"></div>
    </div>
  `).join('');
}


export function hideSkeleton(container) {
  container.innerHTML = '';
}