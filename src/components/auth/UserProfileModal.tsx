import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase/supabaseClient';
import { X, User, Smartphone, Save, Loader2, ShieldCheck, BadgeCheck, LogOut } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  profile?: any; // 新增：从 profiles 表读取的信息
  onProfileUpdate?: (profile: any) => void; // 新增：更新成功后的回调
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ 
  isOpen, 
  onClose, 
  user, 
  profile,
  onProfileUpdate 
}) => {
  const [username, setUsername] = useState('');
  const [xhsId, setXhsId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 优先级：profile 表 > user_metadata
  useEffect(() => {
    if (isOpen && user) {
      const initialUsername = profile?.username || user.user_metadata?.username || '';
      const initialXhsId = profile?.xhs_id || user.user_metadata?.xhs_id || '';
      setUsername(initialUsername);
      setXhsId(initialXhsId);
    }
  }, [isOpen, user, profile]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'USER_UPDATED' && loading && mounted) {
        console.log('Internal modal listener detected update, closing...');
        onClose();
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loading, onClose]);

  if (!isOpen || !user) return null;

  const isAdmin = profile?.role === 'admin';

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const finalUsername = username;
    const finalXhsId = xhsId;

    try {
      // 1. 更新 profiles 表
      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: finalUsername,
          xhs_id: finalXhsId,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // 2. 如果提供了回调，通知父组件更新状态
      if (onProfileUpdate && updatedProfile) {
        onProfileUpdate(updatedProfile);
      }

      alert('档案同步成功！');
      onClose();
    } catch (err: any) {
      console.error('更新档案失败:', err);
      setError(err.message || '更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-neutral-900 border-x border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-300">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-blue-900/20 sticky top-0 bg-neutral-900 z-10">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">研究员档案管理</h2>
            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-[0.2em]">Personal Research Profile</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Status Display */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isAdmin ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {isAdmin ? <ShieldCheck size={20} /> : <BadgeCheck size={20} />}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">研究员身份</p>
                <p className="text-sm text-white font-bold">{isAdmin ? '特殊研究员 (Admin)' : '正式研究员'}</p>
              </div>
            </div>
            {isAdmin && (
              <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] rounded-full font-bold animate-pulse">
                AUTHORIZED
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">研究员代号</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="修改你的代号"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">小红书 ID</label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={xhsId}
                  onChange={(e) => setXhsId(e.target.value)}
                  placeholder="修改小红书号"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">通讯邮箱</label>
              <input
                type="text"
                disabled
                value={user.email}
                className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-4 text-gray-500 cursor-not-allowed"
              />
              <p className="text-[10px] text-gray-600 italic">邮箱作为唯一身份凭证不可修改</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
            <span>更新研究员档案</span>
          </button>

          <div className="pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => {
                supabase.auth.signOut();
                onClose();
              }}
              className="w-full bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              <span>退出登录</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
