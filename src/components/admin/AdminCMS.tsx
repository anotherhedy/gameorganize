import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase/supabaseClient';
import { X, Save, Loader2, Trash2, Settings, Image as ImageIcon, PenLine, Activity, Wifi, CheckCircle, AlertTriangle, Users, Key, Search } from 'lucide-react';
import { ReviewQueue } from './ReviewQueue';
import { fetchPendingCount, detectApiBase, deleteGame, updateGame, fetchAllGames, updateGameLinkStatus, getAccessToken } from '../../services/supabase/api';

interface AdminCMSProps {
  isOpen: boolean;
  onClose: () => void;
  onGameAdded: () => void;
  gameToEdit?: any;
  isSuperAdmin?: boolean;
}

export const AdminCMS: React.FC<AdminCMSProps> = ({ isOpen, onClose, onGameAdded, gameToEdit, isSuperAdmin = false }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '', url: '', image_url: '', description: '', duration: '',
    author_name: '', author_url: '', answer_url: '',
    pc: false, pe: false, jumpscare: false, sound: false,
    linkStatus: 'unknown' as 'ok' | 'broken' | 'unknown',
  });

  // 内部编辑状态（从检测结果点击进入时使用，不依赖父组件 gameToEdit）
  const [editingGame, setEditingGame] = useState<any>(null);
  const activeEdit = editingGame || gameToEdit;

  // 视图切换: 'review' = 审核队列, 'users' = 用户管理
  const [view, setView] = useState<'review' | 'users'>('review');

  // 用户管理状态
  const [userSearchEmail, setUserSearchEmail] = useState('');
  const [userSearchResult, setUserSearchResult] = useState<any>(null); // 当前选中的目标用户
  const [userMatches, setUserMatches] = useState<any[]>([]); // 模糊搜索命中多人时的候选列表
  const [userSearching, setUserSearching] = useState(false);
  const [userResetMsg, setUserResetMsg] = useState('');

  // 链接检测状态
  const [isCheckingLinks, setIsCheckingLinks] = useState(false);
  const [checkProgress, setCheckProgress] = useState({ current: 0, total: 0 });
  const [checkResults, setCheckResults] = useState<{
    ok: number; broken: number; errors: number;
    details: Array<{ id: string; title: string; url: string; status: string; game: any }>;
  } | null>(null);

  // 编辑模式：回填表单
  React.useEffect(() => {
    if (activeEdit) {
      setFormData({
        title: activeEdit.title || '',
        url: activeEdit.url || '',
        image_url: activeEdit.coverImage || '',
        description: activeEdit.description || '',
        duration: activeEdit.duration || '',
        author_name: activeEdit.author?.text || '',
        author_url: activeEdit.author?.url || '',
        answer_url: activeEdit.answer?.url || '',
        pc: activeEdit.platform?.pc || false,
        pe: activeEdit.platform?.pe || false,
        jumpscare: activeEdit.tags?.hasJumpScare || false,
        sound: activeEdit.tags?.hasSound || false,
        linkStatus: activeEdit.linkStatus || 'unknown',
      });
    }
  }, [activeEdit]);

  useEffect(() => {
    if (isOpen) {
      fetchPendingCount().then(setPendingCount).catch(() => {});
    }
  }, [isOpen]);

  // 用户管理面板仅超管可见：若角色降级/切换后仍停留在该视图，强制回到审核队列
  useEffect(() => {
    if (!isSuperAdmin && view === 'users') setView('review');
  }, [isSuperAdmin, view]);

  if (!isOpen) return null;

  // 统一的 /api/admin/users 请求封装：
  //  - 复用 api.ts 的 getAccessToken（同一缓存，不重复手写 getSession）
  //  - 自动带 Authorization；PUT 时带 Content-Type
  //  - 按 content-type 区分 JSON/文本，避免非 JSON 错误体被误解析（CF 404/网关页是 HTML）
  const adminUsersFetch = async (path: string, method: string, body?: any) => {
    const token = await getAccessToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    let payload: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const resp = await fetch(path, { method, headers, body: payload });
    const ct = resp.headers.get('content-type') || '';
    const data = ct.includes('application/json')
      ? await resp.json().catch(() => null)
      : await resp.text();
    return { resp, data };
  };

  // 兼容各种错误格式：GoTrue {code,msg}、PostgREST {message,details}、自研 {error}
  const extractErr = (err: any, fallback: string): string => {
    if (!err || typeof err !== 'object') return fallback;
    return err.error || err.msg || err.message || err.details || fallback;
  };

  const handleSearchUser = async () => {
    if (!userSearchEmail.trim()) return;
    setUserSearching(true);
    setUserSearchResult(null);
    setUserMatches([]);
    setUserResetMsg('');
    try {
      const { resp, data } = await adminUsersFetch(
        `/api/admin/users?email=${encodeURIComponent(userSearchEmail.trim())}`,
        'GET'
      );
      if (!resp.ok) {
        setUserResetMsg(`查找失败: ${extractErr(data, `HTTP ${resp.status}`)}`);
        return;
      }
      // GoTrue /auth/v1/admin/users 返回 { users: [...], aud: "..." }，角色由服务端补齐在 _profileRole
      const users = Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : []);
      if (users.length === 0) {
        setUserSearchResult({ notFound: true });
        return;
      }
      if (users.length === 1) {
        setUserSearchResult(users[0]);
      } else {
        // GoTrue filter 是子串匹配，可能命中多人：先展示候选列表，让管理员明确选择，避免误操作
        setUserMatches(users);
      }
    } catch (err: any) {
      setUserResetMsg(`查找失败: ${err.message}`);
    } finally {
      setUserSearching(false);
    }
  };

  const handleSelectMatch = (user: any) => {
    setUserSearchResult(user);
    setUserMatches([]);
  };

  const handleResetPassword = async () => {
    if (!userSearchResult?.id) return;
    const newPwd = window.prompt('请输入新密码（至少 6 位）：');
    if (!newPwd || newPwd.length < 6) {
      alert('密码至少需要 6 位字符');
      return;
    }
    setUserResetMsg('');
    try {
      const { resp, data } = await adminUsersFetch(
        `/api/admin/users?id=${userSearchResult.id}`,
        'PUT',
        { password: newPwd }
      );
      if (resp.ok) {
        setUserResetMsg(`✅ 密码已重置！用户 ${userSearchResult.email} 下次登录需使用新密码。`);
        setUserSearchResult(null);
      } else {
        setUserResetMsg(`❌ 重置失败: ${extractErr(data, '未知错误')}`);
      }
    } catch (err: any) {
      setUserResetMsg(`❌ 请求失败: ${err.message}`);
    }
  };

  const handleSetRole = async (newRole: string) => {
    if (!userSearchResult?.id) return;
    const label = newRole === 'normal_admin' ? '内容编辑' : '普通用户';
    if (!window.confirm(`确定将该用户${newRole === 'normal_admin' ? '任命为内容编辑' : '降级为普通用户'}吗？`)) return;
    setUserResetMsg('');
    try {
      const { resp, data } = await adminUsersFetch(
        `/api/admin/users?id=${userSearchResult.id}`,
        'PUT',
        { role: newRole }
      );
      if (resp.ok) {
        setUserResetMsg(`✅ 已将 ${userSearchResult.email} 设为「${label}」`);
        // 刷新搜索结果中的角色（服务端已更新成功）
        setUserSearchResult({ ...userSearchResult, _profileRole: newRole });
      } else {
        setUserResetMsg(`❌ 操作失败: ${extractErr(data, '未知错误')}`);
      }
    } catch (err: any) {
      setUserResetMsg(`❌ 请求失败: ${err.message}`);
    }
  };

  const handleCheckLinks = async () => {
    setIsCheckingLinks(true);
    setCheckResults(null);
    setCheckProgress({ current: 0, total: 0 });

    try {
      const allGames = await fetchAllGames();
      setCheckProgress({ current: 0, total: allGames.length });

      const CONCURRENCY = 3;
      let okCount = 0, brokenCount = 0, errorCount = 0;
      const details: Array<{ id: string; title: string; url: string; status: string; game: any }> = [];

      const queue = [...allGames];
      const workers: Promise<void>[] = [];

      for (let i = 0; i < CONCURRENCY; i++) {
        workers.push((async () => {
          while (queue.length > 0) {
            const game = queue.shift()!;
            try {
              const resp = await fetch(`/api/check-url?target=${encodeURIComponent(game.url)}`);
              const data = await resp.json();
              const linkStatus = data.link_status === 'broken' ? 'broken' as const : 'ok' as const;

              if (linkStatus === 'ok') okCount++;
              else brokenCount++;

              details.push({ id: game.id, title: game.title, url: game.url, status: linkStatus, game });

              // 即时写回数据库
              try { await updateGameLinkStatus(game.id, linkStatus); } catch {}
            } catch {
              errorCount++;
              details.push({ id: game.id, title: game.title, url: game.url, status: 'unknown', game });
              try { await updateGameLinkStatus(game.id, 'unknown'); } catch {}
            }

            setCheckProgress(prev => ({ ...prev, current: prev.current + 1 }));
          }
        })());
      }

      await Promise.all(workers);

      setCheckResults({
        ok: okCount,
        broken: brokenCount,
        errors: errorCount,
        details: details.filter(d => d.status === 'broken'),
      });

      onGameAdded(); // 刷新游戏列表以反映新状态
    } catch (err: any) {
      alert('链接检测失败: ' + (err.message || '未知错误'));
    } finally {
      setIsCheckingLinks(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `covers/${Math.random().toString(36).substring(2)}.${fileExt}`;
      const base = await detectApiBase();
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const resp = await fetch(`${base}/storage/v1/object/game-covers/${fileName}`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': file.type },
        body: file,
      });
      if (!resp.ok) throw new Error(`[${resp.status}] ${await resp.text().catch(() => '')}`);
      setFormData(prev => ({ ...prev, image_url: `${base}/storage/v1/object/public/game-covers/${fileName}` }));
    } catch (error: any) {
      alert('图片上传失败: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!activeEdit || !window.confirm('确定要永久删除这份档案吗？此操作不可撤销。')) return;
    setLoading(true);
    try {
      await deleteGame(activeEdit.id);
      alert('档案已销毁');
      setEditingGame(null);
      onGameAdded();
      onClose();
    } catch (error: any) {
      alert('删除失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEdit) return;
    setLoading(true);
    try {
      const payload = {
        title: formData.title, url: formData.url, image_url: formData.image_url,
        description: formData.description, category: [formData.duration].filter(Boolean),
        author_name: formData.author_name || '研究员', author_url: formData.author_url || '',
        answer_url: formData.answer_url || null,
        tags: [formData.pc ? 'PC' : null, formData.pe ? 'PE' : null,
          formData.jumpscare ? '有跳杀' : null, formData.sound ? '有声音' : null].filter(Boolean),
        link_status: formData.linkStatus,
        link_checked_at: new Date().toISOString(),
      };
      await updateGame(activeEdit.id, payload);
      alert('档案更新成功！');
      setEditingGame(null);
      onGameAdded();
      onClose();
    } catch (error: any) {
      alert('操作失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-xl">
      <div className="bg-neutral-900 border-x border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/5 sticky top-0 bg-neutral-900/80 backdrop-blur-md z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Settings className="text-purple-500 w-5 h-5 sm:w-6 sm:h-6" />
                {activeEdit ? '编辑档案' : view === 'users' ? '用户管理' : '审核队列'}
              </h2>
              <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">S.E.A. CMS Portal</p>
            </div>
            <div className="flex items-center gap-2">
              {activeEdit && isSuperAdmin && (
                <button onClick={handleDelete}
                  className="text-red-500 hover:bg-red-500/10 p-2 rounded-full transition-all" title="删除档案">
                  <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* 编辑模式 */}
        {activeEdit ? (
          <form onSubmit={handleEditSubmit} className="p-5 sm:p-8 space-y-6 sm:space-y-8 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div className="space-y-3 sm:space-y-4">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">游戏封面</label>
                <div className="relative aspect-video rounded-xl border-2 border-dashed border-white/10 overflow-hidden bg-white/5 group transition-all hover:border-purple-500/50">
                  {formData.image_url ? (
                    <>
                      <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-4">
                      {uploading ? <Loader2 className="w-8 h-8 animate-spin text-purple-500" /> : <ImageIcon className="w-8 h-8 text-gray-600 group-hover:text-purple-400 transition-colors" />}
                      <span className="mt-2 text-[10px] sm:text-xs text-gray-500 group-hover:text-gray-300 text-center">点击上传封面</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">游戏标题</label>
                  <input type="text" required value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 sm:py-2.5 px-4 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">游戏链接</label>
                  <input type="url" required value={formData.url}
                    onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 sm:py-2.5 px-4 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">链接状态</label>
                  <div className="flex gap-1.5">
                    {[
                      { value: 'ok', label: '✅ 正常', color: 'bg-green-600/20 border-green-500 text-green-300' },
                      { value: 'broken', label: '❌ 失效', color: 'bg-red-600/20 border-red-500 text-red-300' },
                      { value: 'unknown', label: '⚪ 未检测', color: 'bg-white/10 border-white/20 text-gray-400' },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setFormData(prev => ({ ...prev, linkStatus: opt.value as 'ok' | 'broken' | 'unknown' }))}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold border transition-all ${
                          formData.linkStatus === opt.value ? opt.color : 'bg-black/20 border-white/5 text-gray-600 hover:text-gray-400'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">描述信息</label>
                <textarea rows={3} value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 sm:py-2.5 px-4 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">游戏时长</label>
                  <input type="text" value={formData.duration}
                    onChange={e => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 sm:py-2.5 px-4 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">作者名称</label>
                  <input type="text" value={formData.author_name}
                    onChange={e => setFormData(prev => ({ ...prev, author_name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 sm:py-2.5 px-4 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">作者链接</label>
                  <input type="url" value={formData.author_url}
                    onChange={e => setFormData(prev => ({ ...prev, author_url: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 sm:py-2.5 px-4 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">攻略链接 <span className="text-gray-600 font-normal">(选填)</span></label>
                  <input type="url" value={formData.answer_url}
                    onChange={e => setFormData(prev => ({ ...prev, answer_url: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 sm:py-2.5 px-4 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">属性标签</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'pc', label: 'PC 端' }, { key: 'pe', label: 'PE 端' },
                    { key: 'jumpscare', label: '有跳杀' }, { key: 'sound', label: '有声音' },
                  ].map(tag => (
                    <button key={tag.key} type="button"
                      onClick={() => setFormData(prev => ({ ...prev, [tag.key]: !prev[tag.key as keyof typeof prev] }))}
                      className={`py-2 px-3 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${formData[tag.key as keyof typeof formData]
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                        : 'bg-black/20 border-white/10 text-gray-500 hover:text-gray-300'}`}>
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 pb-4 sm:pb-0 border-t border-white/5 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button type="submit" disabled={loading || uploading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 sm:py-4 rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
                <span>更新档案</span>
              </button>
              <button type="button" onClick={() => { setEditingGame(null); onClose(); }}
                className="px-8 py-3 sm:py-4 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl hover:bg-white/10 transition-all text-sm sm:text-base">
                取消
              </button>
            </div>
          </form>
        ) : (
          /* 管理工具（默认视图） */
          <div className="p-5 sm:p-6 flex-1 overflow-y-auto">
            {/* Tab 切换 */}
            <div className="flex gap-1 mb-5 p-0.5 bg-white/5 rounded-lg">
              <button
                onClick={() => setView('review')}
                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  view === 'review' ? 'bg-purple-600/30 text-purple-300' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Settings size={13} /> 审核队列
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => setView('users')}
                  className={`flex-1 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    view === 'users' ? 'bg-purple-600/30 text-purple-300' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Users size={13} /> 用户管理
                </button>
              )}
            </div>

            {view === 'review' ? (
            <>
            {/* 链接有效性检测 */}
            <div className="mb-6 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-purple-400" />
                  <h3 className="text-sm font-bold text-white">链接有效性检测</h3>
                </div>
                <button
                  onClick={handleCheckLinks}
                  disabled={isCheckingLinks}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold hover:bg-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCheckingLinks ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Wifi size={14} />
                  )}
                  <span>{isCheckingLinks ? '检测中...' : '检测失效链接'}</span>
                </button>
              </div>

              {/* 进度条 */}
              {isCheckingLinks && checkProgress.total > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>正在检测 {checkProgress.current}/{checkProgress.total}</span>
                    <span>{Math.round((checkProgress.current / checkProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${(checkProgress.current / checkProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 结果摘要 */}
              {checkResults && !isCheckingLinks && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1 text-green-400">
                      <CheckCircle size={12} /> {checkResults.ok} 正常
                    </span>
                    <span className="flex items-center gap-1 text-red-400">
                      <AlertTriangle size={12} /> {checkResults.broken} 失效
                    </span>
                    {checkResults.errors > 0 && (
                      <span className="text-gray-500">{checkResults.errors} 错误</span>
                    )}
                  </div>
                  {checkResults.details.length > 0 && (
                    <details className="text-xs">
                      <summary className="text-gray-400 cursor-pointer hover:text-gray-300">
                        查看失效详情 ({checkResults.details.length})
                      </summary>
                      <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                        {checkResults.details.map(d => (
                          <li key={d.id}
                            onClick={() => setEditingGame(d.game)}
                            className="text-red-400/80 truncate cursor-pointer hover:text-red-300 hover:bg-white/5 rounded px-1 py-0.5 transition-colors flex items-center gap-1"
                            title="点击编辑此游戏">
                            <PenLine size={10} className="text-gray-600 flex-shrink-0" />
                            <span className="text-gray-600">[{d.id}]</span> {d.title}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>

            <ReviewQueue onStatusChanged={() => {
              onGameAdded();
              fetchPendingCount().then(setPendingCount).catch(() => {});
            }} />
            </>
            ) : (
            <>
            {/* 用户管理面板 */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} className="text-purple-400" />
                <h3 className="text-sm font-bold text-white">用户管理 · 重置密码</h3>
              </div>

              {/* 搜索用户 */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={userSearchEmail}
                  onChange={e => setUserSearchEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchUser()}
                  placeholder="输入用户邮箱..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                <button
                  onClick={handleSearchUser}
                  disabled={userSearching}
                  className="px-3 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold hover:bg-purple-600/30 transition-all disabled:opacity-50 flex items-center gap-1"
                >
                  {userSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  查找
                </button>
              </div>

              {/* 模糊搜索命中多人：先选择具体用户，避免对错误账号执行重置/改角色 */}
              {userMatches.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400">
                    找到 {userMatches.length} 个匹配用户（模糊匹配），请选择：
                  </p>
                  {userMatches.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectMatch(u)}
                      className="w-full text-left flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors"
                    >
                      <span>📧 {u.email}</span>
                      <span className="text-gray-500 text-[10px]">{u.created_at?.split('T')[0] || ''}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 搜索结果 */}
              {userSearchResult && !userSearchResult.notFound && (
                <div className="p-3 bg-white/5 rounded-lg space-y-2">
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>📧 <span className="text-white">{userSearchResult.email}</span></div>
                    <div>🆔 <span className="text-gray-500 text-[10px]">{userSearchResult.id}</span></div>
                    <div>🛡️ 角色: <span className={userSearchResult._profileRole === 'admin' ? 'text-purple-400 font-bold' : userSearchResult._profileRole === 'normal_admin' ? 'text-blue-400' : 'text-gray-500'}>
                      {userSearchResult._profileRole === 'admin' ? '👑 超级管理员' : userSearchResult._profileRole === 'normal_admin' ? '🔧 内容编辑' : '👤 普通用户'}
                    </span></div>
                    <div>📅 <span className="text-gray-500">{userSearchResult.created_at?.split('T')[0] || '未知'}</span></div>
                    {userSearchResult.last_sign_in_at && (
                      <div>🔑 上次登录: <span className="text-gray-500">{new Date(userSearchResult.last_sign_in_at).toLocaleString('zh-CN')}</span></div>
                    )}
                  </div>
                  {/* 角色管理按钮（仅超管可见，且不能改自己） */}
                  {userSearchResult._profileRole !== 'admin' && (
                    <div className="flex gap-2">
                      {userSearchResult._profileRole !== 'normal_admin' ? (
                        <button
                          onClick={() => handleSetRole('normal_admin')}
                          className="flex-1 py-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-bold hover:bg-blue-600/30 transition-all flex items-center justify-center gap-1"
                        >
                          🔧 任命为内容编辑
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSetRole('user')}
                          className="flex-1 py-1.5 bg-gray-600/20 border border-gray-500/30 text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-600/30 transition-all flex items-center justify-center gap-1"
                        >
                          ⬇️ 降级为普通用户
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleResetPassword}
                    className="w-full py-2 bg-red-600/20 border border-red-500/30 text-red-300 rounded-lg text-xs font-bold hover:bg-red-600/30 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Key size={13} /> 重置密码
                  </button>
                </div>
              )}

              {userSearchResult?.notFound && (
                <p className="text-xs text-gray-500">未找到该邮箱对应的用户</p>
              )}

              {userResetMsg && (
                <p className={`text-xs p-2 rounded-lg ${userResetMsg.startsWith('✅') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {userResetMsg}
                </p>
              )}

              <p className="text-[10px] text-gray-600 leading-relaxed">
                Supabase 海外邮件国内可能收不到。通过此功能管理员可帮用户设置新密码，然后通过微信/QQ 等渠道告知用户。用户登录后可在个人中心自行修改密码。
              </p>
            </div>
            </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
