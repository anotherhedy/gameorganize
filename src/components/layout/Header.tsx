import React from 'react';
import { Sparkles, Flame } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="py-12 md:py-20 px-4 text-center relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] h-[300px] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* New Feature Badge */}
        <div 
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] sm:text-xs text-purple-300 mb-6 sm:mb-8"
          style={{ animation: 'bounce 1s ease-in-out 3' }}
        >
          <Sparkles size={14} className="text-yellow-400" />
          <span>系统更新：热门推荐 & 最新收录已上线</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 mb-6 sm:mb-8 tracking-tight drop-shadow-sm leading-tight">
          特殊事件档案库
        </h1>
        
        <div className="space-y-4 text-gray-400 text-sm sm:text-base md:text-lg leading-relaxed max-w-3xl mx-auto px-2">
          <p>
            呀哈哈，欢迎各位特殊事件研究员光临本所，这里正在发生大量不寻常的事件，我们邀请你沉浸其中，与我们一同追踪、分析并还原真相。
          </p>
          <p className="hidden sm:block">
            本网页由「特殊事件研究组」的群友鼎力支持，提供各类不寻常事件的线索与追踪体验。网页内容将不定期更新暂未收录的游戏，更新频率取决于研究员们的摸鱼时长。
          </p>
          
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-xs sm:text-sm">
              <Flame size={16} className="text-orange-500" />
              <span className="text-gray-300">热门推荐：追踪高频异常事件</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-xs sm:text-sm">
              <Sparkles size={16} className="text-yellow-400" />
              <span className="text-gray-300">最新收录：第一时间锁定新案</span>
            </div>
          </div>

          <p className="pt-6 sm:pt-8 text-gray-500 text-xs sm:text-sm">
            若在调查过程中发现任何异常，欢迎在群内提交，或联系小红书 <a 
    href="https://www.xiaohongshu.com/user/profile/69295a990000000037005e7a?xsec_token=YBJHiSXTrc7AmLou2oCMjzjrFcyggA1PUXWEpV_DoyANc%3D&xsec_source=app_share&xhsshare=&shareRedId=ODczQThIOko2NzUyOTgwNjY0OTc8PkxN&apptime=1770648404&share_id=a0d1c48864c14a53bf4a93d0a411d7e7&share_channel=copy_link" 
    target="_blank" 
    rel="noopener noreferrer"
    className="text-pink-400 cursor-pointer hover:underline"
  >
    @摸鱼侦探社 🎰
  </a>。
          </p>
        </div>
      </div>
    </header>
  );
};
