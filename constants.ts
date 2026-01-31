import { PlaybackSettings, Sentence } from './types';

export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  loopCountOption: 1,
  loopDelay: 0.2,
  playbackRate: 1.0,
  autoPlayNext: true,
};

export const LOOP_OPTIONS = [1, 2, 3, 6, 10, 20, 30]; // -1 represents Infinity

export const DEFAULT_SPLIT_RATIO = 70; // 70% width for player

export const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  // 10ms precision (2 decimal places)
  const ms = Math.floor((seconds % 1) * 100);

  const mStr = m.toString().padStart(2, '0');
  const sStr = s.toString().padStart(2, '0');
  const msStr = ms.toString().padStart(2, '0');
  
  if (h > 0) {
    return `${h}:${mStr}:${sStr}.${msStr}`;
  }
  return `${mStr}:${sStr}.${msStr}`;
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

// Helper to parse SRT time format (00:00:00,000) to seconds
export const parseSrtTime = (timeString: string): number => {
  const [time, ms] = timeString.split(',');
  const [h, m, s] = time.split(':').map(Number);
  return h * 3600 + m * 60 + s + (parseInt(ms) / 1000);
};

// Helper to parse TXT content with custom [start-end] markers or auto-generate them
export const parseTxtContent = (content: string): Sentence[] => {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const sentences: Sentence[] = [];
  let currentTime = 0;

  // Custom Format: [start_sec-end_sec] Text Content
  // Example: [0.5-3.2] Hello world
  const markerRegex = /^\[(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\]\s*(.*)$/;

  lines.forEach(line => {
    const trimmed = line.trim();
    const match = trimmed.match(markerRegex);
    
    if (match) {
        // Found existing marker
        const start = parseFloat(match[1]);
        const end = parseFloat(match[2]);
        const text = match[3];
        sentences.push({
            id: generateId(),
            startTime: start,
            endTime: end,
            text: text,
            loopCount: 1
        });
        currentTime = end;
    } else {
        // Auto-generate timestamp based on length
        // Heuristic: 0.1s per char, min 2s, max 10s buffer
        const duration = Math.max(2, Math.min(10, trimmed.length * 0.1));
        const start = Number(currentTime.toFixed(2));
        const end = Number((currentTime + duration).toFixed(2));
        
        sentences.push({
            id: generateId(),
            startTime: start,
            endTime: end,
            text: trimmed,
            loopCount: 1
        });
        currentTime = end;
    }
  });
  
  return sentences;
};
