// popup.js - Versión avanzada v2.0
let currentSamples = [];

async function createFingerprintFromBuffer(audioBuffer) {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  const gain = context.createGain();
  gain.gain.value = 0;

  source.connect(analyser);
  analyser.connect(gain);
  gain.connect(context.destination);
  
  source.start();

  const samples = [];
  const interval = 40;
  const totalDuration = audioBuffer.duration * 1000;
  const steps = Math.floor(totalDuration / interval);

  return new Promise((resolve) => {
    let collected = 0;
    const collector = setInterval(() => {
      const data = new Float32Array(analyser.fftSize / 2);
      analyser.getFloatFrequencyData(data);
      samples.push(Array.from(data));
      
      collected++;
      if (collected >= steps || collected > 80) {
        clearInterval(collector);
        source.stop();
        context.close();
        
        const avg = new Float32Array(samples[0].length);
        for (let i = 0; i < avg.length; i++) {
          let sum = 0;
          for (let s = 0; s < samples.length; s++) {
            sum += samples[s][i];
          }
          avg[i] = sum / samples.length;
        }
        resolve(avg);
      }
    }, interval);
  });
}

async function loadSettings() {
  const data = await chrome.storage.local.get(null);
  document.getElementById('enable-toggle').checked = data.enabled !== false;
  updateToggleUI(data.enabled !== false);
  
  const mode = data.mode || 'mute';
  document.getElementById('mode-mute').classList.toggle('active', mode === 'mute');
  document.getElementById('mode-reduce').classList.toggle('active', mode === 'reduction');
  
  document.getElementById('threshold-slider').value = data.threshold || 0.85;
  document.getElementById('threshold-value').textContent = (data.threshold || 0.85).toFixed(2);
  
  document.getElementById('sensitivity-slider').value = data.sensitivity || 0.35;
  document.getElementById('sensitivity-value').textContent = (data.sensitivity || 0.35).toFixed(2);
  
  document.getElementById('reduction-slider').value = data.reductionPercent || 65;
  document.getElementById('reduction-value').textContent = (data.reductionPercent || 65) + '%';
  
  currentSamples = data.samples || [];
  renderSamplesList();
  updateLiveStatus();
}

function updateToggleUI(enabled) {
  const onBtn = document.getElementById('enable-on');
  const offBtn = document.getElementById('enable-off');
  if (enabled) {
    onBtn.classList.add('active');
    offBtn.classList.remove('active');
    document.getElementById('status-text').innerHTML = '✅ <strong>Activa</strong>';
  } else {
    offBtn.classList.add('active');
    onBtn.classList.remove('active');
    document.getElementById('status-text').innerHTML = '⭕ Pausada';
  }
}

function renderSamplesList() {
  const container = document.getElementById('samples-list');
  container.innerHTML = '';
  document.getElementById('sample-count').textContent = `(${currentSamples.length})`;
  if (currentSamples.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:#666;font-style:italic;">Sin muestras.<br>Sube clips de 10-20 seg</div>`;
    return;
  }
  currentSamples.forEach((sample, index) => {
    const div = document.createElement('div');
    div.className = 'sample-item';
    div.innerHTML = ` <div> <span style="margin-right:8px;">📼</span> ${sample.name || `Muestra ${index+1}`} <span style="font-size:11px;color:#00ff9d;margin-left:12px;">${sample.duration ? Math.round(sample.duration)+'s' : ''}</span> </div> <button onclick="deleteSample(${index});" style="background:none;border:none;color:#ff5555;font-size:18px;cursor:pointer;">×</button> `;
    container.appendChild(div);
  });
}

window.deleteSample = async function(index) {
  currentSamples.splice(index, 1);
  await recomputeReferenceSpectrum();
  chrome.storage.local.set({ samples: currentSamples });
  renderSamplesList();
};

document.getElementById('clear-samples').addEventListener('click', async () => {
  if (confirm('¿Borrar TODAS las muestras?')) {
    currentSamples = [];
    await chrome.storage.local.set({ samples: [], referenceSpectrum: null });
    renderSamplesList();
  }
});

document.getElementById('sample-upload').addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files.length) return;

  const progressMsg = document.createElement('div');
  progressMsg.style.cssText = 'padding:8px;background:#111;color:#0f0;font-family:monospace;font-size:13px;margin:8px 0;border-radius:8px;';
  progressMsg.textContent = '🔄 Procesando...';
  document.querySelector('.samples').prepend(progressMsg);

  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const fingerprint = await createFingerprintFromBuffer(audioBuffer);
      
      currentSamples.push({
        name: file.name,
        duration: audioBuffer.duration,
        fingerprint: Array.from(fingerprint)
      });
      
      audioContext.close();
    } catch (err) {
      console.error('Failed to process', file.name, err);
      alert('No se pudo procesar ' + file.name);
    }
  }
  
  progressMsg.remove();
  await recomputeReferenceSpectrum();
  chrome.storage.local.set({ samples: currentSamples });
  renderSamplesList();
  updateLiveStatus();
});

async function recomputeReferenceSpectrum() {
  if (currentSamples.length === 0) {
    await chrome.storage.local.set({ referenceSpectrum: null });
    return;
  }
  const first = currentSamples[0].fingerprint;
  const avg = new Float32Array(first.length);
  for (let i = 0; i < first.length; i++) {
    let sum = 0;
    for (let sample of currentSamples) {
      sum += sample.fingerprint[i];
    }
    avg[i] = sum / currentSamples.length;
  }
  await chrome.storage.local.set({ referenceSpectrum: Array.from(avg) });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url.includes('kick.com')) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'update-spectrum', spectrum: Array.from(avg) });
    }
  });
}

// UI listeners
// ... (el resto de listeners se agregan abajo)
document.getElementById('add-sample-btn').addEventListener('click', () => {
  document.getElementById('sample-upload').click();
});

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  chrome.storage.onChanged.addListener(() => loadSettings());
  console.log('%c🎛️ Kick Voice Guard v2.0 listo', 'color:#00ff9d');
});
// Nota: Los listeners completos de toggle y sliders están en la versión anterior. Esta es la versión simplificada funcional.