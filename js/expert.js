import { authAPI, usersAPI, groupsAPI } from './api.js';
import { requireAuth } from './auth-module.js';

let currentGroupId = null;
let currentUser = { id: null, full_name: '', email: '', last_name: '', first_name: '' };
let groupsList = []; // храним список групп для быстрого доступа

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = isError ? '#dc2626' : '#1f2937';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, (m) => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function loadCurrentUser() {
    try {
        const user = await usersAPI.getMe();
        currentUser = user;
        const displayName = user.full_name || user.email || 'Пользователь';
        document.getElementById('userNameDisplay').innerText = displayName;
        document.getElementById('headerUserName').innerText = displayName;
        document.getElementById('profileLastName').value = user.last_name || '';
        document.getElementById('profileFirstName').value = user.first_name || '';
        document.getElementById('profileEmail').value = user.email || '';
    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
        document.getElementById('headerUserName').innerText = 'Гость';
    }
}

async function loadGroups() {
    try {
        const groups = await groupsAPI.getMyGroups();
        groupsList = groups;
        renderGroupsList(groups);
        return groups;
    } catch (error) {
        console.error(error);
        return [];
    }
}

function renderGroupsList(groups) {
    const container = document.getElementById('groupsListContainer');
    const detailsContainer = document.getElementById('groupsListDetails');
    const renderInto = (parent, activeId) => {
        if (!parent) return;
        parent.innerHTML = '';
        groups.forEach(group => {
            const isActive = group.id === activeId;
            const div = document.createElement('div');
            div.className = `border-2 ${isActive ? 'border-purple-700 bg-purple-50' : 'border-purple-500 bg-white'} p-3 flex justify-between items-center cursor-pointer group-item`;
            div.setAttribute('data-group-id', group.id);
            div.innerHTML = `
                <span class="text-sm font-medium ${isActive ? 'text-purple-900' : 'text-gray-800'} group-name">${escapeHtml(group.name)}</span>
                <div class="w-px h-5 bg-purple-300 mx-2 group-divider"></div>
                <span class="text-sm ${isActive ? 'text-purple-800' : 'text-gray-600'} group-role">${escapeHtml(group.role || 'участник')}</span>
            `;
            div.onclick = () => openGroupDetails(group.id);
            parent.appendChild(div);
        });
    };
    renderInto(container, currentGroupId);
    renderInto(detailsContainer, currentGroupId);
}

async function openGroupDetails(groupId) {
    currentGroupId = groupId;
    try {
        const group = groupsList.find(g => g.id === groupId);
        if (!group) throw new Error('Группа не найдена');
        document.getElementById('currentGroupNameSpan').innerText = group.name;

        // Показываем инвайт-токены
        const studentInviteField = document.getElementById('studentInviteField');
        const expertInviteField = document.getElementById('expertInviteField');
        if (studentInviteField) {
            const baseUrl = window.location.origin;
            studentInviteField.value = group.student_invite_token 
                ? `${baseUrl}/groups/join/${group.student_invite_token}`
                : 'Токен не сгенерирован (создайте новую группу)';
        }
        if (expertInviteField) {
            expertInviteField.value = group.reviewer_invite_token 
                ? `${baseUrl}/groups/join/${group.reviewer_invite_token}`
                : 'Токен не сгенерирован (создайте новую группу)';
        }

        // Загружаем участников
        const members = await groupsAPI.getMembers(groupId);
        renderMembers(members);

        // Переключаем секцию
        document.querySelectorAll('.section-content').forEach(sec => sec.classList.remove('active'));
        document.getElementById('sectionGroupDetails').classList.add('active');
        
        // Обновляем список групп для подсветки активной
        await loadGroups();
    } catch (error) {
        showToast('Не удалось загрузить группу', true);
    }
}

function renderMembers(members) {
    const container = document.getElementById('membersListArea');
    if (!container) return;
    container.innerHTML = members.map(m => `
        <div class="flex justify-between items-center py-2 px-2 border-b border-gray-100 last:border-0" data-member-id="${m.id}">
            <span class="text-gray-800 text-sm">${escapeHtml(m.full_name || m.name || m.email)}</span>
            <span class="text-gray-500 text-xs font-medium bg-gray-100 px-2 py-0.5">${escapeHtml(m.role || 'участник')}</span>
        </div>
    `).join('');

    // Заполняем выпадающий список для удаления
    const dropdown = document.getElementById('removeMemberDropdown');
    if (dropdown) {
        dropdown.innerHTML = members.map(m => `
            <div class="remove-member-option px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 cursor-pointer border-b border-orange-100" data-member-id="${m.id}" data-member-name="${escapeHtml(m.full_name || m.name || m.email)}">
                ${escapeHtml(m.full_name || m.name || m.email)} — ${escapeHtml(m.role || 'участник')}
            </div>
        `).join('');
        
        document.querySelectorAll('.remove-member-option').forEach(opt => {
            opt.onclick = async (e) => {
                e.stopPropagation();
                const memberId = opt.dataset.memberId;
                const memberName = opt.dataset.memberName;
                if (confirm(`Удалить участника "${memberName}" из группы?`)) {
                    try {
                        await groupsAPI.removeMember(currentGroupId, memberId);
                        showToast(`Участник ${memberName} удален`);
                        await openGroupDetails(currentGroupId);
                    } catch (error) {
                        showToast('Ошибка удаления: ' + error.message, true);
                    }
                }
                dropdown.classList.add('hidden');
            };
        });
    }
}

