import React, { useState, useEffect } from 'react';
import { GameData } from '../../types';
import { fetchPendingGames, updateGameStatus } from '../../services/supabase/api';
import { CheckCircle2, XCircle, Loader2, Clock, ExternalLink, Inbox, MessageSquare, Send } from 'lucide-react';

interface ReviewQueueProps {
  onStatusChanged: () => void;
}

export const ReviewQueue: React.FC<ReviewQueueProps> = ({ onStatusChanged }) => {
  const [pending, setPending] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  // 驳回相关状态
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const games = await fetchPendingGames();
      setPending(games);
    } catch (err) {
      console.error('Failed to load pending games:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (gameId: string) => {
    setActing(gameId);
    try {
      await updateGameStatus(gameId, '是');
      setPending(prev => prev.filter(g => g.id !== gameId));
      onStatusChanged();
    } catch (err) {
      console.error('Failed to approve:', err);
      alert('操作失败，请重试');
    } finally {
      setActing(null);
    }
  };

  const handleRejectConfirm = async (gameId: string) => {
    if (!rejectReason.trim()) return;
    setActing(gameId);
    try {
      await updateGameStatus(gameId, '已驳回', rejectReason.trim());
      setPending(prev => prev.filter(g => g.id !== gameId));
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
      {pending.map(game => (
        <div key={game.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:bg-white/[0.04] transition-all">
          <div className="flex items-start gap-4">
            {/* 封面 */}
            {game.coverImage && (
              <img
                src={game.coverImage}
                alt={game.title}
                className="w-20 h-14 object-cover rounded-lg border border-white/10 shrink-0"
              />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-white font-bold">{game.title}</h4>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] rounded-full">
                  <Clock size={10} /> 审核中
                </span>
              </div>

              {game.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{game.description}</p>
              )}

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {game.url && (
                  <a href={game.url} target="_blank" rel="noreferrer"
                    className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    <ExternalLink size={10} /> 链接
                  </a>
                )}
                <span className="text-[10px] text-gray-600">{game.releaseDate}</span>
                {game.duration && <span className="text-[10px] text-gray-600">⏱ {game.duration}</span>}
                <span className="text-[10px] text-gray-600">👤 {game.author?.text || '匿名'}</span>
                <div className="flex gap-1.5">
                  {game.platform?.pc && <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">PC</span>}
                  {game.platform?.pe && <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">PE</span>}
                  {game.tags?.hasJumpScare && <span className="text-[10px] text-red-500/70 bg-white/5 px-1.5 py-0.5 rounded">微恐</span>}
                  {game.tags?.hasSound && <span className="text-[10px] text-cyan-500/70 bg-white/5 px-1.5 py-0.5 rounded">有声音</span>}
                </div>
              </div>

              {/* 驳回理由输入框 */}
              {rejectingId === game.id && (
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
                      onClick={() => handleRejectConfirm(game.id)}
                      disabled={!rejectReason.trim() || acting === game.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                    >
                      {acting === game.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
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
              {rejectingId !== game.id && (
                <>
                  <button
                    onClick={() => handleApprove(game.id)}
                    disabled={acting === game.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/20 transition-all text-xs font-bold disabled:opacity-50"
                  >
                    {acting === game.id && acting !== game.id + '_r' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    通过
                  </button>
                  <button
                    onClick={() => { setRejectingId(game.id); setRejectReason(''); }}
                    disabled={acting === game.id}
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
