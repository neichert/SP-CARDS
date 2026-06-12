// ---------- Configuration ----------
const STORAGE_KEY = 'fireMapItems';

const TYPE_CONFIG = {
  hydrant: { emoji: '🚒', color: '#e74c3c', label: 'Borne incendie' },
  water:   { emoji: '💧', color: '#3498db', label: "Point d'eau" },
  closure: { emoji: '🚧', color: '#f39c12', label: 'Route barrée' },
  danger:  { emoji: '⚠️', color: '#9b59b6', label: 'Danger / Accès difficile' },
  command: { emoji: '🏠', color: '#27ae60', label: 'Poste de commandement' },
};

// ---------- Map setup ----------
const map = L.map('map', { zoomControl: true });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Default view: France. Try to use geolocation if available.
map.setView([46.6, 2.4], 6);
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    pos => map.setView([pos.coords.latitude, pos.coords.longitude], 14),
    () => { /* ignore, keep default view */ }
  );
}

const itemsLayer = L.layerGroup().addTo(map);
let searchMarker = null;

// ---------- Data persistence ----------
function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Erreur de chargement des données', e);
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

let items = loadItems();

// ---------- Icon helper ----------
function makeIcon(type) {
  const conf = TYPE_CONFIG[type];
  return L.divIcon({
    html: `<div class="map-pin" style="background:${conf.color}"><span>${conf.emoji}</span></div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// ---------- Render ----------
function renderAll() {
  itemsLayer.clearLayers();
  items.forEach(item => renderItem(item));
  renderSidebar();
}

function renderItem(item) {
  const conf = TYPE_CONFIG[item.type] || TYPE_CONFIG.danger;

  if (item.type === 'closure') {
    const line = L.polyline(item.latlngs, {
      color: conf.color,
      weight: 5,
      dashArray: '8 8',
    });
    line.bindPopup(buildPopupContent(item));
    line.addTo(itemsLayer);
  } else {
    const marker = L.marker(item.latlng, { icon: makeIcon(item.type) });
    marker.bindPopup(buildPopupContent(item));
    marker.addTo(itemsLayer);
  }
}

function buildPopupContent(item) {
  const conf = TYPE_CONFIG[item.type] || TYPE_CONFIG.danger;
  const container = document.createElement('div');

  const title = document.createElement('strong');
  title.textContent = `${conf.emoji} ${conf.label}`;
  container.appendChild(title);

  if (item.label) {
    const p = document.createElement('div');
    p.textContent = item.label;
    p.style.margin = '6px 0';
    container.appendChild(p);
  }

  const delBtn = document.createElement('button');
  delBtn.textContent = '🗑 Supprimer';
  delBtn.style.marginTop = '6px';
  delBtn.onclick = () => requireAuth(() => deleteItem(item.id));
  container.appendChild(delBtn);

  return container;
}

function deleteItem(id) {
  items = items.filter(i => i.id !== id);
  saveItems(items);
  renderAll();
  showStatus('Élément supprimé');
}

// ---------- Sidebar ----------
const itemList = document.getElementById('item-list');

function renderSidebar() {
  itemList.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.style.color = '#888';
    empty.style.fontSize = '14px';
    empty.textContent = 'Aucun élément ajouté pour le moment.';
    itemList.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const conf = TYPE_CONFIG[item.type] || TYPE_CONFIG.danger;
    const row = document.createElement('div');
    row.className = 'item-row';

    const icon = document.createElement('span');
    icon.className = 'item-icon';
    icon.textContent = conf.emoji;
    row.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'item-label';
    label.textContent = item.label || conf.label;
    row.appendChild(label);

    const goBtn = document.createElement('button');
    goBtn.title = 'Centrer sur la carte';
    goBtn.textContent = '🎯';
    goBtn.onclick = () => {
      const target = item.type === 'closure' ? item.latlngs[0] : item.latlng;
      map.setView(target, 17);
    };
    row.appendChild(goBtn);

    const delBtn = document.createElement('button');
    delBtn.title = 'Supprimer';
    delBtn.textContent = '🗑';
    delBtn.onclick = () => requireAuth(() => deleteItem(item.id));
    row.appendChild(delBtn);

    itemList.appendChild(row);
  });
}

// ---------- Status bar ----------
const statusBar = document.getElementById('status-bar');
let statusTimeout;
function showStatus(text) {
  statusBar.textContent = text;
  statusBar.classList.add('visible');
  clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => statusBar.classList.remove('visible'), 2500);
}

// ---------- Toolbar / modes ----------
let mode = 'none';
let pendingClosurePoints = [];
let tempLayer = null;

const toolButtons = document.querySelectorAll('.tool-btn');
toolButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    requireAuth(() => {
      const newMode = btn.dataset.mode;
      if (mode === newMode) {
        setMode('none');
      } else {
        setMode(newMode);
      }
    });
  });
});

document.getElementById('cancel-mode-btn').addEventListener('click', () => setMode('none'));

function setMode(newMode) {
  mode = newMode;
  pendingClosurePoints = [];
  clearTempLayer();

  toolButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  if (mode === 'none') {
    showStatus('');
    statusBar.classList.remove('visible');
  } else if (mode === 'closure') {
    showStatus('Cliquez sur la carte pour placer le début de la route barrée');
  } else {
    const conf = TYPE_CONFIG[mode];
    showStatus(`Cliquez sur la carte pour placer : ${conf.label}`);
  }
}

function clearTempLayer() {
  if (tempLayer) {
    map.removeLayer(tempLayer);
    tempLayer = null;
  }
}

// ---------- Map click handling ----------
map.on('click', e => {
  if (mode === 'none') return;

  if (mode === 'closure') {
    handleClosureClick(e.latlng);
  } else {
    handlePointClick(mode, e.latlng);
  }
});

function handlePointClick(type, latlng) {
  const conf = TYPE_CONFIG[type];
  tempLayer = L.marker(latlng, { icon: makeIcon(type) }).addTo(map);

  openModal(`Ajouter : ${conf.label}`, label => {
    items.push({
      id: generateId(),
      type,
      latlng: [latlng.lat, latlng.lng],
      label,
    });
    saveItems(items);
    clearTempLayer();
    renderAll();
    showStatus(`${conf.label} ajouté(e)`);
    setMode('none');
  }, () => {
    clearTempLayer();
    setMode('none');
  });
}

function handleClosureClick(latlng) {
  pendingClosurePoints.push(latlng);

  if (pendingClosurePoints.length === 1) {
    clearTempLayer();
    tempLayer = L.marker(latlng, { icon: makeIcon('closure') }).addTo(map);
    showStatus('Cliquez sur la carte pour placer la fin de la route barrée');
  } else if (pendingClosurePoints.length === 2) {
    clearTempLayer();
    tempLayer = L.polyline(pendingClosurePoints, {
      color: TYPE_CONFIG.closure.color,
      weight: 5,
      dashArray: '8 8',
    }).addTo(map);

    openModal('Ajouter : Route barrée', label => {
      items.push({
        id: generateId(),
        type: 'closure',
        latlngs: pendingClosurePoints.map(p => [p.lat, p.lng]),
        label,
      });
      saveItems(items);
      clearTempLayer();
      pendingClosurePoints = [];
      renderAll();
      showStatus('Route barrée ajoutée');
      setMode('none');
    }, () => {
      clearTempLayer();
      pendingClosurePoints = [];
      setMode('closure');
    });
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Modal ----------
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalLabel = document.getElementById('modal-label');
const modalSave = document.getElementById('modal-save');
const modalCancel = document.getElementById('modal-cancel');

let modalSaveCallback = null;
let modalCancelCallback = null;

function openModal(title, onSave, onCancel) {
  modalTitle.textContent = title;
  modalLabel.value = '';
  modalSaveCallback = onSave;
  modalCancelCallback = onCancel;
  modalOverlay.classList.add('visible');
  setTimeout(() => modalLabel.focus(), 50);
}

function closeModal() {
  modalOverlay.classList.remove('visible');
  modalSaveCallback = null;
  modalCancelCallback = null;
}

modalSave.addEventListener('click', () => {
  const label = modalLabel.value.trim();
  const cb = modalSaveCallback;
  closeModal();
  if (cb) cb(label);
});

modalCancel.addEventListener('click', () => {
  const cb = modalCancelCallback;
  closeModal();
  if (cb) cb();
});

modalLabel.addEventListener('keydown', e => {
  if (e.key === 'Enter') modalSave.click();
  if (e.key === 'Escape') modalCancel.click();
});

// ---------- Sidebar toggle ----------
const sidebar = document.getElementById('sidebar');
document.getElementById('sidebar-toggle').addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

// ---------- Export / Import / Clear ----------
document.getElementById('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `carte-pompiers-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

const importFile = document.getElementById('import-file');
document.getElementById('import-btn').addEventListener('click', () => {
  requireAuth(() => importFile.click());
});

importFile.addEventListener('change', () => {
  const file = importFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('Format invalide');

      const existingIds = new Set(items.map(i => i.id));
      imported.forEach(item => {
        if (!item.id || existingIds.has(item.id)) {
          item.id = generateId();
        }
        items.push(item);
      });
      saveItems(items);
      renderAll();
      showStatus(`${imported.length} élément(s) importé(s)`);
    } catch (e) {
      alert("Erreur : le fichier n'est pas un export valide.");
    }
    importFile.value = '';
  };
  reader.readAsText(file);
});

document.getElementById('clear-btn').addEventListener('click', () => {
  requireAuth(() => {
    if (items.length === 0) return;
    if (confirm('Voulez-vous vraiment supprimer tous les éléments de la carte ? Cette action est irréversible.')) {
      items = [];
      saveItems(items);
      renderAll();
      showStatus('Toutes les données ont été effacées');
    }
  });
});

// ---------- Search (Nominatim / OpenStreetMap) ----------
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchTimeout;

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  clearTimeout(searchTimeout);

  if (query.length < 3) {
    searchResults.classList.remove('visible');
    searchResults.innerHTML = '';
    return;
  }

  searchTimeout = setTimeout(() => doSearch(query), 400);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    searchResults.classList.remove('visible');
  }
});

