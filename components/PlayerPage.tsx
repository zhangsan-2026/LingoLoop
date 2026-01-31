import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Project, Sentence, PlaybackSettings } from '../types';
import { updateProjectInStorage } from '../services/storageService';
import { saveMediaToDB, getMediaFromDB } from '../services/mediaStorageService';
import { DEFAULT_PLAYBACK_SETTINGS, LOOP_OPTIONS } from '../constants';
import MediaPlayer, { MediaPlayerHandle } from './MediaPlayer';
import TextEditor from './TextEditor';
import Sidebar from './Sidebar';
import { analyzeMedia, transcribeMedia } from '../services/geminiService';

interface PlayerPageProps {
  project: Project;
  onBack: () => void;
  onUpdateProject: (p: Project) => void;
}

const PlayerPage: React.FC<PlayerPageProps> = ({ project, onBack, onUpdateProject }) => {
  // State
  const [splitRatio, setSplitRatio] = useState(project.splitRatio || 70);
  const [fontSize, setFontSize] = useState(project.fontSize || 16);
  const [sentences, setSentences] = useState<Sentence[]>(project.sentences || []);
  const [currentSentenceId, setCurrentSentenceId] = useState<string | null>(
      project.lastActiveIndex >= 0 && project.sentences[project.lastActiveIndex] 
      ? project.sentences[project.lastActiveIndex].id 
      : null
  );
  
  //原const [settings, setSettings] = useState<PlaybackSettings>(DEFAULT_PLAYBACK_SETTINGS);
  const [settings, setSettings] = useState<PlaybackSettings>(() => {
  // 1. 尝试从本地存储读取
  const savedSettings = localStorage.getItem('lingoloop_playback_settings');
    if (savedSettings) {
        try {
      // 2. 如果有旧数据，解析并使用
            return JSON.parse(savedSettings);
        } catch (e) {
      console.error("读取设置失败", e);
        }
    }
  // 3. 没找到则使用默认值
            return DEFAULT_PLAYBACK_SETTINGS;
  });
  // 只要设置改变，就自动保存到本地存储
  useEffect(() => {
        localStorage.setItem('lingoloop_playback_settings', JSON.stringify(settings));
  }, [settings]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(project.currentTime || 0);
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  
  // URL Input State
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  
  // AI States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Refs
  const playerRef = useRef<MediaPlayerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaFileRef = useRef<File | null>(null);

  // Load Media Source
  useEffect(() => {
    const loadMedia = async () => {
      // 1. Check if there is a saved URL
      if (project.mediaUrl) {
          setMediaSrc(project.mediaUrl);
          return;
      }

      // 2. Try to load from IndexedDB (Local file persistence)
      if (project.mediaName && !mediaSrc) {
        try {
           const file = await getMediaFromDB(project.id);
           if (file) {
             const url = URL.createObjectURL(file);
             setMediaSrc(url);
             mediaFileRef.current = file;
             console.log("Restored media from persistence");
           }
        } catch(e) {
          console.error("Failed to restore media", e);
        }
      }
    };
    loadMedia();
    
    return () => {
        // Only revoke blob URLs, not remote URLs
        if (mediaSrc && mediaSrc.startsWith('blob:')) {
            URL.revokeObjectURL(mediaSrc);
        }
    }
  }, [project.id, project.mediaUrl]); // React to url changes

  // Persistence Sync (Project Data)
  useEffect(() => {
    const updatedProject = {
      ...project,
      sentences,
      lastActiveIndex: sentences.findIndex(s => s.id === currentSentenceId),
      splitRatio,
      fontSize,
      currentTime // Sync current playback time
    };
    updateProjectInStorage(updatedProject);
  }, [sentences, currentSentenceId, splitRatio, fontSize, currentTime]);


  // Derived
  const activeSentence = sentences.find(s => s.id === currentSentenceId) || null;

  // Handlers
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newRatio = (moveEvent.clientX / containerWidth) * 100;
        if (newRatio > 20 && newRatio < 80) {
          setSplitRatio(newRatio);
        }
      }
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMediaSrc(url);
      mediaFileRef.current = file;
      
      const type = file.type.startsWith('video') ? 'video' : 'audio';
      const newProjectState = { 
          ...project, 
          mediaType: type, 
          mediaName: file.name,
          mediaUrl: undefined, // Clear URL if file selected
          currentTime: 0 
      } as Project;
      
      onUpdateProject(newProjectState);
      setCurrentTime(0);
      
      // Persist to IndexedDB
      await saveMediaToDB(project.id, file);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!urlInput.trim()) return;

      // Guess type
      const isAudio = urlInput.endsWith('.mp3') || urlInput.endsWith('.wav') || urlInput.endsWith('.m4a');
      const type = isAudio ? 'audio' : 'video';

      setMediaSrc(urlInput);
      const newProjectState = {
          ...project,
          mediaType: type,
          mediaName: 'Remote Stream',
          mediaUrl: urlInput,
          currentTime: 0
      } as Project;
      onUpdateProject(newProjectState);
      setCurrentTime(0);
      setShowUrlInput(false);
  };

  const handleSentenceClick = (s: Sentence) => {
    setCurrentSentenceId(s.id);
    playerRef.current?.seek(s.startTime);
    playerRef.current?.play();
    setIsPlaying(true);
  };

  const handlePrev = () => {
    const idx = sentences.findIndex(s => s.id === currentSentenceId);
    if (idx > 0) {
      handleSentenceClick(sentences[idx - 1]);
    }
  };

  const handleNext = useCallback(() => {
    const idx = sentences.findIndex(s => s.id === currentSentenceId);
    if (idx < sentences.length - 1) {
      handleSentenceClick(sentences[idx + 1]);
    }
  }, [sentences, currentSentenceId]);

  const togglePlay = () => {
    if (isPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  // AI Handlers
  const handleAnalyze = async () => {
      if (!mediaFileRef.current && !project.mediaUrl) return alert("Please upload media or provide a URL.");
      
      if (project.mediaUrl) {
          alert("AI Analysis for remote URLs is not yet supported. Please download the file and upload it.");
          return;
      }
      
      setIsAnalyzing(true);
      try {
          const result = await analyzeMedia(mediaFileRef.current!);
          setAnalysisResult(result);
      } catch (e) {
          alert("Analysis failed. Check API Key.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleTranscribe = async () => {
      if (!mediaFileRef.current && !project.mediaUrl) return alert("Please upload media or provide a URL.");

      if (project.mediaUrl) {
          alert("AI Transcription for remote URLs is not yet supported. Please download the file and upload it.");
          return;
      }

      setIsTranscribing(true);
      try {
          const srtText = await transcribeMedia(mediaFileRef.current!);
          const regex = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]*?)(?=\n\n|\n*$)/g;
            let match;
            const newSentences: Sentence[] = [];
            while ((match = regex.exec(srtText)) !== null) {
                const parseTime = (str: string) => {
                    const [t, ms] = str.split(',');
                    const [h, m, s] = t.split(':').map(Number);
                    return h * 3600 + m * 60 + s + (parseInt(ms) / 1000);
                }
                newSentences.push({
                    id: Math.random().toString(36).substr(2,9),
                    startTime: parseTime(match[2]),
                    endTime: parseTime(match[3]),
                    text: match[4].replace(/\n/g, ' '),
                    loopCount: 1
                });
            }
            if(newSentences.length > 0) {
                setSentences(newSentences);
            } else {
                alert("Transcription returned empty or invalid format.");
            }
      } catch (e) {
          alert("Transcription failed.");
      } finally {
          setIsTranscribing(false);
      }
  };

  return (
    <div className="flex flex-col h-screen bg-notion-bg font-sans text-notion-text overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b border-notion-border flex items-center px-4 justify-between bg-white z-20 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-notion-gray hover:text-notion-text hover:bg-notion-hover px-2 py-1 rounded transition-colors">
            ← Back
          </button>
          <span className="text-notion-border">|</span>
          <span className="font-semibold">{project.name}</span>
          {project.mediaName && <span className="text-xs text-notion-gray border border-notion-border px-1 rounded bg-notion-sidebar truncate max-w-[150px]">{project.mediaName}</span>}
          {project.mediaUrl && <span className="text-xs text-blue-500 border border-blue-100 px-1 rounded bg-blue-50 truncate max-w-[150px]" title={project.mediaUrl}>🔗 URL</span>}
        </div>
        
        {/* AI Toolbar */}
        <div className="flex items-center gap-2">
            <button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing}
                className="flex items-center gap-1 text-xs bg-purple-50 text-purple-600 hover:bg-purple-100 px-2 py-1.5 rounded border border-purple-200"
            >
                {isAnalyzing ? 'Thinking...' : '✨ Analyze'}
            </button>
            <button 
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1.5 rounded border border-blue-200"
            >
                {isTranscribing ? 'Listening...' : '🎙️ Transcribe'}
            </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative" ref={containerRef}>
        
        {/* Left: Player */}
        <div style={{ width: `${splitRatio}%` }} className="flex flex-col relative bg-black shrink-0">
          {!mediaSrc ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-notion-sidebar text-notion-gray p-8">
              <div className="mb-4 text-4xl">🎬</div>
              
              {!showUrlInput ? (
                  <div className="flex flex-col gap-3 items-center">
                    <p className="mb-2">No media loaded</p>
                    <input 
                        type="file" 
                        accept="video/*,audio/*" 
                        onChange={handleMediaUpload}
                        className="hidden" 
                        id="media-upload"
                    />
                    <label 
                        htmlFor="media-upload"
                        className="cursor-pointer bg-white border border-notion-border shadow-sm px-4 py-2 rounded hover:bg-notion-hover text-sm font-medium w-48 text-center"
                    >
                        Upload File
                    </label>
                    <span className="text-xs">or</span>
                    <button 
                        onClick={() => setShowUrlInput(true)}
                        className="text-notion-blue hover:underline text-sm"
                    >
                        Enter URL address
                    </button>
                  </div>
              ) : (
                  <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2 w-full max-w-sm">
                      <input 
                        autoFocus
                        type="url" 
                        placeholder="https://example.com/video.mp4" 
                        className="w-full border border-notion-border rounded p-2 text-sm focus:ring-2 focus:ring-notion-blue outline-none"
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                      />
                      <div className="flex gap-2 justify-center">
                          <button type="submit" className="bg-notion-blue text-white px-3 py-1 rounded text-sm">Load URL</button>
                          <button type="button" onClick={() => setShowUrlInput(false)} className="text-notion-gray text-sm hover:underline">Cancel</button>
                      </div>
                  </form>
              )}
            </div>
          ) : (
            <div className="w-full flex-1 relative min-h-0 flex flex-col">
                <MediaPlayer
                ref={playerRef}
                mediaSrc={mediaSrc}
                mediaType={project.mediaType as 'video' | 'audio'}
                currentSentence={activeSentence}
                settings={settings}
                onTimeUpdate={setCurrentTime}
                onEnded={() => setIsPlaying(false)}
                onAutoPlayNext={handleNext}
                autoPlayNextTrigger={false}
                initialTime={project.currentTime}
                />
            </div>
          )}

          {/* Player Controls Bar */}
          <div className="h-16 bg-white border-t border-notion-border flex items-center justify-between px-4 w-full shrink-0">
             
             {/* Left Controls */}
             <div className="flex items-center gap-4">
                 <div className="flex flex-col">
                     <label className="text-[10px] text-notion-gray uppercase font-bold">Loops</label>
                     <select 
                        value={settings.loopCountOption}
                        onChange={(e) => setSettings({...settings, loopCountOption: Number(e.target.value)})}
                        className="text-xs bg-notion-sidebar border-none rounded py-1 px-1 cursor-pointer focus:ring-0"
                     >
                         {LOOP_OPTIONS.map(opt => (
                             <option key={opt} value={opt}>{opt === 30 ? '30' : opt}x</option>
                         ))}
                         <option value={-1}>Infinite</option>
                     </select>
                 </div>
                 
                 <div className="flex flex-col">
                     <label className="text-[10px] text-notion-gray uppercase font-bold">Speed</label>
                     <select 
                        value={settings.playbackRate}
                        onChange={(e) => setSettings({...settings, playbackRate: Number(e.target.value)})}
                        className="text-xs bg-notion-sidebar border-none rounded py-1 px-1 cursor-pointer focus:ring-0"
                     >
                         {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0].map(rate => (
                             <option key={rate} value={rate}>{rate}x</option>
                         ))}
                     </select>
                 </div>
             </div>

             {/* Center Controls */}
             <div className="flex items-center gap-4">
                 <button onClick={handlePrev} className="text-notion-text hover:text-notion-blue" title="Previous Sentence">⏮</button>
                 <button 
                    onClick={togglePlay} 
                    className="w-10 h-10 rounded-full bg-notion-text text-white flex items-center justify-center hover:bg-black transition-transform active:scale-95"
                 >
                     {isPlaying ? '⏸' : '▶'}
                 </button>
                 <button onClick={handleNext} className="text-notion-text hover:text-notion-blue" title="Next Sentence">⏭</button>
             </div>

             {/* Right Controls */}
             <div className="flex items-center gap-2">
                 <label className="flex items-center gap-2 cursor-pointer">
                     <input 
                        type="checkbox" 
                        checked={settings.autoPlayNext}
                        onChange={(e) => setSettings({...settings, autoPlayNext: e.target.checked})}
                        className="rounded border-gray-300 text-notion-blue focus:ring-notion-blue"
                     />
                     <span className="text-xs font-medium text-notion-gray">Auto Play</span>
                 </label>
             </div>

          </div>
          
          {/* Analysis Overlay */}
          {analysisResult && (
              <div className="absolute inset-0 bg-black/80 text-white p-8 overflow-y-auto z-20 backdrop-blur-md">
                  <div className="max-w-2xl mx-auto">
                      <div className="flex justify-between items-center mb-6">
                          <h2 className="text-2xl font-bold">Video Analysis</h2>
                          <button onClick={() => setAnalysisResult(null)} className="text-gray-400 hover:text-white">✕ Close</button>
                      </div>
                      <div className="prose prose-invert">
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{analysisResult}</pre>
                      </div>
                  </div>
              </div>
          )}
        </div>

        {/* Divider */}
        <div 
          onMouseDown={handleDragStart}
          className="w-1 bg-notion-border hover:bg-notion-blue cursor-col-resize z-10 flex items-center justify-center transition-colors delay-75 group shrink-0"
        >
             <div className="w-0.5 h-8 bg-notion-gray/50 rounded group-hover:bg-white" />
        </div>

        {/* Right Area (Text + Sidebar) */}
        <div className="flex-1 flex overflow-hidden bg-white min-w-0">
             
            {/* Text Editor */}
            <div className="flex-1 overflow-hidden">
                <TextEditor 
                    sentences={sentences}
                    activeSentenceId={currentSentenceId}
                    currentTime={currentTime}
                    fontSize={fontSize}
                    onSentenceClick={handleSentenceClick}
                    onImportText={(newSentences) => setSentences(newSentences)}
                    onUpdateSentence={(updatedS) => {
                        setSentences(prev => prev.map(s => s.id === updatedS.id ? updatedS : s));
                    }}
                    onFontSizeChange={setFontSize}
                    onTextUrlUpdate={(url) => onUpdateProject({...project, textUrl: url})}
                />
            </div>

            {/* Narrow Sidebar Index */}
            <div className="w-10 h-full shrink-0 border-l border-notion-border">
                <Sidebar 
                    sentences={sentences} 
                    activeSentenceId={currentSentenceId}
                    onJumpTo={handleSentenceClick}
                />
            </div>
        </div>

      </div>
    </div>
  );
};

export default PlayerPage;