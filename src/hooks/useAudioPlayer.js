import { useState, useEffect, useRef, useCallback } from 'react';

// Tempos milimétricos permitidos por tentativa (em segundos)
export const ATTEMPT_TIME_LIMITS = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0];
export const FINAL_TIME_LIMIT = 30.0;

/**
 * Hook customizado para controle de áudio milimétrico do Songless.
 * Garante ciclo de vida limpo, prevenindo falsos positivos de erro durante
 * transições de faixas e busca de dados.
 */
export function useAudioPlayer(previewUrl, currentAttemptIndex, isGameOver = false) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);
  const animationFrameRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Calcula o tempo máximo liberado para a tentativa atual ou pós-jogo
  const maxAllowedTime = isGameOver 
    ? FINAL_TIME_LIMIT 
    : (ATTEMPT_TIME_LIMITS[currentAttemptIndex] ?? ATTEMPT_TIME_LIMITS[ATTEMPT_TIME_LIMITS.length - 1]);

  // Função auxiliar para desmontar com segurança o elemento de áudio anterior
  const cleanupCurrentAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (audioRef.current) {
      const audio = audioRef.current;
      // Remove listeners antes de pausar/resetar para evitar disparar onError indevido
      audio.oncanplay = null;
      audio.oncanplaythrough = null;
      audio.onerror = null;
      audio.onended = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // Carregamento do áudio
  useEffect(() => {
    cleanupCurrentAudio();

    if (!previewUrl) {
      setIsPlaying(false);
      setCurrentTime(0);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);

    let isCancelled = false;

    const setupAudioElement = (srcUrl) => {
      if (isCancelled) return;

      const audio = new Audio();
      audio.preload = 'auto';

      audio.oncanplay = () => {
        if (isCancelled) return;
        setIsLoading(false);
        setHasError(false);
      };

      audio.oncanplaythrough = () => {
        if (isCancelled) return;
        setIsLoading(false);
        setHasError(false);
      };

      audio.onerror = () => {
        if (isCancelled) return;
        // Ignora abort proposital (código 1 - MEDIA_ERR_ABORTED) ou src vazio
        if (!audio.src || (audio.error && audio.error.code === 1)) {
          return;
        }
        console.warn('[AudioPlayer] Erro ao carregar áudio:', audio.error?.code, srcUrl);
        setIsLoading(false);
        setHasError(true);
        setIsPlaying(false);
      };

      audio.onended = () => {
        if (isCancelled) return;
        setIsPlaying(false);
        audio.currentTime = 0;
        setCurrentTime(0);
      };

      audio.src = srcUrl;
      audioRef.current = audio;
    };

    // Baixa o áudio como Blob audio/mp4 para reprodução consistente
    fetch(previewUrl, { signal: abortController.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        if (isCancelled) return;

        const blob = new Blob([buffer], { type: 'audio/mp4' });
        const objUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objUrl;
        setupAudioElement(objUrl);
      })
      .catch((err) => {
        if (err.name === 'AbortError' || isCancelled) {
          return;
        }
        // Fallback: tenta URL direta sem disparar erro prematuro
        setupAudioElement(previewUrl);
      });

    return () => {
      isCancelled = true;
      cleanupCurrentAudio();
    };
  }, [previewUrl, cleanupCurrentAudio]);

  // Loop de monitoramento milimétrico com requestAnimationFrame
  const monitorPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = audio.currentTime;
    setCurrentTime(time);

    // Se alcançou ou ultrapassou o limite estipulado pela tentativa
    if (time >= maxAllowedTime) {
      audio.pause();
      audio.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
      return;
    }

    if (!audio.paused) {
      animationFrameRef.current = requestAnimationFrame(monitorPlayback);
    }
  }, [maxAllowedTime]);

  // Função para dar play garantindo início estrito em 0.0s
  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    setCurrentTime(0);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          animationFrameRef.current = requestAnimationFrame(monitorPlayback);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.warn('[AudioPlayer] Play impedido pelo navegador:', err);
          }
          setIsPlaying(false);
        });
    }
  }, [monitorPlayback]);

  // Função para pausar
  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
  }, []);

  // Alterna entre play e pause
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Reseta estado
  const stop = useCallback(() => {
    pause();
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    setCurrentTime(0);
  }, [pause]);

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
