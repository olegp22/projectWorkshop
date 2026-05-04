import { authAPI, usersAPI, groupsAPI } from './api.js';
import { requireAuth } from './auth-module.js';

let currentGroupId = null;
// Храним актуальные поля из UserResponse
let currentUser = { id: null, name: '', surname: '', patronymic: '', email: '' };

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
        currentUser = {
            id: user.id,
            name: user.name || '',
            surname: user.surname || '',
            patronymic: user.patronymic || '',
            email: user.email || ''
        };

        const displayName = (user.name && user.surname)
            ? `${user.name} ${user.surname}`
            : (user.name || user.email || 'Пользователь');

        document.getElementById('userNameDisplay').innerText = displayName;
        document.getElementById('headerUserName').innerText = displayName;

        document.getElementById('profileFirstName').value = user.name || '';
        document.getElementById('profileLastName').value = user.surname || '';
        document.getElementById('profileEmail').value = user.email || '';
        const patronymicField = document.getElementById('profilePatronymic');
        if (patronymicField) patronymicField.value = user.patronymic || '';
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
        if (groups.length === 0) {
            parent.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">У вас пока нет групп</p>';
            return;
        }
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

        const studentInviteField = document.getElementById('studentInviteField');
        const expertInviteField = document.getElementById('expertInviteField');
        if (studentInviteField) {
            studentInviteField.value = group.student_invite_token 
                ? group.student_invite_token
                : 'Токен не сгенерирован (создайте новую группу)';
        }
        if (expertInviteField) {
            expertInviteField.value = group.reviewer_invite_token 
                ? group.reviewer_invite_token
                : 'Токен не сгенерирован (создайте новую группу)';
        }

        const members = await groupsAPI.getMembers(groupId);
        renderMembers(members);

        document.querySelectorAll('.section-content').forEach(sec => sec.classList.remove('active'));
        document.getElementById('sectionGroupDetails').classList.add('active');
        await loadGroups();
    } catch (error) {
        showToast('Не удалось загрузить группу', true);
    }
}

function renderMembers(members) {
    const container = document.getElementById('membersListArea');
    if (!container) return;
    container.innerHTML = members.map(m => `
        <div class="flex justify-between items-center py-2 px-2 border-b border-gray-100 last:border-0" data-member-id="${m.user_id}">
            <span class="text-gray-800 text-sm">${escapeHtml((m.name + ' ' + m.surname).trim() || m.email || m.user_id)}</span>
            <span class="text-gray-500 text-xs font-medium bg-gray-100 px-2 py-0.5">${escapeHtml(m.role || 'участник')}</span>
        </div>
    `).join('');

    const dropdown = document.getElementById('removeMemberDropdown');
    if (dropdown) {
        dropdown.innerHTML = members.map(m => {
            const full = (m.name + ' ' + m.surname).trim() || m.email || m.user_id;
            return `
            <div class="remove-member-option px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 cursor-pointer border-b border-orange-100"
                 data-member-id="${m.user_id}" data-member-name="${escapeHtml(full)}">
                ${escapeHtml(full)} — ${escapeHtml(m.role || 'участник')}
            </div>
        `;}).join('');

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
    const btn = document.getElementById('createGroupBtn');
    btn.disabled = true;
    btn.textContent = 'Создание...';
    try {
        const newGroup = await groupsAPI.createGroup(name);
        showToast(`Группа "${name}" создана!`);
        document.getElementById('newGroupName').value = '';
        await loadGroups();
        await openGroupDetails(newGroup.id);
    } catch (error) {
        showToast('Ошибка создания группы: ' + error.message, true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Создать новую группу';
    }
};

// Присоединение по коду
document.getElementById('joinGroupBtn').onclick = async () => {
    const code = document.getElementById('joinCodeInput').value.trim();
    if (!code) { showToast('Введите код приглашения', true); return; }
    try {
        const result = await groupsAPI.joinGroupByToken(code);
        showToast(result.message || 'Вы присоединились к группе!');
        document.getElementById('joinCodeInput').value = '';
        await loadGroups();
        document.querySelectorAll('.section-content').forEach(sec => sec.classList.remove('active'));
        document.getElementById('sectionGroups').classList.add('active');
        currentGroupId = null;
    } catch (error) {
        showToast('Неверный код приглашения', true);
    }
};

// Добавление участника
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

// Сохранение профиля – исправлено под UserUpdate
document.getElementById('saveProfileBtn').onclick = async () => {
    const name = document.getElementById('profileFirstName').value.trim();
    const surname = document.getElementById('profileLastName').value.trim();
    const email = document.getElementById('profileEmail').value.trim();
    const patronymic = document.getElementById('profilePatronymic')?.value.trim();
    try {
        await usersAPI.updateProfile({ name, surname, patronymic, email });
        showToast('Профиль обновлен');
        await loadCurrentUser();
    } catch (error) {
        showToast('Ошибка сохранения: ' + error.message, true);
    }
};

// Смена пароля
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

// Переключение секций
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

async function init() {
    if (!requireAuth()) return;
    await loadCurrentUser();
    await loadGroups();
}

init();