import React, { useState, useEffect } from 'react';
import { GameSubmission } from '../../types';
import { fetchPendingSubmissions, approveSubmission, rejectSubmission } from '../../services/supabase/api';
import { CheckCircle2, XCircle, Loader2, Clock, ExternalLink, Inbox, MessageSquare, Send } from 'lucide-react';

interface ReviewQueueProps {
  onStatusChanged: () => void;
}

export const ReviewQueue: React.FC<ReviewQueueProps> = ({ onStatusChanged }) => {
  const [pending, setPending] = useState<GameSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const subs = await fetchPendingSubmissions();
      setPending(subs);
    } catch (err) {
      console.error('Failed to load pending submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (subId: number) => {
    setActing(subId);
    try {
      await approveSubmission(subId);
      setPending(prev => prev.filter(s => s.id !== subId));
      onStatusChanged();
    } catch (err) {
      console.error('Failed to approve:', err);
      alert('操作失败，请重试');
    } finally {
      setActing(null);
    }
  };

  const handleRejectConfirm = async (subId: number) => {
    if (!rejectReason.trim()) return;
    setActing(subId);
    try {
      await rejectSubmission(subId, rejectReason.trim());
      setPending(prev => prev.filter(s => s.id !== subId));
      setRejectingId(null);
      setRejectReason('');
      onStatusChanged();
    } catch (err) {
      console.error('Failed to reject:', err);
      alert('操作失败，请重试');
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="text-center py-16">
        <Inbox size={40} className="text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">审核队列为空</p>
        <p className="text-gray-600 text-xs mt-1">暂无待审核的投稿</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map(sub => (
        <div key={sub.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:bg-white/[0.04] transition-all">
          <div className="flex items-start gap-4">
            {/* 封面 */}
            {sub.image_url && (
              <img
                src={sub.image_url}
                alt={sub.title}
                className="w-20 h-14 object-cover rounded-lg border border-white/10 shrink-0"
              />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-white font-bold">{sub.title}</h4>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] rounded-full">
                  <Clock size={10} /> 审核中
                </span>
              </div>

              {sub.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-3">{sub.description}</p>
              )}

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {sub.url && (
                  <a href={sub.url} target="_blank" rel="noreferrer"
                    className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    <ExternalLink size={10} /> 游戏链接
                  </a>
                )}
                <span className="text-[10px] text-gray-600">{sub.created_at?.split('T')[0]}</span>
                <span className="text-[10px] text-gray-600">⏱ {sub.duration}</span>
              </div>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-[10px] text-gray-500">
                  👤 {sub.author_name}
                  {sub.author_url && (
                    <a href={sub.author_url} target="_blank" rel="noreferrer"
                      className="text-purple-400 hover:text-purple-300 ml-1">[主页]</a>
                  )}
                </span>
                {sub.answer_url && (
                  <a href={sub.answer_url} target="_blank" rel="noreferrer"
                    className="text-[10px] text-green-400 hover:text-green-300 flex items-center gap-0.5">
                    📖 攻略
                  </a>
                )}
                <div className="flex gap-1.5">
                  {sub.pc && <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">PC</span>}
                  {sub.pe && <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">PE</span>}
                  {sub.jumpscare && <span className="text-[10px] text-red-500/70 bg-white/5 px-1.5 py-0.5 rounded">微恐</span>}
                  {sub.sound && <span className="text-[10px] text-cyan-500/70 bg-white/5 px-1.5 py-0.5 rounded">有声音</span>}
                </div>
              </div>

              {/* 驳回理由输入框 */}
              {rejectingId === sub.id && (
                <div className="mt-3 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <label className="text-[11px] font-bold text-red-300 flex items-center gap-1.5 mb-2">
                    <MessageSquare size={12} /> 驳回理由（必填）
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="说明为什么不通过，用户会看到这条信息..."
                    rows={2}
                    className="w-full bg-black/30 border border-red-500/20 rounded-lg py-2 px-3 text-white text-xs placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleRejectConfirm(sub.id)}
                      disabled={!rejectReason.trim() || acting === sub.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                    >
                      {acting === sub.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                      确认驳回
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason(''); }}
                      className="px-3 py-1.5 bg-white/5 text-gray-400 hover:text-white rounded-lg text-[11px] transition-all"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col gap-2 shrink-0">
              {rejectingId !== sub.id && (
                <>
                  <button
                    onClick={() => handleApprove(sub.id)}
                    disabled={acting === sub.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/20 transition-all text-xs font-bold disabled:opacity-50"
                  >
                    {acting === sub.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    通过
                  </button>
                  <button
                    onClick={() => { setRejectingId(sub.id); setRejectReason(''); }}
                    disabled={acting === sub.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition-all text-xs font-bold disabled:opacity-50"
                  >
                    <XCircle size={14} /> 驳回
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
