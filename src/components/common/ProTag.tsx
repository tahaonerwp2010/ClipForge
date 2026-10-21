import React from 'react';
import { Crown } from 'lucide-react';
import { PRO_ENFORCED } from '../../config/proConfig';

/** Small "PRO" pill next to a Pro feature. Only shown once the Pro system is switched on (PRO_ENFORCED). */
export const ProTag: React.FC<{ className?: string }> = ({ className = '' }) => {
  if (!PRO_ENFORCED) return null;
  return <span className={`inline-flex items-center gap-1 px-1.5 py-[1px] rounded-md bg-[#bef264] text-black text-[9px] font-extrabold uppercase tracking-wider shrink-0 ${className}`}><Crown className="w-2.5 h-2.5" />Pro</span>;
};
