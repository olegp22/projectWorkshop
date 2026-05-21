import { authAPI, usersAPI, groupsAPI } from './api.js';

let currentDate = new Date();
let events = [];
let selectedParticipants = [];
let activeEventBlock = null;
let lastClickedEventElement = null;

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `fixed top-5 right-5 px-5 py-3 rounded-md text-white text-sm z-50 animate-slide-in ${isError ? 'bg-red-600' : 'bg-gray-800'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function loadCurrentUser() {
  try {
    const user = await usersAPI.getMe();
    const displayName = (user.name && user.surname)
      ? `${user.name} ${user.surname}`
      : (user.name || user.email || 'Пользователь');
    const el = document.getElementById('headerUserName');
    if (el) el.innerText = displayName;
  } catch (error) {
    const el = document.getElementById('headerUserName');
    if (el) el.innerText = 'Гость';
    if (error.message && error.message.includes('Сессия истекла')) {
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

  // Контейнер для мероприятий со скроллом
  const eventsContainer = document.createElement('div');
  eventsContainer.className = 'cell-events-scroll overflow-y-auto mt-1';
  eventsContainer.style.maxHeight = '60px';
  cell.appendChild(eventsContainer);

  if (!isOtherMonth && dayEvents.length > 0) {
    dayEvents.forEach((evt) => {
      const evDiv = document.createElement('div');
      // Уменьшенные блоки мероприятий
      evDiv.className = 'mt-1 px-2 py-1 text-xs rounded cursor-pointer transition text-center truncate bg-white border border-orange-500 text-gray-900';
      evDiv.innerText = evt.topic;
      evDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTooltip();
        
        // Блок становится оранжевым с белым текстом
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

  tooltip.innerHTML = `
    <div class="flex justify-between items-start mb-3 pb-2 border-b border-gray-200">
      <span class="font-semibold text-gray-900 text-center flex-1 pt-1">${event.topic}</span>
      <span class="tooltip-close text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none ml-2">&times;</span>
    </div>
    <div class="space-y-1 text-sm text-gray-700">
      <div><span class="font-medium text-gray-900">Тема:</span> ${event.topic}</div>
      <div><span class="font-medium text-gray-900">Место:</span> ${event.place || '—'}</div>
      <div><span class="font-medium text-gray-900">Время начала/окончания:</span> ${event.startTime || '—'} / ${event.endTime || '—'}</div>
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
    showToast('Редактирование в разработке', true);
    closeTooltip();
  });

  tooltip.querySelector('.tooltip-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Удалить мероприятие?')) {
      events = events.filter(e => e.id !== event.id);
      renderCalendar();
      showToast('Мероприятие удалено');
    }
    closeTooltip();
  });
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
  switchSection('createEvent');
  renderParticipantsDropdown();
};

document.getElementById('cancelEventBtn').onclick = () => {
  clearEventForm();
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
      const members = await groupsAPI.getMembers(groups[0].id);
      availableParticipants = members.map(m => ({
        id: m.user_id,
        name: `${m.name || ''} ${m.surname || ''}`.trim() || m.email || `User ${m.user_id}`
      }));
    }
  } catch (error) {
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

document.getElementById('saveEventBtn').onclick = () => {
  const topic = document.getElementById('eventTopic').value.trim();
  const place = document.getElementById('eventPlace').value.trim();
  const dateStr = document.getElementById('eventDate').value.trim();
  const startTime = document.getElementById('eventTimeStart').value.trim();
  const endTime = document.getElementById('eventTimeEnd').value.trim();

  if (!topic) { showToast('Введите тему мероприятия', true); return; }
  if (!dateStr) { showToast('Введите дату', true); return; }

  const parts = dateStr.split('/');
  if (parts.length !== 3) { showToast('Неверный формат даты. Используйте ДД/ММ/ГГГГ', true); return; }

  const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

  events.push({
    id: Date.now(),
    date: formattedDate,
    topic,
    place,
    startTime,
    endTime,
    participants: selectedParticipants.map(p => p.name)
  });

  showToast('Мероприятие создано!');
  clearEventForm();
  switchSection('calendar');
  renderCalendar();
};

async function init() {
  await loadCurrentUser();
  await loadParticipants();

  const y = currentDate.getFullYear();
  const m = String(currentDate.getMonth() + 1).padStart(2, '0');
  events = [
    { id: 1, date: `${y}-${m}-02`, topic: 'мероприятие 1', place: 'Ауд. 101', startTime: '10:00', endTime: '12:00', participants: ['Участник 1', 'Участник 2'] },
    { id: 2, date: `${y}-${m}-02`, topic: 'мероприятие 2', place: 'Ауд. 102', startTime: '14:00', endTime: '16:00', participants: ['Участник 3', 'Участник 4'] },
    { id: 3, date: `${y}-${m}-02`, topic: 'мероприятие 3', place: 'Ауд. 103', startTime: '16:00', endTime: '18:00', participants: ['Участник 5'] },
    { id: 4, date: `${y}-${m}-02`, topic: 'мероприятие 4', place: 'Ауд. 104', startTime: '18:00', endTime: '20:00', participants: ['Участник 6'] },
    { id: 5, date: `${y}-${m}-04`, topic: 'мероприятие 5', place: 'Ауд. 303', startTime: '09:00', endTime: '11:00', participants: ['Участник 1', 'Участник 2', 'Участник 3', 'Участник 4', 'Участник 5'] },
  ];

  renderCalendar();
}

init();