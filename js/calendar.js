import { authAPI, usersAPI, groupsAPI, eventsAPI } from './api.js';

let currentDate = new Date();
let events = [];
let selectedParticipants = [];
let activeEventBlock = null;
let lastClickedEventElement = null;
let currentUserId = null;

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `fixed top-5 right-5 px-5 py-3 rounded-md text-white text-sm z-50 animate-slide-in ${isError ? 'bg-red-600' : 'bg-gray-800'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function getUserIdFromToken() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.user_id || null;
  } catch {
    return null;
  }
}

async function loadCurrentUser() {
  try {
    const user = await usersAPI.getMe();
    currentUserId = user.id;
    const displayName = (user.name && user.surname)
      ? `${user.name} ${user.surname}`
      : (user.name || user.email || 'Пользователь');
    const el = document.getElementById('headerUserName');
    if (el) el.innerText = displayName;
  } catch (error) {
    const el = document.getElementById('headerUserName');
    if (el) el.innerText = 'Гость';
    if (error.isAuthError || (error.message && error.message.includes('Сессия истекла'))) {
      showToast('Сессия истекла. Пожалуйста, войдите снова.', true);
      authAPI.logout();
      window.location.reload();
      return;
    }
  }
}

function closeTooltip() {
  if (activeEventBlock) {
    activeEventBlock.remove();
    activeEventBlock = null;
  }
  if (lastClickedEventElement) {
    lastClickedEventElement.classList.remove('bg-orange-500', 'text-white');
    lastClickedEventElement.classList.add('bg-white', 'text-gray-900');
    lastClickedEventElement = null;
  }
}


async function loadEventsFromServer() {
  try {
    if (!authAPI.isAuthenticated()) {
      events = loadEventsFromLocalStorage();
      return;
    }
    const serverEvents = await eventsAPI.getEvents();
    if (Array.isArray(serverEvents)) {

      events = serverEvents.map(e => ({
        id: e.id,
        date: formatDateForCalendar(new Date(e.date)),
        topic: e.description || 'Без темы',
        place: e.locaition || '',
        startTime: formatTime(new Date(e.date)),
        endTime: '',
        participants: [],
        toUserId: e.to_user_id,
        fromUserId: e.from_user_id,
        isServerEvent: true
      }));
      saveEventsToLocalStorage(events);
    }
  } catch (error) {
    if (error.isAuthError || (error.message && error.message.includes('401'))) {
      showToast('Сессия истекла. Пожалуйста, войдите снова.', true);
      authAPI.logout();
      window.location.reload();
      return;
    }
    console.warn('Не удалось загрузить события с сервера:', error.message);
    events = loadEventsFromLocalStorage();
  }
}

function formatDateForCalendar(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function loadEventsFromLocalStorage() {
  try {
    const raw = localStorage.getItem('calendar_events');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEventsToLocalStorage(eventsData) {
  try {
    localStorage.setItem('calendar_events', JSON.stringify(eventsData));
  } catch (e) {
    console.warn('Не удалось сохранить события в localStorage');
  }
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                      'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  document.getElementById('currentMonthYear').innerText = `${monthNames[month]} ${year}`;
  document.getElementById('monthYearDisplay').innerText = `${monthNames[month]} ${year}`;

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startWeekDay = firstDay.getDay();
  if (startWeekDay === 0) startWeekDay = 7;

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startWeekDay - 1; i > 0; i--) {
    const dayNum = prevMonthLastDay - i + 1;
    grid.appendChild(createCell(dayNum, true));
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = events.filter(e => e.date === dateStr);
    grid.appendChild(createCell(day, false, dayEvents));
  }

  const totalCells = grid.children.length;
  const remaining = 42 - totalCells;
  for (let day = 1; day <= remaining; day++) {
    grid.appendChild(createCell(day, true));
  }
}

function createCell(dayNum, isOtherMonth, dayEvents = []) {
  const cell = document.createElement('div');
  cell.className = 'border border-gray-300 p-2 relative bg-white';

  const numSpan = document.createElement('div');
  numSpan.className = 'text-sm font-medium mb-1 text-center ' + (isOtherMonth ? 'text-gray-400' : 'text-gray-900');
  numSpan.innerText = dayNum;
  cell.appendChild(numSpan);

  const eventsContainer = document.createElement('div');
  eventsContainer.className = 'cell-events-scroll overflow-y-auto mt-1';
  eventsContainer.style.maxHeight = '60px';
  cell.appendChild(eventsContainer);

  if (!isOtherMonth && dayEvents.length > 0) {
    dayEvents.forEach((evt) => {
      const evDiv = document.createElement('div');
      evDiv.className = 'mt-1 px-2 py-1 text-xs rounded cursor-pointer transition text-center truncate bg-white border border-orange-500 text-gray-900';
      evDiv.innerText = evt.topic;
      evDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTooltip();

        evDiv.classList.remove('bg-white', 'text-gray-900');
        evDiv.classList.add('bg-orange-500', 'text-white');
        lastClickedEventElement = evDiv;

        showEventTooltip(evt, evDiv, cell);
      });
      eventsContainer.appendChild(evDiv);
    });
  }

  return cell;
}

function showEventTooltip(event, eventElement, cellElement) {
  const tooltip = document.createElement('div');
  tooltip.className = 'absolute z-50 bg-white border-2 border-orange-500 rounded-lg shadow-lg p-4';
  tooltip.style.width = '260px';

  const participantsHtml = event.participants?.length > 0
    ? event.participants.map(p => `<li class="text-sm text-gray-700">${p}</li>`).join('')
    : '<li class="text-sm text-gray-500">Нет участников</li>';


  const recipientInfo = event.toUserId
    ? `Получатель ID: ${event.toUserId}`
    : 'Нет данных';

  tooltip.innerHTML = `
    <div class="flex justify-between items-start mb-3 pb-2 border-b border-gray-200">
      <span class="font-semibold text-gray-900 text-center flex-1 pt-1">${event.topic}</span>
      <span class="tooltip-close text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none ml-2">&times;</span>
    </div>
    <div class="space-y-1 text-sm text-gray-700">
      <div><span class="font-medium text-gray-900">Тема:</span> ${event.topic}</div>
      <div><span class="font-medium text-gray-900">Место:</span> ${event.place || '—'}</div>
      <div><span class="font-medium text-gray-900">Время начала/окончания:</span> ${event.startTime || '—'} / ${event.endTime || '—'}</div>
      <div><span class="font-medium text-gray-900">Получатель:</span> ${recipientInfo}</div>
      <div class="pt-1 flex gap-2">
        <span class="font-medium text-gray-900 whitespace-nowrap">Участники:</span>
        <ul class="list-disc list-inside ml-1">${participantsHtml}</ul>
      </div>
    </div>
    <div class="flex gap-2 mt-4 pt-2 border-t border-gray-200">
      <button class="tooltip-edit px-4 py-2 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition">Редактировать</button>
      <button class="tooltip-delete px-4 py-2 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition">Удалить</button>
    </div>
  `;

  const top = eventElement.offsetTop + eventElement.offsetHeight + 4;
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${eventElement.offsetLeft}px`;

  cellElement.appendChild(tooltip);
  activeEventBlock = tooltip;

  const tooltipRect = tooltip.getBoundingClientRect();
  if (tooltipRect.right > window.innerWidth - 20) {
    tooltip.style.left = 'auto';
    tooltip.style.right = '0';
  }

  tooltip.querySelector('.tooltip-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTooltip();
  });

  tooltip.querySelector('.tooltip-edit').addEventListener('click', (e) => {
    e.stopPropagation();

    editEvent(event);
  });

  tooltip.querySelector('.tooltip-delete').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm('Удалить мероприятие?')) {

      await deleteEventHandler(event);
    }
    closeTooltip();
  });
}


