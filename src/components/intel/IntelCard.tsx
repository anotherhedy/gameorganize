import React from 'react';
import { Feedback } from '../../types';

interface IntelCardProps {
  feedback: Feedback;
  index: number;
}

const ROTATIONS = [
  'rotate-1',
  '-rotate-1',
  'rotate-2',
  '-rotate-2',
  'rotate-0',
  'rotate-3',
  '-rotate-3'
];

const BG_COLORS = [
  'bg-yellow-100',
  'bg-blue-100',
  'bg-green-100',
  'bg-pink-100',
  'bg-purple-100',
  'bg-orange-100'
];

export const IntelCard: React.FC<IntelCardProps> = ({ feedback, index }) => {
  // Use index to deterministically assign rotation and color so it doesn't change on re-render
  const rotation = ROTATIONS[index % ROTATIONS.length];
  const bgColor = BG_COLORS[index % BG_COLORS.length];

  return (
    <div 
      className={`
        relative p-4 w-full h-full min-h-[200px] 
        shadow-lg hover:shadow-xl transition-transform duration-300 hover:scale-105 hover:z-10
        ${bgColor} ${rotation}
        font-handwriting flex flex-col justify-between
      `}
      style={{
        boxShadow: '2px 2px 5px rgba(0,0,0,0.1)'
      }}
    >
      {/* Tape effect */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-white/30 backdrop-blur-sm rotate-1 shadow-sm border border-white/40"></div>

      <div className="flex-1">
        <div className="flex justify-between items-start mb-2 border-b border-black/10 pb-1">
          <span className="font-bold text-gray-800 text-sm">
            🕵️ {feedback.detective_name}
          </span>
          <span className="text-xs text-gray-500 font-mono">
            {new Date(feedback.created_at).toLocaleDateString()}
          </span>
        </div>
        
        <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed font-medium">
          {feedback.intel_content}
        </p>
      </div>

      {feedback.reply_content && (
        <div className="mt-4 pt-3 border-t-2 border-dashed border-red-800/20 relative">
          <div className="absolute -right-2 -top-3 rotate-12 bg-red-800 text-white text-[10px] px-1 py-0.5 rounded font-bold shadow-sm">
            已阅
          </div>
          <p className="text-xs text-red-900 bg-red-50 p-2 rounded italic font-serif border-l-2 border-red-800">
            <span className="font-bold not-italic mr-1">管理员回应:</span>
            {feedback.reply_content}
          </p>
        </div>
      )}
    </div>
  );
};
