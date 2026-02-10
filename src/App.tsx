import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { GameCard } from './components/game/GameCard';
import { GAMES } from './data/games';
import { Search, Flame, Sparkles, Dices, X } from 'lucide-react';
import { fetchGameStats, incrementGameViews } from './services/supabase/api';
import { GameData } from './types';
import { RingLoader, PuffLoader } from 'react-spinners';

const App: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [gameStats, setGameStats] = useState<Record<string, number>>({});
  const [randomGame, setRandomGame] = useState<GameData | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchGameStats().then((stats) => {
      setGameStats(stats);
      setIsLoading(false);
    });
  }, []);

  const handleRandomPick = () => {
    setIsPicking(true);
    // Add a small delay for "thinking" animation effect
    setTimeout(() => {
      const activeGames = GAMES.filter(g => g.status === '是');
      const randomIndex = Math.floor(Math.random() * activeGames.length);
      setRandomGame(activeGames[randomIndex]);
      setIsPicking(false);
    }, 600);
  };

  // Popular games: sort by views desc, take top 4
  const popularGames = useMemo(() => {
    return [...GAMES]
      .sort((a, b) => (gameStats[b.id] || 0) - (gameStats[a.id] || 0))
      .slice(0, 4);
  }, [gameStats]);

  // New games: sort by releaseDate desc, then id desc, take top 4
  const newGames = useMemo(() => {
    return [...GAMES]
      .sort((a, b) => {
        const dateDiff = new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
        if (dateDiff !== 0) return dateDiff;
        // If dates are the same, sort by ID in descending order (assuming larger ID is newer)
        return parseInt(b.id) - parseInt(a.id);
      })
      .slice(0, 4);
  }, []);

  // Filter games based on search term
  const filteredGames = useMemo(() => {
    return GAMES.filter(game => {
      const lowerTerm = searchTerm.toLowerCase();
      return (
        game.title.toLowerCase().includes(lowerTerm) ||
        game.author.text.toLowerCase().includes(lowerTerm) ||
        game.description.toLowerCase().includes(lowerTerm)
      );
    });
  }, [searchTerm]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-archive-dark flex flex-col items-center justify-center gap-6 relative overflow-hidden">
        {/* 背景氛围光晕 - 增加视觉深度 */}
        <div className="absolute w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full -z-10 animate-pulse" />
        
        {/* Loader 容器：利用 drop-shadow 让线条发光 */}
        <div className="relative filter drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]">
          <RingLoader 
            color="#c084fc" // 稍微调亮一点颜色
            loading={isLoading} 
            size={120} 
            speedMultiplier={1} 
          />
        </div>

        <p className="text-purple-400/90 text-sm tracking-[0.3em] animate-pulse drop-shadow-[0_0_8px_rgba(168,85,247,0.8)] font-light">
          正在接入档案库...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-archive-dark selection:bg-purple-500/30 selection:text-white pb-20">
      
      {/* Picking Loader Overlay */}
      {isPicking && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
          {/* 核心发光圈 */}
          <div className="relative">
            {/* 这是一个背后的光晕层，跟随 PuffLoader 扩散 */}
            <div className="absolute inset-0 bg-purple-500/20 blur-[60px] rounded-full animate-pulse" />
            
            <PuffLoader 
              color="#a855f7" 
              loading={isPicking} 
              size={140} 
              speedMultiplier={1.2}
              // 直接在 cssOverride 里注入滤镜
              cssOverride={{
                filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.7))'
              }}
            />
          </div>

          <p className="mt-8 text-purple-300 font-bold tracking-[0.2em] animate-pulse text-xl drop-shadow-[0_0_12px_rgba(168,85,247,1)]">
            正在随机检索档案...
          </p>
          
          {/* 装饰线条：增加科技感 */}
          <div className="absolute bottom-10 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        </div>
      )}

      {/* Top Navigation / Branding */}
      <nav className="border-b border-white/5 bg-archive-dark/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-auto py-3 sm:h-16 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">
                S
              </div>
              <span className="font-bold text-gray-200 tracking-wider text-sm hidden sm:block">S.E.A. DATABASE</span>
              <span className="font-bold text-gray-200 tracking-wider text-xs block sm:hidden">S.E.A. DB</span>
            </div>

            <div className="sm:hidden">
              <button
                onClick={handleRandomPick}
                disabled={isPicking}
                className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                <Dices size={14} className={isPicking ? 'animate-spin' : ''} />
                <span>{isPicking ? '抽取中' : '随机'}</span>
              </button>
            </div>
          </div>
          
          <div className="relative w-full sm:w-auto">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
             <input 
                type="text" 
                placeholder="检索档案 (名称/作者)..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all w-full sm:w-64"
             />
          </div>

          <div className="hidden sm:block relative group">
            {/* Guide Tooltip */}
            <div className="absolute -bottom-10 right-0 whitespace-nowrap bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              不知道玩哪个？试试随机按钮
              <div className="absolute -top-1 right-8 w-2 h-2 bg-purple-600 rotate-45" />
            </div>
            
            <button
              onClick={handleRandomPick}
              disabled={isPicking}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-50"
            >
              <Dices size={18} className={isPicking ? 'animate-spin' : ''} />
              <span>{isPicking ? '正在抽取...' : '随机抽取'}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <Header />

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-6">
        
        {!searchTerm && (
          <>
            {/* Popular Games Section */}
            <section className="mb-10 sm:mb-12">
              <div className="flex items-center gap-2 mb-4 sm:mb-6 border-b border-white/10 pb-2">
                <Flame className="text-orange-500" size={20} />
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">热门档案</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {popularGames.map(game => (
                  <GameCard 
                    key={game.id} 
                    game={game} 
                    onPlay={() => incrementGameViews(game.id)} 
                  />
                ))}
              </div>
            </section>

            {/* New Games Section */}
            <section className="mb-10 sm:mb-12">
              <div className="flex items-center gap-2 mb-4 sm:mb-6 border-b border-white/10 pb-2">
                <Sparkles className="text-yellow-400" size={20} />
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">最新收录</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {newGames.map(game => (
                  <GameCard 
                    key={game.id} 
                    game={game} 
                    showNewTag={true}
                    onPlay={() => incrementGameViews(game.id)} 
                  />
                ))}
              </div>
            </section>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-8 sm:mb-10" />
            <h2 className="text-lg sm:text-xl font-bold text-gray-400 mb-6 pl-2 border-l-4 border-purple-500">全部档案库</h2>
          </>
        )}

        {/* Results Counter */}
        <div className="mb-6 flex items-center gap-2 text-xs sm:text-sm text-gray-500">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>已检索到 {filteredGames.length} 份特殊档案</span>
        </div>

        {/* Grid Layout - 2 Columns on medium+ screens to ensure "one row two cards" */}
        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {filteredGames.map(game => (
              <GameCard 
                key={game.id} 
                game={game} 
                onPlay={() => incrementGameViews(game.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 sm:py-20 border border-dashed border-white/10 rounded-xl px-4">
            <p className="text-gray-500 text-base sm:text-lg">未找到匹配的档案记录...</p>
            <button 
              onClick={() => setSearchTerm('')}
              className="mt-4 text-purple-400 hover:text-purple-300 text-sm underline"
            >
              清除检索条件
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 sm:mt-24 border-t border-white/5 py-10 sm:py-12 text-center text-gray-600 text-[10px] sm:text-sm px-4">
        <p>&copy; {new Date().getFullYear()} 特殊事件研究组 | 仅供内部流传</p>
        <p className="mt-2">所有档案归其原作者所有</p>
      </footer>

      {/* Random Pick Modal */}
      {randomGame && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl bg-black/60 animate-in fade-in duration-300">
          <div className="relative w-full max-w-lg bg-[#0f0f13] border border-white/20 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/20 animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setRandomGame(null)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 p-1.5 sm:p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/80 transition-all"
            >
              <X size={18} sm:size={20} />
            </button>

            <div className="p-0.5 sm:p-1">
              <GameCard 
                game={randomGame} 
                onPlay={() => {
                  incrementGameViews(randomGame.id);
                  setRandomGame(null);
                }} 
              />
            </div>

            <div className="p-4 sm:p-6 bg-gradient-to-b from-transparent to-black/80">
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="text-center">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-0.5 sm:mb-1">今日推荐研究档案</h3>
                  <p className="text-gray-400 text-[10px] sm:text-sm px-4">如果不满意，可以再次尝试随机抽取</p>
                </div>
                
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={handleRandomPick}
                    className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/20 text-white py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all border border-white/10"
                  >
                    <Dices size={16} sm:size={18} />
                    <span>重抽</span>
                  </button>
                  
                  <a
                    href={randomGame.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      incrementGameViews(randomGame.id);
                      setRandomGame(null);
                    }}
                    className="flex-[1.5] flex items-center justify-center gap-1.5 sm:gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all shadow-lg shadow-purple-500/20"
                  >
                    <span>立即启动</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
