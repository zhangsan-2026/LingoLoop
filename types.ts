export interface Sentence {
  id: string;
  text: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  loopCount: number; // specific loop count for this sentence
}

export interface ProjectGroup {
  id: string;
  name: string;
  createdAt: number;
}

export interface Project {
  id: string;
  groupId?: string; // ID of the group this project belongs to (undefined/null = root)
  name: string;
  createdAt: number;
  lastAccessedAt: number;
  mediaType: 'video' | 'audio' | 'none';
  // Note: We cannot persist Blob URLs across sessions. 
  // We store metadata, and prompt user to re-attach file if missing in current session map.
  mediaName: string; 
  mediaUrl?: string; // External URL for the media
  textUrl?: string; // External URL for the text/subtitle
  sentences: Sentence[];
  lastActiveIndex: number;
  // UI preferences per project
  splitRatio: number; // percentage for left pane (default 70)
  fontSize: number; // Text editor font size in px
  currentTime: number; // Last playback position
}

export interface PlaybackSettings {
  loopCountOption: number; // 1, 3, 5, 10, 30, Infinity (-1)
  loopDelay: number; // seconds, fixed at 0.2 usually, but flexible in model
  playbackRate: number; // 0.5 to 3.0
  autoPlayNext: boolean;
}

export interface AppState {
  projects: Project[];
  currentProjectId: string | null;
}