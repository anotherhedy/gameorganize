import React, { useState } from 'react';
import { supabase } from '../../services/supabase/supabaseClient';
import { X, Mail, Lock, Loader2, AlertCircle, User, Smartphone } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [xhsId, setXhsId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username, // 冗余存一份在 Auth，确保兼容性
            }
          }
        });
        if (signUpError) throw signUpError;
        
        // 注册成功后，立即在 profiles 表创建记录 (使用 upsert 防止冲突)
        if (signUpData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: signUpData.user.id,
              username: username,
              xhs_id: xhsId || null,
              role: 'user', // 明确设置初始角色
              updated_at: new Date().toISOString()
            });
          
          if (profileError) {
            console.error('手动创建 Profile 失败:', profileError.message);
            // 这里不抛出错误，因为账号其实已经创建成功了
          }
        }
        
        // 如果注册成功但没有自动登录（例如需要验证），手动尝试登录
        if (signUpData.user && !signUpData.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            console.log('注册成功，但自动登录失败:', signInError.message);
          }
        }
        
        alert('入职成功！欢迎加入特殊事件研究组。');
      }
      onClose();
    } catch (err: any) {
      setError(err.message || '认证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-neutral-900 border-x border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[95vh] overflow-y-auto no-scrollbar shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-300">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-blue-900/20 sticky top-0 bg-neutral-900 z-10">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {isLogin ? '研究员回归' : '新研究员入职'}
            </h2>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">
              S.E.A. Authorization System
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleAuth} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLogin && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">研究员代号 (必填)</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入你的专属代号"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">小红书 ID (选填)</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={xhsId}
                    onChange={(e) => setXhsId(e.target.value)}
                    placeholder="方便我们联系你"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">电子邮箱 (必填)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="researcher@sea.db"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">通讯密码 (必填)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              isLogin ? '同步档案并登录' : '提交入职申请'
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {isLogin ? '初次来到？提交入职申请' : '已有档案？点击同步登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
