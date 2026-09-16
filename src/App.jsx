import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Music, RefreshCw, AlertTriangle } from 'lucide-react';
import { Header } from './components/Header';
import { GameBoard } from './components/GameBoard';
import { PlayerBar } from './components/PlayerBar';
import { SearchInput } from './components/SearchInput';
import { ResultModal } from './components/ResultModal';
import { StatsModal } from './components/StatsModal';
import { InfoModal } from './components/InfoModal';
import { GENRES, DEFAULT_GENRE_ID } from './config/genres';
import { fetchGenreCatalog, getRandomTrackFromCatalog } from './services/musicService';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useGameStats } from './hooks/useGameStats';

export default function App() {
  // Gênero selecionado
  const [activeGenreId, setActiveGenreId] = useState(DEFAULT_GENRE_ID);
  
  // Catálogo de faixas do gênero ativo
  const [catalog, setCatalog] = useState([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState(null);

  // Faixa secreta da rodada atual e histórico de faixas jogadas nesta sessão
  const [targetTrack, setTargetTrack] = useState(null);
  const playedTrackIdsRef = useRef(new Set());

  // Controle de concorrência para evitar que requisições antigas sobrescrevam novos gêneros
  const currentRequestIdRef = useRef(0);

  // Estado da partida: 'playing' | 'won' | 'lost'
  const [gameStatus, setGameStatus] = useState('playing');
  const [attempts, setAttempts] = useState([]);

  // Modais
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // Estatísticas persistentes
  const { stats, winRate, recordResult, resetStats } = useGameStats();

  const isGameOver = gameStatus === 'won' || gameStatus === 'lost';
  const currentAttemptIndex = attempts.length;

  // Hook de controle de áudio milimétrico
  const audioPlayer = useAudioPlayer(
    targetTrack?.previewUrl,
    currentAttemptIndex,
    isGameOver
  );

  // Inicia uma nova rodada com uma faixa aleatória do catálogo
  const startNewRound = useCallback((currentCatalog) => {
    if (!currentCatalog || currentCatalog.length === 0) return;

    const exclude = Array.from(playedTrackIdsRef.current);
    const selected = getRandomTrackFromCatalog(currentCatalog, exclude);

    if (selected) {
      playedTrackIdsRef.current.add(selected.id);
      setTargetTrack(selected);
      setAttempts([]);
      setGameStatus('playing');
      setIsResultModalOpen(false);
    }
  }, []);

  // Carrega catálogo ao selecionar um gênero com proteção de concorrência
  const loadCatalogForGenre = useCallback(async (genreId) => {
    // Identificador único da requisição atual
    const requestId = ++currentRequestIdRef.current;

    setIsLoadingCatalog(true);
    setCatalogError(null);

    try {
      const tracks = await fetchGenreCatalog(genreId);
      
      // Se o usuário trocou de gênero enquanto essa requisição baixava, descarta
      if (requestId !== currentRequestIdRef.current) {
        return;
      }

      if (!tracks || tracks.length === 0) {
        throw new Error('Nenhuma música encontrada para este gênero.');
      }

      setCatalog(tracks);
      startNewRound(tracks);
    } catch (err) {
      if (requestId === currentRequestIdRef.current) {
        console.error('[App] Erro ao carregar gênero:', err);
        setCatalogError('Não foi possível carregar as músicas. Verifique sua conexão.');
      }
    } finally {
      if (requestId === currentRequestIdRef.current) {
        setIsLoadingCatalog(false);
      }
    }
  }, [startNewRound]);

  // Carregamento inicial do gênero selecionado
  useEffect(() => {
    loadCatalogForGenre(activeGenreId);
  }, [activeGenreId, loadCatalogForGenre]);

  // Alterna o gênero com feedback e reset imediato
  const handleSelectGenre = (newGenreId) => {
    if (newGenreId === activeGenreId) return;
    
    // Reseta estados imediatamente para não exibir erros ou faixas antigas
    setCatalogError(null);
    setIsLoadingCatalog(true);
    setTargetTrack(null);
    setAttempts([]);
    setGameStatus('playing');
    playedTrackIdsRef.current.clear();

    setActiveGenreId(newGenreId);
  };

  // Trata submissão de palpite
  const handleGuess = (guessedTrack) => {
    if (isGameOver || !targetTrack) return;

    audioPlayer.stop();

    const isMatch =
      guessedTrack.id === targetTrack.id ||
      (guessedTrack.title.toLowerCase().trim() === targetTrack.title.toLowerCase().trim() &&
        guessedTrack.artist.toLowerCase().trim() === targetTrack.artist.toLowerCase().trim());

    if (isMatch) {
      const updatedAttempts = [
        ...attempts,
        {
          status: 'correct',
          title: targetTrack.title,
          artist: targetTrack.artist,
          artworkThumb: targetTrack.artworkThumb,
        }
      ];
      setAttempts(updatedAttempts);
      setGameStatus('won');
      recordResult(true, updatedAttempts.length);
      setIsResultModalOpen(true);
    } else {
      const updatedAttempts = [
        ...attempts,
        {
          status: 'wrong',
          title: guessedTrack.title,
          artist: guessedTrack.artist,
        }
      ];
      setAttempts(updatedAttempts);

      if (updatedAttempts.length >= 6) {
        setGameStatus('lost');
        recordResult(false, 6);
        setIsResultModalOpen(true);
      }
    }
  };

  // Trata pulo de tentativa
  const handleSkip = () => {
    if (isGameOver || !targetTrack) return;

    audioPlayer.stop();

    const updatedAttempts = [
      ...attempts,
      {
        status: 'skipped'
      }
    ];
    setAttempts(updatedAttempts);

    if (updatedAttempts.length >= 6) {
      setGameStatus('lost');
      recordResult(false, 6);
      setIsResultModalOpen(true);
    }
  };

  // Reinicia rodada com próxima música
  const handleNextSong = () => {
    startNewRound(catalog);
  };

  const activeGenre = GENRES.find(g => g.id === activeGenreId) || GENRES[0];

  return (
    <div className="min-h-screen bg-spotify-base text-white flex flex-col justify-between selection:bg-spotify-green selection:text-black">
      {/* Cabeçalho */}
      <Header
        activeGenreId={activeGenreId}
        onSelectGenre={handleSelectGenre}
        onOpenStats={() => setIsStatsModalOpen(true)}
        onOpenInfo={() => setIsInfoModalOpen(true)}
        totalInGenre={catalog.length}
      />

      {/* Conteúdo Central com espaçamento inferior amplo para o select não colar na borda */}
      <main className="flex-1 flex flex-col justify-start sm:justify-center items-center pt-3 pb-32 sm:pb-40 w-full max-w-2xl mx-auto px-3">
        {isLoadingCatalog ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-full border-4 border-spotify-card border-t-spotify-green animate-spin" />
              <Music className="w-6 h-6 text-spotify-green absolute inset-0 m-auto" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Sintonizando clássicos de {activeGenre.name}...
            </h3>
            <p className="text-xs text-spotify-subdued mt-1 max-w-xs">
              Buscando as faixas mais aclamadas dos mestres na Apple Search API.
            </p>
          </div>
        ) : catalogError ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-md bg-spotify-card rounded-2xl border border-spotify-red/30 my-8">
            <AlertTriangle className="w-12 h-12 text-spotify-red mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Falha na conexão</h3>
            <p className="text-xs text-spotify-subdued mb-4">{catalogError}</p>
            <button
              onClick={() => loadCatalogForGenre(activeGenreId)}
              className="px-5 py-2.5 rounded-full bg-spotify-green hover:bg-spotify-green-hover text-black font-bold text-xs uppercase tracking-wider transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <>
            {/* Informações da Categoria Ativa */}
            <div className="text-center px-4 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e1e1e] border border-[#333] text-[11px] font-semibold text-spotify-subdued">
                {activeGenre.name} • {catalog.length} clássicos disponíveis
              </span>
            </div>

            {/* Tabuleiro com as 6 tentativas */}
            <GameBoard
              attempts={attempts}
              currentAttemptIndex={currentAttemptIndex}
              isGameOver={isGameOver}
            />

            {/* Barra de Áudio Segmentada e Botão Play */}
            <PlayerBar
              isPlaying={audioPlayer.isPlaying}
              currentTime={audioPlayer.currentTime}
              maxAllowedTime={audioPlayer.maxAllowedTime}
              isLoading={audioPlayer.isLoading}
              hasError={audioPlayer.hasError}
              onTogglePlay={audioPlayer.togglePlay}
              currentAttemptIndex={currentAttemptIndex}
              isGameOver={isGameOver}
            />

            {/* Campo de Palpite ou Ação Pós-Jogo */}
            {!isGameOver ? (
              <SearchInput
                catalog={catalog}
                currentAttemptIndex={currentAttemptIndex}
                onGuess={handleGuess}
                onSkip={handleSkip}
                disabled={audioPlayer.isLoading}
              />
            ) : (
              <div className="w-full max-w-xl mx-auto px-4 mt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsResultModalOpen(true)}
                  className="py-3 px-6 rounded-full bg-spotify-card hover:bg-spotify-card-hover border border-[#3e3e3e] text-white font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Ver Resumo da Música
                </button>
                <button
                  onClick={handleNextSong}
                  className="py-3 px-6 rounded-full bg-spotify-green hover:bg-spotify-green-hover text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-spotify-green/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Próxima Música</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Rodapé Minimalista */}
      <footer className="w-full max-w-2xl mx-auto px-4 py-3 border-t border-[#1f1f1f] text-center text-[11px] text-neutral-500">
        Songless • O jogo de adivinhação musical dos clássicos atemporais
      </footer>

      {/* Modais */}
      <ResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        won={gameStatus === 'won'}
        targetTrack={targetTrack}
        attempts={attempts}
        onNextSong={handleNextSong}
        audioPlayer={audioPlayer}
      />

      <StatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        stats={stats}
        winRate={winRate}
        onResetStats={resetStats}
      />

      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  );
}
