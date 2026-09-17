import React, { useState, useRef, useEffect } from 'react';
import { Music, BarChart2, HelpCircle, ChevronDown, Check, Sparkles, Plus, Trash2, ListMusic, Mic2 } from 'lucide-react';
import { GENRES } from '../config/genres';

export function Header({
  activeGenreId,
  activeCustomPlaylist,
  activeArtist,
  customPlaylists = [],
  onSelectGenre,
  onSelectCustomPlaylist,
  onDeleteCustomPlaylist,
  onOpenImportModal,
  onOpenArtistModal,
  onOpenStats,
  onOpenInfo,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Determina o nome ativo exibido no seletor
  const activeGenre = GENRES.find(g => g.id === activeGenreId) || GENRES[0];
  const activeDisplayName = activeArtist
    ? activeArtist.name
    : activeCustomPlaylist
    ? activeCustomPlaylist.name
    : (activeGenre.shortName || activeGenre.name);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="w-full max-w-2xl mx-auto px-4 py-3 border-b border-[#282828] bg-spotify-base/95 backdrop-blur sticky top-0 z-30 flex items-center justify-between">
      {/* Logo & Marca */}
      <div className="flex items-center gap-2 select-none shrink-0">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-spotify-green flex items-center justify-center shadow-lg shadow-spotify-green/20 shrink-0">
          <Music className="w-4 h-4 sm:w-5 sm:h-5 text-black" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-none">
            Songless
          </h1>
          <p className="text-xs text-spotify-subdued leading-tight mt-0.5 hidden sm:block">
            Adivinhe o clássico da música
          </p>
        </div>
      </div>

      {/* Ações Centrais / Direita: Artistas, Importar & Modais */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Botão de Destaque: Escolher Artista (visível em telas sm+) */}
        <button
          onClick={onOpenArtistModal}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full font-extrabold text-xs transition-all hover:scale-105 active:scale-95 focus:outline-none shrink-0 ${
            activeArtist
              ? 'bg-spotify-green text-black shadow-md shadow-spotify-green/20'
              : 'bg-spotify-card hover:bg-spotify-card-hover border border-[#3e3e3e] text-white'
          }`}
          title="Escolher Artista Específico (ex: Detonautas)"
        >
          <Mic2 className="w-3.5 h-3.5 text-spotify-green" />
          <span>Artistas</span>
        </button>

        {/* Botão de Destaque: Importar Playlist (visível em telas sm+) */}
        <button
          onClick={onOpenImportModal}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-spotify-card hover:bg-spotify-card-hover border border-[#3e3e3e] text-white font-extrabold text-xs transition-all hover:scale-105 active:scale-95 focus:outline-none shrink-0"
          title="Importar Playlist do Spotify ou Deezer"
        >
          <Plus className="w-3.5 h-3.5 text-spotify-green" strokeWidth={3} />
          <span>Playlist</span>
        </button>

        {/* Seletor de Categoria / Playlist / Artista */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border transition-all text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-spotify-green ${
              activeArtist
                ? 'bg-spotify-green/15 border-spotify-green text-spotify-green shadow-sm'
                : activeCustomPlaylist
                ? 'bg-spotify-green/10 border-spotify-green/50 text-spotify-green hover:bg-spotify-green/20'
                : 'bg-spotify-card hover:bg-spotify-card-hover border-[#3e3e3e] text-white'
            }`}
            title="Trocar Gênero, Artista ou Playlist"
          >
            {activeArtist ? (
              <Mic2 className="w-3.5 h-3.5 text-spotify-green shrink-0" />
            ) : activeCustomPlaylist ? (
              <ListMusic className="w-3.5 h-3.5 text-spotify-green shrink-0" />
            ) : null}
            <span className="max-w-[100px] xs:max-w-[120px] sm:max-w-[140px] truncate">
              {activeDisplayName}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-spotify-subdued transition-transform duration-200 shrink-0 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Menu Dropdown de Gêneros, Artistas e Playlists */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-[min(300px,calc(100vw-2rem))] sm:w-72 max-h-[75vh] overflow-y-auto rounded-xl bg-spotify-card border border-[#3e3e3e] shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* Ações Rápidas no topo do menu */}
              <div className="p-2 border-b border-[#333] flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenArtistModal();
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-spotify-green/10 hover:bg-spotify-green/20 border border-spotify-green/30 text-spotify-green text-xs font-bold flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Mic2 className="w-3.5 h-3.5" />
                    <span>Escolher Artista...</span>
                  </span>
                </button>

                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onOpenImportModal();
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-[#252525] hover:bg-[#303030] text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-spotify-green" />
                  <span>Importar Playlist (Spotify/Deezer)</span>
                </button>
              </div>

              {/* Se um Artista estiver ativo no momento */}
              {activeArtist && (
                <div className="px-3.5 py-2 bg-spotify-green/10 border-b border-[#333] flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase font-bold text-spotify-green">Modo Artista Ativo</p>
                    <p className="text-xs font-bold text-white truncate">{activeArtist.name}</p>
                  </div>
                  <Check className="w-4 h-4 text-spotify-green shrink-0" />
                </div>
              )}
              {/* Playlists Personalizadas Importadas */}
              {customPlaylists.length > 0 && (
                <>
                  <div className="px-3.5 py-1.5 border-b border-[#333] mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-spotify-green flex items-center gap-1.5">
                      <ListMusic className="w-3.5 h-3.5" />
                      Minhas Playlists
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {customPlaylists.length}
                    </span>
                  </div>
                  {customPlaylists.map(playlist => {
                    const isSelected = activeCustomPlaylist?.id === playlist.id;
                    return (
                      <div
                        key={playlist.id}
                        className={`w-full px-3.5 py-2 flex items-center justify-between group hover:bg-[#333333] transition-colors ${
                          isSelected ? 'bg-[#2a2a2a]' : ''
                        }`}
                      >
                        <button
                          onClick={() => {
                            onSelectCustomPlaylist(playlist);
                            setIsDropdownOpen(false);
                          }}
                          className="flex-1 text-left min-w-0 pr-2 flex items-center gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-bold truncate ${isSelected ? 'text-spotify-green' : 'text-white'}`}>
                              {playlist.name}
                            </p>
                            <p className="text-[10px] text-spotify-subdued truncate">
                              {playlist.tracks?.length || 0} músicas • {playlist.provider === 'deezer' ? 'Deezer' : 'Spotify'}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isSelected && (
                            <Check className="w-4 h-4 text-spotify-green shrink-0" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCustomPlaylist(playlist.id);
                            }}
                            className="p-1 rounded hover:bg-spotify-red/20 text-neutral-500 hover:text-spotify-red transition-colors opacity-60 hover:opacity-100"
                            title="Excluir playlist salva"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="h-px bg-[#333] my-1.5 mx-2" />
                </>
              )}

              {/* Gêneros Padrão */}
              <div className="px-3.5 py-1.5 border-b border-[#333] mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-spotify-subdued flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-spotify-green" />
                  Gêneros de Clássicos
                </span>
              </div>
              {GENRES.map(genre => {
                const isSelected = !activeCustomPlaylist && genre.id === activeGenreId;
                return (
                  <button
                    key={genre.id}
                    onClick={() => {
                      onSelectGenre(genre.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-[#333333] transition-colors ${
                      isSelected ? 'bg-[#2a2a2a]' : ''
                    }`}
                  >
                    <span className={`text-sm font-semibold ${isSelected ? 'text-spotify-green' : 'text-white'}`}>
                      {genre.name}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-spotify-green shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Botão de Como Jogar */}
        <button
          onClick={onOpenInfo}
          className="p-2 rounded-full hover:bg-spotify-card text-spotify-subdued hover:text-white transition-colors focus:outline-none"
          title="Como Jogar"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Botão de Estatísticas */}
        <button
          onClick={onOpenStats}
          className="p-2 rounded-full hover:bg-spotify-card text-spotify-subdued hover:text-white transition-colors focus:outline-none"
          title="Estatísticas"
        >
          <BarChart2 className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

