let audioContext;

function getContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function beep(frequency, duration) {
  const ctx = getContext();

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(1, ctx.currentTime);

  oscillator.start();

  oscillator.stop(ctx.currentTime + duration / 1000);
}

// ✅ Entrada
export function playEntrada() {
  beep(900, 120);
}

// 📤 Salida
export function playSalida() {
  beep(600, 100);

  setTimeout(() => {
    beep(600, 100);
  }, 150);
}

// ❌ Error
export function playError() {
  beep(250, 400);
}