import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, ArrowLeft, ArrowRight, Crown, ShieldCheck, Loader2 } from 'lucide-react';
import { PAY_METHODS, PRO_PRICE, CONTACTS } from '../config/proConfig';
import { LicenseService, useLicense } from '../services/licenseService';

const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ onClose, children, wide }) => (
  <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} bg-[#0b1410] border border-[#1d3228] rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto`}>{children}</div>
  </div>
);
const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }> = ({ primary, className = '', ...p }) => (
  <button type="button" {...p} className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${primary ? 'bg-[#bef264] hover:bg-[#a3e635] text-black' : 'bg-[#111e18] hover:bg-[#192c23] text-neutral-200 border border-[#1d3228]'} ${className}`} />
);
const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [ok, setOk] = useState(false);
  return <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }} className="text-neutral-400 hover:text-white cursor-pointer shrink-0" title="Copy">{ok ? <Check className="w-3.5 h-3.5 text-[#bef264]" /> : <Copy className="w-3.5 h-3.5" />}</button>;
};

// ---------------- Buy Pro (payment method -> send proof -> get ID) ----------------
export const BuyProModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const lic = useLicense();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [method, setMethod] = useState(PAY_METHODS[0]?.id);
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const m = PAY_METHODS.find(x => x.id === method) || PAY_METHODS[0];
  const open = (url: string) => { if (url) window.electronAPI?.openExternal?.(url); };
  const getId = async () => {
    setBusy(true);
    try { const r = await window.electronAPI?.licenseRegister?.(); setId(r?.id || lic.id); } catch { setId(lic.id); }
    setBusy(false); setStep(3);
  };
  return (
    <Overlay onClose={onClose} wide>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-xl bg-[#bef264]/15 text-[#bef264] flex items-center justify-center"><Crown className="w-4 h-4" /></div>
          <div><h3 className="text-base font-bold text-white">Buy ClipForge Pro</h3><p className="text-[11px] text-neutral-400">One-time payment · tied to this PC · {PRO_PRICE}</p></div></div>
        <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
      </div>

      {step === 1 && (<>
        <p className="text-xs text-neutral-300">Step 1 of 3 · Choose how you want to pay.</p>
        <div className="grid grid-cols-2 gap-2">
          {PAY_METHODS.map(x => (
            <button key={x.id} type="button" onClick={() => setMethod(x.id)}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold text-left cursor-pointer border ${method === x.id ? 'bg-[#12201a] border-[#3f9a5a] text-[#8fd0a4]' : 'bg-[#0f1c16] border-[#1d3228] text-neutral-300 hover:text-white'}`}>{x.name}</button>
          ))}
        </div>
        {m && (
          <div className="rounded-xl bg-[#09100d] border border-[#17291f] p-3 space-y-2">
            {m.lines.map(l => (
              <div key={l.label} className="flex items-center justify-between gap-3 text-xs"><span className="text-neutral-500">{l.label}</span><span className="flex items-center gap-2 text-neutral-100 font-mono break-all text-right">{l.value}<CopyBtn text={l.value} /></span></div>
            ))}
            {m.note && <p className="text-[11px] text-amber-300/90">{m.note}</p>}
          </div>
        )}
        <div className="flex justify-between pt-1"><Btn onClick={onClose}>Close</Btn><Btn primary onClick={() => setStep(2)}>I have paid · Send proof <ArrowRight className="w-3.5 h-3.5" /></Btn></div>
      </>)}

      {step === 2 && (<>
        <p className="text-xs text-neutral-300">Step 2 of 3 · Send a screenshot of your payment on any of these. Then tap <b>Get my ID</b> and send the ID together with the screenshot.</p>
        <div className="space-y-2">
          {Object.values(CONTACTS).map(c => (
            <div key={c.label} className="flex items-center justify-between gap-3 rounded-xl bg-[#09100d] border border-[#17291f] px-3 py-2.5">
              <div><div className="text-xs font-bold text-white">{c.label}</div><div className="text-[11px] text-neutral-400 font-mono">{c.handle}</div></div>
              <div className="flex items-center gap-2"><CopyBtn text={c.handle} />{c.url && <Btn onClick={() => open(c.url)} className="!py-1.5">Open</Btn>}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-between pt-1"><Btn onClick={() => setStep(1)}><ArrowLeft className="w-3.5 h-3.5" /> Back</Btn><Btn primary onClick={getId} disabled={busy}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Get my ID <ArrowRight className="w-3.5 h-3.5" /></Btn></div>
      </>)}

      {step === 3 && (<>
        <p className="text-xs text-neutral-300">Step 3 of 3 · This is your PC's unique ID. Copy it and send it with your payment proof. After checking, I will unlock Pro for this PC. It stays unlocked even if you reinstall ClipForge.</p>
        <div className="rounded-xl bg-[#09100d] border border-[#3f9a5a]/50 px-4 py-4 flex items-center justify-between gap-3"><span className="font-mono text-base text-[#bef264] tracking-wider">{id || lic.id}</span><CopyBtn text={id || lic.id} /></div>
        {!lic.configured && <p className="text-[11px] text-amber-300">The licence server is not set up in this build yet.</p>}
        <div className="flex justify-between pt-1"><Btn onClick={() => setStep(2)}><ArrowLeft className="w-3.5 h-3.5" /> Back</Btn><Btn primary onClick={() => { LicenseService.refresh(); onClose(); }}>Done</Btn></div>
      </>)}
    </Overlay>
  );
};

// ---------------- Owner: password popup ----------------
export const OwnerLogin: React.FC<{ onClose: () => void; onOk: () => void }> = ({ onClose, onOk }) => {
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const go = async () => {
    if (!pw) return;
    setBusy(true); setErr('');
    const r = await window.electronAPI?.ownerCheck?.(pw);
    setBusy(false);
    if (r?.ok) { LicenseService.setOwner(pw); onOk(); }
    else setErr(r?.error === 'not-configured' ? 'The licence server is not set up in this build.' : 'Wrong password.');
  };
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#bef264]" /><h3 className="text-sm font-bold text-white">Owner access</h3></div>
      <input ref={ref} type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} placeholder="Password"
        className="w-full bg-[#09100d] border border-[#1d3228] focus:border-[#3f9a5a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
      {err && <p className="text-[11px] text-red-400">{err}</p>}
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>Cancel</Btn><Btn primary onClick={go} disabled={busy || !pw}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Enter</Btn></div>
    </Overlay>
  );
};

