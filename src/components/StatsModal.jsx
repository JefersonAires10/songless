import React from 'react';
import { X, BarChart3, RotateCcw } from 'lucide-react';

export function StatsModal({
  isOpen,
  onClose,
  stats,
  winRate,
  onResetStats,
}) {
  if (!isOpen) return null;

  const distribution = stats.guessDistribution || {};
  const maxGuessCount = Math.max(1, ...Object.values(distribution));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-spotify-card border border-[#3e3e3e] rounded-2xl p-6 shadow-2xl flex flex-col text-white animate-in zoom-in-95 duration-200">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#333] text-spotify-subdued hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Título */}
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-spotify-green" />
          <h2 className="text-xl font-bold tracking-tight">Estatísticas</h2>
        </div>

        {/* Cards de Métricas Principais */}
        <div className="grid grid-cols-4 gap-2 text-center mb-6">
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-3">
            <span className="block text-2xl font-black text-white">{stats.played}</span>
            <span className="text-[10px] uppercase font-bold text-spotify-subdued">Jogos</span>
          </div>

          <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-3">
            <span className="block text-2xl font-black text-spotify-green">{winRate}%</span>
            <span className="text-[10px] uppercase font-bold text-spotify-subdued">Vitórias</span>
          </div>

          <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-3">
            <span className="block text-2xl font-black text-white">{stats.streak}</span>
            <span className="text-[10px] uppercase font-bold text-spotify-subdued">Sequência</span>
          </div>

          <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-3">
            <span className="block text-2xl font-black text-amber-400">{stats.maxStreak}</span>
            <span className="text-[10px] uppercase font-bold text-spotify-subdued">Melhor</span>
          </div>
        </div>

        {/* Distribuição de Tentativas */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-spotify-subdued mb-3">
            Distribuição de Acertos
          </h3>

          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5, 6].map(num => {
              const count = distribution[num] || 0;
              const percent = stats.wins > 0 ? (count / maxGuessCount) * 100 : 0;

              return (
                <div key={num} className="flex items-center gap-2 text-xs">
                  <span className="w-3 font-mono font-bold text-spotify-subdued">{num}</span>
                  <div className="flex-1 h-6 bg-[#181818] rounded overflow-hidden flex items-center">
                    <div
                      className={`h-full flex items-center justify-end px-2 transition-all duration-500 rounded ${
                        count > 0 ? 'bg-spotify-green text-black font-bold' : 'bg-transparent text-neutral-600'
                      }`}
                      style={{ width: count > 0 ? `${Math.max(12, percent)}%` : '0%' }}
                    >
                      {count > 0 && <span className="text-[11px] font-mono">{count}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rodapé / Ações */}
        <div className="flex items-center justify-between pt-4 border-t border-[#333]">
          <button
            onClick={() => {
              if (window.confirm('Deseja realmente zerar todas as suas estatísticas?')) {
                onResetStats();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-spotify-red transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Zerar Estatísticas</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-spotify-green hover:bg-spotify-green-hover text-black font-bold text-xs uppercase tracking-wider transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
