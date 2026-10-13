import React from 'react';
import { AlertTriangle, Download, Trash2 } from 'lucide-react';

interface ConfirmProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const Overlay: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => (
  <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={onClose}>
    <div className="w-full max-w-md bg-[#0b0e12] border border-[#232936] rounded-2xl p-6 shadow-2xl space-y-4" onMouseDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  </div>
);

export const ConfirmDialog: React.FC<ConfirmProps> = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <Overlay onClose={onCancel}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-rose-950/60 text-rose-300' : 'bg-[#bef264]/10 text-[#bef264]'}`}>
          {danger ? <Trash2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <div className="text-xs text-neutral-400 leading-relaxed">{message}</div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl bg-[#14181f] hover:bg-[#1d232e] text-neutral-200 font-bold text-xs border border-[#222834] cursor-pointer">
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm}
          className={`px-4 py-2 rounded-xl font-extrabold text-xs cursor-pointer ${danger ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-[#bef264] hover:bg-[#a3e635] text-black'}`}>
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
};

export const ModelRequiredDialog: React.FC<{ open: boolean; onOpenSettings: () => void; onClose: () => void }> = ({ open, onOpenSettings, onClose }) => {
  if (!open) return null;
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-300">
          <Download className="w-4 h-4" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-white">Speech model required</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            ClipForge needs a speech recognition model to transcribe your video on this computer. No model is installed yet.
            Please download one first (Small is recommended for most PCs), then come back and generate your clips.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-[#14181f] hover:bg-[#1d232e] text-neutral-200 font-bold text-xs border border-[#222834] cursor-pointer">
          Later
        </button>
        <button type="button" onClick={onOpenSettings} className="px-4 py-2 rounded-xl bg-[#bef264] hover:bg-[#a3e635] text-black font-extrabold text-xs cursor-pointer">
          Open Settings &amp; Download
        </button>
      </div>
    </Overlay>
  );
};
