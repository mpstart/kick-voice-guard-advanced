// ADVANCED VOICE DETECTION v3.0 - MFCC-like + Pre-emphasis + Hamming + VAD + Multi-frame
window.VoiceDetection = {
  REFERENCE_EMBEDDING: null,
  THRESHOLD: 0.80,
  SENSITIVITY: 0.50,
  fftSize: 2048,
  bufferLength: 1024,

  // Pre-emphasis filter
  preEmphasis: function(data) {
    const result = new Float32Array(data.length);
    result[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      result[i] = data[i] - 0.97 * data[i-1];
    }
    return result;
  },

  // Hamming window
  hammingWindow: function(data) {
    const result = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (data.length - 1)));
    }
    return result;
  },

  // Simple MFCC-like features (13 coefficients approximation)
  extractFeatures: function(frequencyData) {
    const features = new Float32Array(13);
    const logMel = new Float32Array(13);
    // Approximate Mel filter banks (simplified for browser)
    for (let i = 0; i < 13; i++) {
      const start = Math.floor(i * (frequencyData.length / 26));
      const end = Math.floor((i + 1) * (frequencyData.length / 26));
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += frequencyData[j];
      }
      logMel[i] = Math.log(Math.max(sum / (end - start), 1e-10));
    }
    // DCT approximation for MFCC
    for (let i = 0; i < 13; i++) {
      let sum = 0;
      for (let j = 0; j < 13; j++) {
        sum += logMel[j] * Math.cos(Math.PI * i * (j + 0.5) / 13);
      }
      features[i] = sum;
    }
    return features;
  },

  // Cosine similarity
  cosineSimilarity: function(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  },

  getEnergy: function(timeData) {
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      sum += timeData[i] * timeData[i];
    }
    return Math.sqrt(sum / timeData.length);
  },

  isTargetSpeaking: function(analyser) {
    if (!this.REFERENCE_EMBEDDING) return false;

    const frequencyData = new Float32Array(this.fftSize / 2);
    const timeData = new Uint8Array(this.fftSize);
    analyser.getFloatFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeData);

    const energy = this.getEnergy(timeData);
    if (energy < 0.025) return false; // VAD - ignore low energy

    const preEmphasized = this.preEmphasis(frequencyData);
    const windowed = this.hammingWindow(preEmphasized);
    const features = this.extractFeatures(windowed);

    const similarity = this.cosineSimilarity(features, this.REFERENCE_EMBEDDING);

    const effectiveThreshold = this.THRESHOLD - (this.SENSITIVITY * 0.25);

    const detected = similarity > effectiveThreshold;

    if (window.DEBUG_MODE) {
      console.log(`[KVG Advanced] MFCC Sim: ${(similarity*100).toFixed(1)}% | Energy: ${(energy*100).toFixed(1)}% | Detected: ${detected}`);
    }

    return detected;
  },

  updateReferenceEmbedding: function(newEmbedding) {
    this.REFERENCE_EMBEDDING = newEmbedding;
    console.log('%c✅ Advanced voice embedding updated (MFCC-like)', 'color:#00ff9d');
  },

  createEmbeddingFromBuffer: async function(audioBuffer) {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const source = context.createBufferSource();
    source.buffer = audioBuffer;

    const analyser = context.createAnalyser();
    analyser.fftSize = this.fftSize;
    const gain = context.createGain();
    gain.gain.value = 0;

    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(context.destination);

    source.start();

    const embeddings = [];
    const interval = 50;
    const steps = Math.floor(audioBuffer.duration * 1000 / interval);

    return new Promise((resolve) => {
      let collected = 0;
      const collector = setInterval(() => {
        const data = new Float32Array(analyser.fftSize / 2);
        analyser.getFloatFrequencyData(data);
        const pre = this.preEmphasis(data);
        const win = this.hammingWindow(pre);
        embeddings.push(Array.from(this.extractFeatures(win)));

        collected++;
        if (collected >= steps || collected > 60) {
          clearInterval(collector);
          source.stop();
          context.close();

          // Average all embeddings
          const avg = new Float32Array(embeddings[0].length);
          for (let i = 0; i < avg.length; i++) {
            let sum = 0;
            for (let s = 0; s < embeddings.length; s++) {
              sum += embeddings[s][i];
            }
            avg[i] = sum / embeddings.length;
          }
          resolve(avg);
        }
      }, interval);
    });
  }
};
