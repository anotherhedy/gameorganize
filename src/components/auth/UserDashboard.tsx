import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase/supabaseClient';
import { GameData } from '../../types';
import { fetchMySubmissions } from '../../services/supabase/api';
import {
  X, User, Mail, ShieldCheck, BadgeCheck, LogOut, Save, Loader2,
  FilePlus, Dices, Edit3, Clock, CheckCircle2, Circle, ExternalLink,
  Trophy, Send, AlertCircle, ChevronRight, Star, Flame, Target,
  Settings, Inbox
} from 'lucide-react';

interface UserDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  profile?: any;
  onProfileUpdate?: (profile: any) => void;
  solvedGameIds: Set<string>;
  games: GameData[];
  isAdmin: boolean;
  pendingCount: number;
  onOpenSubmit: () => void;
  onOpenCMS: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  isOpen,
  onClose,
  user,
  profile,
  onProfileUpdate,
  solvedGameIds,
  games,
  isAdmin,
  pendingCount,
  onOpenSubmit,
  onOpenCMS
}) => {
  const [username, setUsername] = useState('');
  const [xhsId, setXhsId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'submissions' | 'settings'>('overview');
  const [mySubmissions, setMySubmissions] = useState<GameData[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  // 初始化表单值
  useEffect(() => {
    if (isOpen && user) {
      const initialUsername = profile?.username || user.user_metadata?.username || '';
      const initialXhsId = profile?.xhs_id || user.user_metadata?.xhs_id || '';
      setUsername(initialUsername);
      setXhsId(initialXhsId);
    }
  }, [isOpen, user, profile]);

  // 加载我的投稿
  useEffect(() => {
    if (isOpen && user) {
      setSubsLoading(true);
      fetchMySubmissions(user.id)
        .then(setMySubmissions)
        .catch(() => setMySubmissions([]))
        .finally(() => setSubsLoading(false));
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  // 统计数据
  const solvedCount = solvedGameIds.size;
  const totalGames = games.filter(g => g.status === '是').length;
  const submissionCount = mySubmissions.length;
  const approvedCount = mySubmissions.filter(s => s.status === '是').length;

  // 已侦破的游戏
  const solvedGames = games.filter(g => solvedGameIds.has(g.id));

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: updatedRows, error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username,
          xhs_id: xhsId || null,
          updated_at: new Date().toISOString()
        })
        .select();

      if (profileError) throw profileError;

      if (onProfileUpdate && updatedRows?.[0]) {
        onProfileUpdate(updatedRows[0]);
      }

      setLoading(false);
      setActiveSection('overview');
    } catch (err: any) {
      console.error('更新档案失败:', err);
      setError(err.message || '更新失败');
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === '审核中') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] rounded-full font-medium">
          <Clock size={10} /> 审核中
        </span>
      );
    }
    if (status === '已驳回') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] rounded-full font-medium">
          <AlertCircle size={10} /> 已驳回
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] rounded-full font-medium">
        <CheckCircle2 size={10} /> 已通过
      </span>
    );
  };

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-[115] bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 左侧滑出面板 */}
      <div className="fixed inset-y-0 left-0 z-[116] w-full max-w-md bg-[#0a0a10] border-r border-white/10 shadow-2xl shadow-purple-500/10 flex flex-col animate-in slide-in-from-left duration-300">

        {/* ========== Header ========== */}
        <div className="relative p-5 border-b border-white/5 bg-gradient-to-r from-purple-950/40 to-blue-950/20 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X size={20} />
          </button>

          {/* 用户名片 */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-purple-500/20 ring-2 ring-purple-500/30">
                {(username || user.email || '?')[0].toUpperCase()}
              </div>
              {isAdmin && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center ring-2 ring-[#0a0a10]">
                  <ShieldCheck size={10} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white truncate">
                  {username || '研究员'}
                </h2>
                {isAdmin && (
                  <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] rounded-full font-bold">
                    管理员
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
                <Mail size={10} />
                <span className="truncate">{user.email}</span>
              </div>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-2.5 mt-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center hover:bg-white/10 transition-all">
              <Trophy size={16} className="text-yellow-400 mx-auto mb-0.5" />
              <p className="text-xl font-bold text-white">{solvedCount}</p>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">已侦破</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center hover:bg-white/10 transition-all">
              <Send size={16} className="text-cyan-400 mx-auto mb-0.5" />
              <p className="text-xl font-bold text-white">{submissionCount}</p>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">投稿</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center hover:bg-white/10 transition-all">
              <Target size={16} className="text-green-400 mx-auto mb-0.5" />
              <p className="text-xl font-bold text-white">{approvedCount}</p>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">通过</p>
            </div>
          </div>
        </div>

        {/* ========== 功能按钮区 ========== */}
        <div className="p-4 border-b border-white/5 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { onOpenSubmit(); onClose(); }}
              className="flex items-center justify-center gap-2 py-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all group"
            >
              <FilePlus size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium text-cyan-300">提交档案</span>
            </button>

            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 py-3 bg-purple-500/10 border border-purple-500/20 rounded-xl hover:bg-purple-500/20 hover:border-purple-500/40 transition-all group"
            >
              <Dices size={16} className="text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium text-purple-300">随机抽取</span>
            </button>

            <button
              onClick={() => setActiveSection('settings')}
              className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/30 transition-all group"
            >
              <Edit3 size={16} className="text-gray-400 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium text-gray-300">编辑资料</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => { onOpenCMS(); onClose(); }}
                className="relative flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 hover:border-red-500/40 transition-all group"
              >
                <Settings size={16} className="text-red-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-red-300">管理中心</span>
                {pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ========== Section Tabs ========== */}
        <div className="flex border-b border-white/5 px-5 shrink-0">
          {([
            { id: 'overview', label: '概览', icon: Star },
            { id: 'submissions', label: '投稿', icon: Send },
            { id: 'settings', label: '资料', icon: Edit3 },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2 -mb-[1px] ${
                activeSection === tab.id
                  ? 'text-purple-400 border-purple-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
              {tab.id === 'submissions' && submissionCount > 0 && (
                <span className="ml-0.5 px-1 py-0.5 bg-purple-500/20 text-purple-300 text-[9px] rounded-full font-bold leading-none">
                  {submissionCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ========== Content ========== */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ===== 概览 ===== */}
          {activeSection === 'overview' && (
            <>
              {/* 侦破进度 */}
              <section>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  侦破进度 ({solvedCount}/{totalGames})
                </h3>
                {totalGames > 0 ? (
                  <>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((solvedCount / totalGames) * 100)}%` }}
                      />
                    </div>
                    {solvedGames.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {solvedGames.slice(0, 8).map(game => (
                          <a
                            key={game.id}
                            href={game.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/5 border border-green-500/20 rounded-full text-[11px] text-green-400 hover:bg-green-500/10 transition-all"
                          >
                            <CheckCircle2 size={10} />
                            <span className="truncate max-w-[100px]">{game.title}</span>
                          </a>
                        ))}
                        {solvedGames.length > 8 && (
                          <span className="inline-flex items-center px-2.5 py-1 bg-white/5 rounded-full text-[11px] text-gray-500">
                            +{solvedGames.length - 8}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600">标记已玩过的游戏会显示在这里</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-600">暂无数据</p>
                )}
              </section>

              {/* 最近投稿 */}
              {submissionCount > 0 && (
                <section>
                  <button
                    onClick={() => setActiveSection('submissions')}
                    className="w-full flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 hover:text-gray-300 transition-colors"
                  >
                    <span>最近投稿</span>
                    <span className="flex items-center gap-1 text-purple-400">
                      查看全部 <ChevronRight size={14} />
                    </span>
                  </button>
                  <div className="space-y-2">
                    {mySubmissions.slice(0, 3).map(sub => (
                      <div key={sub.id} className="bg-white/5 border border-white/5 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {sub.coverImage && (
                              <img src={sub.coverImage} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                            )}
                            <span className="text-sm text-gray-200 truncate">{sub.title}</span>
                          </div>
                          {statusBadge(sub.status)}
                        </div>
                        {sub.status === '已驳回' && sub.review_comment && (
                          <p className="mt-1.5 ml-9 text-[11px] text-red-400/80 bg-red-500/5 rounded px-2 py-1">
                            💬 {sub.review_comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {submissionCount === 0 && solvedCount === 0 && (
                <div className="text-center py-8">
                  <Inbox size={36} className="text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">暂无活动记录</p>
                  <p className="text-xs text-gray-600 mt-1">提交档案或标记已玩来开始</p>
                </div>
              )}
            </>
          )}

          {/* ===== 我的投稿 ===== */}
          {activeSection === 'submissions' && (
            <section>
              {subsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-purple-400" />
                </div>
              ) : submissionCount === 0 ? (
                <div className="text-center py-12">
                  <Send size={36} className="text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">还没有投过稿</p>
                  <button
                    onClick={() => { onOpenSubmit(); onClose(); }}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl hover:bg-cyan-500/20 transition-all text-sm font-medium"
                  >
                    <FilePlus size={14} />
                    提交第一份档案
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {mySubmissions.map(sub => (
                    <div key={sub.id} className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl p-3 hover:bg-white/10 transition-all">
                      {sub.coverImage && (
                        <img src={sub.coverImage} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate text-sm">{sub.title}</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {sub.releaseDate} · {sub.duration || '时长未知'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {sub.platform?.pc && <span className="text-[9px] text-gray-600 bg-white/5 px-1 py-0.5 rounded">PC</span>}
                          {sub.platform?.pe && <span className="text-[9px] text-gray-600 bg-white/5 px-1 py-0.5 rounded">PE</span>}
                          {sub.tags?.hasJumpScare && <span className="text-[9px] text-gray-600 bg-white/5 px-1 py-0.5 rounded">微恐</span>}
                          {sub.tags?.hasSound && <span className="text-[9px] text-gray-600 bg-white/5 px-1 py-0.5 rounded">声音</span>}
                        </div>
                        {sub.status === '已驳回' && sub.review_comment && (
                          <p className="mt-1.5 text-[11px] text-red-400/80 bg-red-500/5 rounded px-2 py-1">
                            💬 {sub.review_comment}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {statusBadge(sub.status)}
                        {sub.status === '是' && sub.url && (
                          <a href={sub.url} target="_blank" rel="noreferrer"
                            className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5"
                          >
                            <ExternalLink size={10} /> 访问
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ===== 资料设置 ===== */}
          {activeSection === 'settings' && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={12} /> 研究员代号
                </label>
                <input
                  type="text" required value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="你的代号"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">小红书 ID</label>
                <input
                  type="text" value={xhsId}
                  onChange={(e) => setXhsId(e.target.value)}
                  placeholder="选填"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail size={12} /> 通讯邮箱
                </label>
                <input
                  type="text" disabled value={user.email}
                  className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-4 text-gray-500 cursor-not-allowed text-sm"
                />
                <p className="text-[10px] text-gray-600">邮箱作为唯一身份凭证不可修改</p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  保存资料
                </button>
                <button
                  type="button"
                  onClick={() => supabase.auth.signOut()}
                  className="w-full py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl transition-all flex items-center justify-center gap-2 font-medium text-sm"
                >
                  <LogOut size={14} />
                  退出登录
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};
