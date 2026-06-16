import { authAPI, usersAPI, groupsAPI } from './api.js';

let currentGroupId = null;
let currentUserRole = null;
let groupsList = [];
let currentStudentSubmission = null;
let currentGroupMode = "classic";

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


function normalizeRole(role) {
  if (!role) return 'member';
  return role.toLowerCase();
}

function normalizeGroupMode(mode) {
  if (!mode) return 'classic';
  return mode.toLowerCase();
}


function getDisplayRole(role, groupMode) {
  const normalizedRole = normalizeRole(role);
  const normalizedMode = normalizeGroupMode(groupMode);

  if (!normalizedRole) return 'участник';


  if (normalizedMode === 'contest' && (normalizedRole === 'expert' || normalizedRole === 'reviewer')) {
    return 'жюри';
  }

  const roleMap = {
    'organizer': 'организатор',
    'creator': 'организатор',
    'expert': 'эксперт',
    'reviewer': 'эксперт',
    'student': 'студент',
    'member': 'участник',
    'jury': 'жюри'
  };

  return roleMap[normalizedRole] || normalizedRole;
}


const INVITE_TOKENS_KEY = 'feedback_group_invite_tokens';

function getStoredInviteTokens() {
  try {
    const raw = localStorage.getItem(INVITE_TOKENS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveInviteTokens(groupId, reviewerToken, studentToken) {
  const tokens = getStoredInviteTokens();
  tokens[groupId] = {
    reviewer_invite_token: reviewerToken,
    student_invite_token: studentToken,
    created_at: new Date().toISOString()
  };
  localStorage.setItem(INVITE_TOKENS_KEY, JSON.stringify(tokens));
}

function getGroupInviteTokens(groupId) {
  const tokens = getStoredInviteTokens();
  return tokens[groupId] || null;
}

function generateInviteToken() {

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function injectInviteTokens(groups) {

  const tokens = getStoredInviteTokens();
  return groups.map(g => {
    const groupTokens = tokens[g.id];
    if (groupTokens) {
      return {
        ...g,
        reviewer_invite_token: groupTokens.reviewer_invite_token,
        student_invite_token: groupTokens.student_invite_token
      };
    }
    return g;
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
    const groupsWithTokens = injectInviteTokens(groups);
    groupsList = groupsWithTokens.map(g => ({
      ...g,
      role: normalizeRole(g.role),
      group_mode: normalizeGroupMode(g.group_mode)
    }));
    renderGroupsList(groupsList);
    return groupsList;
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
      groups.forEach((group, index) => {
        const isActive = group.id === activeId;
        const groupMode = group.group_mode || 'classic';
        const displayRole = getDisplayRole(group.role, groupMode);

        const nameText = escapeHtml(group.name);
        const roleText = escapeHtml(displayRole);

        const div = document.createElement('div');
        div.className = `border-2 ${isActive ? 'border-purple-700 bg-purple-50' : 'border-purple-500 bg-white'} p-3 flex justify-between items-center cursor-pointer group-item`;
        div.setAttribute('data-group-id', group.id);
        div.innerHTML = `
          <span class="text-sm font-medium ${isActive ? 'text-purple-900' : 'text-gray-800'} group-name">${nameText}</span>
          <div class="group-divider"></div>
          <span class="text-sm ${isActive ? 'text-purple-800' : 'text-gray-600'} group-role">${roleText}</span>
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

function setUserRole(role, groupMode = 'classic') {
  const normalizedRole = normalizeRole(role);
  const normalizedMode = normalizeGroupMode(groupMode);

  currentUserRole = normalizedRole;
  currentGroupMode = normalizedMode;

  const organizerActions = document.getElementById('organizerActions');
  const expertActions = document.getElementById('expertActions');
  const studentActions = document.getElementById('studentActions');
  const organizerTitle = document.getElementById('organizerTitle');



  if (organizerActions) organizerActions.classList.add('hidden');
  if (expertActions) expertActions.classList.add('hidden');
  if (studentActions) studentActions.classList.add('hidden');


  document.querySelectorAll('.role-organizer-only').forEach(el => el.classList.add('hidden'));


  if (normalizedRole === 'organizer' || normalizedRole === 'creator') {
    if (organizerActions) organizerActions.classList.remove('hidden');
    document.querySelectorAll('.role-organizer-only').forEach(el => el.classList.remove('hidden'));
  }

  if (normalizedRole === 'expert' || normalizedRole === 'reviewer' || normalizedRole === 'jury') {
    if (expertActions) expertActions.classList.remove('hidden');
  }

  if (normalizedRole === 'student' || normalizedRole === 'member') {
    if (studentActions) studentActions.classList.remove('hidden');
  }


  if (normalizedRole === 'organizer' || normalizedRole === 'creator') {
    if (expertActions) expertActions.classList.remove('hidden');
    if (studentActions) studentActions.classList.remove('hidden');
  }


  setupOrganizerButtonsByMode(normalizedMode);
  setupStudentButtonsByMode(normalizedMode);


  if (normalizedMode === 'contest') {
    const btn = document.getElementById('goToReviewBtn');
    if (btn) btn.innerText = 'Перейти к голосованию';
  } else {
    const btn = document.getElementById('goToReviewBtn');
    if (btn) btn.innerText = 'Перейти к проверке работ';
  }


  const ratingBtnBlock = document.getElementById('ratingBtnBlock');
  const studentRatingBlock = document.getElementById('studentRatingBlock');

  if (normalizedMode === 'contest') {
    if (ratingBtnBlock) ratingBtnBlock.classList.remove('hidden');
    if (studentRatingBlock) studentRatingBlock.classList.remove('hidden');
  } else {
    if (ratingBtnBlock) ratingBtnBlock.classList.add('hidden');
    if (studentRatingBlock) studentRatingBlock.classList.add('hidden');
  }
}

function setupOrganizerButtonsByMode(groupMode) {
  const addExpertBlock = document.getElementById('addExpertBlock');
  const addExpertBtnText = document.getElementById('addExpertBtnText');

  if (!addExpertBlock) return;

  if (groupMode === 'p2p') {
    addExpertBlock.classList.add('hidden');

  } else if (groupMode === 'contest') {
    addExpertBlock.classList.remove('hidden');
    if (addExpertBtnText) addExpertBtnText.innerText = 'Добавить члена жюри';
    const addStudentBlock = document.getElementById('addStudentBlock');
    if (addStudentBlock) addStudentBlock.classList.remove('hidden');

  } else {
    addExpertBlock.classList.remove('hidden');
    if (addExpertBtnText) addExpertBtnText.innerText = 'Добавить эксперта';
  }
}

function setupStudentButtonsByMode(groupMode) {
  const studentGoToReviewBtn = document.getElementById('studentGoToReviewBtn');

  if (studentGoToReviewBtn) {
    if (groupMode === 'p2p') {
      studentGoToReviewBtn.classList.remove('hidden');
    } else {
      studentGoToReviewBtn.classList.add('hidden');
    }
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


    const expertBlock = document.getElementById('expertInspectorsBlock');
    const p2pBlock = document.getElementById('p2pInspectorsBlock');
    const contestExpertBlock = document.getElementById('contestExpertInspectorsBlock');
    if (expertBlock) expertBlock.classList.remove('hidden');
    if (p2pBlock) p2pBlock.classList.add('hidden');
    if (contestExpertBlock) contestExpertBlock.classList.add('hidden');


    const modeSelector = document.getElementById('modeSelector');
    const buttons = modeSelector?.querySelectorAll('.mode-btn');
    if (buttons) {
      buttons.forEach(b => b.classList.remove('is-active'));
      if (buttons[0]) buttons[0].classList.add('is-active');
    }
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
    const groupMode = group.group_mode || 'classic';

    setUserRole(userRole, groupMode);

    if (userRole === 'student' || userRole === 'member') {
      await loadStudentSubmission();
    }

    const currentGroupNameSpan = document.getElementById('currentGroupNameSpan');
    if (currentGroupNameSpan) currentGroupNameSpan.innerText = group.name;

    const members = await groupsAPI.getMembers(groupId);
    renderMembers(members, groupMode);

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

function renderMembers(members, groupMode = 'classic') {
  const container = document.getElementById('membersListArea');
  if (!container) return;

  if (!members || members.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Участники не добавлены</p>';
    return;
  }

  const normalizedMode = normalizeGroupMode(groupMode);

  container.innerHTML = members.map(m => {
    const fullName = (m.name + ' ' + m.surname).trim() || m.email || m.user_id;
    const displayRole = getDisplayRole(m.role, normalizedMode);

    return `
    <div class="flex justify-between items-center py-2 px-2 border-b border-gray-100 last:border-0" data-member-id="${m.user_id}">
      <span class="text-gray-800 text-sm flex-1 text-center">${escapeHtml(fullName)}</span>
      <div class="w-px h-4 bg-purple-300 mx-3"></div>
      <span class="text-gray-500 text-xs font-medium bg-gray-100 px-2 py-0.5 text-center w-24">${escapeHtml(displayRole)}</span>
    </div>
  `;
  }).join('');

  const dropdown = document.getElementById('removeMemberDropdown');
  if (dropdown) {
    dropdown.innerHTML = members.map(m => {
      const full = (m.name + ' ' + m.surname).trim() || m.email || m.user_id;
      const displayRole = getDisplayRole(m.role, normalizedMode);

      return `
        <div class="remove-member-option px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 cursor-pointer border-b border-orange-100"
             data-member-id="${m.user_id}" data-member-name="${escapeHtml(full)}">
          ${escapeHtml(full)} — ${escapeHtml(displayRole)}
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

function setupModeSelector() {
  const modeSelector = document.getElementById('modeSelector');
  const expertBlock = document.getElementById('expertInspectorsBlock');
  const p2pBlock = document.getElementById('p2pInspectorsBlock');
  const contestExpertBlock = document.getElementById('contestExpertInspectorsBlock');
  const contestStudentBlock = document.getElementById('contestStudentInspectorsBlock');

  const buttons = modeSelector?.querySelectorAll('.mode-btn');
  if (!buttons) return;


  const setVisibility = (mode) => {
    if (expertBlock) expertBlock.classList.toggle('hidden', mode !== 'expert');
    if (p2pBlock) p2pBlock.classList.toggle('hidden', mode !== 'peer');
    if (contestExpertBlock) contestExpertBlock.classList.toggle('hidden', mode !== 'contest');
    if (contestStudentBlock) contestStudentBlock.classList.toggle('hidden', mode !== 'contest');
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      setVisibility(btn.dataset.mode);
    });
  });


  if (buttons.length > 0) {
    buttons[0].classList.add('is-active');
    setVisibility(buttons[0].dataset.mode);
  }
}

function setupCriteriaManager() {
  const addBtn = document.getElementById('addCriterionBtn');
  const addDescBtn = document.getElementById('addCriterionDescBtn');
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

  if (addDescBtn) {
    addDescBtn.addEventListener('click', () => {
      formBlock?.classList.remove('hidden');
      document.getElementById('criterionDescInput')?.focus();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      formBlock?.classList.add('hidden');
      document.getElementById('criterionNameInput').value = '';
      document.getElementById('criterionDescInput').value = '';
      document.getElementById('criterionMaxScoreInput').value = '10';
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const name = document.getElementById('criterionNameInput')?.value.trim();
      const description = document.getElementById('criterionDescInput')?.value.trim() || null;
      const maxScore = parseInt(document.getElementById('criterionMaxScoreInput')?.value) || 10;

      if (!name) {
        showToast('Введите название критерия', true);
        return;
      }

      if (!currentGroupId) {
        showToast('Сначала выберите группу', true);
        return;
      }

      if (maxScore < 1 || maxScore > 100) {
        showToast('Максимальный балл должен быть от 1 до 100', true);
        return;
      }

      const criterionData = { name, description, max_score: maxScore };

      saveBtn.disabled = true;
      try {
        await groupsAPI.createCriterion(currentGroupId, criterionData);
        showToast(`Критерий "${name}" добавлен (макс. ${maxScore} баллов)`);
        formBlock?.classList.add('hidden');
        document.getElementById('criterionNameInput').value = '';
        document.getElementById('criterionDescInput').value = '';
        document.getElementById('criterionMaxScoreInput').value = '10';
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

function getBallWord(num) {
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'баллов';
  if (lastDigit === 1) return 'балл';
  if (lastDigit >= 2 && lastDigit <= 4) return 'балла';
  return 'баллов';
}

function renderCriteriaList(criteria) {
  const container = document.getElementById('criteriaListArea');
  if (!container) return;

  if (criteria.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400">Критерии оценки не настроены</p>';
    return;
  }

  container.innerHTML = criteria.map(c => {
    const max = c.max_score || 10;
    const ballWord = getBallWord(max);

    return `
    <div class="flex items-start gap-3 p-3 border border-purple-200 rounded bg-purple-50" data-criterion-id="${c.id}">
      <div class="flex-1">
        <div class="font-medium text-sm text-gray-800">${escapeHtml(c.name)}</div>
        ${c.description ? `<div class="text-xs text-gray-500 mt-0.5">${escapeHtml(c.description)}</div>` : ''}
      </div>
      <span class="text-xs text-purple-600 font-medium bg-purple-100 px-2 py-0.5 rounded whitespace-nowrap">0–${max} ${ballWord}</span>
    </div>
  `;
  }).join('');
}

function renderCriteriaDropdown(criteria) {
  const dropdown = document.getElementById('removeCriterionDropdown');
  if (!dropdown) return;

  if (criteria.length === 0) {
    dropdown.innerHTML = '<div class="px-3 py-2 text-sm text-gray-500">Нет критериев</div>';
    return;
  }

  dropdown.innerHTML = criteria.map(c => {
    const max = c.max_score || 10;
    const ballWord = getBallWord(max);
    return `
    <div class="remove-criterion-option px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 cursor-pointer border-b border-orange-100"
         data-criterion-id="${c.id}" data-criterion-name="${escapeHtml(c.name)}">
      ${escapeHtml(c.name)} (макс. ${max} ${ballWord})
    </div>
  `;
  }).join('');

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

const createGroupBtn = document.getElementById('createGroupBtn');
if (createGroupBtn) {
  createGroupBtn.onclick = async () => {
    const nameInput = document.getElementById('newGroupName');
    const name = nameInput?.value.trim();
    if (!name) { showToast('Введите название группы', true); return; }

    const activeModeBtn = document.querySelector('.mode-btn.is-active');
    const modeMap = { expert: 'classic', peer: 'p2p', contest: 'contest' };
    const groupMode = modeMap[activeModeBtn?.dataset.mode] || 'classic';

    let countOfInspectorsExpert = 1;
    let countOfInspectorsStudent = 1;

    if (groupMode === 'classic') {
      const countInput = document.getElementById('expertInspectorsCount');
      countOfInspectorsExpert = parseInt(countInput?.value) || 1;
      if (countOfInspectorsExpert < 1) countOfInspectorsExpert = 1;
      if (countOfInspectorsExpert > 10) countOfInspectorsExpert = 10;
      countOfInspectorsStudent = 0;

    } else if (groupMode === 'p2p') {
      const countInput = document.getElementById('p2pInspectorsCount');
      countOfInspectorsStudent = parseInt(countInput?.value) || 2;
      if (countOfInspectorsStudent < 1) countOfInspectorsStudent = 1;
      if (countOfInspectorsStudent > 10) countOfInspectorsStudent = 10;
      countOfInspectorsExpert = 0;

    } else if (groupMode === 'contest') {
      const expertInput = document.getElementById('contestExpertInspectorsCount');
      const studentInput = document.getElementById('contestStudentInspectorsCount');

      countOfInspectorsExpert = parseInt(expertInput?.value) || 1;
      countOfInspectorsStudent = parseInt(studentInput?.value) || 1;

      if (countOfInspectorsExpert < 1) countOfInspectorsExpert = 1;
      if (countOfInspectorsExpert > 10) countOfInspectorsExpert = 10;
      if (countOfInspectorsStudent < 1) countOfInspectorsStudent = 1;
      if (countOfInspectorsStudent > 10) countOfInspectorsStudent = 10;
    }

    createGroupBtn.disabled = true;
    createGroupBtn.textContent = 'Создание...';

    let expertCount = 0;
    let studentCount = 0;

    if (groupMode === 'classic') {
      expertCount = countOfInspectorsExpert;
      studentCount = 0;
    } else if (groupMode === 'p2p') {
      expertCount = 0;
      studentCount = countOfInspectorsStudent;
    } else {
      expertCount = countOfInspectorsExpert;
      studentCount = countOfInspectorsStudent;
    }

    try {
      const newGroup = await groupsAPI.createGroup(
        name,
        groupMode,
        expertCount,
        studentCount
      );
      showToast(`Группа "${name}" создана!`);
      if (nameInput) nameInput.value = '';



      if (newGroup && newGroup.id) {
        const reviewerToken = newGroup.reviewer_invite_token || generateInviteToken();
        const studentToken = newGroup.student_invite_token || generateInviteToken();
        saveInviteTokens(newGroup.id, reviewerToken, studentToken);
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

const addExpertBtn = document.getElementById('addExpertBtn');
if (addExpertBtn) {
  addExpertBtn.onclick = async () => {
    if (!currentGroupId) return;
    const group = groupsList.find(g => g.id === currentGroupId);
    const linkField = document.getElementById('expertInviteLink');

    if (linkField) {
      const baseUrl = window.location.origin;


      let reviewerToken = group?.reviewer_invite_token;
      if (!reviewerToken) {
        reviewerToken = generateInviteToken();
        saveInviteTokens(currentGroupId, reviewerToken, group?.student_invite_token || generateInviteToken());

        group.reviewer_invite_token = reviewerToken;
      }

      linkField.value = `${baseUrl}/group.html?join=${reviewerToken}`;
      linkField.classList.remove('hidden');
      showToast(currentGroupMode === 'contest' ? 'Ссылка для приглашения жюри готова' : 'Ссылка для приглашения эксперта готова');
    }
  };
}

const addStudentBtn = document.getElementById('addStudentBtn');
if (addStudentBtn) {
  addStudentBtn.onclick = async () => {
    if (!currentGroupId) return;
    const group = groupsList.find(g => g.id === currentGroupId);
    const linkField = document.getElementById('studentInviteLink');

    if (linkField) {
      const baseUrl = window.location.origin;


      let studentToken = group?.student_invite_token;
      if (!studentToken) {
        studentToken = generateInviteToken();
        saveInviteTokens(currentGroupId, group?.reviewer_invite_token || generateInviteToken(), studentToken);

        group.student_invite_token = studentToken;
      }

      linkField.value = `${baseUrl}/group.html?join=${studentToken}`;
      linkField.classList.remove('hidden');
      showToast('Ссылка для приглашения студентов готова');
    }
  };
}

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

const goToReviewBtn = document.getElementById('goToReviewBtn');
if (goToReviewBtn) {
  goToReviewBtn.onclick = () => {
    if (!currentGroupId) {
      showToast('Сначала выберите группу', true);
      return;
    }
    if (!authAPI.isAuthenticated()) {
      showToast('Необходимо авторизоваться', true);
      return;
    }
    const modeParam = currentGroupMode === 'contest' ? '&mode=contest' : '';
    window.location.href = `review.html?group=${currentGroupId}${modeParam}`;
  };
}

const viewRatingBtn = document.getElementById('viewRatingBtn');
if (viewRatingBtn) {
  viewRatingBtn.onclick = () => {
    if (!currentGroupId) {
      showToast('Сначала выберите группу', true);
      return;
    }
    window.location.href = `rating.html?group=${currentGroupId}`;
  };
}

const studentViewRatingBtn = document.getElementById('studentViewRatingBtn');
if (studentViewRatingBtn) {
  studentViewRatingBtn.onclick = () => {
    if (!currentGroupId) {
      showToast('Сначала выберите группу', true);
      return;
    }
    window.location.href = `rating.html?group=${currentGroupId}`;
  };
}

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
      const result = await groupsAPI.submitWork(link, currentGroupId);

      if (result && result.id) {
        saveSubmissionId(result.id, currentGroupId, link);
      }

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

      const stored = getStoredSubmissions();
      const idx = stored.findIndex(s => s.submission_id === currentStudentSubmission.submission_id);
      if (idx !== -1) {
        stored[idx].link = newLink;
        localStorage.setItem('my_submissions', JSON.stringify(stored));
      }

      await loadStudentSubmission();
    } catch (error) {
      showToast('Ошибка обновления: ' + error.message, true);
    }
  };
}

const studentGoToReviewBtn = document.getElementById('studentGoToReviewBtn');
if (studentGoToReviewBtn) {
  studentGoToReviewBtn.onclick = () => {
    if (!currentGroupId) {
      showToast('Сначала выберите группу', true);
      return;
    }
    window.location.href = `review.html?group=${currentGroupId}&mode=p2p`;
  };
}

const backBtn = document.getElementById('backToGroupsBtn');
if (backBtn) {
  backBtn.onclick = async () => {
    const inviteBlock = document.getElementById('inviteLinksBlock');
    if (inviteBlock) inviteBlock.classList.add('hidden');

    const studentField = document.getElementById('studentInviteField');
    const expertField = document.getElementById('expertInviteField');
    if (studentField) studentField.value = '';
    if (expertField) expertField.value = '';

    showSection('groups');
    await loadGroups();
  };
}

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


function getStoredSubmissions() {
  try {
    const raw = localStorage.getItem('my_submissions');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSubmissionId(submissionId, groupId, link) {
  const stored = getStoredSubmissions();
  if (!stored.find(s => s.submission_id === submissionId)) {
    stored.push({
      submission_id: submissionId,
      group_id: groupId,
      link: link,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('my_submissions', JSON.stringify(stored));
  }
}

async function loadStudentSubmission() {
  if (!currentGroupId) return;

  try {
    // 1. Получаем базовую инфу о своей работе
    const myWork = await groupsAPI.getMyWork(currentGroupId);

    if (!myWork || !myWork.id) {
      showStudentSubmitBlock();
      return;
    }

    // 2. Получаем полные детали для точного статуса
    let details = null;
    try {
      details = await groupsAPI.getSubmission(myWork.id);
    } catch (e) {
      console.warn('Не удалось загрузить детали работы:', e.message);
    }

    const status = details?.status || 'pending';

    currentStudentSubmission = {
      submission_id: myWork.id,
      link: myWork.link,
      status: status,           // "pending" или "graded"
      score: myWork.score || 0, // число или 0
      group_id: currentGroupId
    };

    showStudentWorkBlock(currentStudentSubmission);

  } catch (error) {
    // 404 = работа не загружена
    if (error.message && (error.message.includes('404') || error.message.includes('не загрузили'))) {
      showStudentSubmitBlock();
    } else {
      console.warn('Ошибка загрузки работы:', error.message);
      showStudentSubmitBlock();
    }
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
    let statusText, statusClass;

    if (submission.status === 'graded' || submission.score > 0) {
      // Проверено — показываем балл
      const ballWord = getBallWord(Math.round(submission.score));
      statusText = `Проверено: ${submission.score.toFixed(1)} ${ballWord}`;
      statusClass = 'bg-green-100 text-green-700';
    } else if (submission.status === 'pending') {
      // Назначены проверяющие, ожидает оценки
      statusText = 'На проверке';
      statusClass = 'bg-orange-100 text-orange-700';
    } else {
      // Создана, но проверяющие ещё не назначены (или другой статус)
      statusText = 'Отправлено';
      statusClass = 'bg-blue-100 text-blue-700';
    }

    statusEl.innerText = statusText;
    statusEl.className = `text-xs px-2 py-0.5 rounded ${statusClass}`;
  }

  // === ЛОГИКА РАЗБЛОКИРОВКИ КНОПКИ ОБНОВЛЕНИЯ ===
  const updateBtn = document.getElementById('studentUpdateLinkBtn');
  const newLinkInput = document.getElementById('studentNewLinkInput');

  // Можно менять ссылку только если работа НЕ проверена
  const canEdit = submission.status !== 'graded' && submission.score === 0;

  if (updateBtn) {
    updateBtn.disabled = !canEdit;
    if (!canEdit) {
      updateBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      updateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  if (newLinkInput) {
    newLinkInput.disabled = !canEdit;
    if (!canEdit) {
      newLinkInput.placeholder = 'Работа проверена — изменение недоступно';
    } else {
      newLinkInput.placeholder = 'новая ссылка';
    }
  }
}

function showStudentSubmitBlock() {
  const submitBlock = document.getElementById('studentSubmitBlock');
  const workBlock = document.getElementById('studentCurrentWorkBlock');

  if (submitBlock) submitBlock.classList.remove('hidden');
  if (workBlock) workBlock.classList.add('hidden');
}

async function init() {
  setupModeSelector();
  setupCriteriaManager();


  showSection('groups');
  await loadGroups();
  await handleInviteToken();
}

init();