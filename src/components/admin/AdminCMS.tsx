import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase/supabaseClient';
import { X, Save, Loader2, Trash2, Settings, Image as ImageIcon, PenLine, Activity, Wifi, CheckCircle, AlertTriangle } from 'lucide-react';
import { ReviewQueue } from './ReviewQueue';
import { fetchPendingCount, detectApiBase, deleteGame, updateGame, fetchAllGames, updateGameLinkStatus } from '../../services/supabase/api';

interface AdminCMSProps {
  isOpen: boolean;
  onClose: () => void;
  onGameAdded: () => void;
  gameToEdit?: any;
}

export const AdminCMS: React.FC<AdminCMSProps> = ({ isOpen, onClose, onGameAdded, gameToEdit }) => {
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

  if (!isOpen) return null;

  const handleCheckLinks = async () => {
    setIsCheckingLinks(true);
    setCheckResults(null);
    setCheckProgress({ current: 0, total: 0 });

    try {
      const allGames = await fetchAllGames();
      setCheckProgress({ current: 0, total: allGames.length });

      const CONCURRENCY = 3;
      let okCount = 0, brokenCount = 0, errorCount = 0;
      const details: Array<{ id: string; title: string; url: string; status: string }> = [];

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
                {activeEdit ? '编辑档案' : '审核队列'}
              </h2>
              <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">S.E.A. CMS Portal</p>
            </div>
            <div className="flex items-center gap-2">
              {activeEdit && (
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
          /* 审核队列（默认视图） */
          <div className="p-5 sm:p-6 flex-1 overflow-y-auto">
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
          </div>
        )}
      </div>
    </div>
  );
};
