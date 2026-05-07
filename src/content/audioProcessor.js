window.AudioProcessor = {
  context: null,
  source: null,
  analyser: null,
  gainNode: null,
  videoElement: null,
  detectionInterval: null,
  debounceCount: 0,
  DEBOUNCE_FRAMES: 6, // Más debounce
  
  init: function(video) {
    if (this.context) return;
    this.videoElement = video;
    video.muted = true;
    video.volume = 0;
    
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.source = this.context.createMediaElementSource(video);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = window.VoiceDetection.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 1;
    
    this.source.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.context.destination);
    
    this.startDetectionLoop();
  },
  
  startDetectionLoop: function() {
    if (this.detectionInterval) clearInterval(this.detectionInterval);
    this.detectionInterval = setInterval(() => {
      const detected = window.VoiceDetection.isTargetSpeaking(this.analyser);
      this.debounceCount = detected ? Math.min(this.debounceCount + 1, this.DEBOUNCE_FRAMES) : Math.max(this.debounceCount - 1, 0);
      const shouldAct = this.debounceCount >= this.DEBOUNCE_FRAMES;
      
      chrome.storage.local.get(['enabled', 'mode', 'reductionPercent'], (s) => {
        if (!s.enabled) return;
        const targetGain = shouldAct ? (s.mode === 'mute' ? 0 : 1 - (s.reductionPercent/100)) : 1;
        if (this.gainNode) this.gainNode.gain.linearRampToValueAtTime(targetGain, this.context.currentTime + 0.15);
      });
    }, 70);
  }
};