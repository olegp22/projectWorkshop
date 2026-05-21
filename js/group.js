import { authAPI, usersAPI, groupsAPI } from './api.js';

let currentGroupId = null;
let currentUserRole = null;
let groupsList = [];
let currentStudentSubmission = null;

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    z-index: 9999;
    animation: slideIn 0.3s ease;
    ${isError ? 'background: #dc2626;' : 'background: #1f2937;'}
  `;
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
    const displayName = (user.name && user.surname)
      ? `${user.name} ${user.surname}`
      : (user.name || user.email || 'Пользователь');

    const userNameDisplay = document.getElementById('userNameDisplay');
    if (userNameDisplay) userNameDisplay.innerText = displayName;
  } catch (error) {
    console.error('Ошибка загрузки пользователя:', error);
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
    renderGroupsList([]);
    return [];
  }
}

function renderGroupsList(groups) {
  const container = document.getElementById('groupsListContainer');
  const detailsContainer = document.getElementById('groupsListDetails');

  const renderInto = (parent, activeId) => {
    if (!parent) return;
    if (groups.length === 0) {
      parent.innerHTML = `
        <div class="border-2 border-purple-500 bg-white p-3 flex justify-center items-center group-item">
          <span class="text-sm text-gray-500">У вас пока нет групп</span>
        </div>
      `;
    } else {
      parent.innerHTML = '';
      groups.forEach(group => {
        const isActive = group.id === activeId;
        const div = document.createElement('div');
        div.className = `border-2 ${isActive ? 'border-purple-700 bg-purple-50' : 'border-purple-500 bg-white'} p-3 flex justify-between items-center cursor-pointer group-item`;
        div.setAttribute('data-group-id', group.id);
        div.innerHTML = `
          <span class="text-sm font-medium ${isActive ? 'text-purple-900' : 'text-gray-800'} group-name">${escapeHtml(group.name)}</span>
          <div class="group-divider"></div>
          <span class="text-sm ${isActive ? 'text-purple-800' : 'text-gray-600'} group-role">${escapeHtml(group.role || 'участник')}</span>
        `;
        div.onclick = () => openGroupDetails(group.id);
        parent.appendChild(div);
      });
    }
    parent.insertAdjacentHTML('beforeend', '<div style="height: 2px;"></div>');
  };

  renderInto(container, currentGroupId);
  renderInto(detailsContainer, currentGroupId);
}

function setUserRole(role) {
  currentUserRole = role;

  const organizerActions = document.getElementById('organizerActions');
  const expertActions = document.getElementById('expertActions');
  const studentActions = document.getElementById('studentActions');
  const criteriaActions = document.getElementById('criteriaActions');

  if (organizerActions) organizerActions.classList.add('hidden');
  if (expertActions) expertActions.classList.add('hidden');
  if (studentActions) studentActions.classList.add('hidden');
  if (criteriaActions) criteriaActions.classList.add('hidden');

  document.querySelectorAll('.role-organizer-only').forEach(el => el.classList.add('hidden'));

  switch(role) {
    case 'organizer':
    case 'creator':
      if (organizerActions) organizerActions.classList.remove('hidden');
      if (criteriaActions) criteriaActions.classList.remove('hidden');
      document.querySelectorAll('.role-organizer-only').forEach(el => el.classList.remove('hidden'));
      break;
    case 'expert':
    case 'reviewer':
      if (expertActions) expertActions.classList.remove('hidden');
      break;
    case 'student':
    case 'member':
      if (studentActions) studentActions.classList.remove('hidden');
      break;
    default:
      if (studentActions) studentActions.classList.remove('hidden');
  }
}

function showSection(sectionName) {
  const sectionGroups = document.getElementById('sectionGroups');
  const sectionGroupDetails = document.getElementById('sectionGroupDetails');

  if (sectionName === 'groups') {
    if (sectionGroups) {
      sectionGroups.classList.remove('hidden');
      sectionGroups.classList.add('active');
    }
    if (sectionGroupDetails) {
      sectionGroupDetails.classList.add('hidden');
      sectionGroupDetails.classList.remove('active');
    }
    currentGroupId = null;
    currentUserRole = null;
  } else if (sectionName === 'details') {
    if (sectionGroups) {
      sectionGroups.classList.add('hidden');
      sectionGroups.classList.remove('active');
    }
    if (sectionGroupDetails) {
      sectionGroupDetails.classList.remove('hidden');
      sectionGroupDetails.classList.add('active');
    }
  }
}

async function openGroupDetails(groupId) {
  currentGroupId = groupId;
  try {
    const group = groupsList.find(g => g.id === groupId);
    if (!group) throw new Error('Группа не найдена');

    const userRole = group.role || 'member';
    setUserRole(userRole);

    if (userRole === 'student' || userRole === 'member') {
      await loadStudentSubmission();
    }

    const currentGroupNameSpan = document.getElementById('currentGroupNameSpan');
    if (currentGroupNameSpan) currentGroupNameSpan.innerText = group.name;

    const members = await groupsAPI.getMembers(groupId);
    renderMembers(members);

    if (userRole === 'creator' || userRole === 'organizer') {
      await loadGroupCriteria();
    }

    showSection('details');
    await loadGroups();

  } catch (error) {
    showToast('Не удалось загрузить группу', true);
    console.error(error);
  }
}

function renderMembers(members) {
  const container = document.getElementById('membersListArea');
  if (!container) return;
  
  container.innerHTML = members.map(m => {
    const fullName = (m.name + ' ' + m.surname).trim() || m.email || m.user_id;
    return `
    <div class="flex justify-between items-center py-2 px-2 border-b border-gray-100 last:border-0" data-member-id="${m.user_id}">
      <span class="text-gray-800 text-sm flex-1 text-center">${escapeHtml(fullName)}</span>
      <div class="w-px h-4 bg-purple-300 mx-3"></div>
      <span class="text-gray-500 text-xs font-medium bg-gray-100 px-2 py-0.5 text-center w-24">${escapeHtml(m.role || 'участник')}</span>
    </div>
  `;
  }).join('');

  const dropdown = document.getElementById('removeMemberDropdown');
  if (dropdown) {
    dropdown.innerHTML = members.map(m => {
      const full = (m.name + ' ' + m.surname).trim() || m.email || m.user_id;
      return `
        <div class="remove-member-option px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 cursor-pointer border-b border-orange-100"
             data-member-id="${m.user_id}" data-member-name="${escapeHtml(full)}">
          ${escapeHtml(full)} — ${escapeHtml(m.role || 'участник')}
        </div>
      `;
    }).join('');

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

// ── Переключение режимов и показ поля count_of_inspectors ──
function setupModeSelector() {
  const modeSelector = document.getElementById('modeSelector');
  const p2pBlock = document.getElementById('p2pInspectorsBlock');
  const buttons = modeSelector?.querySelectorAll('.mode-btn');
  
  if (!buttons || !p2pBlock) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      if (btn.dataset.mode === 'peer') {
        p2pBlock.classList.remove('hidden');
      } else {
        p2pBlock.classList.add('hidden');
      }
    });
  });

  if (buttons.length > 0) {
    buttons[0].classList.add('is-active');
  }
}

// ── Управление критериями оценки ──
function setupCriteriaManager() {
  const addBtn = document.getElementById('addCriterionBtn');
  const formBlock = document.getElementById('criterionFormBlock');
  const saveBtn = document.getElementById('saveCriterionBtn');
  const cancelBtn = document.getElementById('cancelCriterionBtn');
  const removeBtn = document.getElementById('removeCriterionBtn');
  const removeDropdown = document.getElementById('removeCriterionDropdown');

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      formBlock?.classList.remove('hidden');
      document.getElementById('criterionNameInput')?.focus();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      formBlock?.classList.add('hidden');
      const nameInput = document.getElementById('criterionNameInput');
      const descInput = document.getElementById('criterionDescInput');
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const name = document.getElementById('criterionNameInput')?.value.trim();
      const description = document.getElementById('criterionDescInput')?.value.trim() || null;
      
      if (!name) {
        showToast('Введите название критерия', true);
        return;
      }
      
      if (!currentGroupId) {
        showToast('Сначала выберите группу', true);
        return;
      }

      saveBtn.disabled = true;
      try {
        await groupsAPI.createCriterion(currentGroupId, { name, description });
        showToast('Критерий добавлен');
        formBlock?.classList.add('hidden');
        const nameInput = document.getElementById('criterionNameInput');
        const descInput = document.getElementById('criterionDescInput');
        if (nameInput) nameInput.value = '';
        if (descInput) descInput.value = '';
        await loadGroupCriteria();
      } catch (error) {
        showToast('Ошибка: ' + error.message, true);
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  if (removeBtn && removeDropdown) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeDropdown.classList.toggle('hidden');
    });
    
    document.addEventListener('click', (e) => {
      if (!removeDropdown.contains(e.target) && e.target !== removeBtn) {
        removeDropdown.classList.add('hidden');
      }
    });
  }
}

async function loadGroupCriteria() {
  if (!currentGroupId) return;
  
  try {
    const criteria = await groupsAPI.getCriteria(currentGroupId);
    renderCriteriaList(criteria);
    renderCriteriaDropdown(criteria);
  } catch (error) {
    console.warn('Не удалось загрузить критерии:', error.message);
  }
}

function renderCriteriaList(criteria) {
  const container = document.getElementById('criteriaListArea');
  if (!container) return;
  
  if (criteria.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400">Критерии оценки не настроены</p>';
    return;
  }
  
  container.innerHTML = criteria.map(c => `
    <div class="flex items-start gap-3 p-3 border border-purple-200 rounded bg-purple-50" data-criterion-id="${c.id}">
      <div class="flex-1">
        <div class="font-medium text-sm text-gray-800">${escapeHtml(c.name)}</div>
        ${c.description ? `<div class="text-xs text-gray-500 mt-0.5">${escapeHtml(c.description)}</div>` : ''}
      </div>
      <span class="text-xs text-purple-600 font-medium bg-purple-100 px-2 py-0.5 rounded">0–${c.max_score || 10}</span>
    </div>
  `).join('');
}

function renderCriteriaDropdown(criteria) {
  const dropdown = document.getElementById('removeCriterionDropdown');
  if (!dropdown) return;
  
  if (criteria.length === 0) {
    dropdown.innerHTML = '<div class="px-3 py-2 text-sm text-gray-500">Нет критериев</div>';
    return;
  }
  
  dropdown.innerHTML = criteria.map(c => `
    <div class="remove-criterion-option px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 cursor-pointer border-b border-orange-100"
         data-criterion-id="${c.id}" data-criterion-name="${escapeHtml(c.name)}">
      ${escapeHtml(c.name)}
    </div>
  `).join('');
  
  dropdown.querySelectorAll('.remove-criterion-option').forEach(opt => {
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      const criterionId = opt.dataset.criterionId;
      const criterionName = opt.dataset.criterionName;
      
      if (confirm(`Удалить критерий «${criterionName}»?`)) {
        try {
          await groupsAPI.deleteCriterion(currentGroupId, criterionId);
          showToast(`Критерий «${criterionName}» удалён`);
          await loadGroupCriteria();
        } catch (error) {
          showToast('Ошибка удаления: ' + error.message, true);
        }
      }
      dropdown.classList.add('hidden');
    });
  });
}

// ── Создание группы ──
const createGroupBtn = document.getElementById('createGroupBtn');
if (createGroupBtn) {
  createGroupBtn.onclick = async () => {
    const nameInput = document.getElementById('newGroupName');
    const name = nameInput?.value.trim();
    if (!name) { showToast('Введите название группы', true); return; }

    const activeModeBtn = document.querySelector('.mode-btn.is-active');
    const modeMap = { expert: 'classic', peer: 'p2p', contest: 'classic' };
    const groupMode = modeMap[activeModeBtn?.dataset.mode] || 'classic';

    let countOfInspectors = 1;
    if (activeModeBtn?.dataset.mode === 'peer') {
      const countInput = document.getElementById('p2pInspectorsCount');
      countOfInspectors = parseInt(countInput?.value) || 2;
      if (countOfInspectors < 1) countOfInspectors = 1;
      if (countOfInspectors > 10) countOfInspectors = 10;
    }

    createGroupBtn.disabled = true;
    createGroupBtn.textContent = 'Создание...';

    try {
      const newGroup = await groupsAPI.createGroup(name, groupMode, countOfInspectors);
      showToast(`Группа "${name}" создана!`);
      if (nameInput) nameInput.value = '';

      const inviteBlock = document.getElementById('inviteLinksBlock');
      if (inviteBlock) inviteBlock.classList.remove('hidden');

      const baseUrl = window.location.origin;
      const studentField = document.getElementById('studentInviteField');
      const expertField = document.getElementById('expertInviteField');
      if (studentField && newGroup.student_invite_token) {
        studentField.value = `${baseUrl}/group.html?join=${newGroup.student_invite_token}`;
      }
      if (expertField && newGroup.reviewer_invite_token) {
        expertField.value = `${baseUrl}/group.html?join=${newGroup.reviewer_invite_token}`;
      }

      await loadGroups();
    } catch (error) {
      showToast('Ошибка создания группы: ' + error.message, true);
    } finally {
      createGroupBtn.disabled = false;
      createGroupBtn.textContent = 'Создать новую группу';
    }
  };
}

// ── Добавить эксперта ──
const addExpertBtn = document.getElementById('addExpertBtn');
if (addExpertBtn) {
  addExpertBtn.onclick = async () => {
    if (!currentGroupId) return;
    const group = groupsList.find(g => g.id === currentGroupId);
    const linkBlock = document.getElementById('expertLinkBlock');
    const linkField = document.getElementById('expertInviteLink');

    if (linkBlock) linkBlock.classList.remove('hidden');

    const baseUrl = window.location.origin;
    if (group && group.reviewer_invite_token && linkField) {
      linkField.value = `${baseUrl}/group.html?join=${group.reviewer_invite_token}`;
      showToast('Ссылка для приглашения эксперта готова');
    } else {
      showToast('Ссылка недоступна', true);
    }
  };
}

// ── Добавить студентов ──
const addStudentBtn = document.getElementById('addStudentBtn');
if (addStudentBtn) {
  addStudentBtn.onclick = async () => {
    if (!currentGroupId) return;
    const group = groupsList.find(g => g.id === currentGroupId);
    const linkBlock = document.getElementById('studentLinkBlock');
    const linkField = document.getElementById('studentInviteLink');

    if (linkBlock) linkBlock.classList.remove('hidden');

    const baseUrl = window.location.origin;
    if (group && group.student_invite_token && linkField) {
      linkField.value = `${baseUrl}/group.html?join=${group.student_invite_token}`;
      showToast('Ссылка для приглашения студентов готова');
    } else {
      showToast('Ссылка недоступна', true);
    }
  };
}

// ── Удалить участника ──
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

// ── Перейти к проверке ──
const goToReviewBtn = document.getElementById('goToReviewBtn');
if (goToReviewBtn) {
  goToReviewBtn.onclick = () => {
    if (!currentGroupId) {
      showToast('Сначала выберите группу', true);
      return;
    }
    const group = groupsList.find(g => g.id === currentGroupId);
    const isContest = group?.name?.includes('конкурс') || false;
    const modeParam = isContest ? '&mode=contest' : '';
    window.location.href = `review.html?group=${currentGroupId}${modeParam}`;
  };
}

// ── Отправить на проверку (организатор) ──
const sendForReviewBtn = document.getElementById('sendForReviewBtn');
if (sendForReviewBtn) {
  sendForReviewBtn.onclick = async () => {
    const link = document.getElementById('projectLinkInput')?.value.trim();
    if (!link) {
      showToast('Введите ссылку на проект', true);
      return;
    }
    if (!currentGroupId) {
      showToast('Сначала выберите группу', true);
      return;
    }

    sendForReviewBtn.disabled = true;
    sendForReviewBtn.textContent = 'Отправка...';

    try {
      await groupsAPI.submitWork(link, currentGroupId);
      showToast('Проект отправлен на проверку');
      document.getElementById('projectLinkInput').value = '';
    } catch (error) {
      showToast('Ошибка отправки: ' + error.message, true);
    } finally {
      sendForReviewBtn.disabled = false;
      sendForReviewBtn.textContent = 'Отправить на проверку';
    }
  };
}

// ── Отправить на проверку (студент) ──
const studentSendForReviewBtn = document.getElementById('studentSendForReviewBtn');
if (studentSendForReviewBtn) {
  studentSendForReviewBtn.onclick = async () => {
    const link = document.getElementById('studentProjectLink')?.value.trim();
    if (!link) {
      showToast('Введите ссылку на проект', true);
      return;
    }
    if (!currentGroupId) {
      showToast('Сначала выберите группу', true);
      return;
    }

    studentSendForReviewBtn.disabled = true;
    studentSendForReviewBtn.textContent = 'Отправка...';

    try {
      await groupsAPI.submitWork(link, currentGroupId);
      showToast('Проект отправлен на проверку');
      document.getElementById('studentProjectLink').value = '';
      await loadStudentSubmission();
    } catch (error) {
      showToast('Ошибка отправки: ' + error.message, true);
    } finally {
      studentSendForReviewBtn.disabled = false;
      studentSendForReviewBtn.textContent = 'Отправить на проверку';
    }
  };
}

// ── Обновить ссылку (студент) ──
const studentUpdateLinkBtn = document.getElementById('studentUpdateLinkBtn');
if (studentUpdateLinkBtn) {
  studentUpdateLinkBtn.onclick = async () => {
    const newLink = document.getElementById('studentNewLinkInput')?.value.trim();
    if (!newLink) {
      showToast('Введите новую ссылку', true);
      return;
    }
    if (!currentStudentSubmission) {
      showToast('Нет работы для обновления', true);
      return;
    }

    try {
      await groupsAPI.updateSubmissionLink(currentStudentSubmission.submission_id, newLink);
      showToast('Ссылка обновлена');
      document.getElementById('studentNewLinkInput').value = '';
      await loadStudentSubmission();
    } catch (error) {
      showToast('Ошибка обновления: ' + error.message, true);
    }
  };
}

// ── Назад к группам ──
const backBtn = document.getElementById('backToGroupsBtn');
if (backBtn) {
  backBtn.onclick = async () => {
    showSection('groups');
    await loadGroups();
  };
}

// ── Обработка invite-токена ──
async function handleInviteToken() {
  const params = new URLSearchParams(window.location.search);
  const joinToken = params.get('join');
  if (!joinToken) return;

  if (!authAPI.isAuthenticated()) {
    localStorage.setItem('pending_join_token', joinToken);
    window.location.href = 'index.html';
    return;
  }

  try {
    const result = await groupsAPI.joinGroupByToken(joinToken);
    showToast(result.message || 'Вы присоединились к группе');
    window.history.replaceState({}, document.title, window.location.pathname);
    localStorage.removeItem('pending_join_token');
    await loadGroups();
  } catch (error) {
    showToast('Ошибка присоединения: ' + error.message, true);
    localStorage.removeItem('pending_join_token');
  }
}

// ── Загрузка работы студента ──
async function loadStudentSubmission() {
  if (!currentGroupId) return;
  
  try {
    const reviews = await groupsAPI.getMyReviews();
    const user = await usersAPI.getMe();
    const mySubmission = reviews.find(r => r.student_id === user.id && r.group_id == currentGroupId);
    
    if (mySubmission) {
      currentStudentSubmission = mySubmission;
      showStudentWorkBlock(mySubmission);
    } else {
      showStudentSubmitBlock();
    }
  } catch (error) {
    showStudentSubmitBlock();
  }
}

function showStudentWorkBlock(submission) {
  const submitBlock = document.getElementById('studentSubmitBlock');
  const workBlock = document.getElementById('studentCurrentWorkBlock');
  const linkEl = document.getElementById('studentCurrentLink');
  const statusEl = document.getElementById('studentWorkStatus');
  
  if (submitBlock) submitBlock.classList.add('hidden');
  if (workBlock) workBlock.classList.remove('hidden');
  
  if (linkEl) {
    linkEl.href = submission.link;
    linkEl.innerText = submission.link;
  }
  
  if (statusEl) {
    const statusText = {
      'pending': 'На проверке',
      'graded': 'Проверено',
      'reviewing': 'Проверяется'
    };
    statusEl.innerText = statusText[submission.status] || submission.status;
    statusEl.className = `text-xs px-2 py-0.5 rounded ${
      submission.status === 'graded' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
    }`;
  }
  
  const updateBtn = document.getElementById('studentUpdateLinkBtn');
  const newLinkInput = document.getElementById('studentNewLinkInput');
  if (submission.status === 'graded') {
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (newLinkInput) newLinkInput.disabled = true;
  } else {
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    if (newLinkInput) newLinkInput.disabled = false;
  }
}

function showStudentSubmitBlock() {
  const submitBlock = document.getElementById('studentSubmitBlock');
  const workBlock = document.getElementById('studentCurrentWorkBlock');
  
  if (submitBlock) submitBlock.classList.remove('hidden');
  if (workBlock) workBlock.classList.add('hidden');
}

// ── Инициализация ──
async function init() {
  await loadCurrentUser();
  await loadGroups();
  await handleInviteToken();
  setupModeSelector();
  setupCriteriaManager();
}

init();