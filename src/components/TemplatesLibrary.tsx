import React from 'react';
import { 
  InnerFramingConfig, 
  CaptionConfig, 
  VideoGradingConfig, 
  BrandingConfig 
} from '../types/clipper';
import { Sparkles, Check, Layers, Split, Crop, Maximize } from 'lucide-react';

interface TemplateItem {
  id: string;
  name: string;
  tagline: string;
  category: string;
  framing: Partial<InnerFramingConfig>;
  captions: Partial<CaptionConfig>;
  grading: Partial<VideoGradingConfig>;
  branding: Partial<BrandingConfig>;
}

interface TemplatesLibraryProps {
  onApplyTemplate: (template: TemplateItem) => void;
}

export const TEMPLATE_PRESETS: TemplateItem[] = [
  {
    id: 'podcast-reframe',
    name: 'Podcast Viral Reframe',
    tagline: '16:9 fitted with dynamic blurred backdrop, Alex Hormozi yellow subtitles, and top curiosity hook.',
    category: 'Interviews & Podcasts',
    framing: {
      mode: 'fit-blur',
      blurIntensity: 18,
      backdropDarken: 0.35,
      innerBorderRadius: 12,
      innerShadow: true,
      offsetY: 0
    },
    captions: {
      style: 'hormozi',
      fontSize: 24,
      highlightColor: '#facc15',
      uppercase: true,
      maxWordsPerBeat: 3,
      positionY: 72
    },
    grading: {
      brightness: 105,
      contrast: 110,
      saturation: 110,
      warmth: 5,
      vignette: true,
      speedBoost: 1.05
    },
    branding: {
      showHookTitle: true,
      hookTitle: 'WAIT TILL THE END 🤯',
      hookBgColor: '#facc15',
      showWatermark: true,
      progressBar: 'accent'
    }
  },
  {
    id: 'mrbeast-energy',
    name: 'MrBeast High Retention',
    tagline: 'Full 9:16 vertical crop centered on face, bouncy impact subtitles, and rainbow duration progress bar.',
    category: 'Vlogs & Challenges',
    framing: {
      mode: 'fill-crop',
      panX: 0
    },
    captions: {
      style: 'mrbeast',
      fontSize: 26,
      highlightColor: '#22c55e',
      uppercase: true,
      maxWordsPerBeat: 2,
      positionY: 70
    },
    grading: {
      brightness: 110,
      contrast: 115,
      saturation: 120,
      warmth: 0,
      vignette: false,
      speedBoost: 1.05
    },
    branding: {
      showHookTitle: true,
      hookTitle: 'THE UNTOLD TRUTH 🚨',
      hookBgColor: '#f43f5e',
      showWatermark: true,
      progressBar: 'rainbow'
    }
  },
  {
    id: 'viral-split',
    name: 'Dual Screen Split (2x Retention)',
    tagline: 'Speaker on top, viral satisfying loop on bottom. Proven to double completion rates on TikTok.',
    category: 'Viral Shorts',
    framing: {
      mode: 'split-screen',
      splitRatio: 50,
      secondaryVideoType: 'satisfying'
    },
    captions: {
      style: 'neon',
      fontSize: 24,
      highlightColor: '#38bdf8',
      uppercase: true,
      maxWordsPerBeat: 3,
      positionY: 50
    },
    grading: {
      brightness: 100,
      contrast: 105,
      saturation: 105,
      warmth: 0,
      vignette: false,
      speedBoost: 1.0
    },
    branding: {
      showHookTitle: true,
      hookTitle: 'LISTEN TO THIS CAREFULLY 🧠',
      hookBgColor: '#10b981',
      showWatermark: false,
      progressBar: 'accent'
    }
  },
  {
    id: 'cinematic-matte',
    name: 'Cinematic Matte Letterbox',
    tagline: 'Classic letterbox black bars with plenty of space for intellectual editorial subtitles and clean branding.',
    category: 'Documentary & Cinema',
    framing: {
      mode: 'letterbox',
      offsetY: 0,
      innerShadow: true
    },
    captions: {
      style: 'cinematic',
      fontSize: 22,
      highlightColor: '#facc15',
      uppercase: false,
      maxWordsPerBeat: 4,
      positionY: 75
    },
    grading: {
      brightness: 95,
      contrast: 110,
      saturation: 90,
      warmth: -5,
      vignette: true,
      speedBoost: 1.0
    },
    branding: {
      showHookTitle: false,
      showWatermark: true,
      progressBar: 'minimal'
    }
  }
];

export const TemplatesLibrary: React.FC<TemplatesLibraryProps> = ({ onApplyTemplate }) => {
  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      <div className="border-b border-neutral-800 pb-4">
        <h2 className="text-xl font-bold text-white tracking-tight">Viral Creator Templates</h2>
        <p className="text-xs text-neutral-400 mt-1">
          Apply battle-tested formatting combinations of inner video framing, captions, grading, and hooks with 1 click.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLATE_PRESETS.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/60 transition-all shadow-lg group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-semibold">
                  {tpl.category}
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">1-Click Preset</span>
              </div>

              <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                {tpl.name}
              </h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                {tpl.tagline}
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-neutral-800 flex items-center justify-between">
              <div className="text-[11px] text-neutral-500">
                Mode: <span className="font-mono text-neutral-300 capitalize">{tpl.framing.mode}</span>
              </div>

              <button
                onClick={() => onApplyTemplate(tpl)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Apply Template</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
