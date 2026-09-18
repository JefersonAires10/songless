import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Mic2, Sparkles, Loader2, Check, User, Music } from 'lucide-react';
import { getCuratedArtists, searchArtistsOnline } from '../services/artistService.js';
import { normalizeText } from '../services/musicService.js';
import { GENRES } from '../config/genres.js';

export function ArtistSelectModal({
  isOpen,
  onClose,
  onSelectArtist,
  activeArtistName = null,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenreId, setSelectedGenreId] = useState('all');
  const [onlineResults, setOnlineResults] = useState([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  
  const searchTimeoutRef = useRef(null);
  const curatedList = useMemo(() => getCuratedArtists(), []);

  // Limpa busca ao fechar
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setOnlineResults([]);
      setIsSearchingOnline(false);
      setSelectedGenreId('all');
    }
  }, [isOpen]);

  // Busca online com debounce ao digitar
  useEffect(() => {
    const query = searchTerm.trim();
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.length < 2) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    setIsSearchingOnline(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchArtistsOnline(query);
        setOnlineResults(results);
      } catch (err) {
        console.warn('[ArtistSelectModal] Erro busca online:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  // Artistas filtrados localmente por gênero e texto (insensível a acentos)
  const filteredCurated = useMemo(() => {
    let list = curatedList;

    if (selectedGenreId !== 'all') {
      list = list.filter(a => a.genreId === selectedGenreId);
    }

    if (searchTerm.trim()) {
      const q = normalizeText(searchTerm);
      list = list.filter(a => normalizeText(a.name).includes(q));
    }

    return list;
  }, [curatedList, selectedGenreId, searchTerm]);

  if (!isOpen) return null;

  const isSearching = searchTerm.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-spotify-card border border-[#3e3e3e] rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] text-white animate-in zoom-in-95 duration-200">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#333] text-spotify-subdued hover:text-white transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-spotify-green/20 border border-spotify-green/40 flex items-center justify-center text-spotify-green shadow-lg shadow-spotify-green/10">
            <Mic2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Escolha um Artista
            </h2>
            <p className="text-xs text-spotify-subdued">
              Adivinhe músicas exclusivamente do seu cantor ou banda favorita
            </p>
          </div>
        </div>

        {/* Campo de Busca */}
        <div className="relative my-2">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-spotify-subdued pointer-events-none">
            {isSearchingOnline ? (
              <Loader2 className="w-4 h-4 text-spotify-green animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar qualquer artista (ex: Detonautas, Legião Urbana, Queen...)"
            autoFocus
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#181818] border border-[#3e3e3e] focus:border-spotify-green focus:ring-1 focus:ring-spotify-green text-sm text-white placeholder:text-neutral-500 transition-all outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtro de Categorias por Pílulas (visível quando não está pesquisando) */}
        {!isSearching && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 scrollbar-none text-xs">
            <button
              onClick={() => setSelectedGenreId('all')}
              className={`px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all ${
                selectedGenreId === 'all'
                  ? 'bg-spotify-green text-black shadow-sm'
                  : 'bg-[#202020] text-spotify-subdued hover:text-white border border-[#333]'
              }`}
            >
              Todos os Destaques
            </button>
            {GENRES.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGenreId(g.id)}
                className={`px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all ${
                  selectedGenreId === g.id
                    ? 'bg-spotify-green text-black shadow-sm'
                    : 'bg-[#202020] text-spotify-subdued hover:text-white border border-[#333]'
                }`}
              >
                {g.shortName || g.name}
              </button>
            ))}
          </div>
        )}

        {/* Área de Listagem com Scroll */}
        <div className="flex-1 overflow-y-auto pr-1 mt-2 space-y-4 max-h-[55vh]">
          {/* Se estiver buscando online e houver resultados de pesquisa global */}
          {isSearching && onlineResults.length > 0 && (
            <div>
              <div className="px-1 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-spotify-green flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Resultados da Busca Global
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {onlineResults.map((artist) => {
                  const isSelected = normalizeText(activeArtistName) === normalizeText(artist.name);
                  return (
                    <button
                      key={artist.id}
                      onClick={() => {
                        onSelectArtist(artist);
                        onClose();
                      }}
                      className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                        isSelected
                          ? 'bg-spotify-green/15 border-spotify-green text-spotify-green shadow-md'
                          : 'bg-[#181818] border-[#303030] hover:border-spotify-green/60 hover:bg-[#222]'
                      }`}
                    >
                      {artist.picture ? (
                        <img
                          src={artist.picture}
                          alt={artist.name}
                          className="w-11 h-11 rounded-full object-cover shrink-0 shadow border border-white/10"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#282828] flex items-center justify-center shrink-0 border border-white/10">
                          <User className="w-5 h-5 text-spotify-subdued" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-spotify-green' : 'text-white'}`}>
                          {artist.name}
                        </p>
                        <p className="text-[10px] text-spotify-subdued truncate">
                          {artist.fans ? `${Number(artist.fans).toLocaleString('pt-BR')} fãs` : 'Artista'}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-spotify-green shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Artistas em Destaque Curados */}
          <div>
            {isSearching && (
              <div className="px-1 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-spotify-subdued">
                  Artistas em Destaque
                </span>
              </div>
            )}
            {filteredCurated.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredCurated.map((artist) => {
                  const isSelected = normalizeText(activeArtistName) === normalizeText(artist.name);
                  return (
                    <button
                      key={artist.id}
                      onClick={() => {
                        onSelectArtist(artist);
                        onClose();
                      }}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                        isSelected
                          ? 'bg-spotify-green/15 border-spotify-green text-spotify-green shadow-md'
                          : 'bg-[#181818] border-[#303030] hover:border-spotify-green/60 hover:bg-[#222]'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-spotify-green/20 border border-spotify-green/30 text-spotify-green flex items-center justify-center shrink-0 font-bold text-xs font-mono">
                        {artist.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-spotify-green' : 'text-white'}`}>
                          {artist.name}
                        </p>
                        <p className="text-[10px] text-spotify-subdued truncate">
                          {artist.genreName}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-spotify-green shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : !isSearching ? (
              <div className="py-12 text-center text-xs text-spotify-subdued">
                Nenhum artista encontrado para esta categoria.
              </div>
            ) : null}
          </div>

          {/* Caso nada seja encontrado na busca local nem global */}
          {isSearching && !isSearchingOnline && onlineResults.length === 0 && filteredCurated.length === 0 && (
            <div className="py-12 text-center text-xs text-spotify-subdued">
              Nenhum artista encontrado com o nome "{searchTerm}". Tente digitar o nome completo.
            </div>
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="mt-3 pt-3 border-t border-[#2d2d2d] flex items-center justify-between text-[11px] text-spotify-subdued">
          <span>Ao escolher um artista, a adivinhação será apenas com músicas dele.</span>
          <button
            onClick={onClose}
            className="text-white hover:text-spotify-green font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
