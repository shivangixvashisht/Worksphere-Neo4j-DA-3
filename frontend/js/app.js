// WorkSphere - Enterprise Frontend Logic
// DA-3: ported from the original Oracle version to the Neo4j backend.
// The REST API keeps the original paths and UPPERCASE column keys, so most of
// this file is unchanged; Neo4j-specific additions are marked "DA-3".
const API_BASE = '/api';

// DA-3: HTML-escape every database value before it is placed in innerHTML.
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// DA-3: local calendar date (the original used toISOString(), which is the UTC date
// and shows "yesterday" in India between 00:00 and 05:30 IST).
function localDateStr(d = new Date()) {
  const pad = v => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Application State
let state = {
  spaces: [],
  plans: [],
  rooms: [],
  members: [],
  bookings: [],
  payments: [],
  activeCategoryFilter: 'ALL',
  selectedTimelineRoomId: null,
  timelineDate: localDateStr(),
  selectedStartHour: null,
  selectedEndHour: null,
  checkoutData: null,
  appliedPromo: null,
  selectedPaymentMethod: 'UPI'
};

// ====================================================================
// TOAST NOTIFICATIONS & TAB NAVIGATION
// ====================================================================

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-rose-600' : 'bg-sky-600');
  const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info');

  toast.className = `${bgColor} text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs transition-all transform duration-300 translate-y-2 opacity-0 pointer-events-auto border border-white/10`;
  toast.innerHTML = `
    <i class="fa-solid ${icon} text-base"></i>
    <div class="flex-1 font-semibold">${esc(message)}</div>
    <button onclick="this.parentElement.remove()" class="text-white/70 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

  const targetSection = document.getElementById(`tab-${tabId}`);
  const targetBtn = document.getElementById(`tab-btn-${tabId}`);

  if (targetSection) targetSection.classList.remove('hidden');
  if (targetBtn) targetBtn.classList.add('active');

  // If switching to timeline, ensure grid is rendered
  if (tabId === 'timeline') {
    renderTimelineGrid();
  }
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ====================================================================
// DATA INITIALIZATION & SYNC
// ====================================================================

async function refreshAllData() {
  await Promise.all([
    loadStats(),
    loadSpaces(),
    loadPlans(),
    loadRooms(),
    loadMembers(),
    loadBookings(),
    loadPayments()
  ]);
  renderDashboard();
  renderCatalog();
  renderTimelineGrid();
}

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('stat-spaces').textContent = data.stats.totalSpaces;
      document.getElementById('stat-rooms').textContent = data.stats.availableRooms;
      document.getElementById('stat-bookings').textContent = data.stats.activeBookings;
      document.getElementById('stat-revenue').textContent = `₹ ${Number(data.stats.totalRevenue).toLocaleString()}`;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadSpaces() {
  try {
    const res = await fetch(`${API_BASE}/spaces`);
    const data = await res.json();
    if (data.success) {
      state.spaces = data.data;
      const spaceSelect = document.getElementById('room-space-id');
      if (spaceSelect) {
        spaceSelect.innerHTML = state.spaces.map(s => `
          <option value="${esc(s.SPACE_ID)}">${esc(s.NAME)} (${esc(s.CITY)})</option>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load spaces:', err);
  }
}

async function loadPlans() {
  try {
    const res = await fetch(`${API_BASE}/members/plans`);
    const data = await res.json();
    if (data.success) {
      state.plans = data.data;
      const planSelect = document.getElementById('member-plan-id');
      if (planSelect) {
        planSelect.innerHTML = `<option value="">-- None / Pay per use --</option>` + state.plans.map(p => `
          <option value="${esc(p.PLAN_ID)}">${esc(p.PLAN_NAME)} (₹${esc(p.MONTHLY_FEE)}/mo)</option>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load plans:', err);
  }
}

async function loadRooms() {
  try {
    const res = await fetch(`${API_BASE}/rooms`);
    const data = await res.json();
    if (data.success) {
      state.rooms = data.data;
      if (!state.selectedTimelineRoomId && state.rooms.length > 0) {
        state.selectedTimelineRoomId = state.rooms[0].ROOM_ID;
      }
      populateTimelineRoomDropdown();
    }
  } catch (err) {
    console.error('Failed to load rooms:', err);
  }
}

async function loadMembers() {
  try {
    const res = await fetch(`${API_BASE}/members`);
    const data = await res.json();
    if (data.success) {
      state.members = data.data;
      renderMembersTable(state.members);
    }
  } catch (err) {
    console.error('Failed to load members:', err);
  }
}

async function loadBookings() {
  try {
    const res = await fetch(`${API_BASE}/bookings`);
    const data = await res.json();
    if (data.success) {
      state.bookings = data.data;
      renderDashboardBookings();
    }
  } catch (err) {
    console.error('Failed to load bookings:', err);
  }
}

async function loadPayments() {
  try {
    const res = await fetch(`${API_BASE}/payments`);
    const data = await res.json();
    if (data.success) {
      state.payments = data.data;
      renderPaymentsTable(state.payments);
    }
  } catch (err) {
    console.error('Failed to load payments:', err);
  }
}

// ====================================================================
// VIEW 1: DASHBOARD ACTIVE RESERVATIONS & QUICK FILTER
// ====================================================================

function renderDashboard() {
  renderDashboardBookings();
  const quickDate = document.getElementById('quick-date');
  if (quickDate && !quickDate.value) {
    quickDate.value = localDateStr();
  }
}

function renderDashboardBookings() {
  const container = document.getElementById('dashboard-bookings-list');
  if (!container) return;

  const activeBookings = (state.bookings || []).filter(b => b.STATUS === 'CONFIRMED').slice(0, 5);

  if (activeBookings.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400 text-xs">
        <i class="fa-solid fa-calendar-xmark text-2xl text-slate-300 block mb-2"></i>
        No active reservations found. Click "Book a Time Slot" to lock a space!
      </div>
    `;
    return;
  }

  container.innerHTML = activeBookings.map(b => `
    <div class="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition">
      <div class="flex items-start gap-3.5">
        <div class="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
          <i class="fa-solid fa-door-open"></i>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-slate-900 text-sm">${esc(b.ROOM_NAME)}</h4>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">CONFIRMED</span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5">${esc(b.SPACE_NAME)} • Reserved by <span class="text-slate-800 font-semibold">${esc(b.MEMBER_NAME)}</span></p>
          <div class="flex items-center gap-3 text-[11px] text-slate-600 mt-1 font-mono">
            <span><i class="fa-regular fa-calendar text-[10px] mr-1 text-slate-400"></i>${esc(b.BOOKING_DATE)}</span>
            <span class="text-blue-700 font-bold"><i class="fa-regular fa-clock text-[10px] mr-1"></i>${esc(b.START_TIME)} - ${esc(b.END_TIME)}</span>
            <span class="text-emerald-700 font-bold">₹${Number(b.TOTAL_AMOUNT).toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 self-end sm:self-center">
        <button onclick="cancelBooking(${esc(b.BOOKING_ID)})" class="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition">
          <i class="fa-solid fa-ban text-[10px] mr-1"></i> Cancel
        </button>
      </div>
    </div>
  `).join('');
}

function handleQuickFilter(e) {
  e.preventDefault();
  const hub = document.getElementById('quick-hub').value;
  const type = document.getElementById('quick-type').value;
  const date = document.getElementById('quick-date').value;

  if (date) {
    state.timelineDate = date;
    const dp = document.getElementById('timeline-date-picker');
    if (dp) dp.value = date;
  }

  // Switch to catalog or timeline
  if (type) state.activeCategoryFilter = type;
  if (hub) {
    const hubFilter = document.getElementById('filter-hub');
    if (hubFilter) hubFilter.value = hub;
  }

  switchTab('catalog');
  renderCatalog();
}

// ====================================================================
// VIEW 2: SPACE CATALOG & 2D FLOOR PLAN
// ====================================================================

function toggleCatalogView(viewType) {
  const grid = document.getElementById('catalog-grid-view');
  const map = document.getElementById('catalog-map-view');
  const btnGrid = document.getElementById('view-btn-grid');
  const btnMap = document.getElementById('view-btn-map');

  if (viewType === 'map') {
    grid.classList.add('hidden');
    map.classList.remove('hidden');
    btnMap.classList.add('bg-sky-600', 'text-white');
    btnMap.classList.remove('text-slate-400');
    btnGrid.classList.remove('bg-sky-600', 'text-white');
    btnGrid.classList.add('text-slate-400');
  } else {
    map.classList.add('hidden');
    grid.classList.remove('hidden');
    btnGrid.classList.add('bg-sky-600', 'text-white');
    btnGrid.classList.remove('text-slate-400');
    btnMap.classList.remove('bg-sky-600', 'text-white');
    btnMap.classList.add('text-slate-400');
  }
}

function filterRoomsByType(type) {
  state.activeCategoryFilter = type;
  document.querySelectorAll('.room-pill').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent.includes(type) || (type === 'ALL' && btn.textContent.includes('All Spaces'))) {
      btn.classList.add('active');
    }
  });
  renderCatalog();
}

