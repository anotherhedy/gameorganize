import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="py-20 px-4 text-center relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 mb-8 tracking-tight drop-shadow-sm">
          特殊事件档案库
        </h1>
        
        <div className="space-y-4 text-gray-400 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
          <p>
            呀哈哈，欢迎各位特殊事件研究员光临本所，这里正在发生大量不寻常的事件，我们邀请你沉浸其中，与我们一同追踪、分析并还原真相。
          </p>
          <p>
            本网页由「特殊事件研究组」的群友鼎力支持，提供各类不寻常事件的线索与追踪体验。网页内容将不定期更新暂未收录的游戏，更新频率取决于研究员们的摸鱼时长。
          </p>
          <p className="pt-4 text-gray-500 text-sm">
            若在调查过程中发现任何异常，欢迎在群内提交，或联系系小红书 <span className="text-pink-400 cursor-pointer hover:underline">@摸鱼侦探社 🎰</span>。
          </p>
        </div>
      </div>
    </header>
  );
};