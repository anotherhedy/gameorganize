import React from 'react';
import { GameData } from '../types';
import { Icons } from './Icon';

interface GameCardProps {
  game: GameData;
  onPlay?: () => void;
  showNewTag?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({ game, onPlay, showNewTag }) => {
  const isActive = game.status === '是';
    // Resolve image source: if path is relative like "images/...", prefix with /data/
    const imgSrc = game.coverImage
        ? (game.coverImage.startsWith('http') || game.coverImage.startsWith('/')
                ? game.coverImage
                : `/data/${game.coverImage}`)
        : undefined;
  
  // Format platform text
  const platforms = [];
  if (game.platform.pc) platforms.push('PC');
  if (game.platform.pe) platforms.push('Mobile');
  const platformText = platforms.join(', ');

  return (
    <div className="group relative w-full h-[340px] rounded-xl overflow-hidden bg-[#0f0f13] border border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl">
      
            {/* New Tag Overlay */}
            {showNewTag && (
                <div className="absolute top-0 left-0 z-20 overflow-hidden w-16 h-16 pointer-events-none">
                    <div className="absolute top-[10px] left-[-25px] w-[80px] py-0.5 bg-red-600 text-white text-[10px] font-bold text-center -rotate-45 shadow-lg uppercase tracking-wider">
                        NEW
                    </div>
                </div>
            )}

            {/* Background Image with Gradient Overlay */}
            <div className="absolute inset-0 z-0">
                {imgSrc ? (
                    <img
                        src={imgSrc}
                        alt={game.title}
                        className="w-full h-full object-cover opacity-60 transition-transform duration-700 ease-out group-hover:scale-105"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://placehold.co/600x400/1e1e2e/FFF?text=${encodeURIComponent(game.title)}`;
                        }}
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900 flex items-center justify-center p-4">
                        <div className="text-white text-xl font-bold opacity-90 text-center leading-snug">
                            {game.title}
                        </div>
                    </div>
                )}
                {/* Gradient: Transparent top to solid dark bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a12] via-[#0a0a12]/90 to-[#0a0a12]/30" />
            </div>

      {/* Content Container */}
      <div className="relative z-10 p-6 flex flex-col h-full">
        
        {/* Top Right Tags */}
        <div className="flex justify-end gap-2 mb-2">
            {!game.tags.hasJumpScare && (
                <span className="px-2 py-1 rounded bg-black/40 border border-white/10 text-[10px] text-gray-300 backdrop-blur-sm">
                    无跳脸
                </span>
            )}
            {!game.tags.hasSound && (
                <span className="px-2 py-1 rounded bg-black/40 border border-white/10 text-[10px] text-gray-300 backdrop-blur-sm">
                    无声音
                </span>
            )}
            {game.tags.hasJumpScare && (
                <span className="px-2 py-1 rounded bg-red-900/40 border border-red-500/20 text-[10px] text-red-300 backdrop-blur-sm">
                    微恐
                </span>
            )}
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-white tracking-wide mb-3 drop-shadow-sm truncate pr-4">
            {game.title}
        </h3>

        {/* Description */}
        <p className="text-gray-400 text-sm leading-relaxed line-clamp-3 mb-6 opacity-90 h-[4.5em]">
            {game.description}
        </p>

        {/* Divider */}
        <div className="w-full h-px bg-white/10 mb-5" />

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs text-gray-400 mb-6">
            <div className="flex items-center gap-2 truncate">
                <Icons.User className="w-4 h-4 text-cyan-500" />
                {game.author.url ? (
                    <a href={game.author.url} target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition-colors truncate">
                        {game.author.text}
                    </a>
                ) : (
                    <span className="truncate">{game.author.text}</span>
                )}
            </div>
            
            <div className="flex items-center gap-2 truncate">
                <Icons.Calendar className="w-4 h-4 text-cyan-500" />
                <span>{game.releaseDate.split(' ')[0]}</span>
            </div>

            <div className="flex items-center gap-2 truncate">
                <Icons.Clock className="w-4 h-4 text-cyan-500" />
                <span>{game.duration || '未知'}</span>
            </div>

            <div className="flex items-center gap-2 truncate">
                <div className="flex gap-0.5 text-cyan-500">
                    <Icons.Monitor className="w-4 h-4" />
                    {game.platform.pe && <Icons.Smartphone className="w-4 h-4 ml-1" />}
                </div>
                <span>平台: {platformText || '未知'}</span>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-auto flex items-center justify-between">
            <a 
                href={isActive ? game.url : '#'}
                target={isActive ? "_blank" : undefined}
                rel="noreferrer"
                onClick={() => {
                    if (isActive && onPlay) onPlay();
                }}
                className={`flex items-center gap-2 text-lg font-bold transition-all group/link ${
                    isActive 
                    ? 'text-white hover:text-cyan-400 cursor-pointer' 
                    : 'text-gray-600 cursor-not-allowed'
                }`}
            >
                <span>{isActive ? '启动研究' : '维护中'}</span>
                {isActive && <Icons.ArrowRight className="w-5 h-5 transition-transform group-hover/link:translate-x-1" />}
            </a>

            {game.answer && game.answer.url && (
                <a 
                    href={game.answer.url}
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs text-gray-500 hover:text-purple-400 transition-colors flex items-center gap-1 bg-white/5 px-2 py-1 rounded border border-white/5 hover:border-purple-500/30"
                >
                    <Icons.BookOpen className="w-3 h-3" />
                    <span>查看攻略</span>
                </a>
            )}
        </div>

      </div>
    </div>
  );
};