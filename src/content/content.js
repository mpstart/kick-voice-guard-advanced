let currentSettings = {};
const observer = new MutationObserver(() => {
  const player = document.querySelector('video');
  if (player && !window.AudioProcessor?.context && currentSettings.enabled) {
    window.AudioProcessor.init(player);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

chrome.storage.onChanged.addListener((changes) => {
  Object.keys(changes).forEach(key => currentSettings[key] = changes[key].newValue);
  if (window.VoiceDetection && changes.referenceSpectrum) {
    window.VoiceDetection.updateReferenceSpectrum(changes.referenceSpectrum.newValue);
  }
});

window.addEventListener('load', () => {
  chrome.storage.local.get(null, (s) => {
    currentSettings = s;
    if (s.enabled) {
      const player = document.querySelector('video');
      if (player) window.AudioProcessor.init(player);
    }
  });
});
console.log('%c✅ Kick Voice Guard v2.0 cargada en Kick.com', 'color:#00ff9d');