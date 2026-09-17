import React, { useEffect, useState } from 'react';
import { Trophy, Frown, Play, Pause, RefreshCw, Share2, Check, ExternalLink, Disc, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export function ResultModal({
  isOpen,
  onClose,
  won,
  targetTrack,
  attempts = [],
  onNextSong,
  audioPlayer,
}) {
  const [copied, setCopied] = useState(false);

  // Efeito de confete ao vencer
  useEffect(() => {
    if (isOpen && won) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#1DB954', '#ffffff', '#1ed760', '#f59e0b'],
      });
    }
  }, [isOpen, won]);

  if (!isOpen || !targetTrack) return null;

  // Monta grade de compartilhamento emoji
  const generateShareText = () => {
    const symbols = attempts.map(att => {
      if (att.status === 'correct') return '🟩';
      if (att.status === 'wrong') return '🟥';
      if (att.status === 'skipped') return '⬛';
      return '⬜';
    });

    // Completa até 6 se terminou antes
    while (symbols.length < 6) {
      symbols.push('⬜');
    }

    const score = won ? attempts.length : 'X';
    return `Songless 🎵 (${score}/6)\n\n${symbols.join('')}\n\nJogue agora e adivinhe o clássico!`;
  };

  const handleShare = async () => {
    const text = generateShareText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (e) {
      console.warn('Erro ao copiar para clipboard:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-spotify-card border border-[#3e3e3e] rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        {/* Botão Fechar no canto */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#333] text-spotify-subdued hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Ícone de Status & Título */}
        {won ? (
          <div className="flex flex-col items-center mb-3">
            <div className="w-12 h-12 rounded-full bg-spotify-green/20 border border-spotify-green/50 flex items-center justify-center mb-2 shadow-lg shadow-spotify-green/20">
              <Trophy className="w-6 h-6 text-spotify-green" />
            </div>
            <h2 className="text-2xl font-black text-white">Excelente!</h2>
            <p className="text-xs font-semibold text-spotify-green uppercase tracking-wider">
              Você acertou na {attempts.length}ª tentativa!
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center mb-3">
            <div className="w-12 h-12 rounded-full bg-spotify-red/20 border border-spotify-red/50 flex items-center justify-center mb-2">
              <Frown className="w-6 h-6 text-spotify-red" />
            </div>
            <h2 className="text-2xl font-black text-white">Não foi dessa vez!</h2>
            <p className="text-xs font-semibold text-spotify-subdued uppercase tracking-wider">
              A música clássica era:
            </p>
          </div>
        )}

        {/* Card da Música Revelada estilo Spotify */}
        <div className="w-full bg-[#181818] border border-[#2e2e2e] rounded-xl p-4 my-2 flex flex-col items-center shadow-inner">
          {/* Capa em Alta Resolução */}
          <div className="relative w-44 h-44 rounded-lg overflow-hidden shadow-2xl mb-4 group">
            {targetTrack.artwork ? (
              <img
                src={targetTrack.artwork}
                alt={targetTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#2a2a2a] flex items-center justify-center">
                <Disc className="w-16 h-16 text-neutral-600" />
              </div>
            )}

            {/* Overlay de Play Rápido */}
            <button
              onClick={audioPlayer.togglePlay}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-spotify-green text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                {audioPlayer.isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </div>
            </button>
          </div>

          {/* Dados da Faixa */}
          <h3 className="text-lg font-bold text-white leading-snug line-clamp-1">
            {targetTrack.title}
          </h3>
          <p className="text-sm font-medium text-spotify-subdued line-clamp-1 mt-0.5">
            {targetTrack.artist}
          </p>
          <p className="text-xs text-neutral-500 line-clamp-1 mt-1">
            {targetTrack.album} {targetTrack.releaseYear ? `• ${targetTrack.releaseYear}` : ''}
          </p>

          {/* Mini Player 30s */}
          <div className="w-full mt-4 pt-3 border-t border-[#262626] flex items-center justify-between gap-3">
            <button
              onClick={audioPlayer.togglePlay}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white hover:text-spotify-green transition-colors"
            >
              {audioPlayer.isPlaying ? (
                <>
                  <Pause className="w-4 h-4 text-spotify-green" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-spotify-green" />
                  <span>Ouvir Completa (30s)</span>
                </>
              )}
            </button>

            {targetTrack.trackViewUrl && (
              <a
                href={targetTrack.trackViewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-spotify-subdued hover:text-white flex items-center gap-1 transition-colors"
                title={
                  targetTrack.provider === 'spotify' || targetTrack.trackViewUrl.includes('spotify.com')
                    ? 'Abrir no Spotify'
                    : targetTrack.provider === 'deezer' || targetTrack.trackViewUrl.includes('deezer.com')
                    ? 'Abrir no Deezer'
                    : 'Abrir no Apple Music'
                }
              >
                <span>
                  {targetTrack.provider === 'spotify' || targetTrack.trackViewUrl.includes('spotify.com')
                    ? 'Spotify'
                    : targetTrack.provider === 'deezer' || targetTrack.trackViewUrl.includes('deezer.com')
                    ? 'Deezer'
                    : 'Apple Music'}
                </span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Botões de Ação Final */}
        <div className="w-full flex flex-col gap-2.5 mt-3">
          {/* Botão Modo Infinito: Próxima Música */}
          <button
            onClick={onNextSong}
            className="w-full py-3 px-4 rounded-full bg-spotify-green hover:bg-spotify-green-hover text-black font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-spotify-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Próxima Música</span>
          </button>

          {/* Botão Compartilhar */}
          <button
            onClick={handleShare}
            className="w-full py-2.5 px-4 rounded-full bg-transparent hover:bg-white/10 border border-[#3e3e3e] text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-spotify-green" />
                <span className="text-spotify-green">Copiado para a área de transferência!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Compartilhar Resultado</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
