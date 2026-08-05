import React, { useState } from 'react';
import { GameData } from '../../types';
import { Icons } from './Icon';
import { CheckCircle2, Circle, Edit3 } from 'lucide-react';

interface GameCardProps {
  game: GameData;
  onPlay?: (id: string) => void;
  onEdit?: (game: GameData) => void;
  onToggleSolved?: (id: string, isSolved: boolean) => Promise<void>;
  showNewTag?: boolean;
  views?: number;
  priority?: boolean;
  isSolved?: boolean;
  userId?: string;
  isAdmin?: boolean;
}

const failedImageSrc = new Set<string>();

export const GameCard: React.FC<GameCardProps> = React.memo(({
  game,
  onPlay,
  onEdit,
  onToggleSolved,
  showNewTag,
  views = 0,
  priority = false,
  isSolved: initialSolved = false,
  userId,
  isAdmin,
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isSolved, setIsSolved] = useState(initialSolved);
  const [isUpdating, setIsUpdating] = useState(false);
  const imageFailedRef = React.useRef(false);

  // 同步外部状态（当 App.tsx 加载完数据库数据后）
  React.useEffect(() => {
    setIsSolved(initialSolved);
  }, [initialSolved]);

  // 链接状态：仅当明确标记为 broken 时视为失效
  const isActive = game.linkStatus !== 'broken';

  // 处理“已破案”切换逻辑
  const handleToggleSolved = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发卡片点击跳转
    if (!userId || isUpdating || !onToggleSolved) return;

    setIsUpdating(true);
    try {
      await onToggleSolved(game.id, !isSolved);
      setIsSolved(!isSolved);
    } catch (err) {
      console.error('更新进度失败:', err);
    } finally {
      setIsUpdating(false);
    }
  };
    // Resolve image source: if path is relative like "images/...", prefix with /data/
    // Optimization: Check for .webp version if available or use as-is
    const imgSrc = game.coverImage
        ? (game.coverImage.startsWith('http') || game.coverImage.startsWith('/')
                ? game.coverImage
                : `/data/${game.coverImage}`)
        : undefined;
    const hasImageFailed = imgSrc ? failedImageSrc.has(imgSrc) : false;
  
  // Format platform text
  const platforms = [];
  if (game.platform.pc) platforms.push('PC');
  if (game.platform.pe) platforms.push('Mobile');
  const platformText = platforms.join(', ');

  return (
    <div className="group relative w-full h-full min-h-[380px] sm:min-h-[340px] rounded-xl overflow-hidden bg-[#0f0f13] border border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl flex flex-col">
      
            {/* New Tag Overlay */}
            {showNewTag && (
                <div className="absolute top-0 left-0 z-20 overflow-hidden w-16 h-16 pointer-events-none">
                    <div className="absolute top-[10px] left-[-25px] w-[80px] py-0.5 bg-red-600 text-white text-[10px] font-bold text-center -rotate-45 shadow-lg uppercase tracking-wider">
                        NEW
                    </div>
                </div>
            )}

            {/* Solve Status Icon */}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-30 flex gap-2">
              {userId && (
                <button
                  onClick={handleToggleSolved}
                  disabled={isUpdating}
                  className={`p-1.5 sm:p-2 rounded-full backdrop-blur-md transition-all duration-300 ${
                    isSolved 
                      ? 'bg-green-500/80 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' 
                      : 'bg-black/40 text-white/40 hover:bg-black/60 hover:text-white border border-white/10'
                  }`}
                  title={isSolved ? "已破案" : "标记为已玩"}
                >
                  {isSolved ? <CheckCircle2 size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Circle size={16} className="sm:w-[18px] sm:h-[18px]" />}
                </button>
              )}

              {isAdmin && onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(game);
                  }}
                  className="p-1.5 sm:p-2 rounded-full bg-purple-600/80 text-white backdrop-blur-md hover:bg-purple-500 transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                  title="编辑档案"
                >
                  <Edit3 size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              )}
            </div>

            {/* Background Image with Gradient Overlay */}
            <div className="absolute inset-0 z-0 bg-[#1a1a24]">
                {imgSrc && !hasImageFailed ? (
                    <img
                        src={imgSrc}
                        alt={game.title}
                        loading={priority ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={priority ? "high" : "auto"}
                        width="400"
                        height="260"
                        className={`w-full h-full object-cover opacity-50 sm:opacity-60 transition-all duration-700 ease-out group-hover:scale-105 ${isLoaded ? 'blur-0' : 'blur-lg scale-110'}`}
                        onLoad={() => setIsLoaded(true)}
                        onError={(e) => {
                            if (imageFailedRef.current) return;
                            imageFailedRef.current = true;
                            const src = (e.target as HTMLImageElement).src;
                            failedImageSrc.add(src);
                            (e.target as HTMLImageElement).src = `https://placehold.co/600x400/1e1e2e/FFF?text=${encodeURIComponent(game.title)}`;
                            setIsLoaded(true);
                        }}
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900 flex items-center justify-center p-4">
                        <div className="text-white text-lg sm:text-xl font-bold opacity-90 text-center leading-snug">
                            {game.title}
                        </div>
                    </div>
                )}
                {/* Gradient: Transparent top to solid dark bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a12] via-[#0a0a12]/90 to-[#0a0a12]/30" />
            </div>

      {/* Content Container */}
      <div className="relative z-10 p-4 sm:p-6 flex flex-col h-full min-h-[380px] sm:min-h-0">

        {/* Link Status Indicator — 失效链接右上角标记 */}
        {!isActive && (
          <div className="absolute top-10 right-3 sm:top-12 sm:right-4 z-30 flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/15 border border-red-500/30 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            <span className="text-[10px] text-red-400 font-medium">链接失效</span>
          </div>
        )}

        {/* Top Right Tags */}
        <div className="flex justify-end gap-1.5 sm:gap-2 mb-2">
            {game.tags.hasJumpScare ? (
                <span className="px-1.5 py-0.5 rounded bg-red-900/40 border border-red-500/20 text-[9px] sm:text-[10px] text-red-300 backdrop-blur-sm flex items-center gap-1">
                    <Icons.Ghost className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    微恐
                </span>
            ) : (
                <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[9px] sm:text-[10px] text-gray-400 backdrop-blur-sm">
                    无跳脸
                </span>
            )}
            
            {game.tags.hasSound ? (
                <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 border border-cyan-500/20 text-[9px] sm:text-[10px] text-cyan-300 backdrop-blur-sm flex items-center gap-1">
                    <Icons.Volume2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    有声音
                </span>
            ) : (
                <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[9px] sm:text-[10px] text-gray-400 backdrop-blur-sm">
                    无声音
                </span>
            )}

            <span className="px-1.5 py-0.5 rounded bg-purple-900/40 border border-purple-500/20 text-[9px] sm:text-[10px] text-purple-300 backdrop-blur-sm flex items-center gap-1">
                <Icons.Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                {views.toLocaleString()}
            </span>
        </div>

        {/* Title */}
        <h3 className="text-lg sm:text-2xl font-bold text-white tracking-wide mb-2 sm:mb-3 drop-shadow-sm leading-tight pr-4 line-clamp-1">
            {game.title}
        </h3>

        {/* Description */}
        <p className="text-gray-400 text-[11px] sm:text-sm leading-relaxed mb-4 sm:mb-6 opacity-90 h-[4.5em] overflow-y-auto custom-scrollbar pr-1">
            {game.description}
        </p>

        {/* Divider */}
        <div className="w-full h-px bg-white/10 mb-4 sm:mb-5" />

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-y-2.5 sm:gap-y-3 gap-x-2 sm:gap-x-4 text-[10px] sm:text-xs text-gray-400 mb-5 sm:mb-6">
            <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                <Icons.User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500 flex-shrink-0" />
                {game.author?.url ? (
                    <a href={game.author.url} target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition-colors truncate">
                        {game.author.text || '研究员'}
                    </a>
                ) : (
                    <span className="truncate">{game.author?.text || '研究员'}</span>
                )}
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                <Icons.Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500 flex-shrink-0" />
                <span>{game.releaseDate?.split(' ')[0] || '未知'}</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                <Icons.Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500 flex-shrink-0" />
                <span>{game.duration || '未知'}</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                <div className="flex gap-0.5 text-cyan-500 flex-shrink-0">
                    <Icons.Monitor className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {game.platform.pe && <Icons.Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </div>
                <span className="truncate">平台: {platformText || '未知'}</span>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-auto flex items-center justify-between gap-2">
            {isActive ? (
              <a
                href={game.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => { if (onPlay) onPlay(game.id); }}
                className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-lg font-bold transition-all group/link text-white hover:text-cyan-400 cursor-pointer"
              >
                <span>启动研究</span>
                <Icons.ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover/link:translate-x-1" />
              </a>
            ) : (
              <span className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-lg font-bold text-gray-600 cursor-not-allowed">
                <span>链接失效</span>
              </span>
            )}

            {game.answer && game.answer.url && (
                <a 
                    href={game.answer.url}
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[9px] sm:text-xs text-gray-500 hover:text-purple-400 transition-colors flex items-center gap-1 bg-white/5 px-2 py-1 rounded border border-white/5 hover:border-purple-500/30 whitespace-nowrap"
                >
                    <Icons.BookOpen className="w-3 h-3" />
                    <span>攻略</span>
                </a>
            )}
        </div>
      </div>
    </div>
  );
});