async function editEvent(event) {
  if (event.isServerEvent && event.fromUserId !== currentUserId) {
    showToast('Вы можете редактировать только свои события', true);
    closeTooltip();
    return;
  }


  document.getElementById('eventTopic').value = event.topic;
  document.getElementById('eventPlace').value = event.place || '';
  document.getElementById('eventDate').value = event.date;
  document.getElementById('eventTimeStart').value = event.startTime || '';
  document.getElementById('eventTimeEnd').value = event.endTime || '';


  window.editingEventId = event.id;

  switchSection('createEvent');
  renderParticipantsDropdown();
  closeTooltip();
}


async function deleteEventHandler(event) {
  try {
    if (event.isServerEvent) {
      await eventsAPI.deleteEvent(event.id);
      showToast('Мероприятие удалено');
    }

    events = events.filter(e => e.id !== event.id);
    saveEventsToLocalStorage(events);
    renderCalendar();
  } catch (error) {
    showToast('Ошибка удаления: ' + error.message, true);
  }
}

document.addEventListener('click', (e) => {
  if (activeEventBlock && !activeEventBlock.contains(e.target) && !e.target.closest('.bg-orange-500')) {
    closeTooltip();
  }
});

document.getElementById('prevMonthBtn').onclick = () => {
  closeTooltip();
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
};
document.getElementById('nextMonthBtn').onclick = () => {
  closeTooltip();
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
};
document.getElementById('prevYearBtn').onclick = () => {
  closeTooltip();
  currentDate.setFullYear(currentDate.getFullYear() - 1);
  renderCalendar();
};
document.getElementById('nextYearBtn').onclick = () => {
  closeTooltip();
  currentDate.setFullYear(currentDate.getFullYear() + 1);
  renderCalendar();
};