// ---------------- Owner: CMS panel (set a PC id to Pro true / false) ----------------
export const OwnerPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { ownerPw: pw } = useLicense();
  const [id, setId] = useState('');
  const [sugg, setSugg] = useState<{ id: string; pro: boolean }[]>([]);
  const [info, setInfo] = useState<{ exists: boolean; pro: boolean } | null>(null);
  const [pro, setPro] = useState<'true' | 'false'>('false');
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const clean = id.trim().toUpperCase();
  const complete = /^CF-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(clean);

  useEffect(() => {
    setMsg(null); setConfirm(false);
    if (!pw || clean.length < 2) { setSugg([]); setInfo(null); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      const s = await window.electronAPI?.ownerSuggest?.(pw, clean);
      if (my !== seq.current) return;
      setSugg(s?.list || []);
      if (complete) {
        const l = await window.electronAPI?.ownerLookup?.(pw, clean);
        if (my !== seq.current) return;
        if (l?.ok) { setInfo({ exists: !!l.exists, pro: !!l.pro }); setPro(l.pro ? 'true' : 'false'); }
      } else setInfo(null);
    }, 350);
    return () => clearTimeout(t);
  }, [clean, pw, complete]);

  const save = async () => {
    if (!pw) return;
    setBusy(true);
    const r = await window.electronAPI?.ownerSet?.(pw, clean, pro === 'true');
    setBusy(false); setConfirm(false);
    if (r?.ok) { setMsg({ ok: true, t: `Saved. ${clean} is now Pro = ${pro}.` }); setInfo({ exists: true, pro: pro === 'true' }); LicenseService.refresh(); }
    else setMsg({ ok: false, t: r?.error === 'denied' ? 'Access denied (wrong password).' : `Could not save: ${r?.error || 'unknown error'}` });
  };

  return (
    <Overlay onClose={onClose} wide>
      <div className="flex items-start justify-between"><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#bef264]" /><h3 className="text-sm font-bold text-white">Owner panel</h3></div>
        <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button></div>

      <section className="space-y-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">ID</h4>
        <input value={id} onChange={e => setId(e.target.value)} placeholder="CF-XXXX-XXXX-XXXX-XXXX" spellCheck={false}
          className="w-full bg-[#09100d] border border-[#1d3228] focus:border-[#3f9a5a] rounded-lg px-3 py-2 text-sm font-mono text-white uppercase focus:outline-none" />
        {complete && info && (
          <p className={`text-[11px] ${info.exists ? 'text-[#8fd0a4]' : 'text-amber-300'}`}>{info.exists ? `This ID exists · currently Pro = ${info.pro}` : 'This ID does not exist yet (saving will create it).'}</p>
        )}
        {!complete && clean.length >= 2 && sugg.length === 0 && <p className="text-[11px] text-neutral-500">No matching ID found.</p>}
        {sugg.length > 0 && !(complete && sugg.length === 1 && sugg[0].id === clean) && (
          <div className="rounded-lg border border-[#17291f] bg-[#09100d] divide-y divide-[#13231b] overflow-hidden">
            {sugg.map(s => (
              <button key={s.id} type="button" onClick={() => setId(s.id)} className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-mono text-neutral-200 hover:bg-[#10201a] cursor-pointer">
                <span>{s.id}</span><span className={s.pro ? 'text-[#bef264]' : 'text-neutral-500'}>{s.pro ? 'PRO' : 'free'}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Pro</h4>
        <select value={pro} onChange={e => setPro(e.target.value as 'true' | 'false')} disabled={!complete}
          className="w-full bg-[#09100d] border border-[#1d3228] rounded-lg px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50">
          <option value="true">true</option><option value="false">false</option>
        </select>
      </section>

      {msg && <p className={`text-xs ${msg.ok ? 'text-[#8fd0a4]' : 'text-red-400'}`}>{msg.t}</p>}
      {!confirm ? (
        <div className="flex justify-end"><Btn primary disabled={!complete || busy} onClick={() => setConfirm(true)}>Save</Btn></div>
      ) : (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs text-amber-200">Are you sure? Set <span className="font-mono">{clean}</span> to Pro = <b>{pro}</b>.</p>
          <div className="flex justify-end gap-2"><Btn onClick={() => setConfirm(false)}>No</Btn><Btn primary onClick={save} disabled={busy}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Yes, update</Btn></div>
        </div>
      )}
    </Overlay>
  );
};
