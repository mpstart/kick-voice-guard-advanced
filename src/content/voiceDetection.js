window.VoiceDetection = {
  REFERENCE_SPECTRUM: null,
  THRESHOLD: 0.85,
  SENSITIVITY: 0.35,
  fftSize: 2048,
  bufferLength: 1024,
  
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
    if (!this.REFERENCE_SPECTRUM) return false;
    
    const frequencyData = new Float32Array(this.fftSize / 2);
    const timeData = new Uint8Array(this.fftSize);
    
    analyser.getFloatFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeData);
    
    const energy = this.getEnergy(timeData);
    if (energy < 0.025) return false; // Umbral de energía más alto
    
    const similarity = this.cosineSimilarity(frequencyData, this.REFERENCE_SPECTRUM);
    
    const effectiveThreshold = this.THRESHOLD - (this.SENSITIVITY * 0.2);
    
    return similarity > effectiveThreshold;
  },
  
  updateReferenceSpectrum: function(newSpectrum) {
    this.REFERENCE_SPECTRUM = new Float32Array(newSpectrum);
  }
};