// Создание группы
document.getElementById('createGroupBtn').onclick = async () => {
    const name = document.getElementById('newGroupName').value.trim();
    if (!name) { showToast('Введите название группы', true); return; }
    try {
        const newGroup = await groupsAPI.createGroup(name);
        showToast(`Группа "${name}" создана!`);
        document.getElementById('newGroupName').value = '';
        await loadGroups();
        await openGroupDetails(newGroup.id);
    } catch (error) {
        showToast('Ошибка создания группы: ' + error.message, true);
    }
};

// Присоединение по коду (GET /groups/join/{token})
document.getElementById('joinGroupBtn').onclick = async () => {
    const code = document.getElementById('joinCodeInput').value.trim();
    if (!code) { showToast('Введите код приглашения', true); return; }
    try {
        const result = await groupsAPI.joinGroupByToken(code);
        showToast(result.message || 'Вы присоединились к группе!');
        document.getElementById('joinCodeInput').value = '';
        await loadGroups();
        // Если вернулся id группы, открываем её (в API нет, но можно перезагрузить список)
        // Для простоты просто обновим список и закроем детали
        document.querySelectorAll('.section-content').forEach(sec => sec.classList.remove('active'));
        document.getElementById('sectionGroups').classList.add('active');
        currentGroupId = null;
    } catch (error) {
        showToast('Неверный код приглашения', true);
    }
};

// Добавление участника (заглушка, т.к. бэкенд не генерирует инвайт-ссылки)
document.getElementById('addMemberBtn').onclick = () => {
    showToast('Для добавления участника скопируйте код приглашения из группы (функция в разработке)', false);
};

// Выпадающий список удаления
const removeBtn = document.getElementById('removeMemberBtn');
const removeDropdown = document.getElementById('removeMemberDropdown');
if (removeBtn && removeDropdown) {
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeDropdown.classList.toggle('hidden');
    };
    document.addEventListener('click', (e) => {
        if (!removeDropdown.contains(e.target) && e.target !== removeBtn) {
            removeDropdown.classList.add('hidden');
        }
    });
}

// Навигация
document.getElementById('backToGroupsBtn').onclick = async () => {
    document.querySelectorAll('.section-content').forEach(sec => sec.classList.remove('active'));
    document.getElementById('sectionGroups').classList.add('active');
    await loadGroups();
    currentGroupId = null;
};

// Сохранение профиля
document.getElementById('saveProfileBtn').onclick = async () => {
    const lastName = document.getElementById('profileLastName').value;
    const firstName = document.getElementById('profileFirstName').value;
    const email = document.getElementById('profileEmail').value;
    try {
        await usersAPI.updateProfile({ last_name: lastName, first_name: firstName, email });
        showToast('Профиль обновлен');
        await loadCurrentUser();
    } catch (error) {
        showToast('Ошибка сохранения: ' + error.message, true);
    }
};

// Смена пароля (заглушка, т.к. эндпоинта нет)
document.getElementById('changePasswordBtn').onclick = () => {
    showToast('Функция смены пароля временно недоступна', true);
};

// Выпадающее меню профиля
const profileNameBtn = document.getElementById('profile-name');
const profileDropdownMenu = document.getElementById('profileDropdown');
const profileIconBtn = document.getElementById('profile-btn');

function toggleProfileMenu() {
    profileDropdownMenu.classList.toggle('show');
}
profileNameBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleProfileMenu(); });
profileIconBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleProfileMenu(); });
document.addEventListener('click', () => profileDropdownMenu?.classList.remove('show'));

// Переключение секций через меню
document.querySelectorAll('[data-section]').forEach(el => {
    el.onclick = () => {
        const sec = el.dataset.section;
        document.querySelectorAll('.section-content').forEach(s => s.classList.remove('active'));
        document.getElementById(`section${sec.charAt(0).toUpperCase() + sec.slice(1)}`).classList.add('active');
        if (sec === 'groups') loadGroups();
        profileDropdownMenu?.classList.remove('show');
    };
});

// Табы настроек
document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.onclick = () => {
        document.querySelectorAll('.settings-tab').forEach(t => {
            t.classList.remove('text-orange-500', 'border-orange-500');
            t.classList.add('text-gray-500', 'border-transparent');
        });
        tab.classList.add('text-orange-500', 'border-orange-500');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`tab${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`).classList.add('active');
    };
});

// Выход
document.getElementById('logoutBtn').onclick = () => {
    authAPI.logout();
    window.location.href = '/index.html';
};

// Инициализация страницы
async function init() {
    if (!requireAuth()) return;
    await loadCurrentUser();
    await loadGroups();
}

init();