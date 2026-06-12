// ---------- Point type configuration ----------
// Lets users define their own marker types (emoji, name, color) from the UI.
// Stored in localStorage so it persists across sessions/devices that share it.

const TYPE_CONFIG_KEY = 'fireMapTypeConfigs';
const ZONES_KEY = 'fireMapZones';
const CURRENT_MAP_KEY = 'fireMapCurrentMap';

const DEFAULT_TYPES = [
  { id: 'hydrant', emoji: '🚒', label: 'Borne incendie', color: '#e74c3c' },
  { id: 'water', emoji: '💧', label: "Point d'eau", color: '#3498db' },
  { id: 'closure', emoji: '🚧', label: 'Route barrée', color: '#f39c12', lineMode: true },
  { id: 'danger', emoji: '⚠️', label: 'Danger / Accès difficile', color: '#9b59b6' },
  { id: 'command', emoji: '🏠', label: 'Poste de commandement', color: '#27ae60' },
];

const FALLBACK_TYPE = { id: '_unknown', emoji: '❓', label: 'Inconnu', color: '#7f8c8d' };

function getTypeConfigs() {
  try {
    const raw = localStorage.getItem(TYPE_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Erreur de chargement des types', e);
  }
  return DEFAULT_TYPES.map(t => ({ ...t }));
}

function saveTypeConfigs(types) {
  localStorage.setItem(TYPE_CONFIG_KEY, JSON.stringify(types));
}

function getTypeConfig(id) {
  return getTypeConfigs().find(t => t.id === id) || FALLBACK_TYPE;
}

function generateTypeId() {
  return `type-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- Maps / zones ----------
// "Carte principale" (id 'main') always shows everything.
// Other maps are rectangular zones: only items inside the rectangle are shown,
// and panning is restricted to that rectangle while it is selected.

function getZones() {
  try {
    const raw = localStorage.getItem(ZONES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Erreur de chargement des cartes', e);
  }
  return [];
}

function saveZones(zones) {
  localStorage.setItem(ZONES_KEY, JSON.stringify(zones));
}

function generateZoneId() {
  return `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function getCurrentMapId() {
  return localStorage.getItem(CURRENT_MAP_KEY) || 'main';
}

function setCurrentMapId(id) {
  localStorage.setItem(CURRENT_MAP_KEY, id);
}

function getCurrentZone() {
  const id = getCurrentMapId();
  if (id === 'main') return null;
  return getZones().find(z => z.id === id) || null;
}

// ---------- Map selector ----------
const mapSelect = document.getElementById('map-select');

function renderMapSelect() {
  const currentId = getCurrentMapId();
  mapSelect.innerHTML = '';

  const mainOption = document.createElement('option');
  mainOption.value = 'main';
  mainOption.textContent = '🗺️ Carte principale';
  mapSelect.appendChild(mainOption);

  getZones().forEach(zone => {
    const option = document.createElement('option');
    option.value = zone.id;
    option.textContent = `📍 ${zone.name}`;
    mapSelect.appendChild(option);
  });

  // Fall back to 'main' if the previously selected zone no longer exists
  const validIds = Array.from(mapSelect.options).map(o => o.value);
  mapSelect.value = validIds.includes(currentId) ? currentId : 'main';
  if (mapSelect.value !== currentId) {
    setCurrentMapId(mapSelect.value);
  }
}

mapSelect.addEventListener('change', () => {
  switchMap(mapSelect.value);
});

// ---------- Config modal ----------
const configOverlay = document.getElementById('config-modal-overlay');
const configTabs = document.querySelectorAll('.config-tab');
const configTabContents = {
  types: document.getElementById('config-tab-types'),
  zones: document.getElementById('config-tab-zones'),
};
const typeList = document.getElementById('type-list');
const zoneList = document.getElementById('zone-list');

document.getElementById('config-toggle').addEventListener('click', () => {
  requireAuth(openConfigModal);
});

document.getElementById('config-close').addEventListener('click', () => {
  configOverlay.classList.remove('visible');
});

configTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    configTabs.forEach(t => t.classList.toggle('active', t === tab));
    Object.entries(configTabContents).forEach(([name, el]) => {
      el.style.display = name === tab.dataset.tab ? 'block' : 'none';
    });
  });
});

function openConfigModal() {
  renderTypeList();
  renderZoneList();
  configOverlay.classList.add('visible');
}

