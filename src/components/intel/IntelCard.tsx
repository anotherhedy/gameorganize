import React from 'react';
import { Feedback } from '../../types';
import { Trash2, Edit2, MessageSquare } from 'lucide-react';

interface IntelCardProps {
  feedback: Feedback;
  index: number;
  onDelete?: (id: number) => void;
  onEdit?: (feedback: Feedback) => void;
  onReply?: (feedback: Feedback) => void; // 新增：回复回调
  currentUserId?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
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

export const IntelCard: React.FC<IntelCardProps> = ({
  feedback,
  index,
  onDelete,
  onEdit,
  onReply,
  currentUserId,
  isAdmin,
  isSuperAdmin
}) => {
  // Use index to deterministically assign rotation and color so it doesn't change on re-render
  const rotation = ROTATIONS[index % ROTATIONS.length];
  const bgColor = BG_COLORS[index % BG_COLORS.length];

  const isOwner = currentUserId && feedback.user_id === currentUserId;

  return (
    <div 
      className={`
        relative p-4 w-full h-full min-h-[200px] 
        shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:z-10
        ${bgColor} ${rotation}
        font-handwriting flex flex-col justify-between group
      `}
      style={{
        boxShadow: '2px 2px 5px rgba(0,0,0,0.1)'
      }}
    >
      {/* Tape effect */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-white/30 backdrop-blur-sm rotate-1 shadow-sm border border-white/40"></div>

      {/* Action Buttons (Visible on Hover) */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isAdmin && onReply && (
          <button 
            onClick={() => onReply(feedback)}
            className="p-1.5 bg-purple-500/10 hover:bg-purple-500 text-purple-700 hover:text-white rounded transition-colors"
            title="回复情报"
          >
            <MessageSquare size={14} />
          </button>
        )}
        {isOwner && onEdit && (
          <button 
            onClick={() => onEdit(feedback)}
            className="p-1.5 bg-blue-500/10 hover:bg-blue-500 text-blue-700 hover:text-white rounded transition-colors"
            title="编辑情报"
          >
            <Edit2 size={14} />
          </button>
        )}
        {isSuperAdmin && onDelete && (
          <button 
            onClick={() => onDelete(feedback.id)}
            className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-700 hover:text-white rounded transition-colors"
            title="删除情报"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="flex-1">
        <div className="flex justify-between items-start mb-2 border-b border-black/10 pb-1">
          <span className="font-bold text-gray-800 text-sm">
            🕵️ {feedback.detective_name}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">
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
            <span className="font-bold not-italic mr-1">
              {feedback.replied_by || '管理员回应'}:
            </span>
            {feedback.reply_content}
          </p>
        </div>
      )}
    </div>
  );
};
