import React from 'react';
import { X, Volume2, HelpCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { ATTEMPT_TIME_LIMITS } from '../hooks/useAudioPlayer';

export function InfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-spotify-card border border-[#3e3e3e] rounded-2xl p-6 shadow-2xl flex flex-col text-white animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#333] text-spotify-subdued hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-spotify-green" />
          <h2 className="text-xl font-bold tracking-tight">Como Jogar Songless</h2>
        </div>

        <p className="text-xs text-spotify-subdued mb-4 leading-relaxed">
          Adivinhe o clássico da música no menor número de tentativas possível ouvindo apenas frações de segundo da canção!
        </p>

        <div className="space-y-3 text-xs mb-6">
          <div className="flex items-start gap-3 bg-[#181818] p-3 rounded-xl border border-[#2e2e2e]">
            <div className="w-6 h-6 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center shrink-0 font-bold font-mono">
              1
            </div>
            <div>
              <p className="font-semibold text-white">Escute a introdução</p>
              <p className="text-spotify-subdued mt-0.5">
                Pressione Play para ouvir a primeira fração da música ({ATTEMPT_TIME_LIMITS[0]}s).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#181818] p-3 rounded-xl border border-[#2e2e2e]">
            <div className="w-6 h-6 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center shrink-0 font-bold font-mono">
              2
            </div>
            <div>
              <p className="font-semibold text-white">Chute ou pule a tentativa</p>
              <p className="text-spotify-subdued mt-0.5">
                Digite o nome da faixa ou artista no autocomplete. Se não souber, clique em Pular.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#181818] p-3 rounded-xl border border-[#2e2e2e]">
            <div className="w-6 h-6 rounded-full bg-spotify-green/20 text-spotify-green flex items-center justify-center shrink-0 font-bold font-mono">
              3
            </div>
            <div>
              <p className="font-semibold text-white">Mais tempo desbloqueado</p>
              <p className="text-spotify-subdued mt-0.5">
                A cada erro ou pulo, você libera mais tempo: 0.1s → 0.5s → 1.0s → 2.0s → 4.0s → 8.0s!
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-[#181818] p-3 rounded-xl border border-[#2e2e2e]">
            <Sparkles className="w-6 h-6 text-spotify-green shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Catálogo 100% Clássico</p>
              <p className="text-spotify-subdued mt-0.5">
                Você pode trocar de categoria (MPB, Rock Nacional, Rock Clássico Internacional, Pop) e jogar quantas rodadas quiser!
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-full bg-spotify-green hover:bg-spotify-green-hover text-black font-bold text-xs uppercase tracking-wider transition-colors"
        >
          Entendi, vamos jogar!
        </button>
      </div>
    </div>
  );
}