document.getElementById('addEventBtn').onclick = () => {
  closeTooltip();
  window.editingEventId = null;
  clearEventForm();
  switchSection('createEvent');
  renderParticipantsDropdown();
};

document.getElementById('cancelEventBtn').onclick = () => {
  clearEventForm();
  window.editingEventId = null;
  switchSection('calendar');
};

function switchSection(name) {
  document.querySelectorAll('.section-content').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });

  const section = document.getElementById(`section${name.charAt(0).toUpperCase() + name.slice(1)}`);
  if (section) {
    section.classList.add('active');
    section.classList.remove('hidden');
  }
}

function clearEventForm() {
  document.getElementById('eventTopic').value = '';
  document.getElementById('eventPlace').value = '';
  document.getElementById('eventDate').value = '';
  document.getElementById('eventTimeStart').value = '';
  document.getElementById('eventTimeEnd').value = '';
  selectedParticipants = [];
  renderSelectedParticipants();
}

let availableParticipants = [];

async function loadParticipants() {
  try {
    const groups = await groupsAPI.getMyGroups();
    if (groups && groups.length > 0) {
      const allMembers = [];
      const seenIds = new Set();

      for (const group of groups) {
        try {
          const members = await groupsAPI.getMembers(group.id);
          for (const m of members) {
            if (!seenIds.has(m.user_id) && m.user_id !== currentUserId) {
              seenIds.add(m.user_id);
              allMembers.push({
                id: m.user_id,
                name: `${m.name || ''} ${m.surname || ''}`.trim() || m.email || `User ${m.user_id}`
              });
            }
          }
        } catch (e) {
          console.warn(`Не удалось загрузить участников группы ${group.id}:`, e.message);
        }
      }

      availableParticipants = allMembers;
    }
  } catch (error) {
    if (error.isAuthError || (error.message && error.message.includes('401'))) {
      showToast('Сессия истекла. Пожалуйста, войдите снова.', true);
      authAPI.logout();
      window.location.reload();
      return;
    }
    console.log('Не удалось загрузить участников групп:', error.message);
    availableParticipants = [];
  }
}

