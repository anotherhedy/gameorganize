import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase/supabaseClient';
import { X, Save, Loader2, Trash2, Settings, Image as ImageIcon, PenLine } from 'lucide-react';
import { ReviewQueue } from './ReviewQueue';
import { fetchPendingCount, detectApiBase, deleteGame, updateGame } from '../../services/supabase/api';

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
  });

  // 编辑模式：回填表单
  React.useEffect(() => {
    if (gameToEdit) {
      setFormData({
        title: gameToEdit.title || '',
        url: gameToEdit.url || '',
        image_url: gameToEdit.coverImage || '',
        description: gameToEdit.description || '',
        duration: gameToEdit.duration || '',
        author_name: gameToEdit.author?.text || '',
        author_url: gameToEdit.author?.url || '',
        answer_url: gameToEdit.answer?.url || '',
        pc: gameToEdit.platform?.pc || false,
        pe: gameToEdit.platform?.pe || false,
        jumpscare: gameToEdit.tags?.hasJumpScare || false,
        sound: gameToEdit.tags?.hasSound || false,
      });
    }
  }, [gameToEdit]);

  useEffect(() => {
    if (isOpen) {
      fetchPendingCount().then(setPendingCount).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
    if (!gameToEdit || !window.confirm('确定要永久删除这份档案吗？此操作不可撤销。')) return;
    setLoading(true);
    try {
      await deleteGame(gameToEdit.id);
      alert('档案已销毁');
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
    setLoading(true);
    try {
      const payload = {
        title: formData.title, url: formData.url, image_url: formData.image_url,
        description: formData.description, category: [formData.duration].filter(Boolean),
        author_name: formData.author_name || '研究员', author_url: formData.author_url || '',
        answer_url: formData.answer_url || null,
        tags: [formData.pc ? 'PC' : null, formData.pe ? 'PE' : null,
          formData.jumpscare ? '有跳杀' : null, formData.sound ? '有声音' : null].filter(Boolean),
      };
      await updateGame(gameToEdit.id, payload);
      alert('档案更新成功！');
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
                {gameToEdit ? '编辑档案' : '审核队列'}
              </h2>
              <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">S.E.A. CMS Portal</p>
            </div>
            <div className="flex items-center gap-2">
              {gameToEdit && (
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
        {gameToEdit ? (
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
              <button type="button" onClick={onClose}
                className="px-8 py-3 sm:py-4 bg-white/5 border border-white/10 text-gray-400 font-bold rounded-xl hover:bg-white/10 transition-all text-sm sm:text-base">
                取消
              </button>
            </div>
          </form>
        ) : (
          /* 审核队列（默认视图） */
          <div className="p-5 sm:p-6 flex-1 overflow-y-auto">
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
