import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Header } from './components/layout/Header';
import { GameCard } from './components/game/GameCard';
import { Search, Flame, Sparkles, Dices, X, ArrowUp, Loader2, Filter, Clock, ArrowUpDown, ChevronDown, Sliders, Database } from 'lucide-react';
import { fetchGameStats, incrementGameViews } from './services/supabase/api';
import { GameData } from './types';
import { RingLoader, PuffLoader } from 'react-spinners';
import { FloatingEntry } from './components/intel/FloatingEntry';
import { VirtuosoGrid } from 'react-virtuoso';
import * as OpenCC from 'opencc-js';

// Initialize converter for simplified/traditional conversion
const t2s = OpenCC.Converter({ from: 't', to: 'cn' });
const s2t = OpenCC.Converter({ from: 'cn', to: 't' });

const IntelligenceWall = React.lazy(() => 
  import('./components/intel/IntelligenceWall').then(module => ({ default: module.IntelligenceWall }))
);

type SortOption = 'releaseDate' | 'views';
type DurationFilter = 'all' | '<1h' | '1h-3h' | '>3h';
type TabOption = 'all' | 'popular' | 'new';

const App: React.FC = () => {
  const [games, setGames] = useState<GameData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [gameStats, setGameStats] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<SortOption>('releaseDate');
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [tagsFilter, setTagsFilter] = useState<{ sound: boolean | null, jumpscare: boolean | null }>({
    sound: null,
    jumpscare: null
  });
  const [randomGame, setRandomGame] = useState<GameData | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showIntelWall, setShowIntelWall] = useState(false);
  const [activeTab, setActiveTab] = useState<TabOption>('all');
  const resultsRef = useRef<HTMLDivElement>(null);
  const prevSearchTermRef = useRef('');

  // Use useCallback to prevent unnecessary re-renders of GameCard components
  const handleGamePlay = React.useCallback((id: string) => {
    incrementGameViews(id);
  }, []);

  // Scroll logic for searching (Debounced to avoid lag while typing/deleting)
  useEffect(() => {
    const isSearching = searchTerm.trim() !== '';
    const wasSearching = prevSearchTermRef.current.trim() !== '';

    if (isSearching) {
      if (resultsRef.current) {
        // Use requestAnimationFrame to avoid forced reflow in some browsers
        const timeoutId = setTimeout(() => {
          requestAnimationFrame(() => {
            resultsRef.current?.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
          });
        }, 800); // Increased delay for better typing performance on mobile
        return () => clearTimeout(timeoutId);
      }
    } else if (searchTerm === '' && wasSearching) {
      // Only scroll back to top if the search was explicitly cleared
      scrollToTop();
    }
    
    // Update the ref for next render
    prevSearchTermRef.current = searchTerm;
  }, [searchTerm]);

  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. First fetch critical game data to unblock FCP
        const response = await fetch('/data/games.json');
        const gamesData = await response.json();
        setGames(gamesData);
        setIsLoading(false); // Unblock rendering as soon as games are available

        // 2. Then fetch non-critical stats in background
        fetchGameStats().then(stats => {
          setGameStats(stats);
        }).catch(err => {
          console.error('Failed to fetch game stats:', err);
        });
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsLoading(false);
      }
    };

    initApp();

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top with passive listener support and optimization
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRandomPick = () => {
    setIsPicking(true);
    // Add a small delay for "thinking" animation effect
    setTimeout(() => {
      const activeGames = games.filter(g => g.status === '是');
      const randomIndex = Math.floor(Math.random() * activeGames.length);
      setRandomGame(activeGames[randomIndex]);
      setIsPicking(false);
    }, 600);
  };

  // Popular games: sort by views desc, take top 4
  const popularGames = useMemo(() => {
    return [...games]
      .sort((a, b) => {
        const viewsA = gameStats[a.id] || 0;
        const viewsB = gameStats[b.id] || 0;
        return viewsB - viewsA;
      })
      .slice(0, 4);
  }, [gameStats, games]);

  // New games: sort by releaseDate desc, then id desc, take top 4
  const newGames = useMemo(() => {
    return [...games]
      .sort((a, b) => {
        const dateDiff = new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
        if (dateDiff !== 0) return dateDiff;
        // If dates are the same, sort by ID in descending order (assuming larger ID is newer)
        return parseInt(b.id) - parseInt(a.id);
      })
      .slice(0, 4);
  }, [games]);

  // Performance optimized filter logic
  const searchableGames = useMemo(() => {
    return games.map(game => ({
      ...game,
      _searchStrings: {
        titleS: t2s(game.title.toLowerCase()),
        titleT: s2t(game.title.toLowerCase()),
        authorS: t2s((game.author?.text || '').toLowerCase()),
        authorT: s2t((game.author?.text || '').toLowerCase()),
        titleOrig: game.title.toLowerCase(),
        authorOrig: (game.author?.text || '').toLowerCase()
      }
    }));
  }, [games]);

  // Helper to parse duration string to minutes
  const parseDurationMinutes = (durationStr: string): number => {
    if (!durationStr) return 0;
    
    // Normalize to handle "h", "小时", "min", "分钟"
    const str = durationStr.toLowerCase().replace(/\s+/g, '');
    
    // Extract numbers (could be ranges like "0.5-1")
    const matches = str.match(/(\d+(\.\d+)?)/g);
    if (!matches) return 0;
    
    // Take the average if it's a range, otherwise take the first number
    const nums = matches.map(Number);
    const val = nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
    
    // Determine unit
    if (str.includes('h') || str.includes('小时')) {
      return val * 60;
    }
    return val; // Default to minutes
  };

  // Filter games based on search term, tags, duration and sorting
  const filteredGames = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const simplifiedTerm = t2s(term);
    const traditionalTerm = s2t(term);

    let result = searchableGames.filter(game => {
      // 1. Text Search (Title/Author)
      const { titleS, titleT, authorS, authorT, titleOrig, authorOrig } = game._searchStrings;
      const textMatch = !term || 
        titleOrig.includes(term) || titleS.includes(simplifiedTerm) || titleT.includes(traditionalTerm) ||
        authorOrig.includes(term) || authorS.includes(simplifiedTerm) || authorT.includes(traditionalTerm);
      
      if (!textMatch) return false;

      // 2. Tag Filters
      if (tagsFilter.sound !== null && game.tags?.hasSound !== tagsFilter.sound) return false;
      if (tagsFilter.jumpscare !== null && game.tags?.hasJumpScare !== tagsFilter.jumpscare) return false;

      // 3. Duration Filter
      if (durationFilter !== 'all') {
        const mins = parseDurationMinutes(game.duration);
        if (durationFilter === '<1h' && mins >= 60) return false;
        if (durationFilter === '1h-3h' && (mins < 60 || mins > 180)) return false;
        if (durationFilter === '>3h' && mins <= 180) return false;
      }

      return true;
    });

    // 4. Sorting
    return result.sort((a, b) => {
      if (sortBy === 'releaseDate') {
        const dateA = new Date(a.releaseDate).getTime();
        const dateB = new Date(b.releaseDate).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return parseInt(b.id) - parseInt(a.id);
      } else {
        const viewsA = gameStats[a.id] || 0;
        const viewsB = gameStats[b.id] || 0;
        if (viewsB !== viewsA) return viewsB - viewsA;
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      }
    });
  }, [searchTerm, searchableGames, tagsFilter, durationFilter, sortBy, gameStats]);

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

  if (showIntelWall) {
    return (
      <React.Suspense fallback={
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-yellow-500" />
        </div>
      }>
        <IntelligenceWall onBack={() => setShowIntelWall(false)} />
      </React.Suspense>
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
                placeholder="检索 (名称/作者)..." 
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

      {/* Main Content Tabs */}
      {!searchTerm && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 mb-8 relative z-10">
          <div className="flex items-center justify-between border-b border-white/5 pb-0.5">
            <div className="flex gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: '全部档案库', icon: <Database size={18} /> },
                { id: 'popular', label: '热门排行', icon: <Flame size={18} /> },
                { id: 'new', label: '最新收录', icon: <Sparkles size={18} /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabOption)}
                  className={`flex items-center gap-2 pb-3 px-1 transition-all relative whitespace-nowrap ${
                    activeTab === tab.id 
                    ? 'text-purple-400 font-bold' 
                    : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.icon}
                  <span className="text-sm sm:text-base tracking-wide">{tab.label}</span>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                  )}
                </button>
              ))}
            </div>

            {/* Total Count Badge (Only on desktop) */}
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                Database: {games.length} Entries
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-6">
        
        {!searchTerm && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Popular Games View */}
            {activeTab === 'popular' && (
              <section className="mb-10 sm:mb-12">
                <div className="flex items-center gap-2 mb-4 sm:mb-6 border-b border-white/10 pb-2">
                  <Flame className="text-orange-500" size={20} />
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">本周最热</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {popularGames.map((game, index) => (
                    <GameCard 
                      key={game.id} 
                      game={game} 
                      views={gameStats[game.id] || 0}
                      onPlay={handleGamePlay} 
                      priority={index < 2}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* New Games View */}
            {activeTab === 'new' && (
              <section className="mb-10 sm:mb-12">
                <div className="flex items-center gap-2 mb-4 sm:mb-6 border-b border-white/10 pb-2">
                  <Sparkles className="text-yellow-400" size={20} />
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">近期新增</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {newGames.map((game, index) => (
                    <GameCard 
                      key={game.id} 
                      game={game} 
                      showNewTag={true}
                      views={gameStats[game.id] || 0}
                      onPlay={handleGamePlay} 
                      priority={index < 2}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All Games View (Full Database with Filters) */}
            {activeTab === 'all' && (
              <>
                <div className="flex flex-col gap-4 mb-6">
                  <div className="flex items-center justify-between relative min-h-[44px]">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-400 pl-2 border-l-4 border-purple-500 shrink-0 uppercase tracking-wider">档案记录</h2>
                    
                    <div className="flex items-center gap-3">
                      {/* Expandable Filter & Sort Bar - Desktop */}
                      <div 
                        className={`hidden lg:flex items-center transition-all duration-500 ease-in-out origin-right overflow-hidden ${
                          isFilterOpen 
                          ? 'max-w-[1000px] opacity-100 translate-x-0' 
                          : 'max-w-0 opacity-0 translate-x-10 pointer-events-none'
                        }`}
                      >
                        <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {/* Duration Filter */}
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-xs font-medium flex items-center gap-1">
                                <Clock size={14} /> 时长:
                              </span>
                              <div className="flex bg-black/20 rounded-lg p-1">
                                {[
                                  { label: '全部', value: 'all' },
                                  { label: '<1h', value: '<1h' },
                                  { label: '1-3h', value: '1h-3h' },
                                  { label: '>3h', value: '>3h' }
                                ].map((item) => (
                                  <button
                                    key={item.value}
                                    onClick={() => setDurationFilter(item.value as DurationFilter)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                      durationFilter === item.value 
                                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' 
                                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Tag Filters */}
                            <div className="h-4 w-px bg-white/10 mx-1" />
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 text-xs font-medium flex items-center gap-1">
                                <Filter size={14} /> 标签:
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setTagsFilter(prev => ({ ...prev, sound: prev.sound === true ? null : true }))}
                                  className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                    tagsFilter.sound === true
                                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                                    : 'bg-black/20 border-white/10 text-gray-400 hover:border-white/20'
                                  }`}
                                >
                                  有声音
                                </button>
                                <button
                                  onClick={() => setTagsFilter(prev => ({ ...prev, jumpscare: prev.jumpscare === true ? null : true }))}
                                  className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                    tagsFilter.jumpscare === true
                                    ? 'bg-red-500/10 border-red-500/50 text-red-400'
                                    : 'bg-black/20 border-white/10 text-gray-400 hover:border-white/20'
                                  }`}
                                >
                                  微恐
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 border-l border-white/10 pl-4">
                            <span className="text-gray-500 text-xs font-medium flex items-center gap-1">
                              <ArrowUpDown size={14} /> 排序:
                            </span>
                            <div className="flex bg-black/20 rounded-lg p-1">
                              {[
                                { label: '最新发布', value: 'releaseDate' },
                                { label: '浏览量', value: 'views' }
                              ].map((item) => (
                                <button
                                  key={item.value}
                                  onClick={() => setSortBy(item.value as SortOption)}
                                  className={`px-4 py-1 rounded-md text-[11px] font-bold transition-all ${
                                    sortBy === item.value 
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' 
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Toggle Button */}
                      <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 border shadow-lg ${
                          isFilterOpen 
                          ? 'bg-purple-600 border-purple-500 text-white shadow-purple-500/40 scale-105' 
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:scale-105'
                        }`}
                      >
                        <Sliders size={18} />
                        <span className="font-bold text-sm tracking-wide">筛选器</span>
                        <ChevronDown size={16} className={`transition-transform duration-500 ${isFilterOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Mobile Filter Bar - Original Style */}
                  <div 
                    className={`lg:hidden overflow-hidden transition-all duration-500 ease-in-out ${
                      isFilterOpen 
                      ? 'max-h-[500px] opacity-100 mt-2' 
                      : 'max-h-0 opacity-0 mt-0 pointer-events-none'
                    }`}
                  >
                    <div className="flex flex-col gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs font-medium flex items-center gap-1">
                            <Clock size={14} /> 时长:
                          </span>
                          <div className="flex bg-black/20 rounded-lg p-1">
                            {['all', '<1h', '1h-3h', '>3h'].map((v) => (
                              <button
                                key={v}
                                onClick={() => setDurationFilter(v as DurationFilter)}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  durationFilter === v ? 'bg-purple-600 text-white' : 'text-gray-400'
                                }`}
                              >
                                {v === 'all' ? '全部' : v}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs font-medium flex items-center gap-1">
                            <Filter size={14} /> 标签:
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setTagsFilter(prev => ({ ...prev, sound: prev.sound === true ? null : true }))}
                              className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                tagsFilter.sound === true ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' : 'bg-black/20 border-white/10 text-gray-400'
                              }`}
                            >
                              有声音
                            </button>
                            <button
                              onClick={() => setTagsFilter(prev => ({ ...prev, jumpscare: prev.jumpscare === true ? null : true }))}
                              className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                tagsFilter.jumpscare === true ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-black/20 border-white/10 text-gray-400'
                              }`}
                            >
                              微恐
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full border-t border-white/5 pt-4">
                        <span className="text-gray-500 text-xs font-medium flex items-center gap-1">
                          <ArrowUpDown size={14} /> 排序:
                        </span>
                        <div className="flex bg-black/20 rounded-lg p-1 w-full">
                          {[
                            { label: '最新发布', value: 'releaseDate' },
                            { label: '浏览量', value: 'views' }
                          ].map((item) => (
                            <button
                              key={item.value}
                              onClick={() => setSortBy(item.value as SortOption)}
                              className={`flex-1 px-4 py-1 rounded-md text-[11px] font-bold transition-all ${
                                sortBy === item.value ? 'bg-purple-600 text-white' : 'text-gray-400'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Results Counter - Only show when searching or in Archive Tab */}
        {(searchTerm || activeTab === 'all') && (
          <div 
            ref={resultsRef}
            className="mb-6 flex items-center gap-2 text-xs sm:text-sm text-gray-500 scroll-mt-20 animate-in fade-in duration-700"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>已检索到 {filteredGames.length} 份特殊档案</span>
          </div>
        )}

      {/* Grid Layout - Virtualized for performance */}
      {filteredGames.length > 0 ? (
        (searchTerm || activeTab === 'all') && (
          <VirtuosoGrid
            useWindowScroll
            data={filteredGames}
            overscan={400} // Pre-render more items for smoother scrolling
            listClassName="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"
            itemClassName="w-full"
            itemContent={(index, game) => {
              return (
                <div className="p-2 sm:p-3">
                  <GameCard 
                    game={game} 
                    showNewTag={false}
                    views={gameStats[game.id] || 0}
                    onPlay={handleGamePlay}
                    priority={index < 4}
                  />
                </div>
              );
            }}
          />
        )
        ) : (
          (searchTerm || activeTab === 'all') && (
            <div className="text-center py-16 sm:py-20 border border-dashed border-white/10 rounded-xl px-4">
              <p className="text-gray-500 text-base sm:text-lg">未找到匹配的档案记录...</p>
              <button 
                onClick={() => setSearchTerm('')}
                className="mt-4 text-purple-400 hover:text-purple-300 text-sm underline"
              >
                清除检索条件
              </button>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 sm:mt-24 border-t border-white/5 py-10 sm:py-12 text-center text-gray-600 text-[10px] sm:text-sm px-4">
        <p>&copy; {new Date().getFullYear()} 特殊事件研究组 | 仅供内部流传</p>
        <p className="mt-2">所有档案归其原作者所有</p>
      </footer>

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 p-3 bg-purple-600 text-white rounded-full shadow-lg transition-all duration-300 z-40 hover:bg-purple-500 hover:shadow-purple-500/30 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
        aria-label="Back to top"
      >
        <ArrowUp size={20} />
      </button>

      {/* Floating Entry for Intelligence Wall */}
      <FloatingEntry onClick={() => setShowIntelWall(true)} />

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
                views={gameStats[randomGame.id] || 0}
                onPlay={(id) => {
                  handleGamePlay(id);
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