function renderParticipantsDropdown() {
  const dropdown = document.getElementById('participantsDropdown');
  if (availableParticipants.length === 0) {
    dropdown.innerHTML = '<div class="px-3 py-2 text-sm text-gray-500">Нет доступных участников</div>';
    return;
  }

  dropdown.innerHTML = availableParticipants.map(p => `
    <label class="flex items-center gap-2 px-3 py-2 hover:bg-orange-50 cursor-pointer">
      <input type="checkbox" value="${p.id}" data-name="${p.name}" ${selectedParticipants.find(sp => sp.id === p.id) ? 'checked' : ''}>
      <span class="text-sm text-gray-700">${p.name}</span>
    </label>
  `).join('');

  dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.onchange = () => {
      const id = parseInt(cb.value);
      const name = cb.dataset.name;
      if (cb.checked) {
        if (!selectedParticipants.find(p => p.id === id)) selectedParticipants.push({ id, name });
      } else {
        selectedParticipants = selectedParticipants.filter(p => p.id !== id);
      }
      renderSelectedParticipants();
    };
  });
}

function renderSelectedParticipants() {
  const container = document.getElementById('selectedParticipants');
  container.innerHTML = selectedParticipants.map(p => `
    <span class="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
      ${p.name}
      <span class="remove-tag cursor-pointer font-bold hover:text-orange-600" data-id="${p.id}">&times;</span>
    </span>
  `).join('');

  container.querySelectorAll('.remove-tag').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.dataset.id);
      selectedParticipants = selectedParticipants.filter(p => p.id !== id);
      renderSelectedParticipants();
      renderParticipantsDropdown();
    };
  });
}

document.getElementById('participantsDropdownBtn').onclick = (e) => {
  e.stopPropagation();
  document.getElementById('participantsDropdown').classList.toggle('hidden');
};

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('participantsDropdown');
  const btn = document.getElementById('participantsDropdownBtn');
  if (!dropdown.contains(e.target) && e.target !== btn) dropdown.classList.add('hidden');
});


document.getElementById('saveEventBtn').onclick = async () => {
  const topic = document.getElementById('eventTopic').value.trim();
  const place = document.getElementById('eventPlace').value.trim();
  const dateStr = document.getElementById('eventDate').value.trim();
  const startTime = document.getElementById('eventTimeStart').value.trim();
  const endTime = document.getElementById('eventTimeEnd').value.trim();

  if (!topic) { showToast('Введите тему мероприятия', true); return; }
  if (!dateStr) { showToast('Выберите дату', true); return; }


  let eventDateTime = new Date(dateStr);
  if (startTime) {
    const [hours, minutes] = startTime.split(':');
    eventDateTime.setHours(parseInt(hours), parseInt(minutes));
  }


  if (window.editingEventId) {
    try {
      await eventsAPI.updateEvent(window.editingEventId, {
        to_user_id: selectedParticipants[0]?.id || currentUserId,
        date: eventDateTime.toISOString(),
        locaition: place,
        description: topic
      });


      const idx = events.findIndex(e => e.id === window.editingEventId);
      if (idx !== -1) {
        events[idx] = {
          ...events[idx],
          date: dateStr,
          topic,
          place,
          startTime,
          endTime,
          participants: selectedParticipants.map(p => p.name)
        };
      }

      showToast('Мероприятие обновлено!');
      window.editingEventId = null;
    } catch (error) {
      showToast('Ошибка обновления: ' + error.message, true);
      return;
    }
  } else {


    if (selectedParticipants.length === 0) {
      showToast('Выберите хотя бы одного участника', true);
      return;
    }

    try {

      const result = await eventsAPI.createEvent({
        to_user_id: selectedParticipants[0].id,
        date: eventDateTime.toISOString(),
        locaition: place,
        description: topic
      });


      events.push({
        id: result.id || Date.now(),
        date: dateStr,
        topic,
        place,
        startTime,
        endTime,
        participants: selectedParticipants.map(p => p.name),
        toUserId: selectedParticipants[0].id,
        fromUserId: currentUserId,
        isServerEvent: true
      });

      showToast('Мероприятие создано!');
    } catch (error) {
      showToast('Ошибка создания: ' + error.message, true);
      return;
    }
  }

  saveEventsToLocalStorage(events);
  clearEventForm();
  switchSection('calendar');
  renderCalendar();
};

async function init() {
  currentUserId = getUserIdFromToken();
  await loadCurrentUser();
  await loadParticipants();


  await loadEventsFromServer();

  renderCalendar();
}

init();