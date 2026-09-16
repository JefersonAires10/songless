import React from 'react';
import { Play, Pause, Loader2, Volume2, RotateCcw } from 'lucide-react';

export function PlayerBar({
  isPlaying,
  currentTime,
  maxAllowedTime,
  isLoading,
  hasError,
  onTogglePlay,
  currentAttemptIndex,
  isGameOver = false,
}) {
  // Proporção de preenchimento da barra baseado no tempo máximo liberado
  const progressPercent = maxAllowedTime > 0 
    ? Math.min(100, (currentTime / maxAllowedTime) * 100) 
    : 0;

  // Segmentos visuais representativos dos checkpoints
  const segments = [
    { limit: 0.1, label: '0.1s', flex: 1 },
    { limit: 0.5, label: '0.5s', flex: 1.5 },
    { limit: 1.0, label: '1.0s', flex: 2 },
    { limit: 2.0, label: '2.0s', flex: 2.5 },
    { limit: 4.0, label: '4.0s', flex: 3 },
    { limit: 8.0, label: '8.0s', flex: 3.5 },
  ];

  // Mostra erro apenas se não estiver carregando e de fato houver falha confirmada
  const shouldShowError = hasError && !isLoading;

  return (
    <div className="w-full max-w-xl mx-auto px-4 mt-2 mb-4 flex flex-col items-center select-none">
      {/* Barra de Progresso Segmentada */}
      <div className="w-full mb-3">
        {/* Marcadores de Tempo Acima da Barra */}
        <div className="flex justify-between items-center text-[11px] font-mono text-spotify-subdued mb-1.5 px-0.5">
          <span className="text-white font-semibold flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-spotify-green" />
            {currentTime.toFixed(1)}s
          </span>
          <span className="text-neutral-400">
            {isGameOver ? 'Áudio Completo (30s)' : `Liberado: ${maxAllowedTime.toFixed(1)}s`}
          </span>
        </div>

        {/* Container da Barra com Divisões */}
        <div className="relative w-full h-3.5 bg-[#242424] rounded-full overflow-hidden flex border border-[#333]">
          {/* Preenchimento Dinâmico em Verde Spotify */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-spotify-green transition-all duration-75 ease-linear rounded-full shadow-lg shadow-spotify-green/40"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Divisões de Segmentos */}
          {!isGameOver && (
            <div className="absolute inset-0 flex pointer-events-none">
              {segments.map((seg, idx) => {
                const isUnlocked = idx <= currentAttemptIndex;
                return (
                  <div
                    key={seg.limit}
                    style={{ flex: seg.flex }}
                    className={`h-full border-r border-[#121212]/90 flex items-center justify-end pr-1 transition-opacity ${
                      isUnlocked ? 'bg-transparent' : 'bg-black/40'
                    }`}
                  >
                    <span className="text-[8px] font-mono text-neutral-400 opacity-60">
                      {seg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Botão Central de Play / Pause */}
      <div className="flex flex-col items-center justify-center gap-2">
        {shouldShowError ? (
          <button
            onClick={onTogglePlay}
            className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 px-3.5 py-1.5 rounded-full border border-amber-400/30 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tocar novamente</span>
          </button>
        ) : (
          <button
            onClick={onTogglePlay}
            disabled={isLoading}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl ${
              isLoading
                ? 'bg-[#333] cursor-not-allowed text-neutral-500'
                : 'bg-spotify-green hover:bg-spotify-green-hover text-black hover:scale-105 active:scale-95 shadow-spotify-green/20'
            }`}
            title={isPlaying ? 'Pausar' : 'Tocar trecho'}
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-spotify-green" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>
        )}

        <span className="text-xs font-medium text-spotify-subdued">
          {isLoading
            ? 'Carregando áudio da música...'
            : isPlaying
            ? 'Tocando trecho...'
            : shouldShowError
            ? 'Clique para tentar reproduzir'
            : isGameOver
            ? 'Toque para ouvir a música completa'
            : `Toque para ouvir até ${maxAllowedTime.toFixed(1)}s`}
        </span>
      </div>
    </div>
  );
}
