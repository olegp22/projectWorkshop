// Фильтрация проектов на странице эксперта
document.addEventListener('DOMContentLoaded', function() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');

    // Проверяем, есть ли элементы на странице
    if (filterBtns.length > 0 && projectCards.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Обновляем активную кнопку
                filterBtns.forEach(b => {
                    b.classList.remove('bg-orange-500');
                    b.classList.add('bg-orange-400');
                });
                this.classList.remove('bg-orange-400');
                this.classList.add('bg-orange-500');

                // Фильтруем карточки
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

    // ===== ПЛАВНАЯ ПРОКРУТКА ДЛЯ ГЛАВНОЙ СТРАНИЦЫ =====
    // Функция плавной прокрутки к элементу
    function smoothScrollToElement(elementId) {
        const targetElement = document.getElementById(elementId);
        if (!targetElement) return;
        
        targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    // Обработчик для кнопки "Начать сейчас" (прокрутка к блоку студента)
    const startBtn = document.getElementById('startNowBtn');
    if (startBtn) {
        startBtn.addEventListener('click', function(e) {
            e.preventDefault();
            smoothScrollToElement('student-section');
        });
    }

    // Если в URL есть якорь, плавно прокручиваем
    if (window.location.hash === '#student-section' || window.location.hash === '#expert-section') {
        setTimeout(function() {
            const hash = window.location.hash.substring(1);
            const target = document.getElementById(hash);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 200);
    }
});

// Утилита для debounce (если понадобится для поиска)
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

// Мобильное меню (если понадобится)
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}