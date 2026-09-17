import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Music, RefreshCw, AlertTriangle, Mic2 } from 'lucide-react';
import { Header } from './components/Header';
import { GameBoard } from './components/GameBoard';
import { PlayerBar } from './components/PlayerBar';
import { SearchInput } from './components/SearchInput';
import { ResultModal } from './components/ResultModal';
import { StatsModal } from './components/StatsModal';
import { InfoModal } from './components/InfoModal';
import { ImportPlaylistModal } from './components/ImportPlaylistModal';
import { ArtistSelectModal } from './components/ArtistSelectModal';
import { GENRES, DEFAULT_GENRE_ID } from './config/genres';
import { fetchGenreCatalog, getRandomTrackFromCatalog, isPreviewUrlExpired, refreshTrackPreview } from './services/musicService';
import { getSavedPlaylists, deleteCustomPlaylist } from './services/playlistService';
import { fetchArtistCatalog } from './services/artistService';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useGameStats } from './hooks/useGameStats';

export default function App() {
  // Gênero selecionado, Playlist Customizada ativa e Modo Artista ativo
  const [activeGenreId, setActiveGenreId] = useState(DEFAULT_GENRE_ID);
  const [activeCustomPlaylist, setActiveCustomPlaylist] = useState(null);
  const [activeArtist, setActiveArtist] = useState(null);
  const [customPlaylists, setCustomPlaylists] = useState(() => getSavedPlaylists());
  
  // Catálogo de faixas do gênero, playlist ou artista ativo
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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isArtistModalOpen, setIsArtistModalOpen] = useState(false);

  // Estatísticas persistentes
  const { stats, winRate, recordResult, resetStats } = useGameStats();

  const isGameOver = gameStatus === 'won' || gameStatus === 'lost';
  const currentAttemptIndex = attempts.length;

  // Atualiza metadados ou URL de áudio quando o token for renovado em background
  const handleTrackUpdated = useCallback((updatedTrack) => {
    if (!updatedTrack) return;
    setTargetTrack(prev => (prev && prev.id === updatedTrack.id ? { ...prev, ...updatedTrack } : prev));
    setCatalog(prevCatalog =>
      prevCatalog.map(t => (t.id === updatedTrack.id ? { ...t, ...updatedTrack } : t))
    );
  }, []);

  // Hook de controle de áudio milimétrico com autorrecuperação
  const audioPlayer = useAudioPlayer(
    targetTrack,
    currentAttemptIndex,
    isGameOver,
    handleTrackUpdated
  );

  // Inicia uma nova rodada com uma faixa aleatória do catálogo
  const startNewRound = useCallback((currentCatalog) => {
    if (!currentCatalog || currentCatalog.length === 0) return;

    const exclude = Array.from(playedTrackIdsRef.current);
    const selected = getRandomTrackFromCatalog(currentCatalog, exclude);

    if (selected) {
      playedTrackIdsRef.current.add(selected.id);

      // Se a URL de áudio do Deezer estiver expirada (> 15min) ou perto disso, renova proativamente
      if (isPreviewUrlExpired(selected.previewUrl)) {
        refreshTrackPreview(selected).then((freshUrl) => {
          if (freshUrl) {
            setTargetTrack(prev => (prev && prev.id === selected.id ? { ...prev, previewUrl: freshUrl } : prev));
            setCatalog(prevCatalog =>
              prevCatalog.map(t => (t.id === selected.id ? { ...t, previewUrl: freshUrl } : t))
            );
          }
        });
      }

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

  // Alterna o gênero padrão com feedback e reset imediato
  const handleSelectGenre = (newGenreId) => {
    if (newGenreId === activeGenreId && !activeCustomPlaylist && !activeArtist) return;
    
    audioPlayer.stop();
    setActiveCustomPlaylist(null);
    setActiveArtist(null);
    setCatalogError(null);
    setIsLoadingCatalog(true);
    setTargetTrack(null);
    setAttempts([]);
    setGameStatus('playing');
    playedTrackIdsRef.current.clear();

    setActiveGenreId(newGenreId);
    loadCatalogForGenre(newGenreId);
  };

  // Seleciona uma playlist personalizada importada
  const handleSelectCustomPlaylist = (playlist) => {
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;

    audioPlayer.stop();
    setActiveArtist(null);
    setCatalogError(null);
    setIsLoadingCatalog(false);
    setTargetTrack(null);
    setAttempts([]);
    setGameStatus('playing');
    playedTrackIdsRef.current.clear();

    setActiveCustomPlaylist(playlist);
    setCatalog(playlist.tracks);
    startNewRound(playlist.tracks);
  };

  // Seleciona um artista específico (Modo Artista)
  const handleSelectArtist = async (artist) => {
    const requestId = ++currentRequestIdRef.current;

    audioPlayer.stop();
    setActiveCustomPlaylist(null);
    setActiveArtist({ name: artist.name, picture: artist.picture });
    setCatalogError(null);
    setIsLoadingCatalog(true);
    setTargetTrack(null);
    setAttempts([]);
    setGameStatus('playing');
    playedTrackIdsRef.current.clear();

    try {
      const artistData = await fetchArtistCatalog(artist.name, artist.id, artist.picture);

      if (requestId !== currentRequestIdRef.current) return;

      if (!artistData || !artistData.tracks || artistData.tracks.length === 0) {
        throw new Error(`Não encontramos músicas com áudio disponível para "${artist.name}".`);
      }

      setActiveArtist(artistData);
      setCatalog(artistData.tracks);
      startNewRound(artistData.tracks);
    } catch (err) {
      if (requestId === currentRequestIdRef.current) {
        console.error('[App] Erro ao carregar artista:', err);
        setCatalogError(err.message || `Não foi possível carregar as músicas de ${artist.name}.`);
      }
    } finally {
      if (requestId === currentRequestIdRef.current) {
        setIsLoadingCatalog(false);
      }
    }
  };

  // Exclui playlist personalizada salva
  const handleDeleteCustomPlaylist = (playlistId) => {
    const updated = deleteCustomPlaylist(playlistId);
    setCustomPlaylists(updated);

    if (activeCustomPlaylist?.id === playlistId) {
      handleSelectGenre(DEFAULT_GENRE_ID);
    }
  };

  // Callback de sucesso ao importar uma nova playlist
  const handleImportSuccess = (newPlaylist) => {
    setCustomPlaylists(getSavedPlaylists());
    handleSelectCustomPlaylist(newPlaylist);
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
        activeCustomPlaylist={activeCustomPlaylist}
        activeArtist={activeArtist}
        customPlaylists={customPlaylists}
        onSelectGenre={handleSelectGenre}
        onSelectCustomPlaylist={handleSelectCustomPlaylist}
        onDeleteCustomPlaylist={handleDeleteCustomPlaylist}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenArtistModal={() => setIsArtistModalOpen(true)}
        onOpenStats={() => setIsStatsModalOpen(true)}
        onOpenInfo={() => setIsInfoModalOpen(true)}
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
              {activeArtist
                ? `Sintonizando as melhores músicas de ${activeArtist.name}...`
                : activeCustomPlaylist
                ? `Carregando faixas da playlist ${activeCustomPlaylist.name}...`
                : `Sintonizando clássicos de ${activeGenre.name}...`}
            </h3>
            <p className="text-xs text-spotify-subdued mt-1 max-w-xs">
              {activeArtist
                ? 'Buscando os maiores sucessos e áudios originais do artista.'
                : 'Buscando as faixas mais aclamadas dos mestres na Apple Search API.'}
            </p>
          </div>
        ) : catalogError ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-md bg-spotify-card rounded-2xl border border-spotify-red/30 my-8">
            <AlertTriangle className="w-12 h-12 text-spotify-red mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Falha na conexão</h3>
            <p className="text-xs text-spotify-subdued mb-4">{catalogError}</p>
            <button
              onClick={() => {
                if (activeArtist) {
                  handleSelectArtist(activeArtist);
                } else if (activeCustomPlaylist) {
                  handleSelectCustomPlaylist(activeCustomPlaylist);
                } else {
                  loadCatalogForGenre(activeGenreId);
                }
              }}
              className="px-5 py-2.5 rounded-full bg-spotify-green hover:bg-spotify-green-hover text-black font-bold text-xs uppercase tracking-wider transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        ) : (
          <>
            {/* Informações da Categoria, Playlist ou Artista Ativo */}
            <div className="text-center px-4 mb-2">
              {activeArtist ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-spotify-green/10 border border-spotify-green/40 text-[11px] font-semibold text-spotify-green shadow-sm max-w-full">
                  <Mic2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Modo Artista: {activeArtist.name}</span>
                  <span className="text-neutral-500 shrink-0">•</span>
                  <span className="shrink-0">{catalog.length} faixas</span>
                </span>
              ) : activeCustomPlaylist ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-spotify-green/10 border border-spotify-green/40 text-[11px] font-semibold text-spotify-green shadow-sm max-w-full">
                  <span className="truncate">Playlist: {activeCustomPlaylist.name}</span>
                  <span className="text-neutral-500 shrink-0">•</span>
                  <span className="shrink-0">{catalog.length} faixas</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e1e1e] border border-[#333] text-[11px] font-semibold text-spotify-subdued max-w-full">
                  <span className="truncate">{activeGenre.name}</span>
                  <span className="text-neutral-500 shrink-0">•</span>
                  <span className="shrink-0">{catalog.length} clássicos</span>
                </span>
              )}
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
      <ArtistSelectModal
        isOpen={isArtistModalOpen}
        onClose={() => setIsArtistModalOpen(false)}
        onSelectArtist={handleSelectArtist}
        activeArtistName={activeArtist?.name}
      />

      <ImportPlaylistModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

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
