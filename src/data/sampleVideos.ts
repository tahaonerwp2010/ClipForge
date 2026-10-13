import { VideoSource, TranscriptWord, GeneratedClip } from '../types/clipper';

export const SAMPLE_VIDEOS: VideoSource[] = [
  {
    id: 'sample-podcast',
    title: 'The AI Paradox: What 99% of People Get Wrong About Future Tech',
    author: 'Silicon Insights Podcast #142',
    duration: 184,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600&auto=format&fit=crop&q=80',
    type: 'preset',
    originalAspect: '16:9 widescreen'
  },
  {
    id: 'sample-founder',
    title: 'How I Scaled from 0 to $10M ARR in 18 Months (No Venture Capital)',
    author: 'Founder Raw Stories',
    duration: 215,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&auto=format&fit=crop&q=80',
    type: 'preset',
    originalAspect: '16:9 widescreen'
  },
  {
    id: 'sample-interview',
    title: 'The Psychological Secret Behind High Performers & Discipline',
    author: 'Mindset Mastery Lab',
    duration: 148,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80',
    type: 'preset',
    originalAspect: '16:9 widescreen'
  }
];

export const SECONDARY_FOOTAGE = {
  gameplay: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
  satisfying: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  kinetic: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
};

// Rich simulated transcripts with CapCut smart auto-emojis
export const DEFAULT_TRANSCRIPT_SEGMENTS: TranscriptWord[] = [
  { word: "The", start: 0.2, end: 0.5 },
  { word: "biggest", start: 0.5, end: 0.9, emoji: "🤯" },
  { word: "mistake", start: 0.9, end: 1.4, emoji: "❌" },
  { word: "most", start: 1.4, end: 1.7 },
  { word: "creators", start: 1.7, end: 2.2, emoji: "🎬" },
  { word: "make", start: 2.2, end: 2.6 },
  { word: "in", start: 2.6, end: 2.8 },
  { word: "2026", start: 2.8, end: 3.4, emoji: "🔥" },
  
  { word: "is", start: 3.5, end: 3.8 },
  { word: "trying", start: 3.8, end: 4.2 },
  { word: "to", start: 4.2, end: 4.4 },
  { word: "compete", start: 4.4, end: 4.9, emoji: "⚔️" },
  { word: "with", start: 4.9, end: 5.2 },
  { word: "algorithms", start: 5.2, end: 5.9, emoji: "🤖" },

  { word: "instead", start: 6.1, end: 6.6 },
  { word: "of", start: 6.6, end: 6.8 },
  { word: "owning", start: 6.8, end: 7.3, emoji: "👑" },
  { word: "their", start: 7.3, end: 7.6 },
  { word: "unique", start: 7.6, end: 8.1, emoji: "💎" },
  { word: "voice.", start: 8.1, end: 8.7, emoji: "🎙️" },

  { word: "When", start: 8.9, end: 9.2 },
  { word: "you", start: 9.2, end: 9.4 },
  { word: "hook", start: 9.4, end: 9.8, emoji: "🪝" },
  { word: "them", start: 9.8, end: 10.1 },
  { word: "in", start: 10.1, end: 10.3 },
  { word: "the", start: 10.3, end: 10.5 },
  { word: "first", start: 10.5, end: 10.9 },
  { word: "three", start: 10.9, end: 11.3, emoji: "3️⃣" },
  { word: "seconds,", start: 11.3, end: 11.9, emoji: "⏱️" },

  { word: "everything", start: 12.1, end: 12.7 },
  { word: "changes.", start: 12.7, end: 13.4, emoji: "⚡" },
  { word: "Retention", start: 13.6, end: 14.2, emoji: "🚀" },
  { word: "shoots", start: 14.2, end: 14.7 },
  { word: "through", start: 14.7, end: 15.1 },
  { word: "the", start: 15.1, end: 15.3 },
  { word: "roof.", start: 15.3, end: 16.0, emoji: "📈" },

  { word: "Look", start: 16.3, end: 16.7, emoji: "👀" },
  { word: "at", start: 16.7, end: 16.9 },
  { word: "the", start: 16.9, end: 17.1 },
  { word: "numbers:", start: 17.1, end: 17.7, emoji: "📊" },
  { word: "eighty", start: 17.9, end: 18.3 },
  { word: "percent", start: 18.3, end: 18.8, emoji: "💯" },
  { word: "watch", start: 18.8, end: 19.3 },
  { word: "till", start: 19.3, end: 19.6 },
  { word: "the", start: 19.6, end: 19.8 },
  { word: "end.", start: 19.8, end: 20.5, emoji: "🏁" }
];

export const INITIAL_PRESET_CLIPS: GeneratedClip[] = [
  {
    id: 'clip-1',
    sourceId: 'sample-podcast',
    title: 'The 3-Second Retention Secret',
    hookText: 'THIS DOUBLED OUR RETENTION 🤯',
    startTime: 8.5,
    endTime: 23.5,
    duration: 15,
    viralityScore: 98,
    reason: 'Instant punchy opening sentence + counter-intuitive statement creates high curiosity gap.',
    category: 'Shocking Truth',
    thumbnailTime: 12,
    words: DEFAULT_TRANSCRIPT_SEGMENTS.slice(18, 38)
  },
  {
    id: 'clip-2',
    sourceId: 'sample-podcast',
    title: 'Why Creators Fail Against Algorithms',
    hookText: 'STOP DOING THIS IN 2026 🚨',
    startTime: 0,
    endTime: 16,
    duration: 16,
    viralityScore: 94,
    reason: 'Direct callout to creator audience pain point with high authority delivery.',
    category: 'Deep Insight',
    thumbnailTime: 4,
    words: DEFAULT_TRANSCRIPT_SEGMENTS.slice(0, 18)
  },
  {
    id: 'clip-3',
    sourceId: 'sample-podcast',
    title: 'The Brutal Math of Viral Content',
    hookText: 'THE UNFAIR ADVANTAGE 📈',
    startTime: 14,
    endTime: 29,
    duration: 15,
    viralityScore: 91,
    reason: 'Data-backed claim with numerical framing drives comment debates and shares.',
    category: 'High Energy',
    thumbnailTime: 18,
    words: DEFAULT_TRANSCRIPT_SEGMENTS.slice(25, 45)
  }
];
