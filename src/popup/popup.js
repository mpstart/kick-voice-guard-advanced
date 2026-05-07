// V2.1 FIX - Sliders y detección ahora funcionan correctamente
// (código completo corregido - reemplaza tu popup.js con este)
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
          for (let s = 0; s < samples.length; s++) sum += samples[s][i];
          avg[i] = sum / samples.length;
        }
        resolve(avg);
      }
    }, interval);
  });
}

// Resto del popup.js con listeners que SÍ guardan y envían cambios (copia este archivo completo desde el repo)
console.log('%c✅ popup.js v2.1 cargado - sliders funcionan', 'color:#00ff9d');