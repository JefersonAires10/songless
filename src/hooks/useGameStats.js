import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'songless_game_stats_v1';

const INITIAL_STATS = {
  played: 0,
  wins: 0,
  losses: 0,
  streak: 0,
  maxStreak: 0,
  guessDistribution: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  }
};

/**
 * Hook para gerenciar as estatísticas persistentes do Songless no localStorage
 */
export function useGameStats() {
  const [stats, setStats] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_STATS,
          ...parsed,
          guessDistribution: {
            ...INITIAL_STATS.guessDistribution,
            ...(parsed.guessDistribution || {})
          }
        };
      }
    } catch (e) {
      console.warn('[GameStats] Erro ao ler stats do localStorage:', e);
    }
    return INITIAL_STATS;
  });

  // Salva no localStorage sempre que stats mudar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      console.warn('[GameStats] Erro ao salvar stats no localStorage:', e);
    }
  }, [stats]);

  /**
   * Registra o resultado de uma partida concluída.
   * @param {boolean} won - se o jogador venceu
   * @param {number} attemptNumber - número da tentativa em que venceu (1 a 6)
   */
  const recordResult = useCallback((won, attemptNumber) => {
    setStats(prev => {
      const newPlayed = prev.played + 1;
      const newWins = won ? prev.wins + 1 : prev.wins;
      const newLosses = won ? prev.losses : prev.losses + 1;
      const newStreak = won ? prev.streak + 1 : 0;
      const newMaxStreak = Math.max(prev.maxStreak, newStreak);

      const newDistribution = { ...prev.guessDistribution };
      if (won && attemptNumber >= 1 && attemptNumber <= 6) {
        newDistribution[attemptNumber] = (newDistribution[attemptNumber] || 0) + 1;
      }

      return {
        played: newPlayed,
        wins: newWins,
        losses: newLosses,
        streak: newStreak,
        maxStreak: newMaxStreak,
        guessDistribution: newDistribution,
      };
    });
  }, []);

  const resetStats = useCallback(() => {
    setStats(INITIAL_STATS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[GameStats] Erro ao limpar stats:', e);
    }
  }, []);

  // Taxa de vitória calculada em porcentagem
  const winRate = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;

  return {
    stats,
    winRate,
    recordResult,
    resetStats,
  };
}
