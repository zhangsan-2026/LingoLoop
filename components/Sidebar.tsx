import React from 'react';
import { Sentence } from '../types';

interface SidebarProps {
  sentences: Sentence[];
  activeSentenceId: string | null;
  onJumpTo: (sentence: Sentence) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sentences, activeSentenceId, onJumpTo }) => {
  return (
    <div className="w-full h-full bg-notion-sidebar border-l border-notion-border flex flex-col items-center py-2 overflow-y-auto scrollbar-hide">
      {sentences.map((s, idx) => (
        <button
          key={s.id}
          onClick={() => onJumpTo(s)}
          className={`
            w-5 h-5 my-0.5 rounded flex items-center justify-center text-[9px] font-mono transition-colors
            ${activeSentenceId === s.id 
                ? 'bg-notion-blue text-white' 
                : 'text-notion-gray hover:bg-notion-hover'}
          `}
          title={`Jump to sentence ${idx + 1}`}
        >
          {idx + 1}
        </button>
      ))}
    </div>
  );
};

export default Sidebar;