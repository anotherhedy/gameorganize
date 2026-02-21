import React from 'react';
import { Mail, MessageSquare } from 'lucide-react';

interface FloatingEntryProps {
  onClick: () => void;
}

export const FloatingEntry: React.FC<FloatingEntryProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 left-6 z-50 group flex items-center justify-center w-14 h-14 bg-yellow-500 hover:bg-yellow-400 text-black rounded-full shadow-lg hover:shadow-yellow-500/50 transition-all transform hover:scale-110 active:scale-95 animate-bounce-slow"
      title="进入情报墙"
    >
      <div className="relative">
        <Mail className="w-6 h-6 group-hover:hidden transition-opacity" />
        <MessageSquare className="w-6 h-6 hidden group-hover:block transition-opacity" />
      </div>
      
      {/* Tooltip on hover */}
      <span className="absolute left-16 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        情报墙
      </span>
    </button>
  );
};
