import { useEffect, useState } from 'react';
import { PRO_ENFORCED } from '../config/proConfig';

export interface LicenseState { id: string; pro: boolean; configured: boolean; online: boolean; loaded: boolean; ownerPw: string | null; buyOpen: boolean }
let state: LicenseState = { id: '', pro: false, configured: false, online: false, loaded: false, ownerPw: null, buyOpen: false };
const subs = new Set<() => void>();
const set = (p: Partial<LicenseState>) => { state = { ...state, ...p }; subs.forEach(f => f()); };

export const LicenseService = {
  get: () => state,
  async refresh() {
    try { const s = await window.electronAPI?.licenseStatus?.(); if (s) set({ ...s, loaded: true }); else set({ loaded: true }); } catch { set({ loaded: true }); }
  },
  setOwner: (pw: string | null) => set({ ownerPw: pw }),
  openBuy: () => set({ buyOpen: true }),
  closeBuy: () => set({ buyOpen: false }),
  /** Can this PC use a Pro feature right now? (Always yes while PRO_ENFORCED is false, for Pro PCs and for the owner.) */
  allowed: () => !PRO_ENFORCED || state.pro || !!state.ownerPw,
  /** Call before a Pro feature starts: returns false (and opens the Buy Pro window) when it is locked. */
  guard: () => { if (!PRO_ENFORCED || state.pro || state.ownerPw) return true; set({ buyOpen: true }); return false; },
  locked: () => PRO_ENFORCED && !state.pro && !state.ownerPw,
};
export function useLicense(): LicenseState {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(n => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return state;
}
