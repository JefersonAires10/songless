import { useState, useEffect, useRef, useCallback } from 'react';
import { isPreviewUrlExpired, refreshTrackPreview } from '../services/musicService.js';

// Tempos milimétricos permitidos por tentativa (em segundos)
export const ATTEMPT_TIME_LIMITS = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0];
export const FINAL_TIME_LIMIT = 30.0;

/**
 * Hook customizado para controle de áudio milimétrico do Songless.
 * Garante que:
 * 1. Cada clique reproduza exatamente o trecho permitido (0.1s, 0.5s, 1s, etc.);
 * 2. Em dispositivos móveis (iOS Safari / Chrome Android), resíduos de seek assíncronos
 *    não pausem o áudio prematuramente no primeiro frame do segundo clique ("uma vez sim outra não");
 * 3. O player não fique bloqueado em estado de carregamento ao abrir no mobile;
 * 4. Links expirados com token Akamai (Deezer) sejam renovados automaticamente.
 */
export function useAudioPlayer(trackOrUrl, currentAttemptIndex, isGameOver = false, onTrackUpdated = null) {
  const currentTrack = (trackOrUrl && typeof trackOrUrl === 'object') ? trackOrUrl : null;
  const initialUrl = currentTrack ? currentTrack.previewUrl : (typeof trackOrUrl === 'string' ? trackOrUrl : null);

  const [activeUrl, setActiveUrl] = useState(initialUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const audioRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isRefreshingRef = useRef(false);
  const hasSeekedToZeroRef = useRef(false);
  const playWallStartRef = useRef(0);

  // Sincroniza activeUrl quando a faixa ou URL de entrada mudar
  useEffect(() => {
    let isDisposed = false;

    if (!initialUrl) {
      setActiveUrl(null);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    // Se o link já estiver expirado ou prestes a expirar, renova proativamente
    if (currentTrack && isPreviewUrlExpired(initialUrl)) {
      setIsLoading(true);
      refreshTrackPreview(currentTrack).then((freshUrl) => {
        if (!isDisposed) {
          setIsLoading(false);
          if (freshUrl) {
            setActiveUrl(freshUrl);
            if (onTrackUpdated) onTrackUpdated(currentTrack);
          } else {
            setActiveUrl(initialUrl);
          }
        }
      });
    } else {
      setActiveUrl(initialUrl);
    }

    return () => {
      isDisposed = true;
    };
  }, [initialUrl, currentTrack, onTrackUpdated]);

  // Calcula o tempo máximo liberado para a tentativa atual ou pós-jogo
  const maxAllowedTime = isGameOver 
    ? FINAL_TIME_LIMIT 
    : (ATTEMPT_TIME_LIMITS[currentAttemptIndex] ?? ATTEMPT_TIME_LIMITS[ATTEMPT_TIME_LIMITS.length - 1]);

  // Limpeza completa do elemento de áudio
  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioRef.current) {
      const audio = audioRef.current;
      audio.oncanplay = null;
      audio.oncanplaythrough = null;
      audio.onerror = null;
      audio.onended = null;
      audio.onpause = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    }
  }, []);

  // Monitor de reprodução milimétrico com requestAnimationFrame
  const monitorPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = audio.currentTime || 0;
    const elapsedWallMs = performance.now() - (playWallStartRef.current || 0);

    // No mobile (Safari / Chrome), ao pausar no final do primeiro clique,
    // audio.currentTime pode reter 0.10s por alguns milissegundos enquanto o seek para 0.0s é processado.
    // Assim que time < 0.04s, temos a confirmação física de que o áudio voltou para o início!
    if (time < 0.04) {
      hasSeekedToZeroRef.current = true;
    }

    // Só consideramos o tempo válido se o seek para zero foi confirmado pelo decoder
    // ou como fallback após 500ms de relógio real
    const isReady = hasSeekedToZeroRef.current || elapsedWallMs > 500;

    if (isReady) {
      setCurrentTime(time);
    } else {
      setCurrentTime(0);
    }

    // Se atingiu ou ultrapassou o limite estipulado pela tentativa atual (e não é resíduo da anterior)
    if (isReady && time >= maxAllowedTime) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch (e) {}
      setCurrentTime(0);
      setIsPlaying(false);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    if (!audio.paused) {
      animationFrameRef.current = requestAnimationFrame(monitorPlayback);
    }
  }, [maxAllowedTime]);

  // Tenta renovar o link de áudio e recarregar o player em caso de falha ou expiração
  const attemptRenewAudio = useCallback(async () => {
    if (!currentTrack || isRefreshingRef.current) return null;
    isRefreshingRef.current = true;
    setIsLoading(true);

    try {
      console.log('[AudioPlayer] Tentando renovar áudio para:', currentTrack.title);
      const freshUrl = await refreshTrackPreview(currentTrack);
      if (freshUrl) {
        setActiveUrl(freshUrl);
        if (onTrackUpdated) onTrackUpdated(currentTrack);
        setHasError(false);
        return freshUrl;
      }
    } catch (e) {
      console.warn('[AudioPlayer] Falha ao renovar áudio:', e);
    } finally {
      isRefreshingRef.current = false;
      setIsLoading(false);
    }
    return null;
  }, [currentTrack, onTrackUpdated]);

  // Função para dar Play garantindo início ESTRITO em 0.0s e autorrecuperação
  const play = useCallback(async () => {
    let audio = audioRef.current;
    if (!audio) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Se estiver em estado de erro ou com URL expirada, renova antes de tocar
    if (hasError || audio.error || !audio.src || isPreviewUrlExpired(audio.src)) {
      const freshUrl = await attemptRenewAudio();
      if (freshUrl && audioRef.current) {
        audio = audioRef.current;
        audio.src = freshUrl;
        audio.load();
        setHasError(false);
        // Aguarda canplay se estiver carregando do zero
        await new Promise(resolve => {
          const onReady = () => {
            audio.removeEventListener('canplay', onReady);
            resolve();
          };
          audio.addEventListener('canplay', onReady);
          setTimeout(resolve, 800);
        });
      }
    }

    // Marca que um novo ciclo iniciou e o seek para zero precisa ser confirmado
    hasSeekedToZeroRef.current = false;
    playWallStartRef.current = performance.now();

    // 1. Pausa e força rebobinamento para 0.0s
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch (e) {}
    setCurrentTime(0);

    try {
      await audio.play();
      try {
        audio.currentTime = 0;
      } catch (e) {}
      setCurrentTime(0);
      setIsPlaying(true);
      setHasError(false);
      animationFrameRef.current = requestAnimationFrame(monitorPlayback);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[AudioPlayer] Play impedido pelo navegador:', err);
        if (err.name === 'NotSupportedError') {
          setHasError(true);
          attemptRenewAudio();
        }
      }
      setIsPlaying(false);
    }
  }, [hasError, attemptRenewAudio, monitorPlayback]);

  // Função para pausar e sempre rebobinar para 0.0s
  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch (e) {}
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setCurrentTime(0);
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  // Alterna entre play e pause
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    const isCurrentlyPlaying = isPlaying || (audio && !audio.paused);
    if (isCurrentlyPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Para a reprodução e reseta ponteiros
  const stop = useCallback(() => {
    pause();
  }, [pause]);

  // Inicialização e troca de faixa
  useEffect(() => {
    cleanupAudio();

    if (!activeUrl) {
      setIsPlaying(false);
      setCurrentTime(0);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    // Inicializa com isLoading = false para manter o botão Play sempre liberado e clicável no mobile
    setIsLoading(false);
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);

    let isDisposed = false;
    const audio = new Audio();
    audio.preload = 'auto';

    audio.oncanplay = () => {
      if (isDisposed) return;
      setIsLoading(false);
      setHasError(false);
    };

    audio.oncanplaythrough = () => {
      if (isDisposed) return;
      setIsLoading(false);
      setHasError(false);
    };

    audio.onerror = async () => {
      if (isDisposed) return;
      if (!audio.src || (audio.error && audio.error.code === 1)) {
        return;
      }
      console.warn('[AudioPlayer] Erro no áudio:', audio.error?.code, activeUrl);

      if (currentTrack && !isRefreshingRef.current) {
        const freshUrl = await attemptRenewAudio();
        if (!isDisposed && freshUrl && freshUrl !== activeUrl) {
          console.log('[AudioPlayer] URL recuperada com sucesso.');
          return;
        }
      }

      setIsLoading(false);
      setHasError(true);
      setIsPlaying(false);
    };

    audio.onended = () => {
      if (isDisposed) return;
      setIsPlaying(false);
      try {
        audio.currentTime = 0;
      } catch (e) {}
      setCurrentTime(0);
    };

    audio.src = activeUrl;
    audioRef.current = audio;

    return () => {
      isDisposed = true;
      cleanupAudio();
    };
  }, [activeUrl, cleanupAudio, currentTrack, attemptRenewAudio]);

  return {
    isPlaying,
    currentTime,
    maxAllowedTime,
    isLoading,
    hasError,
    play,
    pause,
    togglePlay,
    stop,
    timeLimits: ATTEMPT_TIME_LIMITS,
    finalTimeLimit: FINAL_TIME_LIMIT,
  };
}
