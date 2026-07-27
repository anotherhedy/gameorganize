import React, { useState, useEffect } from 'react';
import { GameSubmission } from '../../types';
import { fetchPendingSubmissions, approveSubmission, rejectSubmission } from '../../services/supabase/api';
import { CheckCircle2, XCircle, Loader2, Clock, ExternalLink, Inbox, MessageSquare, Send, ChevronDown, ChevronRight, Monitor, Smartphone, Zap, Volume2 } from 'lucide-react';

interface ReviewQueueProps {
  onStatusChanged: () => void;
}

export const ReviewQueue: React.FC<ReviewQueueProps> = ({ onStatusChanged }) => {
  const [pending, setPending] = useState<GameSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
      setExpandedId(null);
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
      setExpandedId(null);
      onStatusChanged();
    } catch (err) {
      console.error('Failed to reject:', err);
      alert('操作失败，请重试');
    } finally {
      setActing(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
    // 关闭驳回输入框
    if (rejectingId && rejectingId !== id) {
      setRejectingId(null);
      setRejectReason('');
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
      {pending.map(sub => {
        const isExpanded = expandedId === sub.id;

        return (
          <div key={sub.id} className="bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-all overflow-hidden">
            {/* ====== 折叠行 ====== */}
            <button
              onClick={() => toggleExpand(sub.id)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              {/* 展开图标 */}
              <span className="text-gray-500 shrink-0">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>

              {/* 封面缩略图 */}
              {sub.image_url && (
                <img src={sub.image_url} alt="" className="w-9 h-9 rounded object-cover shrink-0 border border-white/10" />
              )}

              {/* 标题 + 链接 + 作者 */}
              <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                <span className="text-white font-bold text-sm truncate">{sub.title}</span>
                {sub.url && (
                  <a
                    href={sub.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 shrink-0"
                  >
                    <ExternalLink size={10} /> 游戏链接
                  </a>
                )}
                <span className="text-[11px] text-gray-500">👤 {sub.author_name || '未知'}</span>
              </div>

              {/* 审核中标签 */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] rounded-full shrink-0">
                <Clock size={10} /> 审核中
              </span>
            </button>

            {/* ====== 展开详情 ====== */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-white/5">
                {/* 详情网格 */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {/* 封面大图 */}
                  {sub.image_url && (
                    <div className="sm:col-span-2 mb-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">封面图片</p>
                      <img src={sub.image_url} alt={sub.title} className="w-full max-w-[240px] rounded-lg border border-white/10" />
                    </div>
                  )}

                  {/* 简介 */}
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">简介</p>
                    <p className="text-gray-300 leading-relaxed">{sub.description || '无'}</p>
                  </div>

                  {/* 时长 */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">预计时长</p>
                    <p className="text-gray-300">{sub.duration || '未知'}</p>
                  </div>

                  {/* 提交时间 */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">提交时间</p>
                    <p className="text-gray-300">{sub.created_at ? new Date(sub.created_at).toLocaleString('zh-CN') : '未知'}</p>
                  </div>

                  {/* 作者 */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">作者</p>
                    <p className="text-gray-300">{sub.author_name || '未知'}</p>
                  </div>

                  {/* 作者链接 */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">作者链接</p>
                    {sub.author_url ? (
                      <a href={sub.author_url} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 break-all">
                        {sub.author_url}
                      </a>
                    ) : (
                      <span className="text-gray-600">未提供</span>
                    )}
                  </div>

                  {/* 攻略链接 */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">攻略链接</p>
                    {sub.answer_url ? (
                      <a href={sub.answer_url} target="_blank" rel="noreferrer" className="text-green-400 hover:text-green-300 break-all">
                        {sub.answer_url}
                      </a>
                    ) : (
                      <span className="text-gray-600">未提供</span>
                    )}
                  </div>

                  {/* 平台 / 标签 */}
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">平台 & 标签</p>
                    <div className="flex gap-2 flex-wrap">
                      {sub.pc && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-gray-300">
                          <Monitor size={11} /> PC
                        </span>
                      )}
                      {sub.pe && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-gray-300">
                          <Smartphone size={11} /> 手机
                        </span>
                      )}
                      {sub.jumpscare && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400">
                          <Zap size={11} /> 微恐
                        </span>
                      )}
                      {sub.sound && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-[11px] text-cyan-400">
                          <Volume2 size={11} /> 有声音
                        </span>
                      )}
                      {!sub.pc && !sub.pe && !sub.jumpscare && !sub.sound && (
                        <span className="text-gray-600 text-[11px]">无标签</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 驳回输入 */}
                {rejectingId === sub.id && (
                  <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <label className="text-[11px] font-bold text-red-300 flex items-center gap-1.5 mb-2">
                      <MessageSquare size={12} /> 驳回理由（必填）
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="说明为什么不通过..."
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

                {/* 操作按钮 */}
                {rejectingId !== sub.id && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleApprove(sub.id)}
                      disabled={acting === sub.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/20 transition-all text-xs font-bold disabled:opacity-50"
                    >
                      {acting === sub.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      通过
                    </button>
                    <button
                      onClick={() => { setRejectingId(sub.id); setRejectReason(''); }}
                      disabled={acting === sub.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition-all text-xs font-bold disabled:opacity-50"
                    >
                      <XCircle size={14} /> 驳回
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
