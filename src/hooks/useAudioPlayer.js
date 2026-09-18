import { useState, useEffect, useRef, useCallback } from 'react';
import { isPreviewUrlExpired, refreshTrackPreview } from '../services/musicService.js';

// Tempos milimétricos permitidos por tentativa (em segundos)
export const ATTEMPT_TIME_LIMITS = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0];
export const FINAL_TIME_LIMIT = 30.0;

/**
 * Hook customizado para controle de áudio milimétrico do Songless com autorrecuperação de tokens.
 * Garante que cada reprodução comece RIGOROSAMENTE em 0.0s (início da música/trecho)
 * e pause exatamente no limite liberado pela tentativa.
 * Renova proativamente ou reativamente links expirados (ex: tokens de 15min do Deezer CDN).
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
  const stopTimeoutRef = useRef(null);
  const playbackStartTimeRef = useRef(null);
  const isRefreshingRef = useRef(false);

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

  // Função para parar a reprodução do trecho e rebobinar para 0.0s
  const stopPlayback = useCallback(() => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch (e) {}
    }

    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  // Limpeza completa do elemento de áudio
  const cleanupAudio = useCallback(() => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
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

  // Monitor de reprodução milimétrico com requestAnimationFrame e proteção anti-stale seek
  const monitorPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const elapsedWall = playbackStartTimeRef.current 
      ? (performance.now() - playbackStartTimeRef.current) / 1000 
      : 0;
    const audioTime = audio.currentTime || 0;

    // No mobile (Safari / Chrome), se a reprodução acabou de iniciar (< 60ms),
    // audio.currentTime pode retornar resíduo stale da reprodução anterior (ex: 0.10s).
    // Só validamos audioTime quando houver transcorrido tempo mínimo plausível.
    const isStaleAudioTime = elapsedWall < 0.06 && audioTime >= maxAllowedTime;

    const displayTime = isStaleAudioTime 
      ? Math.min(maxAllowedTime, elapsedWall) 
      : Math.min(maxAllowedTime, Math.max(audioTime, elapsedWall));
    setCurrentTime(displayTime);

    // Se atingiu o limite de tempo estipulado
    const reachedLimit = elapsedWall >= maxAllowedTime || (!isStaleAudioTime && audioTime >= maxAllowedTime);

    if (reachedLimit) {
      stopPlayback();
      return;
    }

    if (!audio.paused) {
      animationFrameRef.current = requestAnimationFrame(monitorPlayback);
    }
  }, [maxAllowedTime, stopPlayback]);

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

    // Cancela qualquer execução pendente
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
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
        // Aguarda canplay
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

    // 1. Pausa e força rebobinamento para 0.0s ANTES de iniciar a reprodução
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch (e) {}
    setCurrentTime(0);

    // Se o áudio estiver em processo de busca/seeking ou se currentTime ainda não estiver zerado,
    // aguarda brevemente pelo evento 'seeked' para garantir que o buffer começa rigorosamente em 0.0s
    if (audio.seeking || audio.currentTime > 0.02) {
      await new Promise(resolve => {
        const onSeeked = () => {
          audio.removeEventListener('seeked', onSeeked);
          resolve();
        };
        audio.addEventListener('seeked', onSeeked, { once: true });
        try {
          audio.currentTime = 0;
        } catch (e) {}
        setTimeout(resolve, 70);
      });
    }

    try {
      await audio.play();

      // Registra timestamp real do início para cálculo milimétrico no mobile
      playbackStartTimeRef.current = performance.now();
      setIsPlaying(true);
      setHasError(false);

      // Timeout exato de segurança contra throttling de requestAnimationFrame em mobile/tablet
      const timeoutMs = Math.round(maxAllowedTime * 1000);
      stopTimeoutRef.current = setTimeout(() => {
        stopPlayback();
      }, timeoutMs);

      animationFrameRef.current = requestAnimationFrame(monitorPlayback);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[AudioPlayer] Play impedido pelo navegador:', err);
        // NotSupportedError ocorre quando a URL retornou 403 Forbidden ou foi invalidada
        if (err.name === 'NotSupportedError') {
          setHasError(true);
          // Tenta renovar em segundo plano para o próximo toque
          attemptRenewAudio();
        }
      }
      setIsPlaying(false);
    }
  }, [hasError, attemptRenewAudio, maxAllowedTime, monitorPlayback, stopPlayback]);

  // Função para pausar e sempre rebobinar para 0.0s
  const pause = useCallback(() => {
    stopPlayback();
  }, [stopPlayback]);

  // Alterna entre play e pause com verificação do elemento nativo
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
    stopPlayback();
  }, [stopPlayback]);

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

    setIsLoading(true);
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

    audio.onpause = () => {
      if (isDisposed) return;
      // Garante sincronização imediata do estado se o browser/OS pausar o áudio
      setIsPlaying(false);
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    audio.onerror = async () => {
      if (isDisposed) return;
      if (!audio.src || (audio.error && audio.error.code === 1)) {
        return;
      }
      console.warn('[AudioPlayer] Erro no áudio:', audio.error?.code, activeUrl);

      // Se der erro (ex: 403 pelo token expirado de 15min), tenta autorrecuperação
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
      stopPlayback();
    };

    audio.src = activeUrl;
    audioRef.current = audio;

    return () => {
      isDisposed = true;
      cleanupAudio();
    };
  }, [activeUrl, cleanupAudio, currentTrack, attemptRenewAudio, stopPlayback]);

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
