import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, MessageSquare } from 'lucide-react';

interface IntelReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: number, content: string) => Promise<void>;
  initialData: any;
}

export const IntelReplyModal: React.FC<IntelReplyModalProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && initialData) {
      setContent(initialData.reply_content || '');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(initialData.id, content);
      onClose();
    } catch (error) {
      console.error('Reply failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-purple-900/20">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            回复研究情报
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-white/5 p-3 rounded-lg border border-white/5">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">原情报内容</p>
            <p className="text-sm text-gray-300 line-clamp-3 italic">"{initialData?.intel_content}"</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">特殊研究员回应</label>
            <textarea
              autoFocus
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入你的正式回应..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={18} />}
            <span>发布回应</span>
          </button>
        </form>
      </div>
    </div>
  );
};
