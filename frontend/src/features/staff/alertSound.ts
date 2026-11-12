let context: AudioContext | null = null;

/** Two short tones. Browsers may block sound until the user has clicked the page once. */
export function playAlert(): void {
  try {
    context ??= new AudioContext();
    const now = context.currentTime;
    [0, 0.3].forEach((offset) => {
      const osc = context!.createOscillator();
      const gain = context!.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
      osc.connect(gain).connect(context!.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.22);
    });
  } catch {
    /* audio unavailable: the on-screen banner still shows */
  }
}
