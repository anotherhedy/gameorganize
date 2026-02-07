import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { GameCard } from './components/GameCard';
import { GAMES } from './games';
import { Search } from 'lucide-react';

const App: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

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

  return (
    <div className="min-h-screen bg-archive-dark selection:bg-purple-500/30 selection:text-white pb-20">
      
      {/* Top Navigation / Branding */}
      <nav className="border-b border-white/5 bg-archive-dark/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded flex items-center justify-center font-bold text-white">
              S
            </div>
            <span className="font-bold text-gray-200 tracking-wider text-sm hidden sm:block">S.E.A. DATABASE</span>
          </div>
          
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
             <input 
                type="text" 
                placeholder="检索档案 (名称/作者)..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all w-48 sm:w-64"
             />
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <Header />

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-6">
        
        {/* Results Counter */}
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>已检索到 {filteredGames.length} 份特殊档案</span>
        </div>

        {/* Grid Layout - 2 Columns on medium+ screens to ensure "one row two cards" */}
        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredGames.map(game => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-xl">
            <p className="text-gray-500 text-lg">未找到匹配的档案记录...</p>
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
      <footer className="mt-24 border-t border-white/5 py-12 text-center text-gray-600 text-sm">
        <p>&copy; {new Date().getFullYear()} 特殊事件研究组 | 仅供内部流传</p>
        <p className="mt-2">所有案件档案归其原作者所有</p>
      </footer>
    </div>
  );
};

export default App;