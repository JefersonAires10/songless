import { useState, useEffect, useRef, useCallback } from 'react';
import { isPreviewUrlExpired, refreshTrackPreview } from '../services/musicService.js';

// Tempos milimétricos permitidos por tentativa (em segundos)
export const ATTEMPT_TIME_LIMITS = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0];
export const FINAL_TIME_LIMIT = 30.0;

/**
 * Hook customizado para controle de áudio milimétrico do Songless com autorrecuperação de tokens.
 * Garante que cada reprodução:
 * 1. Comece RIGOROSAMENTE em 0.0s (início da faixa);
 * 2. Inicie de forma 100% SÍNCRONA na interação do usuário (respeitando o user gesture do iOS Safari e mobile Chrome);
 * 3. Conte o tempo com alta precisão (performance.now) somente a partir do momento em que o áudio realmente começa a sair pelo hardware ('playing');
 * 4. Isole cada clique com um playId incremental, eliminando resíduos de seek assíncronos e eventos 'pause' em fila ("uma vez sim outra não");
 * 5. Pause exatamente no limite liberado pela tentativa.
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
  const playingHandlerRef = useRef(null);
  const playIdRef = useRef(0);
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
    // Incrementa playId para invalidar qualquer timeout, frame ou evento assíncrono em andamento
    playIdRef.current += 1;

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
      if (playingHandlerRef.current) {
        audio.removeEventListener('playing', playingHandlerRef.current);
        playingHandlerRef.current = null;
      }
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch (e) {}
    }

    playbackStartTimeRef.current = null;
    setCurrentTime(0);
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  // Limpeza completa do elemento de áudio
  const cleanupAudio = useCallback(() => {
    playIdRef.current += 1;

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
      if (playingHandlerRef.current) {
        audio.removeEventListener('playing', playingHandlerRef.current);
        playingHandlerRef.current = null;
      }
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

  // Função para dar Play com execução 100% SÍNCRONA no clique do usuário (essencial para mobile Safari/Chrome)
  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 1. Gera novo ID único para este ciclo de play. Qualquer callback de clique anterior será descartado.
    playIdRef.current += 1;
    const thisPlayId = playIdRef.current;

    // 2. Limpa timeouts, frames e listeners residuais
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (playingHandlerRef.current) {
      audio.removeEventListener('playing', playingHandlerRef.current);
      playingHandlerRef.current = null;
    }

    // 3. Se estiver tocando, pausa antes de reiniciar
    if (!audio.paused) {
      audio.pause();
    }

    // 4. Força rebobinamento síncrono para o início
    try {
      audio.currentTime = 0;
    } catch (e) {}
    playbackStartTimeRef.current = null;
    setCurrentTime(0);

    // 5. Se o áudio estiver em estado de erro ou com URL nula, tenta renovar
    if (hasError || !audio.src || isPreviewUrlExpired(audio.src)) {
      attemptRenewAudio().then((freshUrl) => {
        if (freshUrl && audioRef.current) {
          audioRef.current.src = freshUrl;
          audioRef.current.load();
          setHasError(false);
        }
      });
      return;
    }

    // 6. Duração do trecho em milissegundos
    // Para 0.1s no mobile, reservamos 120ms acústicos para compensar o tempo de subida (attack) do alto-falante
    const durationMs = maxAllowedTime <= 0.1 ? 120 : Math.round(maxAllowedTime * 1000);

    // 7. Função de início do monitoramento quando o som de fato começar a sair pelos alto-falantes
    const startPlaybackTracking = () => {
      if (playIdRef.current !== thisPlayId) return;
      if (playbackStartTimeRef.current !== null) return;

      playbackStartTimeRef.current = performance.now();
      setIsPlaying(true);
      setHasError(false);

      // Timer de segurança contra throttling de requestAnimationFrame
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = setTimeout(() => {
        if (playIdRef.current === thisPlayId) {
          stopPlayback();
        }
      }, durationMs);

      // Monitor de alta frequência via requestAnimationFrame
      const monitor = () => {
        if (playIdRef.current !== thisPlayId) return;
        const curAudio = audioRef.current;
        if (!curAudio) return;

        if (playbackStartTimeRef.current === null) {
          if (!curAudio.paused) {
            animationFrameRef.current = requestAnimationFrame(monitor);
          }
          return;
        }

        const elapsedWall = (performance.now() - playbackStartTimeRef.current) / 1000;
        const audioTime = curAudio.currentTime || 0;

        // Atualização contínua da barra de progresso
        const displayTime = Math.min(maxAllowedTime, elapsedWall);
        setCurrentTime(displayTime);

        // Condição de parada rigorosa:
        // - Para trechos de 0.1s: paramos em 0.12s de relógio real (acústico ideal)
        // - Para outros trechos: paramos em maxAllowedTime de relógio real
        // - NUNCA confiamos em audio.currentTime nos primeiros 150ms porque no iOS Safari
        //   audio.currentTime é quantizado em 250ms e retém valores stale da reprodução anterior!
        const targetWallLimit = maxAllowedTime <= 0.1 ? 0.12 : maxAllowedTime;
        const reachedDuration = elapsedWall >= targetWallLimit;
        const reachedAudioLimit = elapsedWall >= 0.15 && audioTime >= maxAllowedTime;

        if (reachedDuration || reachedAudioLimit) {
          stopPlayback();
          return;
        }

        if (!curAudio.paused) {
          animationFrameRef.current = requestAnimationFrame(monitor);
        }
      };

      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(monitor);
    };

    // 8. O evento 'playing' dispara exatamente quando o hardware do dispositivo começa a emitir áudio
    const onPlaying = () => {
      if (playIdRef.current === thisPlayId) {
        startPlaybackTracking();
      }
    };
    playingHandlerRef.current = onPlaying;
    audio.addEventListener('playing', onPlaying, { once: true });

    // 9. Chamada estritamente síncrona a audio.play() dentro do contexto do clique
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Fallback: se o evento 'playing' do WebView demorar mais de 80ms, inicia o rastreamento
          setTimeout(() => {
            if (playIdRef.current === thisPlayId && playbackStartTimeRef.current === null) {
              if (audioRef.current && !audioRef.current.paused) {
                startPlaybackTracking();
              }
            }
          }, 80);
        })
        .catch((err) => {
          if (playIdRef.current === thisPlayId) {
            if (err.name !== 'AbortError') {
              console.warn('[AudioPlayer] Play impedido pelo navegador:', err);
              if (err.name === 'NotSupportedError') {
                setHasError(true);
                attemptRenewAudio();
              }
            }
            stopPlayback();
          }
        });
    }
  }, [maxAllowedTime, stopPlayback, attemptRenewAudio, hasError]);

  // Função para pausar e sempre rebobinar para 0.0s
  const pause = useCallback(() => {
    stopPlayback();
  }, [stopPlayback]);

  // Alterna entre play e pause com verificação do elemento nativo
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    const isCurrentlyPlaying = isPlaying || (audio && !audio.paused);
    if (isCurrentlyPlaying) {
      stopPlayback();
    } else {
      play();
    }
  }, [isPlaying, play, stopPlayback]);

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

    // No mobile (iOS Safari / Chrome Mobile), o navegador NÃO pré-carrega áudio em segundo plano.
    // O evento 'canplay' nunca dispara antes do primeiro clique do usuário.
    // Portanto, NÃO deixamos isLoading = true bloqueando o botão de play!
    // O player fica com isLoading = false (pronto para o usuário tocar).
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

    audio.onwaiting = () => {
      if (isDisposed) return;
      // Mostra loading apenas se estiver tentando tocar e o buffer estiver vazio
      if (audioRef.current && !audioRef.current.paused) {
        setIsLoading(true);
      }
    };

    audio.onplaying = () => {
      if (isDisposed) return;
      setIsLoading(false);
    };

    audio.onpause = () => {
      if (isDisposed) return;
      if (audio.paused) {
        setIsPlaying(false);
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
