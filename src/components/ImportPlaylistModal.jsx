import React, { useState } from 'react';
import { X, Link2, Music2, Sparkles, AlertCircle, Loader2, CheckCircle, ExternalLink, HelpCircle } from 'lucide-react';
import { importPlaylistFromInput, saveCustomPlaylist } from '../services/playlistService';

// Exemplos rápidos para testar com 1 clique
const PRESET_EXAMPLES = [
  {
    name: "Today's Top Hits (Spotify)",
    url: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
  },
  {
    name: "RapCaviar (Spotify)",
    url: "https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd",
  },
  {
    name: "Top Worldwide (Deezer)",
    url: "https://www.deezer.com/playlist/3155776842",
  },
];

export function ImportPlaylistModal({ isOpen, onClose, onImportSuccess }) {
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  if (!isOpen) return null;

  const handleImport = async (urlToUse) => {
    const targetUrl = (urlToUse || urlInput).trim();
    if (!targetUrl) {
      setErrorMessage('Por favor, cole o link da playlist.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const playlist = await importPlaylistFromInput(targetUrl);
      // Salva no localStorage para persistência
      saveCustomPlaylist(playlist);
      onImportSuccess(playlist);
      setUrlInput('');
      onClose();
    } catch (err) {
      console.error('[ImportPlaylistModal] Erro:', err);
      setErrorMessage(err.message || 'Erro ao importar playlist. Verifique se o link está correto e a playlist é pública.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrlInput(text.trim());
          setErrorMessage(null);
        }
      }
    } catch (e) {
      // Falha silenciosa de permissão de clipboard
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-spotify-card border border-[#3e3e3e] rounded-2xl p-6 shadow-2xl flex flex-col text-white animate-in zoom-in-95 duration-200">
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#333] text-spotify-subdued hover:text-white transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho do Modal */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-spotify-green/20 border border-spotify-green/40 flex items-center justify-center text-spotify-green shadow-lg shadow-spotify-green/10">
            <Music2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Importar Playlist
            </h2>
            <p className="text-xs text-spotify-subdued">
              Jogue adivinhando exclusivamente as faixas da sua playlist
            </p>
          </div>
        </div>

        {/* Formulário de Importação */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleImport();
          }}
          className="mt-4 flex flex-col gap-4"
        >
          <div>
            <label className="block text-xs font-bold text-spotify-subdued uppercase tracking-wider mb-2">
              Link da Playlist (Spotify ou Deezer)
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-spotify-subdued pointer-events-none">
                <Link2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setErrorMessage(null);
                }}
                disabled={isLoading}
                placeholder="https://open.spotify.com/playlist/..."
                className="w-full h-12 pl-10 pr-20 rounded-xl bg-[#181818] border border-[#3e3e3e] focus:border-spotify-green focus:ring-1 focus:ring-spotify-green text-sm text-white placeholder:text-neutral-500 transition-all outline-none"
              />
              <button
                type="button"
                onClick={handlePasteClipboard}
                disabled={isLoading}
                className="absolute right-2 px-3 py-1.5 rounded-lg bg-[#282828] hover:bg-[#333] text-[11px] font-semibold text-spotify-subdued hover:text-white transition-colors"
              >
                Colar
              </button>
            </div>
          </div>

          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-spotify-red/10 border border-spotify-red/30 text-spotify-red text-xs leading-relaxed animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Exemplos para testar rapidamente */}
          <div>
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
              Testar com exemplos rápidos:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_EXAMPLES.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    setUrlInput(preset.url);
                    handleImport(preset.url);
                  }}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-full bg-[#202020] hover:bg-[#303030] border border-[#383838] text-[11px] text-spotify-subdued hover:text-white transition-all disabled:opacity-50"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Dicas de Como Copiar Link */}
          <div className="bg-[#141414] border border-[#262626] rounded-xl p-3.5 text-xs text-spotify-subdued">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="w-full flex items-center justify-between font-semibold text-white text-xs hover:text-spotify-green transition-colors text-left"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-spotify-green" />
                Como pegar o link público da playlist?
              </span>
              <span className="text-[10px] text-neutral-500 uppercase">
                {showHelp ? 'Ocultar' : 'Ver passos'}
              </span>
            </button>

            {showHelp && (
              <div className="mt-2.5 pt-2.5 border-t border-[#222] space-y-1.5 text-[11px] text-neutral-400 animate-in fade-in">
                <p>1. No Spotify, abra a playlist que você deseja usar.</p>
                <p>2. Clique nos <strong>três pontinhos (···)</strong> ao lado do botão de Play.</p>
                <p>3. Selecione <strong>Compartilhar</strong> → <strong>Copiar link da playlist</strong>.</p>
                <p className="text-spotify-green pt-0.5">
                  ★ Importante: A playlist precisa ser pública para que o Songless consiga carregar as faixas!
                </p>
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 px-4 rounded-full bg-transparent hover:bg-white/5 border border-[#3e3e3e] text-xs font-bold uppercase tracking-wider text-neutral-300 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !urlInput.trim()}
              className="flex-1 py-3 px-4 rounded-full bg-spotify-green hover:bg-spotify-green-hover text-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-spotify-green/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Importar e Jogar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
