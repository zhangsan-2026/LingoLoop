import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { PlaybackSettings, Sentence } from '../types';
import { formatTime } from '../constants';

interface MediaPlayerProps {
  mediaSrc: string;
  mediaType: 'video' | 'audio';
  currentSentence: Sentence | null;
  settings: PlaybackSettings;
  onTimeUpdate: (time: number) => void;
  onEnded: () => void;
  autoPlayNextTrigger: boolean; 
  onAutoPlayNext: () => void;
  initialTime?: number;
}

export interface MediaPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
}

const MediaPlayer = forwardRef<MediaPlayerHandle, MediaPlayerProps>(({ 
  mediaSrc, 
  mediaType, 
  currentSentence, 
  settings, 
  onTimeUpdate, 
  onEnded,
  onAutoPlayNext,
  initialTime = 0
}, ref) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLoop, setCurrentLoop] = useState(0);
  const [isDelaying, setIsDelaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [internalTime, setInternalTime] = useState(initialTime); // For progress bar sync
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    play: () => mediaRef.current?.play(),
    pause: () => mediaRef.current?.pause(),
    seek: (time: number) => {
      if (mediaRef.current) mediaRef.current.currentTime = time;
    },
    getCurrentTime: () => mediaRef.current?.currentTime || 0,
  }));

  // 只要设置改变，就自动存入硬盘
  useEffect(() => {
    localStorage.setItem('lingoloop-settings', JSON.stringify(settings));
  }, [settings]);
  // Handle Playback Rate
  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = settings.playbackRate;
    }
  }, [settings.playbackRate]);

  // Initial Time Restoration
  useEffect(() => {
    if (mediaRef.current && initialTime > 0 && !hasInitialized) {
      mediaRef.current.currentTime = initialTime;
      setHasInitialized(true);
    }
  }, [initialTime, hasInitialized, mediaSrc]);

  // Handle Main Loop Logic & Time Update
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const handleLoadedMetadata = () => {
        setDuration(media.duration);
        if (initialTime > 0 && !hasInitialized) {
             media.currentTime = initialTime;
             setHasInitialized(true);
        }
    };

    const handleTimeUpdate = () => {
      const currentTime = media.currentTime;
      // 如果当前时间已经超过了所有句子的范围，或者没有匹配的句子
      if (!currentSentence) {
      // 如果你希望文本结束后视频立即停止：
        media.pause(); 
      return;
  }
      setInternalTime(currentTime);
      onTimeUpdate(currentTime);

      // Looping Logic
      if (currentSentence && !isDelaying) {
        if (currentTime >= currentSentence.endTime) {
            
          const maxLoops = settings.loopCountOption === -1 ? Infinity : settings.loopCountOption;
          
          if (currentLoop < maxLoops - 1) {
            media.pause();
            setIsDelaying(true);
            
            setTimeout(() => {
              media.currentTime = currentSentence.startTime;
              media.play().catch(e => console.log("Play interrupted", e));
              setCurrentLoop(prev => prev + 1);
              setIsDelaying(false);
            }, settings.loopDelay * 1000);
            
          } else {
            // 核心改进：判断是否能跳到下一句
            // 如果你的组件里能获取到句子列表，可以用 index < length - 1 来判断
            const hasNextSentence = typeof hasNext !== 'undefined' ? hasNext : true;
            if (settings.autoPlayNext && hasNextSentence) {
               onAutoPlayNext();
               setCurrentLoop(0); 
            } else {
              // 如果没有下一句了，或者没勾选自动播放：强制停止并归位
              media.pause();
              media.currentTime = currentSentence.startTime;
              setCurrentLoop(0);
              // 可选：显式设置播放状态为 false
              setIsPlaying(false);
            }
          }
        }
      }
    };

    media.addEventListener('loadedmetadata', handleLoadedMetadata);
    media.addEventListener('timeupdate', handleTimeUpdate);
    media.addEventListener('play', () => setIsPlaying(true));
    media.addEventListener('pause', () => setIsPlaying(false));
    media.addEventListener('ended', onEnded);

    return () => {
      media.removeEventListener('loadedmetadata', handleLoadedMetadata);
      media.removeEventListener('timeupdate', handleTimeUpdate);
      media.removeEventListener('play', () => setIsPlaying(true));
      media.removeEventListener('pause', () => setIsPlaying(false));
      media.removeEventListener('ended', onEnded);
    };
  }, [currentSentence, settings, currentLoop, isDelaying, onTimeUpdate, onEnded, onAutoPlayNext, initialTime, hasInitialized]);

  // Reset loop count when sentence changes
  useEffect(() => {
    setCurrentLoop(0);
    setIsDelaying(false);
    if (currentSentence && settings.autoPlayNext && mediaRef.current && !mediaRef.current.paused) {
        if (mediaRef.current.currentTime < currentSentence.startTime || mediaRef.current.currentTime > currentSentence.endTime) {
            mediaRef.current.currentTime = currentSentence.startTime;
        }
    }
  }, [currentSentence]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = Number(e.target.value);
      if (mediaRef.current) {
          mediaRef.current.currentTime = time;
          setInternalTime(time);
      }
  };

  return (
    <div className="w-full h-full flex flex-col bg-black relative group">
      {/* Media Element Container - Flex-1 to fill space, min-h-0 to allow shrinking */}
      <div className="flex-1 w-full relative flex items-center justify-center overflow-hidden min-h-0">
        {mediaType === 'video' ? (
            <video 
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={mediaSrc} 
            className="w-full h-full object-contain"
            playsInline
            controls={false}
            />
        ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-notion-sidebar">
            <div className="text-6xl mb-4">🎵</div>
            <audio 
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                src={mediaSrc} 
                controls={false}
            />
            <div className="text-notion-text font-medium">{mediaSrc.split('/').pop() || 'Audio Track'}</div>
            </div>
        )}

        {/* Overlay status for Looping - Positioned over media */}
        {currentSentence && isPlaying && (
            <div className="absolute top-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm pointer-events-none z-10">
                Loop: {settings.loopCountOption === -1 ? '∞' : `${currentLoop + 1}/${settings.loopCountOption}`} 
                {' • '}
                Time left: {formatTime(Math.max(0, currentSentence.endTime - internalTime))}
            </div>
        )}
      </div>
      
      {/* Timeline Control - Fixed height, always visible, static flex item (no absolute) */}
      <div className="w-full h-8 bg-neutral-900 flex items-center px-2 gap-2 shrink-0 border-t border-gray-800">
          <span className="text-[10px] text-white font-mono min-w-[50px] text-right">{formatTime(internalTime)}</span>
          <input 
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={internalTime}
            onChange={handleSeek}
            className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-notion-blue"
          />
          <span className="text-[10px] text-gray-400 font-mono min-w-[50px]">{formatTime(duration)}</span>
      </div>
    </div>
  );
});

MediaPlayer.displayName = 'MediaPlayer';

export default MediaPlayer;