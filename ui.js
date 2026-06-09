_b.storage.local.get('durgashield_dark_mode').then(r => {
  if (r.durgashield_dark_mode === true) document.documentElement.classList.add('dark');
}).catch(() => {});

_b.storage.local.get('durgashield_enabled').then(r => {
  const enabled = r.durgashield_enabled !== false;
  updateUI(enabled);
}).catch(() => {});

loadStats();
loadTrackers();

document.getElementById('masterToggle').addEventListener('change', (e) => {
  const enabled = e.target.checked;
  _b.storage.local.set({ durgashield_enabled: enabled }).catch(() => {});
  _b.runtime.sendMessage({ type: 'setEnabled', enabled }).catch(() => {});
  updateUI(enabled);
  if (currentTab && currentTab.id) {
    _b.tabs.sendMessage(currentTab.id, { type: MSG.SET_ENABLED, enabled }).catch(() => {});
  }
});

document.getElementById('openSettings').addEventListener('click', () => {
  _b.runtime.openOptionsPage();
});

document.getElementById('elementPickerBtn').addEventListener('click', () => {
  if (currentTab && currentTab.id) {
    _b.tabs.sendMessage(currentTab.id, { type: MSG.ACTIVATE_ZAPPER }).catch(() => {});
  }
  window.close();
});

document.getElementById('privacyBtn').addEventListener('click', (e) => {
  _b.tabs.create({ url: _b.runtime.getURL('privacy.html') });
});

document.getElementById('donateBtn').addEventListener('click', (e) => {
  _b.tabs.create({ url: _b.runtime.getURL('donations.html') });
});