async function doSearch(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&accept-language=fr&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    showSearchResults(data);
  } catch (e) {
    console.error('Erreur de recherche', e);
  }
}

function showSearchResults(results) {
  searchResults.innerHTML = '';

  if (!results || results.length === 0) {
    const div = document.createElement('div');
    div.textContent = 'Aucun résultat trouvé';
    div.style.color = '#888';
    searchResults.appendChild(div);
    searchResults.classList.add('visible');
    return;
  }

  results.forEach(result => {
    const div = document.createElement('div');
    div.textContent = result.display_name;
    div.addEventListener('click', () => {
      goToSearchResult(result);
      searchResults.classList.remove('visible');
      searchInput.value = result.display_name;
    });
    searchResults.appendChild(div);
  });

  searchResults.classList.add('visible');
}

function goToSearchResult(result) {
  const lat = parseFloat(result.lat);
  const lon = parseFloat(result.lon);

  if (result.boundingbox) {
    const bb = result.boundingbox.map(parseFloat);
    map.fitBounds([[bb[0], bb[2]], [bb[1], bb[3]]]);
  } else {
    map.setView([lat, lon], 17);
  }

  if (searchMarker) {
    map.removeLayer(searchMarker);
  }
  searchMarker = L.marker([lat, lon]).addTo(map);
  searchMarker.bindPopup(result.display_name).openPopup();
}

// Hide search results when clicking elsewhere
document.addEventListener('click', e => {
  if (!document.getElementById('search-box').contains(e.target)) {
    searchResults.classList.remove('visible');
  }
});

// ---------- Init ----------
renderAll();
