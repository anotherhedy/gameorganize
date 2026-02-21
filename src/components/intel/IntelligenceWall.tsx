import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase/supabaseClient';
import { Feedback } from '../../types';
import { IntelCard } from './IntelCard';
import { IntelModal } from './IntelModal';
import { Loader2, Plus, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const PAGE_SIZE = 6;

interface IntelligenceWallProps {
  onBack: () => void;
}

export const IntelligenceWall: React.FC<IntelligenceWallProps> = ({ onBack }) => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchFeedbacks = useCallback(async (pageNumber: number) => {
    setLoading(true);
    try {
      const from = (pageNumber - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, count, error } = await supabase
        .from('feedback')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setFeedbacks(data as Feedback[] || []);
      if (count !== null) setTotal(count);
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedbacks(page);
  }, [page, fetchFeedbacks]);

  const handlePostIntel = async (data: { detective_name: string; intel_content: string }) => {
    try {
      const { error } = await supabase.from('feedback').insert([
        {
          detective_name: data.detective_name,
          intel_content: data.intel_content,
        },
      ]);

      if (error) throw error;

      // Refresh current page or go to page 1
      if (page === 1) {
        await fetchFeedbacks(1);
      } else {
        setPage(1); // Go to first page to see new post
      }
    } catch (error) {
      console.error('Error posting feedback:', error);
      alert('发送失败，请稍后重试');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4 md:p-8 relative overflow-hidden font-sans flex flex-col">
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
      
      {/* Header */}
      <header className="relative z-10 flex flex-col md:flex-row justify-between items-center mb-4 md:mb-8 gap-4 border-b border-white/10 pb-4 md:pb-6 shrink-0">
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors group flex items-center gap-2"
            title="返回大厅"
          >
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-400 group-hover:text-white" />
            <span className="text-gray-400 group-hover:text-white text-xs md:text-sm hidden md:inline">返回大厅</span>
          </button>
          <div>
            <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              情报墙
            </h1>
            <p className="text-gray-400 text-[10px] md:text-sm mt-1 tracking-wider">
              Moyu Detective Agency Intelligence Board
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:shadow-yellow-500/20 transition-all transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          提供情报
        </button>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto w-full flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="w-12 h-12 animate-spin text-yellow-500" />
          </div>
        ) : (
          <>
            {feedbacks.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center text-gray-500 py-20">
                <RefreshCw className="w-16 h-16 mb-4 text-gray-700" />
                <p className="text-xl font-light">暂无情报...</p>
                <p className="text-sm mt-2 text-gray-600">快来做第一个提供线索的侦探吧！</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 p-4">
                {feedbacks.map((feedback, index) => (
                  <div key={feedback.id} className="transform hover:z-20 transition-all duration-300">
                     <IntelCard feedback={feedback} index={index} />
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8 mb-8 shrink-0">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                
                <div className="flex gap-2 flex-wrap justify-center">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm transition-all
                        ${page === p 
                          ? 'bg-yellow-500 text-black font-bold scale-110 shadow-lg shadow-yellow-500/30' 
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}
                      `}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Submission Modal */}
      <IntelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handlePostIntel}
      />
    </div>
  );
};
