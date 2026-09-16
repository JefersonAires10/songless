import { useState, useEffect, useRef, useCallback } from 'react';

// Tempos milimétricos permitidos por tentativa (em segundos)
export const ATTEMPT_TIME_LIMITS = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0];
export const FINAL_TIME_LIMIT = 30.0;

/**
 * Hook customizado para controle de áudio milimétrico do Songless.
 * Garante que cada reprodução comece RIGOROSAMENTE em 0.0s (início da música/trecho)
 * e pause exatamente no limite liberado pela tentativa.
 */
export function useAudioPlayer(previewUrl, currentAttemptIndex, isGameOver = false) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const audioRef = useRef(null);
  const animationFrameRef = useRef(null);

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

    const time = audio.currentTime;
    setCurrentTime(time);

    // Se atingiu ou ultrapassou o limite estipulado pela tentativa atual
    if (time >= maxAllowedTime) {
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

  // Função para dar Play garantindo início ESTRITO em 0.0s
  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 1. Pausa e força rebobinamento para 0.0s
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch (e) {}
    setCurrentTime(0);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // 2. Confirma novamente que o áudio está em 0.0s após o início da reprodução no dispositivo móvel
          try {
            audio.currentTime = 0;
          } catch (e) {}
          setCurrentTime(0);
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
  }, []);

  // Alterna entre play e pause
  const togglePlay = useCallback(() => {
    if (isPlaying) {
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

    if (!previewUrl) {
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

    audio.onerror = () => {
      if (isDisposed) return;
      if (!audio.src || (audio.error && audio.error.code === 1)) {
        return;
      }
      console.warn('[AudioPlayer] Erro no áudio:', audio.error?.code, previewUrl);
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

    // Força áudio direto para compatibilidade nativa com Safari/iOS e Chrome Android
    audio.src = previewUrl;
    audioRef.current = audio;

    return () => {
      isDisposed = true;
      cleanupAudio();
    };
  }, [previewUrl, cleanupAudio]);

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