function applyRoomFilters() {
  renderCatalog();
}

function getRoomImage(room) {
  const name = (room.ROOM_NAME || '').toLowerCase();
  const type = (room.ROOM_TYPE || '').toLowerCase();

  if (name.includes('titan') || name.includes('apex')) {
    return 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80';
  } else if (name.includes('nexus') || name.includes('video')) {
    return 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=800&q=80';
  } else if (name.includes('emerald') || type.includes('meeting')) {
    return 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80';
  } else if (type.includes('hot') || name.includes('desk')) {
    return 'https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?auto=format&fit=crop&w=800&q=80';
  } else if (name.includes('focus') || name.includes('pod')) {
    return 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80';
  } else if (type.includes('private')) {
    return 'https://images.unsplash.com/photo-1505409859467-3a796fd5798e?auto=format&fit=crop&w=800&q=80';
  }
  return 'https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=800&q=80';
}

function renderCatalog() {
  const container = document.getElementById('rooms-catalog-cards');
  if (!container) return;

  const hubFilter = document.getElementById('filter-hub')?.value || 'ALL';
  const capacityFilter = Number(document.getElementById('filter-capacity')?.value || 0);
  const checkedAmenities = Array.from(document.querySelectorAll('.amenity-checkbox:checked')).map(c => c.value.toLowerCase());

  const filtered = state.rooms.filter(room => {
    // Type Filter
    if (state.activeCategoryFilter !== 'ALL' && room.ROOM_TYPE !== state.activeCategoryFilter) {
      return false;
    }
    // Hub Filter
    if (hubFilter !== 'ALL' && !room.SPACE_NAME.toLowerCase().includes(hubFilter.toLowerCase())) {
      return false;
    }
    // Capacity Filter
    if (capacityFilter > 0 && Number(room.CAPACITY) < capacityFilter) {
      return false;
    }
    // Amenity Filter
    if (checkedAmenities.length > 0) {
      const roomFacs = (room.FACILITIES || []).join(' ').toLowerCase();
      const matchesAll = checkedAmenities.every(a => roomFacs.includes(a));
      if (!matchesAll) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-16 bg-white border border-slate-200 rounded-3xl shadow-sm">
        <div class="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400 text-2xl">
          <i class="fa-solid fa-filter-circle-xmark"></i>
        </div>
        <h4 class="font-bold text-slate-900 text-base">No spaces match your filters</h4>
        <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Try relaxing your hub location or capacity filters to explore more available conference rooms and hot desks.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(room => {
    const facilitiesList = (room.FACILITIES && room.FACILITIES.length > 0)
      ? room.FACILITIES.slice(0, 3)
      : ['High-Speed Wi-Fi', 'Power Outlets', 'Ergonomic Seating'];

    const imgUrl = getRoomImage(room);

    return `
      <div class="bg-white border border-slate-200/90 rounded-2xl overflow-hidden hover:border-blue-400 transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col justify-between group">
        <div>
          <!-- Image Header with Badges -->
          <div class="h-44 relative overflow-hidden bg-slate-100">
            <img src="${imgUrl}" alt="${esc(room.ROOM_NAME)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent"></div>
            
            <!-- Top Badges -->
            <div class="absolute top-3 inset-x-3 flex justify-between items-center">
              <span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/95 text-slate-800 shadow-sm backdrop-blur border border-white/50">
                <i class="fa-solid fa-layer-group text-blue-600 mr-1"></i> ${esc(room.ROOM_TYPE)}
              </span>
              <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${room.STATUS === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'} flex items-center gap-1 shadow-sm">
                <span class="h-1.5 w-1.5 rounded-full ${room.STATUS === 'AVAILABLE' ? 'bg-emerald-500' : 'bg-rose-500'}"></span> ${esc(room.STATUS)}
              </span>
            </div>

            <!-- Bottom Card Title inside Image overlay -->
            <div class="absolute bottom-3 inset-x-3 text-white">
              <span class="text-[11px] text-blue-200 font-medium block flex items-center gap-1">
                <i class="fa-solid fa-location-dot text-blue-400"></i> ${esc(room.SPACE_NAME)}
              </span>
              <h3 class="text-base font-bold text-white tracking-tight drop-shadow-sm">${esc(room.ROOM_NAME)}</h3>
            </div>
          </div>

          <!-- Specs & Amenities -->
          <div class="p-5 space-y-4 text-xs">
            <div class="grid grid-cols-2 gap-3 py-2 border-b border-slate-100">
              <div class="flex items-center gap-2 text-slate-600">
                <div class="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs">
                  <i class="fa-solid fa-users"></i>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400 uppercase font-semibold">Capacity</div>
                  <strong class="text-slate-900 font-bold">${esc(room.CAPACITY)} Pax</strong>
                </div>
              </div>
              <div class="flex items-center gap-2 text-slate-600">
                <div class="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
                  <i class="fa-solid fa-tag"></i>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400 uppercase font-semibold">Hourly Rate</div>
                  <strong class="text-emerald-700 font-bold font-mono">₹${Number(room.HOURLY_RATE).toFixed(0)}/hr</strong>
                </div>
              </div>
            </div>

            <!-- Facilities Tags -->
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Included Amenities</span>
              <div class="flex flex-wrap gap-1.5">
                ${facilitiesList.map(f => `
                  <span class="px-2.5 py-1 rounded-md bg-slate-50 text-[11px] text-slate-700 border border-slate-200 flex items-center gap-1.5">
                    <i class="fa-solid fa-check text-[9px] text-blue-600"></i> ${esc(f)}
                  </span>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="p-5 pt-0 flex items-center gap-2 border-t border-slate-100/80 mt-2">
          <button onclick="openSlotPickerForRoom(${esc(room.ROOM_ID)})" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm hover:shadow-md">
            <i class="fa-solid fa-calendar-check text-xs"></i> Select Slots & Lock
          </button>
          <button onclick="openEditRoomModal(${esc(room.ROOM_ID)})" class="h-9 w-9 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 flex items-center justify-center text-xs border border-slate-200 hover:border-amber-300 transition" title="Update Room in Neo4j">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteRoom(${esc(room.ROOM_ID)})" class="h-9 w-9 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 flex items-center justify-center text-xs border border-slate-200 hover:border-rose-300 transition" title="Delete Room from Neo4j">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function selectRoomFromMap(roomId) {
  openSlotPickerForRoom(roomId);
}

// ====================================================================
// VIEW 3: CALENDAR & TIME-SLOT TIMELINE PICKER
// ====================================================================

function populateTimelineRoomDropdown() {
  const select = document.getElementById('timeline-room-select');
  if (!select) return;
  select.innerHTML = state.rooms.map(r => `
    <option value="${esc(r.ROOM_ID)}" ${Number(r.ROOM_ID) === Number(state.selectedTimelineRoomId) ? 'selected' : ''}>
      ${esc(r.ROOM_NAME)} (₹${esc(r.HOURLY_RATE)}/hr, ${esc(r.CAPACITY)} pax)
    </option>
  `).join('');
}

function openSlotPickerForRoom(roomId) {
  if (roomId) {
    state.selectedTimelineRoomId = roomId;
    const select = document.getElementById('timeline-room-select');
    if (select) select.value = roomId;
  }
  state.selectedStartHour = null;
  state.selectedEndHour = null;
  switchTab('timeline');
}

function shiftTimelineDate(days) {
  const [y, m, d] = state.timelineDate.split('-').map(Number);
  const cur = new Date(y, m - 1, d);
  cur.setDate(cur.getDate() + days);
  state.timelineDate = localDateStr(cur);
  const dp = document.getElementById('timeline-date-picker');
  if (dp) dp.value = state.timelineDate;
  state.selectedStartHour = null;
  state.selectedEndHour = null;
  renderTimelineGrid();
}

function setTimelineDate(mode) {
  const cur = new Date();
  if (mode === 'tomorrow') cur.setDate(cur.getDate() + 1);
  else if (mode === 'monday') {
    const day = cur.getDay();
    const diff = cur.getDate() + (day === 0 ? 1 : 8 - day);
    cur.setDate(diff);
  }
  state.timelineDate = localDateStr(cur);
  const dp = document.getElementById('timeline-date-picker');
  if (dp) dp.value = state.timelineDate;
  state.selectedStartHour = null;
  state.selectedEndHour = null;
  renderTimelineGrid();
}

function renderTimelineGrid() {
  const select = document.getElementById('timeline-room-select');
  if (select) state.selectedTimelineRoomId = select.value;

  const dp = document.getElementById('timeline-date-picker');
  if (dp) {
    if (!dp.value) dp.value = state.timelineDate;
    else state.timelineDate = dp.value;
  }

  const curRoom = state.rooms.find(r => Number(r.ROOM_ID) === Number(state.selectedTimelineRoomId)) || state.rooms[0];
  if (!curRoom) return;

  // Header meta
  document.getElementById('timeline-current-room-name').textContent = curRoom.ROOM_NAME;
  document.getElementById('timeline-current-rate').textContent = `₹ ${Number(curRoom.HOURLY_RATE).toFixed(0)}/hr`;
  document.getElementById('timeline-current-space-city').textContent = `${curRoom.SPACE_NAME}, ${curRoom.CITY}`;

  // Find confirmed bookings for this room on this date in Neo4j
  const existingBookings = state.bookings.filter(b => 
    Number(b.ROOM_ID) === Number(curRoom.ROOM_ID) &&
    b.BOOKING_DATE === state.timelineDate &&
    b.STATUS === 'CONFIRMED'
  );

  const container = document.getElementById('hourly-blocks-container');
  container.innerHTML = '';

  // Hours 08:00 to 20:00 (12 one-hour slots)
  const hours = [
    { start: 8, label: '08:00 - 09:00' },
    { start: 9, label: '09:00 - 10:00' },
    { start: 10, label: '10:00 - 11:00' },
    { start: 11, label: '11:00 - 12:00' },
    { start: 12, label: '12:00 - 13:00' },
    { start: 13, label: '13:00 - 14:00' },
    { start: 14, label: '14:00 - 15:00' },
    { start: 15, label: '15:00 - 16:00' },
    { start: 16, label: '16:00 - 17:00' },
    { start: 17, label: '17:00 - 18:00' },
    { start: 18, label: '18:00 - 19:00' },
    { start: 19, label: '19:00 - 20:00' }
  ];

  hours.forEach(slot => {
    // Check if slot overlaps with any confirmed booking in Neo4j
    const isBooked = existingBookings.some(b => {
      const bStart = parseInt(b.START_TIME.split(':')[0], 10);
      const bEnd = parseInt(b.END_TIME.split(':')[0], 10);
      return slot.start >= bStart && slot.start < bEnd;
    });

    const isSelected = state.selectedStartHour !== null && 
                       slot.start >= state.selectedStartHour && 
                       slot.start < state.selectedEndHour;

    const block = document.createElement('div');
    block.className = `time-block p-3 rounded-xl text-center border text-xs font-mono font-semibold transition ${
      isBooked ? 'booked' : (isSelected ? 'selected' : 'available')
    }`;

    block.innerHTML = `
      <div class="text-[11px] mb-1">${slot.label}</div>
      <div class="text-[10px] uppercase font-bold tracking-wider">
        ${isBooked ? '🔒 Reserved' : (isSelected ? '✓ Selected' : 'Free Slot')}
      </div>
    `;

    if (!isBooked) {
      block.onclick = () => handleSlotClick(slot.start);
    }

    container.appendChild(block);
  });

  updateSelectedTimelineSummary(curRoom);
}

function handleSlotClick(hour) {
  if (state.selectedStartHour === null) {
    state.selectedStartHour = hour;
    state.selectedEndHour = hour + 1;
  } else if (state.selectedStartHour !== null && state.selectedEndHour === (state.selectedStartHour + 1) && hour > state.selectedStartHour) {
    state.selectedEndHour = hour + 1;
  } else {
    // Reset selection
    state.selectedStartHour = hour;
    state.selectedEndHour = hour + 1;
  }
  renderTimelineGrid();
}

function updateSelectedTimelineSummary(curRoom) {
  const summarySpan = document.getElementById('timeline-selected-span');
  const priceSpan = document.getElementById('timeline-selected-price');
  const btn = document.getElementById('btn-proceed-checkout');

  if (state.selectedStartHour !== null && state.selectedEndHour !== null) {
    const duration = state.selectedEndHour - state.selectedStartHour;
    const sStr = String(state.selectedStartHour).padStart(2, '0') + ':00';
    const eStr = String(state.selectedEndHour).padStart(2, '0') + ':00';
    const total = duration * Number(curRoom.HOURLY_RATE);

    summarySpan.innerHTML = `<span class="text-amber-400 font-mono">${sStr} - ${eStr}</span> (${duration} hr${duration > 1 ? 's' : ''}) on <span class="text-sky-400 font-mono">${state.timelineDate}</span>`;
    priceSpan.textContent = `₹ ${total.toFixed(2)}`;
    btn.disabled = false;

    // Cache checkout details
    state.checkoutData = {
      room: curRoom,
      date: state.timelineDate,
      startTime: sStr,
      endTime: eStr,
      durationHours: duration,
      basePrice: total
    };
  } else {
    summarySpan.textContent = 'Click on free time slots above to select';
    priceSpan.textContent = '₹ 0.00';
    btn.disabled = true;
    state.checkoutData = null;
  }
}

// ====================================================================
// VIEW 4: CHECKOUT & CONFIRMATION MODAL
// ====================================================================

function launchCheckoutFromTimeline() {
  if (!state.checkoutData) return;
  const d = state.checkoutData;

  document.getElementById('checkout-room-name').textContent = d.room.ROOM_NAME;
  document.getElementById('checkout-space-loc').textContent = `${d.room.SPACE_NAME}, ${d.room.CITY}`;
  document.getElementById('checkout-date').textContent = d.date;
  document.getElementById('checkout-slot').textContent = `${d.startTime} - ${d.endTime}`;
  document.getElementById('checkout-duration').textContent = `${d.durationHours} Hour(s)`;
  document.getElementById('checkout-rate').textContent = `₹ ${d.room.HOURLY_RATE}/hr`;

  // Reset checkboxes & promo
  document.getElementById('addon-coffee').checked = false;
  document.getElementById('addon-recording').checked = false;
  document.getElementById('addon-concierge').checked = false;
  document.getElementById('checkout-promo-input').value = '';
  state.appliedPromo = null;

  recalculateCheckoutTotal();
  openModal('checkout-modal');
}

function recalculateCheckoutTotal() {
  if (!state.checkoutData) return;

  let total = state.checkoutData.basePrice;
  let amenitiesTotal = 0;

  if (document.getElementById('addon-coffee').checked) amenitiesTotal += 200;
  if (document.getElementById('addon-recording').checked) amenitiesTotal += 500;
  if (document.getElementById('addon-concierge').checked) amenitiesTotal += 600;

  total += amenitiesTotal;

  // Apply promo
  let discount = 0;
  if (state.appliedPromo === 'VIT2026') {
    discount = total * 0.20; // 20% discount
  } else if (state.appliedPromo === 'STARTUP50') {
    discount = Math.min(500, total * 0.5);
  }

  total = Math.max(0, total - discount);

  // Add 18% GST standard in India
  const gst = total * 0.18;
  const grandTotal = total + gst;

  document.getElementById('checkout-grand-total').textContent = `₹ ${grandTotal.toFixed(2)}`;

  const discountBadge = document.getElementById('checkout-discount-badge');
  if (discount > 0) {
    discountBadge.textContent = `Promo Code Applied: -₹${discount.toFixed(2)} savings + 18% GST`;
    discountBadge.classList.remove('hidden');
  } else {
    discountBadge.textContent = '+ 18% GST applicable';
    discountBadge.classList.remove('hidden');
  }

  state.checkoutData.calculatedGrandTotal = grandTotal;
}

function applyPromoCode() {
  const code = document.getElementById('checkout-promo-input').value.trim().toUpperCase();
  if (code === 'VIT2026' || code === 'STARTUP50') {
    state.appliedPromo = code;
    showToast(`Promo "${code}" applied successfully!`, 'success');
    recalculateCheckoutTotal();
  } else {
    showToast('Invalid promo code. Try: VIT2026 or STARTUP50', 'error');
  }
}

function selectPaymentMethod(method) {
  state.selectedPaymentMethod = method;
  document.querySelectorAll('.pay-method-btn').forEach(btn => btn.classList.remove('active', 'bg-sky-600', 'text-white'));
  
  if (method === 'UPI') document.getElementById('pay-btn-UPI').classList.add('active', 'bg-sky-600', 'text-white');
  else if (method === 'Credit Card') document.getElementById('pay-btn-CARD').classList.add('active', 'bg-sky-600', 'text-white');
  else if (method === 'Net Banking') document.getElementById('pay-btn-NET').classList.add('active', 'bg-sky-600', 'text-white');
  else if (method === 'Corporate Account') document.getElementById('pay-btn-CORP').classList.add('active', 'bg-sky-600', 'text-white');
}

async function submitCompleteCheckout() {
  if (!state.checkoutData) return;

  const btn = document.getElementById('btn-confirm-payment');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i> Writing to Neo4j...`;

  // Use default active resident member for checkout booking
  const defaultMember = state.members[0] || { MEMBER_ID: 1001 };

  const payload = {
    member_id: defaultMember.MEMBER_ID,
    room_id: state.checkoutData.room.ROOM_ID,
    booking_date: state.checkoutData.date,
    start_time: state.checkoutData.startTime,
    end_time: state.checkoutData.endTime,
    total_amount: state.checkoutData.calculatedGrandTotal,
    payment_method: state.selectedPaymentMethod
  };

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-check-double"></i> Authorize & Lock Space`;

    if (data.success) {
      showToast(data.message || 'Reservation Locked & Settled in Neo4j!', 'success');
      closeModal('checkout-modal');
      await loadBookings();
      await loadPayments();
      await loadStats();
      switchTab('dashboard');
    } else {
      // Overlap rule rejected the slot (HTTP 409) or validation failed (HTTP 400)
      showToast(data.error, 'error');
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-check-double"></i> Authorize & Lock Space`;
    showToast(err.message, 'error');
  }
}

// ====================================================================
// CRUD: ROOMS & MEMBERS (FACULTY RUBRIC M-1, M-2, M-3)
// ====================================================================

function openNewRoomModal() {
  document.getElementById('room-modal-title').textContent = 'Add Space (Insert)';
  document.getElementById('room-id').value = '';
  document.getElementById('room-form').reset();
  openModal('room-modal');
}

function openEditRoomModal(roomId) {
  const room = state.rooms.find(r => Number(r.ROOM_ID) === Number(roomId));
  if (!room) return;

  document.getElementById('room-modal-title').textContent = `Update Room #${roomId}`;
  document.getElementById('room-id').value = room.ROOM_ID;
  document.getElementById('room-space-id').value = room.SPACE_ID;
  document.getElementById('room-name').value = room.ROOM_NAME;
  document.getElementById('room-type').value = room.ROOM_TYPE;
  document.getElementById('room-capacity').value = room.CAPACITY;
  document.getElementById('room-rate').value = room.HOURLY_RATE;
  document.getElementById('room-status').value = room.STATUS;

  openModal('room-modal');
}

async function handleRoomSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('room-id').value;
  const payload = {
    space_id: document.getElementById('room-space-id').value,
    room_name: document.getElementById('room-name').value,
    room_type: document.getElementById('room-type').value,
    capacity: document.getElementById('room-capacity').value,
    hourly_rate: document.getElementById('room-rate').value,
    status: document.getElementById('room-status').value
  };

  try {
    const url = id ? `${API_BASE}/rooms/${id}` : `${API_BASE}/rooms`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal('room-modal');
      await loadRooms();
      await loadStats();
      renderCatalog();
    } else {
      showToast(data.error || 'Operation failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteRoom(id) {
  if (!confirm(`Permanently delete room #${id} from Neo4j? All linked reservations, payments and facilities will cascade delete.`)) return;

  try {
    const res = await fetch(`${API_BASE}/rooms/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadRooms();
      await loadStats();
      renderCatalog();
    } else {
      showToast(data.error || 'Failed to delete room', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------- MEMBERS CRUD -----------------
function renderMembersTable(members) {
  const tbody = document.getElementById('members-table-body');
  if (!tbody) return;

  if (!members || members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">No members registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = members.map(m => `
    <tr class="hover:bg-blue-50/40 border-b border-slate-100 transition">
      <td class="px-6 py-4 font-mono font-bold text-blue-600">#${esc(m.MEMBER_ID)}</td>
      <td class="px-6 py-4 font-bold text-slate-900">${esc(m.FIRST_NAME)} ${esc(m.LAST_NAME)}</td>
      <td class="px-6 py-4 text-slate-600 font-mono text-xs">${esc(m.EMAIL)}</td>
      <td class="px-6 py-4 text-slate-600 font-mono text-xs">${esc(m.PHONE || '-')}</td>
      <td class="px-6 py-4">
        <span class="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          ${esc(m.PLAN_NAME || 'Standard')} (₹${esc(m.MONTHLY_FEE || 0)}/mo)
        </span>
      </td>
      <td class="px-6 py-4 text-slate-500 font-mono text-xs">${esc(m.JOIN_DATE)}</td>
      <td class="px-6 py-4">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          ${esc(m.STATUS)}
        </span>
      </td>
      <td class="px-6 py-4 text-right">
        <div class="flex items-center justify-end gap-2">
          <button onclick="openEditMemberModal(${esc(m.MEMBER_ID)})" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold border border-amber-200 transition">
            Update
          </button>
          <button onclick="deleteMember(${esc(m.MEMBER_ID)})" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg text-xs font-semibold border border-rose-200 transition">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openNewMemberModal() {
  document.getElementById('member-modal-title').textContent = 'Register Member (Insert)';
  document.getElementById('member-id').value = '';
  document.getElementById('member-form').reset();
  openModal('member-modal');
}

function openEditMemberModal(memberId) {
  const m = state.members.find(mem => Number(mem.MEMBER_ID) === Number(memberId));
  if (!m) return;

  document.getElementById('member-modal-title').textContent = `Update Member #${memberId}`;
  document.getElementById('member-id').value = m.MEMBER_ID;
  document.getElementById('member-first-name').value = m.FIRST_NAME;
  document.getElementById('member-last-name').value = m.LAST_NAME;
  document.getElementById('member-email').value = m.EMAIL;
  document.getElementById('member-phone').value = m.PHONE || '';
  document.getElementById('member-plan-id').value = m.PLAN_ID || '';

  openModal('member-modal');
}

async function handleMemberSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('member-id').value;
  const payload = {
    first_name: document.getElementById('member-first-name').value,
    last_name: document.getElementById('member-last-name').value,
    email: document.getElementById('member-email').value,
    phone: document.getElementById('member-phone').value,
    plan_id: document.getElementById('member-plan-id').value || null
  };

  try {
    const url = id ? `${API_BASE}/members/${id}` : `${API_BASE}/members`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal('member-modal');
      await loadMembers();
      await loadStats();
    } else {
      showToast(data.error || 'Operation failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteMember(id) {
  if (!confirm(`Delete member #${id}? All associated reservations and payments will be deleted in Neo4j.`)) return;

  try {
    const res = await fetch(`${API_BASE}/members/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadMembers();
      await loadStats();
    } else {
      showToast(data.error || 'Failed to delete member', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------- CANCELLATION -----------------
async function cancelBooking(id) {
  if (!confirm(`Cancel reservation #${id}?`)) return;
  try {
    const res = await fetch(`${API_BASE}/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Reservation marked CANCELLED in Neo4j', 'info');
      await loadBookings();
      await loadStats();
      renderDashboard();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------- PAYMENTS LEDGER -----------------
function renderPaymentsTable(payments) {
  const tbody = document.getElementById('payments-table-body');
  if (!tbody) return;

  if (!payments || payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400">No payment receipts found.</td></tr>`;
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr class="hover:bg-blue-50/40 border-b border-slate-100 transition">
      <td class="px-6 py-4 font-mono font-bold text-blue-600">#${esc(p.PAYMENT_ID)}</td>
      <td class="px-6 py-4 font-mono text-slate-400 text-xs">#${esc(p.BOOKING_ID)}</td>
      <td class="px-6 py-4 font-bold text-slate-900">${esc(p.MEMBER_NAME)}</td>
      <td class="px-6 py-4 text-slate-700 font-medium">${esc(p.ROOM_NAME)}</td>
      <td class="px-6 py-4 font-bold text-emerald-700 font-mono">₹ ${Number(p.AMOUNT).toFixed(2)}</td>
      <td class="px-6 py-4">
        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
          ${esc(p.PAYMENT_METHOD)}
        </span>
      </td>
      <td class="px-6 py-4 text-slate-500 font-mono text-xs">${esc(p.PAYMENT_DATE)}</td>
      <td class="px-6 py-4">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          ${esc(p.STATUS)}
        </span>
      </td>
      <td class="px-6 py-4 text-right flex items-center justify-end gap-1.5">
        <button onclick="viewInvoiceModal(${esc(p.PAYMENT_ID)})" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 transition flex items-center gap-1 shadow-2xs">
          <i class="fa-solid fa-file-invoice text-xs"></i> Invoice
        </button>
        <button onclick="deletePayment(${esc(p.PAYMENT_ID)})" class="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold border border-rose-200 transition">
          Delete
        </button>
      </td>
    </tr>
  `).join('');
}


function viewInvoiceModal(paymentId) {
  const p = state.payments.find(x => Number(x.PAYMENT_ID) === Number(paymentId));
  if (!p) return;
  const b = state.bookings.find(x => Number(x.BOOKING_ID) === Number(p.BOOKING_ID)) || {};
  const r = state.rooms.find(x => x.ROOM_NAME === p.ROOM_NAME) || {};

  const total = Number(p.AMOUNT) || 0;
  const base = total / 1.18;
  const gst = total - base;

  const invDisplay = document.getElementById('invoice-id-display');
  if (invDisplay) invDisplay.textContent = 'INV-2026-' + p.PAYMENT_ID;
  const bRef = document.getElementById('invoice-booking-ref');
  if (bRef) bRef.textContent = '#BK-' + p.BOOKING_ID;
  const dDisp = document.getElementById('invoice-date-display');
  if (dDisp) dDisp.textContent = p.PAYMENT_DATE || localDateStr();
  const mName = document.getElementById('invoice-member-name');
  if (mName) mName.textContent = p.MEMBER_NAME || 'Registered Resident';
  const mEmail = document.getElementById('invoice-member-email');
  if (mEmail) mEmail.textContent = b.EMAIL || ((p.MEMBER_NAME || 'resident').toLowerCase().replace(/\s+/g, '.') + '@worksphere.io');
  const orgName = document.getElementById('invoice-org-name');
  if (orgName) orgName.textContent = b.ORG_NAME || 'WorkSphere Resident Network';
  const rTitle = document.getElementById('invoice-room-title');
  if (rTitle) rTitle.textContent = p.ROOM_NAME || 'Meeting Suite';
  const rHub = document.getElementById('invoice-room-hub');
  if (rHub) rHub.textContent = b.SPACE_NAME || r.SPACE_NAME || 'WorkSphere Campus Chennai';
  const slotTime = document.getElementById('invoice-slot-time');
  if (slotTime) slotTime.textContent = (b.BOOKING_DATE || '') + ' (' + (b.START_TIME || '10:00') + ' - ' + (b.END_TIME || '12:00') + ')';
  const mMethod = document.getElementById('invoice-method-display');
  if (mMethod) mMethod.textContent = p.PAYMENT_METHOD || p.METHOD || 'UPI (Instant)';
  const bAmt = document.getElementById('invoice-base-amount');
  if (bAmt) bAmt.textContent = '₹ ' + base.toFixed(2);
  const gAmt = document.getElementById('invoice-gst-amount');
  if (gAmt) gAmt.textContent = '₹ ' + gst.toFixed(2);
  const tAmt = document.getElementById('invoice-total-amount');
  if (tAmt) tAmt.textContent = '₹ ' + total.toFixed(2);

  openModal('invoice-view-modal');
}

async function deletePayment(id) {
  if (!confirm(`Delete payment record #${id}?`)) return;
  try {
    const res = await fetch(`${API_BASE}/payments/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadPayments();
      await loadStats();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ====================================================================
// VIEW 6 (DA-3): GRAPH EXPLORER, PRESET DEMOS & READ-ONLY CYPHER CONSOLE
// Replaces the original Oracle SQL console. Presets come from the server
// (GET /api/demos) so the UI always shows the Cypher that actually runs.
// ====================================================================

const LABEL_COLORS = {
  Member: '#0A5BEB', Employee: '#7c3aed', Person: '#64748b', CoworkingSpace: '#0f766e',
  MeetingRoom: '#0284c7', Facility: '#94a3b8', FacilityCategory: '#d97706', Organization: '#db2777',
  Booking: '#16a34a', Payment: '#ca8a04', MembershipPlan: '#475569'
};

let demoState = { list: [], selected: null };
let graphNetwork = null;

function primaryLabel(labels) {
  const order = ['Member', 'Employee', 'CoworkingSpace', 'MeetingRoom', 'FacilityCategory', 'Facility',
    'Organization', 'Booking', 'Payment', 'MembershipPlan', 'Person'];
  return order.find(l => (labels || []).includes(l)) || (labels || [])[0] || 'Node';
}

// ---------- Live connection badge ----------
async function checkDatabaseHealth() {
  const dot = document.getElementById('db-status-dot');
  const label = document.getElementById('db-status-label');
  const card = document.getElementById('db-health-card');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const h = await res.json();
    if (h.status !== 'UP') throw new Error(h.error || 'Neo4j is DOWN');
    if (dot) dot.className = 'h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse';
    if (label) label.textContent = h.database.replace(/ \(.*\)/, '');
    if (card) {
      card.innerHTML = `<span class="text-emerald-600 font-bold">● CONNECTED</span> ${esc(h.database)}<br>
        ${esc(h.connectivity)} • ${esc(h.uri)} • db "${esc(h.databaseName)}" • ${esc(h.nodeCount)} nodes`;
    }
  } catch (err) {
    if (dot) dot.className = 'h-1.5 w-1.5 rounded-full bg-rose-500';
    if (label) label.textContent = 'Neo4j: offline';
    if (card) card.innerHTML = `<span class="text-rose-600 font-bold">● NOT CONNECTED</span> ${esc(err.message)}`;
  }
}

// The original buttons called openNewBookingModal(), which did not exist in app.js.
// DA-3: new bookings are made through the slot picker + checkout flow.
function openNewBookingModal() {
  openSlotPickerForRoom(state.selectedTimelineRoomId);
  showToast('Pick a room, date and free slots, then press "Configure & Checkout".', 'info');
}

// ---------- DA-3 room recommendation (timeline view) ----------
async function loadFacilityCategories() {
  try {
    const res = await fetch(`${API_BASE}/graph/meta`);
    const data = await res.json();
    const select = document.getElementById('rec-category');
    if (data.success && select) {
      select.innerHTML = '<option value="">Any</option>' +
        data.categories.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load facility categories:', err);
  }
}

async function runRoomRecommendation() {
  const box = document.getElementById('rec-results');
  const toHHMM = v => (v || '').slice(0, 5);
  const body = {
    date: state.timelineDate,
    start_time: toHHMM(document.getElementById('rec-start').value),
    end_time: toHHMM(document.getElementById('rec-end').value),
    min_capacity: document.getElementById('rec-capacity').value || 0,
    category: document.getElementById('rec-category').value
  };
  box.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running Cypher on Neo4j...';
  try {
    const res = await fetch(`${API_BASE}/demos/room_recommendation`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) {
      box.innerHTML = `<span class="text-rose-600 font-semibold">${esc(data.error)}</span>`;
      return;
    }
    if (!data.rows.length) {
      box.innerHTML = `No free room matches on ${esc(body.date)} ${esc(body.start_time)}-${esc(body.end_time)}.`;
      return;
    }
    box.innerHTML = `
      <div class="mb-2 text-slate-500">${data.rowCount} free room(s) on <strong>${esc(body.date)}</strong>
        ${esc(body.start_time)}-${esc(body.end_time)} • ${data.executionTimeMs} ms</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        ${data.rows.map(r => `
          <div class="p-3 rounded-2xl border border-slate-200 bg-slate-50">
            <div class="font-bold text-slate-900">${esc(r.room_name)}</div>
            <div class="text-[11px] text-slate-500">${esc(r.space_name)} • ${esc(r.room_type)}</div>
            <div class="text-[11px] mt-1">${esc(r.capacity)} pax • ₹${Number(r.hourly_rate).toFixed(0)}/hr •
              est. ₹${Number(r.estimated_cost).toFixed(0)} • ${esc(r.popularity)} past bookings</div>
            <button onclick="openSlotPickerForRoom(${Number(r.room_id)})" class="mt-2 px-3 py-1.5 bg-appspace-blue text-white rounded-lg text-[11px] font-bold">Open slot picker</button>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    box.innerHTML = `<span class="text-rose-600 font-semibold">${esc(err.message)}</span>`;
  }
}

// ---------- Preset demos ----------
async function loadDemoPresets() {
  const container = document.getElementById('demo-preset-groups');
  if (!container) return;
  try {
    const res = await fetch(`${API_BASE}/demos`);
    const data = await res.json();
    demoState.list = data.data || [];
    const groups = {};
    demoState.list.forEach(d => { (groups[d.group] = groups[d.group] || []).push(d); });
    const styles = {
      'Original DA-II queries in Cypher': 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200',
      'DA-3 graph traversals': 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200',
      'DA-3 facility categories (enhancement)': 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
    };
    container.innerHTML = Object.entries(groups).map(([group, demos]) => `
      <div>
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">${esc(group)}</div>
        <div class="flex flex-wrap gap-2">
          ${demos.map(d => `<button onclick="selectDemo('${esc(d.key)}')" title="${esc(d.description)}"
              class="px-3.5 py-2 text-xs font-bold rounded-xl transition border ${styles[group] || styles['Original DA-II queries in Cypher']}">${esc(d.title)}</button>`).join('')}
        </div>
      </div>`).join('');
  } catch (err) {
    container.innerHTML = `<span class="text-rose-600">Failed to load presets: ${esc(err.message)}</span>`;
  }
}

function selectDemo(key, autoRun = true) {
  const d = demoState.list.find(x => x.key === key);
  if (!d) return;
  demoState.selected = d;
  document.getElementById('demo-title').textContent = d.title;
  document.getElementById('demo-description').textContent = d.description;
  document.getElementById('demo-sql-label').textContent = d.sqlSource === 'original'
    ? 'Original DA-II SQL / PL-SQL (Oracle)'
    : 'Equivalent SQL (written for DA-3 comparison - not in the original project)';
  document.getElementById('demo-sql').textContent = d.sql;
  document.getElementById('demo-cypher').textContent = d.cypher;
  document.getElementById('demo-params').innerHTML = d.params.map(p => {
    const type = p.type === 'date' ? 'date' : (p.type === 'time' ? 'time' : (p.type === 'category' ? 'text' : 'number'));
    return `<label class="flex flex-col text-[11px] font-bold text-slate-600">${esc(p.label)}
      <input data-param="${esc(p.name)}" type="${type}" value="${esc(p.default)}" ${type === 'time' ? 'step="60"' : ''}
        class="mt-1 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 w-40"></label>`;
  }).join('');
  document.getElementById('demo-detail-card').classList.remove('hidden');
  if (autoRun) runSelectedDemo();
}

function collectDemoParams() {
  const params = {};
  document.querySelectorAll('#demo-params [data-param]').forEach(input => {
    let v = input.value;
    if (input.type === 'time') v = v.slice(0, 5);
    params[input.dataset.param] = v;
  });
  return params;
}

async function runSelectedDemo() {
  const d = demoState.selected;
  if (!d) return;
  const meta = document.getElementById('query-execution-meta');
  meta.textContent = `Running preset "${d.title}" on Neo4j...`;
  try {
    const res = await fetch(`${API_BASE}/demos/${encodeURIComponent(d.key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collectDemoParams())
    });
    const data = await res.json();
    if (data.success) {
      renderQueryOutput(data, `Preset "${d.title}"`);
    } else {
      showQueryError(data.error, data.executionTimeMs);
    }
  } catch (err) {
    showQueryError(err.message);
  }
}

// Console queries cannot take $parameters, so literal values are substituted.
function copyDemoToConsole() {
  const d = demoState.selected;
  if (!d) return;
  const params = collectDemoParams();
  let text = d.cypher;
  d.params.forEach(p => {
    const raw = params[p.name];
    const literal = ['id', 'int', 'number'].includes(p.type) ? String(Number(raw)) : `'${String(raw).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    text = text.replace(new RegExp(`\\$${p.name}\\b`, 'g'), literal);
  });
  document.getElementById('cypher-input').value = text;
  document.getElementById('cypher-input').focus();
  showToast('Preset copied into the console with literal values. Press Execute.', 'info');
}

// ---------- Custom read-only console ----------
async function executeCustomQuery() {
  const cypherInput = document.getElementById('cypher-input').value.trim();
  const meta = document.getElementById('query-execution-meta');
  const btn = document.getElementById('btn-run-query');

  if (!cypherInput) {
    showToast('Please type a Cypher query first!', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i> Executing on Neo4j...`;
  meta.textContent = 'Query running on Neo4j (READ transaction)...';

  try {
    const res = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cypher: cypherInput })
    });
    const data = await res.json();
    if (data.success) {
      renderQueryOutput(data, 'Console query');
    } else {
      showQueryError(data.error, data.executionTimeMs);
    }
  } catch (err) {
    showQueryError(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-play text-xs"></i> Execute Query (Fetch)`;
  }
}

function showQueryError(message, ms) {
  document.getElementById('query-execution-meta').textContent = `Failed${ms !== undefined ? ` in ${ms} ms` : ''}`;
  document.getElementById('query-error-text').textContent = message || 'Cypher execution error';
  document.getElementById('query-error-container').classList.remove('hidden');
  document.getElementById('query-output-container').classList.add('hidden');
}

function renderQueryOutput(data, source) {
  document.getElementById('query-error-container').classList.add('hidden');
  const meta = document.getElementById('query-execution-meta');
  meta.textContent = `${source}: completed in ${data.executionTimeMs} ms | ${data.rowCount} rows` +
    (data.truncated ? ` (truncated to ${data.rowCount})` : '') +
    ` | ${data.graph ? data.graph.nodes.length : 0} graph nodes`;
  renderQueryResults(data.columns || [], data.rows || []);
  const executed = data.params && Object.keys(data.params).length
    ? `${data.cypher}\n\n// parameters\n${JSON.stringify(data.params, null, 2)}`
    : data.cypher;
  document.getElementById('result-view-cypher').textContent = executed;
  document.getElementById('query-output-container').classList.remove('hidden');
  const hasGraph = data.graph && data.graph.nodes.length > 0;
  setResultView(hasGraph ? 'graph' : 'table');
  if (hasGraph) renderGraph(data.graph);
}

function formatCell(v) {
  if (v === null || v === undefined) return '<span class="text-slate-400 italic">NULL</span>';
  if (Array.isArray(v)) {
    if (v.some(x => x && typeof x === 'object')) return v.map(formatCell).join(' ');
    return esc(v.join(', '));
  }
  if (typeof v === 'object') {
    if (v._type === 'node') {
      const label = primaryLabel(v.labels);
      const caption = v.properties.first_name ? `${v.properties.first_name} ${v.properties.last_name || ''}` :
        (v.properties.room_name || v.properties.space_name || v.properties.organization_name || v.properties.plan_name ||
         v.properties.facility_name || v.properties.name || (v.properties.booking_id ? `#${v.properties.booking_id}` : '') ||
         (v.properties.payment_id ? `#${v.properties.payment_id}` : ''));
      return `<span class="inline-block px-1.5 py-0.5 rounded text-white text-[10px]" style="background:${LABEL_COLORS[label] || '#64748b'}">:${esc(label)}</span> ${esc(caption)}`;
    }
    if (v._type === 'relationship') return `<span class="text-indigo-600">[:${esc(v.type)}]</span>`;
    if (v._type === 'path') return `<span class="text-indigo-600">path (${v.relationships.length} hops)</span>`;
    return esc(JSON.stringify(v));
  }
  return esc(v);
}

function renderQueryResults(columns, rows) {
  const thead = document.getElementById('query-table-head');
  const tbody = document.getElementById('query-table-body');
  document.getElementById('query-row-count').textContent = rows.length;

  if (!columns || columns.length === 0) {
    thead.innerHTML = '';
    tbody.innerHTML = `<tr><td class="px-6 py-6 text-center text-slate-500 font-medium">Query executed on Neo4j (no rows returned).</td></tr>`;
    return;
  }

  thead.innerHTML = `<tr class="bg-slate-50 border-b border-slate-200">${columns.map(c => `<th class="px-6 py-3 font-mono text-xs font-bold text-slate-700 uppercase tracking-wider text-left">${esc(c)}</th>`).join('')}</tr>`;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${columns.length}" class="px-6 py-6 text-center text-slate-500 font-medium">0 rows returned from Neo4j.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => `
    <tr class="hover:bg-blue-50/50 border-b border-slate-100 transition">
      ${columns.map(c => `<td class="px-6 py-3 font-mono text-xs text-slate-800 align-top">${formatCell(row[c])}</td>`).join('')}
    </tr>
  `).join('');
}

function setResultView(view) {
  ['table', 'graph', 'cypher'].forEach(v => {
    document.getElementById(`result-view-${v}`).classList.toggle('hidden', v !== view);
    const btn = document.getElementById(`result-view-btn-${v}`);
    btn.className = `result-view-btn px-3 py-1.5 rounded-lg ${v === view ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`;
  });
  if (view === 'graph' && graphNetwork) setTimeout(() => graphNetwork.fit(), 50);
}

function renderGraph(graph) {
  const canvas = document.getElementById('graph-canvas');
  const legend = document.getElementById('graph-legend');
  const selection = document.getElementById('graph-selection');
  if (typeof vis === 'undefined') {
    canvas.innerHTML = '<div class="p-6 text-xs text-rose-600">Graph library (vis-network) failed to load. Run "npm install" and reload.</div>';
    return;
  }
  const usedLabels = new Set();
  const nodes = graph.nodes.map(n => {
    const label = primaryLabel(n.labels);
    usedLabels.add(label);
    return {
      id: n.id, label: String(n.caption || label).slice(0, 28), group: label,
      title: `:${n.labels.join(':')}`,
      color: { background: LABEL_COLORS[label] || '#64748b', border: '#0f172a' },
      font: { color: '#0f172a', size: 12 }, shape: 'dot', size: label === 'Facility' ? 8 : 14
    };
  });
  const edges = graph.edges.map(e => ({
    id: e.id, from: e.from, to: e.to, label: e.type, arrows: 'to',
    font: { size: 9, color: '#475569', strokeWidth: 0 }, color: { color: '#94a3b8' }, smooth: { type: 'dynamic' }
  }));
  legend.innerHTML = [...usedLabels].map(l =>
    `<span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full" style="background:${LABEL_COLORS[l] || '#64748b'}"></span>${esc(l)}</span>`).join('') +
    `<span class="ml-auto text-slate-400 font-normal">${nodes.length} nodes • ${edges.length} relationships</span>`;
  if (graphNetwork) graphNetwork.destroy();
  graphNetwork = new vis.Network(canvas, { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) }, {
    physics: { stabilization: { iterations: 200 }, barnesHut: { springLength: 110 } },
    interaction: { hover: true, tooltipDelay: 150 }
  });
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const edgeById = new Map(graph.edges.map(e => [e.id, e]));
  graphNetwork.on('click', params => {
    if (params.nodes.length) {
      const n = byId.get(params.nodes[0]);
      selection.textContent = `(:${n.labels.join(':')}) ${JSON.stringify(n.properties)}`;
    } else if (params.edges.length) {
      const e = edgeById.get(params.edges[0]);
      selection.textContent = `[:${e.type}] ${JSON.stringify(e.properties)}`;
    }
  });
}

async function loadGraphOverview() {
  const meta = document.getElementById('query-execution-meta');
  meta.textContent = 'Loading the whole WorkSphere graph from Neo4j...';
  const started = Date.now();
  try {
    const res = await fetch(`${API_BASE}/graph/overview`);
    const data = await res.json();
    if (!data.success) return showQueryError(data.error);
    renderQueryOutput({ ...data, executionTimeMs: Date.now() - started, columns: [], rows: [], rowCount: 0 }, 'Whole graph');
  } catch (err) {
    showQueryError(err.message);
  }
}

// Shortcuts & Startup
document.addEventListener('DOMContentLoaded', () => {
  const cypherInput = document.getElementById('cypher-input');
  if (cypherInput) {
    cypherInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        executeCustomQuery();
      }
    });
  }

  refreshAllData();
  resetHeroSlideTimer();
  // DA-3 additions
  checkDatabaseHealth();
  loadDemoPresets();
  loadFacilityCategories();
});


// ====================================================================
// NEW HELPER FUNCTIONS FOR VISUAL HERO, HUBS, AND MANAGE SUB-TABS
// ====================================================================

// Hero Carousel Logic (Matching ZESTY Design)
const HERO_SLIDES = [
  {
    kicker: "ALL IN ONE SOLUTION FOR YOU",
    title: `Elevating Brands, Driving <br class="hidden sm:inline"><span class="text-white">Success</span>`,
    desc: "Empowering Brands with Innovative Design, Cutting-Edge Technology, and Strategic Marketing to Drive Business Growth and Success.",
    bg: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=2000&q=80",
    ctaText: "View Portfolio",
    ctaAction: () => switchTab('catalog')
  },
  {
    kicker: "WELCOME TO WORKSPHERE",
    title: `Crafting Brands for <br class="hidden sm:inline"><span class="text-white">Tomorrow</span>`,
    desc: "Delivering Next-Gen Coworking Ecosystems, Premium Meeting Suites, and High-Speed Infrastructure for Modern Global Enterprises.",
    bg: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2000&q=80",
    ctaText: "Explore Facilities",
    ctaAction: () => switchTab('catalog')
  },
  {
    kicker: "PREMIUM COWORKING & FLEX SPACES",
    title: `Your Digital Journey <br class="hidden sm:inline"><span class="text-white">Starts With Us</span>`,
    desc: "Experience Flexible Desk Plans, 4K Video Conferencing Hubs, and Instant Hourly Bookings with Real-Time Neo4j Graph Database Sync.",
    bg: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=2000&q=80",
    ctaText: "Book a Room",
    ctaAction: () => switchTab('timeline')
  }
];

let currentHeroSlide = 0;
let heroSlideTimer = null;

function setHeroSlide(index) {
  if (index < 0 || index >= HERO_SLIDES.length) return;
  currentHeroSlide = index;
  const slide = HERO_SLIDES[index];

  const bgEl = document.getElementById('hero-bg-image');
  const kickerEl = document.getElementById('hero-kicker-text');
  const titleEl = document.getElementById('hero-main-title');
  const descEl = document.getElementById('hero-desc-text');
  const ctaBtn = document.getElementById('hero-cta-btn');

  if (bgEl) {
    bgEl.style.opacity = '0.4';
    setTimeout(() => {
      bgEl.style.backgroundImage = `url('${slide.bg}')`;
      bgEl.style.opacity = '1';
    }, 200);
  }

  if (kickerEl) kickerEl.innerHTML = slide.kicker;
  if (titleEl) titleEl.innerHTML = slide.title;
  if (descEl) descEl.innerHTML = slide.desc;
  if (ctaBtn) {
    ctaBtn.textContent = slide.ctaText;
    ctaBtn.onclick = slide.ctaAction;
  }

  // Update dots
  const dots = document.querySelectorAll('.hero-dot');
  dots.forEach((dot, i) => {
    if (i === index) {
      dot.className = 'hero-dot h-1.5 w-6 rounded-full bg-sky-400 cursor-pointer transition-all duration-300';
    } else {
      dot.className = 'hero-dot h-1.5 w-1.5 rounded-full bg-white/40 cursor-pointer hover:bg-white transition-all duration-300';
    }
  });

  resetHeroSlideTimer();
}

function resetHeroSlideTimer() {
  if (heroSlideTimer) clearInterval(heroSlideTimer);
  heroSlideTimer = setInterval(() => {
    const nextIdx = (currentHeroSlide + 1) % HERO_SLIDES.length;
    setHeroSlide(nextIdx);
  }, 7000);
}

function handleHeroSearch() {
  const hub = document.getElementById('hero-hub-select')?.value || 'ALL';
  const type = document.getElementById('hero-type-select')?.value || 'ALL';

  const filterHub = document.getElementById('filter-hub');
  if (filterHub && hub !== 'ALL') {
    filterHub.value = hub;
  }

  filterRoomsByType(type);
  switchTab('catalog');
  applyRoomFilters();
  window.scrollTo({ top: 350, behavior: 'smooth' });
}

function filterByCampus(campusName) {
  const filterHub = document.getElementById('filter-hub');
  if (filterHub) {
    filterHub.value = campusName;
  }
  filterRoomsByType('ALL');
  switchTab('catalog');
  applyRoomFilters();
  window.scrollTo({ top: 350, behavior: 'smooth' });
}

function switchManageSubTab(subTab) {
  document.querySelectorAll('.manage-subtab-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-appspace-blue', 'text-white');
    btn.classList.add('bg-slate-100', 'text-slate-700');
  });

  document.querySelectorAll('.manage-view').forEach(view => {
    view.classList.add('hidden');
  });

  const activeBtn = document.getElementById('manage-subtab-btn-' + subTab);
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-appspace-blue', 'text-white');
    activeBtn.classList.remove('bg-slate-100', 'text-slate-700');
  }

  const activeView = document.getElementById('manage-' + subTab + '-view');
  if (activeView) {
    activeView.classList.remove('hidden');
  }

  if (subTab === 'rooms') {
    renderManageRoomsTable();
  } else if (subTab === 'employees') {
    renderEmployeesTable();
  }
}

function renderManageRoomsTable() {
  const tbody = document.getElementById('manage-rooms-table-body');
  if (!tbody) return;

  const rooms = state.rooms || [];
  if (rooms.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-400">No rooms found.</td></tr>';
    return;
  }

  tbody.innerHTML = rooms.map(r => `
    <tr class="hover:bg-blue-50/40 border-b border-slate-100 transition">
      <td class="px-6 py-4 font-mono font-bold text-blue-600">#${esc(r.ROOM_ID)}</td>
      <td class="px-6 py-4 font-bold text-slate-900">${esc(r.ROOM_NAME)}</td>
      <td class="px-6 py-4 text-slate-600">${esc(r.SPACE_NAME || '-')}</td>
      <td class="px-6 py-4">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
          ${esc(r.ROOM_TYPE)}
        </span>
      </td>
      <td class="px-6 py-4 font-bold text-slate-700">${esc(r.CAPACITY)} pax</td>
      <td class="px-6 py-4 font-bold text-emerald-600 font-mono">₹${Number(r.HOURLY_RATE).toFixed(2)}/hr</td>
      <td class="px-6 py-4">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${r.STATUS === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
          ${esc(r.STATUS)}
        </span>
      </td>
      <td class="px-6 py-4 text-right">
        <div class="flex items-center justify-end gap-2">
          <button onclick="openEditRoomModal(${esc(r.ROOM_ID)})" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold border border-amber-200 transition">
            Update
          </button>
          <button onclick="deleteRoom(${esc(r.ROOM_ID)})" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg text-xs font-semibold border border-rose-200 transition">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function renderEmployeesTable() {
  const tbody = document.getElementById('manage-employees-table-body');
  if (!tbody) return;

  try {
    const res = await fetch('/api/employees');
    const json = await res.json();
    if (json.success && json.data) {
      const emps = json.data;
      if (emps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">No employees registered.</td></tr>';
        return;
      }
      tbody.innerHTML = emps.map(e => `
        <tr class="hover:bg-purple-50/40 border-b border-slate-100 transition">
          <td class="px-6 py-4 font-mono font-bold text-purple-700">#${esc(e.EMPLOYEE_ID)}</td>
          <td class="px-6 py-4 font-bold text-slate-900">${esc(e.EMPLOYEE_NAME || (e.FIRST_NAME + ' ' + e.LAST_NAME))}</td>
          <td class="px-6 py-4 font-medium text-slate-700">${esc(e.JOB_TITLE)}</td>
          <td class="px-6 py-4 font-bold text-emerald-600 font-mono">₹${Number(e.SALARY).toFixed(2)}/mo</td>
          <td class="px-6 py-4 font-semibold text-indigo-700">
            ${e.SUPERVISOR_NAME ? '<i class="fa-solid fa-arrow-turn-up text-[10px] mr-1 text-slate-400"></i>' + esc(e.SUPERVISOR_NAME) : '<span class="text-xs text-slate-400 italic font-normal">Top Director (Root)</span>'}
          </td>
          <td class="px-6 py-4 font-mono text-xs text-slate-500">${esc(e.EMAIL || '-')}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-rose-500">Failed to load employees: ${esc(err.message)}</td></tr>`;
  }
}
