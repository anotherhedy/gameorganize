import React, { useState, useRef } from 'react';
import { supabase } from '../../services/supabase/supabaseClient';
import { submitGameForReview, checkDuplicateGame } from '../../services/supabase/api';
import { X, Upload, Loader2, Monitor, Smartphone, AlertTriangle, Send, ImagePlus } from 'lucide-react';

/** Canvas 压缩图片 — 最大宽度 400px，WebP 格式，质量 0.7 */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxW = 400;
      let w = img.width;
      let h = img.height;
      if (w > maxW) {
        h = Math.round(h * (maxW / w));
        w = maxW;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 不可用')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('压缩失败'));
        },
        'image/webp',
        0.7
      );
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = url;
  });
}

interface SubmitGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSubmitted: () => void;
}

export const SubmitGameModal: React.FC<SubmitGameModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSubmitted
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorUrl, setAuthorUrl] = useState('');
  const [answerUrl, setAnswerUrl] = useState('');
  const [pc, setPc] = useState(true);
  const [pe, setPe] = useState(false);
  const [jumpscare, setJumpscare] = useState(false);
  const [sound, setSound] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('图片不能超过 2MB');
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError(null);
  };

  const uploadCover = async (): Promise<string> => {
    if (!coverFile) throw new Error('请选择封面图片');

    // 先压缩
    const compressed = await compressImage(coverFile);
    const compressedFile = new File([compressed], coverFile.name.replace(/\.[^.]+$/, '.webp'), {
      type: 'image/webp'
    });

    const fileName = `submitted/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;

    const { error: uploadError } = await supabase.storage
      .from('game-covers')
      .upload(fileName, compressedFile, {
        cacheControl: '31536000',
        contentType: 'image/webp'
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('game-covers')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim() || !description.trim() || !duration.trim() || !authorName.trim() || !authorUrl.trim()) {
      setError('请填写所有必填项');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. 先按标题查重（链接可重复——同作者可能用同网站发多个游戏）
      console.log('[提交] 步骤1: 检查重复...');
      const { isDuplicate, existingTitle } = await checkDuplicateGame(title.trim());
      if (isDuplicate) {
        setError(`已收录该游戏：${existingTitle || ''}`);
        setLoading(false);
        return;
      }
      console.log('[提交] 步骤1: 无重复');

      // 2. 上传封面图（自动压缩为 WebP）
      let imageUrl = '';
      if (coverFile) {
        console.log('[提交] 步骤2: 压缩并上传图片...');
        imageUrl = await uploadCover();
        console.log('[提交] 步骤2: 图片上传完成', imageUrl);
      }

      // 3. 提交审核
      console.log('[提交] 步骤3: 写入数据库...');
      await submitGameForReview({
        title: title.trim(),
        url: url.trim(),
        image_url: imageUrl,
        description: description.trim(),
        duration: duration.trim(),
        author_name: authorName.trim(),
        author_url: authorUrl.trim(),
        answer_url: answerUrl.trim(),
        pc,
        pe,
        jumpscare,
        sound,
        submitted_by: userId
      });
      console.log('[提交] 步骤3: 写入成功');

      // 清空表单
      setTitle(''); setUrl(''); setDescription(''); setDuration('');
      setAuthorName(''); setAuthorUrl(''); setAnswerUrl('');
      setPc(true); setPe(false); setJumpscare(false); setSound(false);
      setCoverFile(null); setCoverPreview(null);
      setLoading(false);
      onSubmitted();
      onClose();
    } catch (err: any) {
      console.error('[提交] 失败:', err);
      setError(err?.message || err?.error_description || '提交失败，请重试');
      setLoading(false);
    }
  };

  const togglePlatform = (p: 'pc' | 'pe') => {
    if (p === 'pc') setPc(!pc);
    else setPe(!pe);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0a0a10] border border-white/10 sm:rounded-2xl w-full max-w-lg h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto shadow-2xl shadow-cyan-500/10">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0a0a10] p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">提交新档案</h2>
            <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">Submit Game Record</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 审核提示 */}
          <div className="flex items-start gap-3 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
            <AlertTriangle size={16} className="text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-cyan-300">提交后将进入审核队列</p>
              <p className="text-[10px] text-gray-500 mt-0.5">管理员审核通过后才会公开展示，请确保信息准确</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>
          )}

          {/* 封面图 */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">封面图片</label>
            {coverPreview ? (
              <div className="relative inline-block">
                <img src={coverPreview} alt="预览" className="w-32 h-20 object-cover rounded-lg border border-white/10" />
                <button
                  type="button"
                  onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 h-20 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all">
                <ImagePlus size={24} className="text-gray-500" />
                <span className="text-[10px] text-gray-500">点击上传封面（可选）</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            )}
          </div>

          {/* 游戏名称 */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
              游戏名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：青楼"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
            />
          </div>

          {/* 链接 */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
              游戏链接 <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
            />
          </div>

          {/* 简介 */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
              简介 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="简单描述这个游戏的背景、玩法..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none"
            />
          </div>

          {/* 时长 */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
              预计时长 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="例如：1-2小时 或 30分钟"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
            />
          </div>

          {/* 作者信息 */}
          <div className="space-y-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">作者信息</p>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                作者名称 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="作者名 / 小红书昵称"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                作者链接 <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                required
                value={authorUrl}
                onChange={(e) => setAuthorUrl(e.target.value)}
                placeholder="小红书/微博/B站 主页链接"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
            </div>
          </div>

          {/* 攻略链接 */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
              攻略链接 <span className="text-gray-600 font-normal">（选填）</span>
            </label>
            <input
              type="url"
              value={answerUrl}
              onChange={(e) => setAnswerUrl(e.target.value)}
              placeholder="通关攻略 / 答案链接"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
            />
          </div>

          {/* 平台 + 标签 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                <Monitor size={12} /> 平台
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => togglePlatform('pc')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                    pc ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  💻 PC
                </button>
                <button
                  type="button"
                  onClick={() => togglePlatform('pe')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                    pe ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  📱 手机
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">标签</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setJumpscare(!jumpscare)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                    jumpscare ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  👻 微恐
                </button>
                <button
                  type="button"
                  onClick={() => setSound(!sound)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                    sound ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  🔊 有声音
                </button>
              </div>
            </div>
          </div>

          {/* 提交 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {loading ? '提交中...' : '提交审核'}
          </button>
        </form>
      </div>
    </div>
  );
};
