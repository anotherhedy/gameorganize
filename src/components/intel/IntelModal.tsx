import React, { useState, useEffect } from 'react';
import { X, Send, Lock, RefreshCw, CircleHelp } from 'lucide-react';

interface IntelModalProps {
  onClose: () => void;
  onSubmit: (data: { detective_name: string; intel_content: string }) => Promise<void>;
  isOpen: boolean;
}

export const IntelModal: React.FC<IntelModalProps> = ({ onClose, onSubmit, isOpen }) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
        const today = new Date().toLocaleDateString();
        const storedDate = localStorage.getItem('intel_submission_date');
        const storedCount = parseInt(localStorage.getItem('intel_submission_count') || '0', 10);

        if (storedDate === today) {
            setDailyCount(storedCount);
        } else {
            localStorage.setItem('intel_submission_date', today);
            localStorage.setItem('intel_submission_count', '0');
            setDailyCount(0);
        }
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (content.length > 200) {
        alert('情报内容不能超过200字！');
        return;
    }

    if (dailyCount >= 3) {
        alert('今日情报发送次数已达上限（3次）！请明天再来。');
        return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit({ detective_name: name || '匿名研究员', intel_content: content });
      
      // Update daily count
      const newCount = dailyCount + 1;
      setDailyCount(newCount);
      localStorage.setItem('intel_submission_count', newCount.toString());

      setContent('');
      onClose();
    } catch (error) {
      console.error('Submission failed', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[95%] sm:w-full max-w-md relative overflow-hidden transform transition-all scale-100">
        {/* Header */}
        <div className="bg-gray-900 text-white p-3 sm:p-4 flex justify-between items-center border-b-4 border-yellow-500">
          <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
            加密情报传输
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              研究员代号 (Researcher Code Name)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 bg-gray-50 text-black focus:ring-2 focus:ring-yellow-500 focus:border-transparent font-mono"
                placeholder="匿名研究员"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              情报内容 (Intelligence Data)
              <span className={`float-right text-xs ${content.length > 200 ? 'text-red-500' : 'text-gray-400'}`}>
                {content.length}/200
              </span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-24 sm:h-32 border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none bg-yellow-50/50 text-black text-sm sm:text-base"
              placeholder="请在此输入你需要报告的情报..."
              required
              maxLength={200}
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowGuidelines(true)}
              className="p-3 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
              title="情报发送须知"
            >
              <CircleHelp className="w-5 h-5" />
            </button>
            <button
              type="submit"
              disabled={isSubmitting || dailyCount >= 3}
              className={`
                flex-1 py-3 px-4 rounded font-bold text-white flex items-center justify-center gap-2
                ${(isSubmitting || dailyCount >= 3) ? 'bg-gray-500 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700 shadow-lg hover:shadow-xl'}
                transition-all duration-200
              `}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  加密传输中...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  {dailyCount >= 3 ? '今日次数已尽' : '提交情报'}
                </>
              )}
            </button>
          </div>
          
          <p className="text-xs text-center text-gray-400 mt-2">
            * 发送情报前请点击？按钮阅读发送须知，无关言论会被系统删除。
          </p>
        </form>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-stripes-yellow opacity-10 pointer-events-none"></div>

        {/* Guidelines Modal */}
        {showGuidelines && (
          <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur flex flex-col p-6 animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-2">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                   <CircleHelp className="w-5 h-5 text-yellow-600" />
                   情报发送须知
                </h3>
                <button onClick={() => setShowGuidelines(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto text-sm text-gray-700 space-y-3">
                <p>1. 支持侦探们对于游戏或者游戏作者的推荐</p>
                <p>2. 支持反馈该汇总网站的问题和功能优化建议</p>
                <p>3. 具体游戏过程中的问题请反馈相关作者</p>
                <p>4. 为避免发送通道拥堵，每位研究员每天最多发送3个情报，内容200字以内</p>
                <p className="text-red-600 font-bold">5. 禁止发布无关内容！禁止攻击、诋毁每一个游戏作品！不当言论将被删除！</p>
             </div>
             <button 
               onClick={() => setShowGuidelines(false)}
               className="mt-4 w-full py-2 bg-yellow-600 text-white rounded font-bold hover:bg-yellow-700 transition-colors"
             >
               我已知晓
             </button>
          </div>
        )}

      </div>
    </div>
  );
};