// ---------- Types tab ----------
function renderTypeList() {
  const types = getTypeConfigs();
  typeList.innerHTML = '';

  types.forEach(type => {
    const row = document.createElement('div');
    row.className = 'config-row';

    const emojiInput = document.createElement('input');
    emojiInput.className = 'config-emoji-input';
    emojiInput.value = type.emoji;
    emojiInput.maxLength = 4;

    const nameInput = document.createElement('input');
    nameInput.className = 'config-name-input';
    nameInput.value = type.label;
    nameInput.placeholder = 'Nom';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'config-color-input';
    colorInput.value = type.color;

    const saveRow = () => {
      const types = getTypeConfigs();
      const t = types.find(x => x.id === type.id);
      if (!t) return;
      t.emoji = emojiInput.value.trim() || '📍';
      t.label = nameInput.value.trim() || 'Sans nom';
      t.color = colorInput.value;
      saveTypeConfigs(types);
      renderToolbar();
      renderAll();
    };

    emojiInput.addEventListener('change', saveRow);
    nameInput.addEventListener('change', saveRow);
    colorInput.addEventListener('change', saveRow);

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.title = 'Supprimer ce type';
    delBtn.addEventListener('click', () => {
      if (!confirm(`Supprimer le type "${type.label}" ? Les éléments déjà placés avec ce type resteront sur la carte.`)) return;
      const remaining = getTypeConfigs().filter(t => t.id !== type.id);
      saveTypeConfigs(remaining);
      renderTypeList();
      renderToolbar();
      renderAll();
    });

    row.appendChild(emojiInput);
    row.appendChild(nameInput);
    row.appendChild(colorInput);
    row.appendChild(delBtn);
    typeList.appendChild(row);
  });
}

document.getElementById('add-type-btn').addEventListener('click', () => {
  const types = getTypeConfigs();
  types.push({ id: generateTypeId(), emoji: '📍', label: 'Nouveau type', color: '#34495e' });
  saveTypeConfigs(types);
  renderTypeList();
  renderToolbar();
});

// ---------- Zones tab ----------
function renderZoneList() {
  const zones = getZones();
  zoneList.innerHTML = '';

  const mainRow = document.createElement('div');
  mainRow.className = 'config-row';
  const mainLabel = document.createElement('span');
  mainLabel.className = 'config-zone-name';
  mainLabel.textContent = '🗺️ Carte principale';
  mainRow.appendChild(mainLabel);
  zoneList.appendChild(mainRow);

  zones.forEach(zone => {
    const row = document.createElement('div');
    row.className = 'config-row';

    const nameInput = document.createElement('input');
    nameInput.className = 'config-name-input';
    nameInput.value = zone.name;
    nameInput.addEventListener('change', () => {
      const zones = getZones();
      const z = zones.find(x => x.id === zone.id);
      if (!z) return;
      z.name = nameInput.value.trim() || 'Carte sans nom';
      saveZones(zones);
      renderMapSelect();
    });

    const goBtn = document.createElement('button');
    goBtn.textContent = '🎯 Aller';
    goBtn.addEventListener('click', () => {
      configOverlay.classList.remove('visible');
      mapSelect.value = zone.id;
      switchMap(zone.id);
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.title = 'Supprimer cette carte';
    delBtn.addEventListener('click', () => {
      if (!confirm(`Supprimer la carte "${zone.name}" ? Les éléments qu'elle contient ne seront pas supprimés.`)) return;
      const remaining = getZones().filter(z => z.id !== zone.id);
      saveZones(remaining);
      if (getCurrentMapId() === zone.id) {
        switchMap('main');
      }
      renderZoneList();
      renderMapSelect();
    });

    row.appendChild(nameInput);
    row.appendChild(goBtn);
    row.appendChild(delBtn);
    zoneList.appendChild(row);
  });
}

document.getElementById('add-zone-btn').addEventListener('click', () => {
  configOverlay.classList.remove('visible');
  startZoneDrawing();
});

// ---------- Switching maps ----------
function switchMap(id) {
  setCurrentMapId(id);

  if (id === 'main') {
    map.setMaxBounds(null);
  } else {
    const zone = getZones().find(z => z.id === id);
    if (!zone) {
      setCurrentMapId('main');
      mapSelect.value = 'main';
      map.setMaxBounds(null);
      renderAll();
      return;
    }
    const bounds = L.latLngBounds(zone.bounds);
    map.flyToBounds(bounds);
    map.setMaxBounds(bounds.pad(0.05));
  }

  renderAll();
}

// ---------- Init ----------
renderMapSelect();
renderToolbar();

const initialZone = getCurrentZone();
if (initialZone) {
  map.fitBounds(L.latLngBounds(initialZone.bounds));
  map.setMaxBounds(L.latLngBounds(initialZone.bounds).pad(0.05));
}

renderAll();
