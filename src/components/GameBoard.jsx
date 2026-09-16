import React from 'react';
import { Check, X, SkipForward, Disc3 } from 'lucide-react';
import { ATTEMPT_TIME_LIMITS } from '../hooks/useAudioPlayer';

export function GameBoard({ attempts = [], currentAttemptIndex, isGameOver = false }) {
  const totalRows = 6;

  return (
    <div className="w-full max-w-xl mx-auto px-4 my-4 flex flex-col gap-2.5">
      {Array.from({ length: totalRows }).map((_, index) => {
        const attempt = attempts[index];
        const isCurrent = index === currentAttemptIndex && !isGameOver;
        const timeLimit = ATTEMPT_TIME_LIMITS[index];

        // Estado: CORRETO
        if (attempt && attempt.status === 'correct') {
          return (
            <div
              key={index}
              className="w-full h-13 py-2.5 px-3.5 rounded-lg bg-[#143922] border-2 border-spotify-green flex items-center justify-between shadow-lg shadow-spotify-green/10 animate-in zoom-in-95 duration-200"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-6 h-6 rounded-full bg-spotify-green flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-black" strokeWidth={3} />
                </div>
                {attempt.artworkThumb && (
                  <img
                    src={attempt.artworkThumb}
                    alt="Capa"
                    className="w-8 h-8 rounded object-cover shrink-0 shadow"
                  />
                )}
                <div className="min-w-0 text-left">
                  <p className="text-sm font-bold text-white truncate leading-tight">
                    {attempt.title}
                  </p>
                  <p className="text-xs text-spotify-green truncate leading-tight">
                    {attempt.artist}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-spotify-green uppercase tracking-wider shrink-0 bg-black/40 px-2 py-0.5 rounded">
                Acertou!
              </span>
            </div>
          );
        }

        // Estado: INCORRETO
        if (attempt && attempt.status === 'wrong') {
          return (
            <div
              key={index}
              className="w-full h-13 py-2.5 px-3.5 rounded-lg bg-[#2c1518] border border-spotify-red/70 flex items-center justify-between animate-in zoom-in-95 duration-150"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-6 h-6 rounded-full bg-spotify-red/30 flex items-center justify-center shrink-0">
                  <X className="w-4 h-4 text-spotify-red" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-sm font-medium text-white/90 truncate leading-tight">
                    {attempt.title}
                  </p>
                  <p className="text-xs text-spotify-subdued truncate leading-tight">
                    {attempt.artist}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-spotify-red font-semibold uppercase tracking-wider shrink-0">
                Incorreto
              </span>
            </div>
          );
        }

        // Estado: PULOU
        if (attempt && attempt.status === 'skipped') {
          return (
            <div
              key={index}
              className="w-full h-13 py-2.5 px-3.5 rounded-lg bg-[#202020] border border-[#383838] flex items-center justify-between text-spotify-subdued animate-in zoom-in-95 duration-150"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#2c2c2c] flex items-center justify-center shrink-0">
                  <SkipForward className="w-3.5 h-3.5 text-spotify-subdued" />
                </div>
                <span className="text-xs font-medium tracking-wide uppercase">
                  Tentativa pulada
                </span>
              </div>
              <span className="text-[11px] font-mono text-spotify-subdued font-semibold">
                +{timeLimit}s
              </span>
            </div>
          );
        }

        // Estado: VAZIO / LINHA ATIVA
        return (
          <div
            key={index}
            className={`w-full h-13 py-2.5 px-3.5 rounded-lg flex items-center justify-between transition-all ${
              isCurrent
                ? 'bg-spotify-card border-2 border-spotify-green/50 shadow-md shadow-spotify-green/5'
                : 'bg-spotify-surface/40 border border-[#262626]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                  isCurrent
                    ? 'bg-spotify-green text-black'
                    : 'bg-[#262626] text-spotify-subdued'
                }`}
              >
                {index + 1}
              </span>
              <span
                className={`text-xs ${
                  isCurrent ? 'text-white font-medium' : 'text-neutral-500'
                }`}
              >
                {isCurrent ? 'Sua vez de tentar...' : ''}
              </span>
            </div>
            <span className="text-[11px] font-mono text-neutral-500">
              {timeLimit}s
            </span>
          </div>
        );
      })}
    </div>
  );
}
