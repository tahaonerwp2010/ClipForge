import { useEffect, useState } from 'react';

export interface LicenseState { id: string; pro: boolean; configured: boolean; online: boolean; loaded: boolean; ownerPw: string | null }
let state: LicenseState = { id: '', pro: false, configured: false, online: false, loaded: false, ownerPw: null };
const subs = new Set<() => void>();
const set = (p: Partial<LicenseState>) => { state = { ...state, ...p }; subs.forEach(f => f()); };

export const LicenseService = {
  get: () => state,
  async refresh() {
    try { const s = await window.electronAPI?.licenseStatus?.(); if (s) set({ ...s, loaded: true }); else set({ loaded: true }); } catch { set({ loaded: true }); }
  },
  setOwner: (pw: string | null) => set({ ownerPw: pw }),
};
export function useLicense(): LicenseState {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(n => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return state;
}
