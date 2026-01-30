import React, { useRef, useEffect, useState } from 'react';
import { Sentence } from '../types';
import { formatTime, generateId, parseSrtTime, parseTxtContent } from '../constants';
import { generateSpeech } from '../services/geminiService';

interface TextEditorProps {
  sentences: Sentence[];
  activeSentenceId: string | null;
  currentTime: number;
  fontSize: number;
  onSentenceClick: (sentence: Sentence) => void;
  onUpdateSentence: (sentence: Sentence) => void;
  onImportText: (sentences: Sentence[]) => void;
  onFontSizeChange: (size: number) => void;
  onTextUrlUpdate?: (url: string) => void; // Optional callback for updating URL in parent
}

const TextEditor: React.FC<TextEditorProps> = ({
  sentences,
  activeSentenceId,
  currentTime,
  fontSize,
  onSentenceClick,
  onUpdateSentence,
  onImportText,
  onFontSizeChange,
  onTextUrlUpdate
}) => {
  const activeRef = useRef<HTMLDivElement>(null);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Auto-scroll to active sentence
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSentenceId]);

  const processContent = (content: string, isSrt: boolean) => {
      let newSentences: Sentence[] = [];
      if (isSrt) {
        // Simple SRT Parser
        const regex = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]*?)(?=\n\n|\n*$)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          newSentences.push({
            id: generateId(),
            startTime: parseSrtTime(match[2]),
            endTime: parseSrtTime(match[3]),
            text: match[4].replace(/\n/g, ' '),
            loopCount: 1
          });
        }
      } else {
        newSentences = parseTxtContent(content);
      }
      onImportText(newSentences);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const isSrt = file.name.endsWith('.srt');
      processContent(content, isSrt);
      if (onTextUrlUpdate) onTextUrlUpdate(''); // Clear URL since file is local
    };
    reader.readAsText(file);
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!urlInput.trim()) return;

      try {
          const res = await fetch(urlInput);
          const text = await res.text();
          const isSrt = urlInput.endsWith('.srt');
          processContent(text, isSrt);
          if (onTextUrlUpdate) onTextUrlUpdate(urlInput); // Save URL
          setShowUrlInput(false);
      } catch (err) {
          alert("Failed to fetch text from URL. Check CORS or URL validity.");
      }
  };

  const handleDownloadTxt = () => {
    if (sentences.length === 0) return;

    const content = sentences.map(s => {
      // Format: [start-end] text
      const start = s.startTime.toFixed(2);
      const end = s.endTime.toFixed(2);
      return `[${start}-${end}] ${s.text}`;
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript_with_timestamps.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTTS = async (e: React.MouseEvent, sentence: Sentence) => {
      e.stopPropagation();
      setTtsLoadingId(sentence.id);
      try {
          const buffer = await generateSpeech(sentence.text);
          if (buffer) {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(0);
          }
      } catch (err) {
          console.error("TTS Error", err);
          alert("Failed to generate speech");
      } finally {
          setTtsLoadingId(null);
      }
  };

  return (
    <div className="flex flex-col h-full bg-notion-bg text-notion-text relative">
      {sentences.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-notion-gray border-2 border-dashed border-notion-border m-4 rounded-lg">
          {!showUrlInput ? (
              <div className="flex flex-col items-center gap-2">
                <p className="mb-2">Import .txt or .srt transcript</p>
                <div className="flex gap-2">
                    <input 
                        type="file" 
                        accept=".txt,.srt" 
                        onChange={handleFileUpload}
                        className="hidden" 
                        id="text-upload"
                    />
                    <label 
                        htmlFor="text-upload"
                        className="cursor-pointer bg-notion-sidebar hover:bg-notion-hover px-4 py-2 rounded text-sm font-medium transition-colors border border-notion-border"
                    >
                        Upload File
                    </label>
                    <button 
                        onClick={() => setShowUrlInput(true)}
                        className="text-notion-blue hover:underline text-sm px-2"
                    >
                        From URL
                    </button>
                </div>
              </div>
          ) : (
              <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2 w-full max-w-xs">
                  <input 
                    autoFocus
                    type="url" 
                    placeholder="https://example.com/subtitles.srt" 
                    className="w-full border border-notion-border rounded p-2 text-sm focus:ring-2 focus:ring-notion-blue outline-none"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                  />
                  <div className="flex gap-2 justify-center">
                      <button type="submit" className="bg-notion-blue text-white px-3 py-1 rounded text-sm">Fetch</button>
                      <button type="button" onClick={() => setShowUrlInput(false)} className="text-notion-gray text-sm hover:underline">Cancel</button>
                  </div>
              </form>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white/95 backdrop-blur z-10 p-2 border-b border-notion-border">
                <div className="flex items-center gap-4">
                    <span className="text-sm text-notion-gray font-medium">{sentences.length} lines</span>
                    <div className="flex items-center gap-1 bg-notion-sidebar rounded px-2 py-1">
                        <button 
                            onClick={() => onFontSizeChange(Math.max(12, fontSize - 2))}
                            className="text-xs px-2 hover:bg-gray-200 rounded text-notion-gray"
                        >
                            A-
                        </button>
                        <span className="text-xs font-mono text-notion-text w-6 text-center">{fontSize}</span>
                        <button 
                            onClick={() => onFontSizeChange(Math.min(32, fontSize + 2))}
                            className="text-xs px-2 hover:bg-gray-200 rounded text-notion-gray"
                        >
                            A+
                        </button>
                    </div>

                    <button 
                        onClick={handleDownloadTxt}
                        className="text-xs flex items-center gap-1 text-notion-gray hover:text-notion-text hover:bg-notion-sidebar px-2 py-1 rounded transition-colors border border-transparent hover:border-notion-border"
                    >
                        <span>⬇️</span> Save
                    </button>
                </div>
                
                <div>
                     <input 
                        type="file" 
                        accept=".txt,.srt" 
                        onChange={handleFileUpload}
                        className="hidden" 
                        id="text-upload-replace"
                    />
                    <label htmlFor="text-upload-replace" className="text-xs text-notion-blue cursor-pointer hover:underline">
                        Replace Text
                    </label>
                </div>
            </div>

          <div style={{ fontSize: `${fontSize}px` }} className="space-y-2">
            {sentences.map((s, idx) => {
                const isActive = activeSentenceId === s.id;
                const isPlaying = currentTime >= s.startTime && currentTime <= s.endTime;

                return (
                <div 
                    key={s.id}
                    ref={isActive ? activeRef : null}
                    onClick={() => onSentenceClick(s)}
                    className={`
                    group relative p-3 rounded-md transition-all duration-200 cursor-pointer border border-transparent
                    ${isActive ? 'bg-blue-50 border-blue-200 shadow-sm' : 'hover:bg-notion-hover'}
                    `}
                >
                    {/* Time Controls (Visible on Hover or Active) */}
                    <div className={`
                        flex items-center gap-2 text-xs text-notion-gray mb-1
                        ${isActive || isPlaying ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}
                    `}>
                        <span className="font-mono text-[10px] bg-notion-sidebar px-1 rounded">
                            {formatTime(s.startTime)} - {formatTime(s.endTime)}
                        </span>
                        {/* Inline Loop Editor with 10ms precision */}
                        {isActive && (
                            <div className="flex gap-1 items-center">
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="w-16 px-1 border rounded text-[10px] bg-white" 
                                    value={s.startTime}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => onUpdateSentence({ ...s, startTime: Number(e.target.value) })}
                                />
                                <span>-</span>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="w-16 px-1 border rounded text-[10px] bg-white" 
                                    value={s.endTime}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => onUpdateSentence({ ...s, endTime: Number(e.target.value) })}
                                />
                            </div>
                        )}
                    </div>

                    <p className={`leading-relaxed ${isActive ? 'text-notion-text font-medium' : 'text-notion-text/80'}`}>
                    {s.text}
                    </p>

                    {/* Inline Actions */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={(e) => handleTTS(e, s)}
                            className="p-1 hover:bg-gray-200 rounded text-notion-gray"
                            title="Read Aloud (Gemini TTS)"
                        >
                            {ttsLoadingId === s.id ? '...' : '🔊'}
                        </button>
                    </div>
                </div>
                );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TextEditor;