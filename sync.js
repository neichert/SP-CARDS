// ---------- Cloud sync (Firebase Realtime Database) ----------
// Keeps items, point type configs, zones and the password hash in sync
// across every device/browser that opens this site.

const SYNC_REF = db.ref('sync');

function pushToCloud(key, value) {
  SYNC_REF.child(key).set(value).catch(e => console.error('Erreur de synchronisation', e));
}

function toArray(value) {
  return Array.isArray(value) ? value : Object.values(value);
}

SYNC_REF.on('value', snapshot => {
  const data = snapshot.val();

  if (!data) {
    // Nothing in the cloud yet: seed it with whatever is stored locally.
    pushToCloud('items', items);
    pushToCloud('typeConfigs', getTypeConfigs());
    pushToCloud('zones', getZones());
    pushToCloud('passwordHash', getStoredPasswordHash());
    return;
  }

  if (data.items) {
    items = toArray(data.items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } else {
    pushToCloud('items', items);
  }

  if (data.typeConfigs) {
    localStorage.setItem(TYPE_CONFIG_KEY, JSON.stringify(toArray(data.typeConfigs)));
  } else {
    pushToCloud('typeConfigs', getTypeConfigs());
  }

  if (data.zones) {
    localStorage.setItem(ZONES_KEY, JSON.stringify(toArray(data.zones)));
  } else {
    pushToCloud('zones', getZones());
  }

  if (data.passwordHash) {
    localStorage.setItem(PASSWORD_HASH_KEY, data.passwordHash);
  } else {
    pushToCloud('passwordHash', getStoredPasswordHash());
  }

  renderToolbar();
  renderMapSelect();
  renderAll();
});
