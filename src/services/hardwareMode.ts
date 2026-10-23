// Which hardware does the heavy work: processor, graphics card, or both together. Remembered on this computer.
export type HardwareMode = 'cpu' | 'gpu' | 'both';
const KEY = 'cf_hardware_mode';
export const getHardware = (): HardwareMode => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'gpu' || v === 'both' || v === 'cpu') return v;
  } catch { /* storage not available */ }
  // Mac already used its graphics chip (Metal) before this setting existed, so it stays that way by default
  try { if (/Mac/i.test(navigator.platform || '')) return 'gpu'; } catch { /* ignore */ }
  return 'cpu';
};
export const setHardware = (m: HardwareMode) => { try { localStorage.setItem(KEY, m); } catch { /* storage not available */ } };
