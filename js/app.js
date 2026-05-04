// Фильтрация проектов на странице эксперта
document.addEventListener('DOMContentLoaded', function() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  if (filterBtns.length > 0 && projectCards.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        filterBtns.forEach(b => {
          b.classList.remove('bg-orange-500');
          b.classList.add('bg-orange-400');
        });
        this.classList.remove('bg-orange-400');
        this.classList.add('bg-orange-500');

        const filter = this.dataset.filter;
        projectCards.forEach(card => {
          if (filter === 'all' || card.dataset.status === filter) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // Плавная прокрутка для кнопки "Начать сейчас"
  function smoothScrollToElement(elementId) {
    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      console.error('Элемент не найден:', elementId);
      return;
    }

    targetElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  const startBtn = document.getElementById('startNowBtn');
  if (startBtn) {
    startBtn.addEventListener('click', function(e) {
      e.preventDefault();
      smoothScrollToElement('student-section');
    });
  }

  // Обработка якорей в URL после полной загрузки
  function handleHashScroll() {
    if (window.location.hash === '#student-section' || window.location.hash === '#expert-section') {
      const hash = window.location.hash.substring(1);
      const target = document.getElementById(hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  // Ждём загрузки шрифтов и контента
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(handleHashScroll);
  } else {
    window.addEventListener('load', handleHashScroll);
  }
});

// Утилита debounce
function debounce(func, wait) {
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

// Мобильное меню
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) {
    const isHidden = menu.classList.toggle('hidden');
    menu.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
  }
}