import React, { useState, useRef, useEffect } from 'react';
import { Search, SkipForward, Send, Disc } from 'lucide-react';
import { filterTracksForSearch } from '../services/musicService';
import { ATTEMPT_TIME_LIMITS } from '../hooks/useAudioPlayer';

export function SearchInput({
  catalog = [],
  currentAttemptIndex,
  onGuess,
  onSkip,
  disabled = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedTrack, setSelectedTrack] = useState(null);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Calcula o acréscimo de tempo do próximo pulo
  const nextTimeLimit = currentAttemptIndex < ATTEMPT_TIME_LIMITS.length - 1
    ? ATTEMPT_TIME_LIMITS[currentAttemptIndex + 1]
    : null;

  // Atualiza as sugestões ao digitar
  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      const results = filterTracksForSearch(catalog, searchTerm);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  }, [searchTerm, catalog]);

  // Fecha popup ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Seleciona uma faixa da lista
  const handleSelectTrack = (track) => {
    setSelectedTrack(track);
    setSearchTerm(`${track.title} - ${track.artist}`);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Submete o palpite
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!selectedTrack) return;

    onGuess(selectedTrack);
    setSelectedTrack(null);
    setSearchTerm('');
    setIsOpen(false);
  };

  // Navegação por teclado
  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter' && selectedTrack) {
        handleSubmit(e);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectTrack(suggestions[selectedIndex]);
        } else if (selectedTrack) {
          handleSubmit(e);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 select-none pb-6 sm:pb-8" ref={containerRef}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Container do Input + Dropdown ancorado estritamente abaixo */}
        <div className="relative w-full">
          <div className="relative flex items-center w-full">
            <div className="absolute left-3.5 text-spotify-subdued pointer-events-none z-10">
              <Search className="w-4 h-4" />
            </div>

            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedTrack(null);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) setIsOpen(true);
              }}
              disabled={disabled}
              placeholder="Conhece a música? Digite o artista ou título..."
              className="w-full h-12 pl-10 pr-24 rounded-lg bg-spotify-card border border-[#3e3e3e] focus:border-spotify-green focus:ring-1 focus:ring-spotify-green text-sm text-white placeholder-spotify-subdued transition-all outline-none"
            />

            {/* Botão Enviar */}
            <button
              type="submit"
              disabled={disabled || !selectedTrack}
              className={`absolute right-1.5 px-4 py-2 rounded-md font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all z-10 ${
                selectedTrack && !disabled
                  ? 'bg-spotify-green hover:bg-spotify-green-hover text-black cursor-pointer shadow-md'
                  : 'bg-transparent text-neutral-600 cursor-not-allowed'
              }`}
            >
              <span>Enviar</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dropdown Flutuante de Autocomplete POSICIONADO ESTRITAMENTE ABAIXO DO INPUT */}
          {isOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 max-h-56 sm:max-h-60 overflow-y-auto rounded-xl bg-[#202020] border border-[#3e3e3e] shadow-[0_20px_40px_rgba(0,0,0,0.95)] z-50 py-1.5">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-spotify-subdued border-b border-[#2d2d2d] sticky top-0 bg-[#202020]/95 backdrop-blur z-10">
                Clássicos Sugeridos
              </div>
              {suggestions.map((track, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${track.id}-${idx}`}
                    type="button"
                    onClick={() => handleSelectTrack(track)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                      isSelected ? 'bg-spotify-card-active' : 'hover:bg-[#282828]'
                    }`}
                  >
                    {track.artworkThumb ? (
                      <img
                        src={track.artworkThumb}
                        alt={track.title}
                        className="w-9 h-9 rounded object-cover shrink-0 shadow"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-[#333] flex items-center justify-center shrink-0">
                        <Disc className="w-4 h-4 text-spotify-subdued" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate leading-tight">
                        {track.title}
                      </p>
                      <p className="text-xs text-spotify-subdued truncate leading-tight">
                        {track.artist}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Botão de Pular Tentativa */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={onSkip}
            disabled={disabled}
            className="w-full py-2.5 px-4 rounded-lg bg-spotify-surface hover:bg-spotify-card border border-[#383838] hover:border-neutral-500 text-spotify-subdued hover:text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SkipForward className="w-4 h-4" />
            <span>
              {nextTimeLimit
                ? `Pular (+${nextTimeLimit.toFixed(1)}s)`
                : 'Pular / Revelar Resposta'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
