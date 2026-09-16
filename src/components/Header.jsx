import React, { useState, useRef, useEffect } from 'react';
import { Music, BarChart2, HelpCircle, ChevronDown, Check, Sparkles } from 'lucide-react';
import { GENRES } from '../config/genres';

export function Header({
  activeGenreId,
  onSelectGenre,
  onOpenStats,
  onOpenInfo,
  totalInGenre = 0,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeGenre = GENRES.find(g => g.id === activeGenreId) || GENRES[0];

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
      <div className="flex items-center gap-2.5 select-none">
        <div className="w-9 h-9 rounded-full bg-spotify-green flex items-center justify-center shadow-lg shadow-spotify-green/20">
          <Music className="w-5 h-5 text-black" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-none">
            Songless
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-spotify-card text-spotify-green border border-spotify-green/30">
              Clássicos
            </span>
          </h1>
          <p className="text-xs text-spotify-subdued leading-tight mt-0.5 hidden sm:block">
            Adivinhe o clássico da música
          </p>
        </div>
      </div>

      {/* Ações Centrais / Direita: Seletor de Gênero & Modais */}
      <div className="flex items-center gap-2">
        {/* Seletor de Categoria / Gênero */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-spotify-card hover:bg-spotify-card-hover border border-[#3e3e3e] transition-all text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-spotify-green"
            title="Trocar Gênero Musical"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: activeGenre.accentColor || '#1DB954' }}
            />
            <span className="max-w-[110px] sm:max-w-none truncate">
              {activeGenre.shortName || activeGenre.name}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-spotify-subdued transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Menu Dropdown de Gêneros */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-spotify-card border border-[#3e3e3e] shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 border-b border-[#333] mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-spotify-subdued flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-spotify-green" />
                  Gêneros de Clássicos
                </span>
              </div>
              {GENRES.map(genre => {
                const isSelected = genre.id === activeGenreId;
                return (
                  <button
                    key={genre.id}
                    onClick={() => {
                      onSelectGenre(genre.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start justify-between hover:bg-[#333333] transition-colors ${
                      isSelected ? 'bg-[#2a2a2a]' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: genre.accentColor }}
                        />
                        <span className={`text-sm font-semibold ${isSelected ? 'text-spotify-green' : 'text-white'}`}>
                          {genre.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-spotify-subdued mt-0.5 pl-4 line-clamp-1">
                        {genre.tagline}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-spotify-green shrink-0 mt-0.5" />
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
