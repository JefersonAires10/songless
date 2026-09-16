import { GENRES } from '../config/genres.js';

// Cache em memória para catálogo de músicas por gênero
const catalogCache = new Map();
const pendingRequests = new Map();

/**
 * Limpa títulos removendo sufixos redundantes de remasters ou coletâneas
 */
export function sanitizeTrackTitle(title) {
  if (!title) return '';
  return title
    .replace(/\s*-\s*Remaster(ed)?(\s*\d{4})?/gi, '')
    .replace(/\s*\(\s*Remaster(ed)?(\s*\d{4})?\s*\)/gi, '')
    .replace(/\s*-\s*\d{4}\s*Remaster/gi, '')
    .replace(/\s*\(\s*\d{4}\s*Remaster\s*\)/gi, '')
    .replace(/\s*-\s*Live(\s*At\s*.*)?/gi, '')
    .replace(/\s*\(\s*Live(\s*At\s*.*)?\s*\)/gi, '')
    .replace(/\s*-\s*Ao Vivo/gi, '')
    .replace(/\s*\(\s*Ao Vivo\s*\)/gi, '')
    .replace(/\s*-\s*Radio Edit/gi, '')
    .replace(/\s*\[.*\]/g, '')
    .trim();
}

/**
 * Obtém URL da capa em alta resolução (600x600) a partir da URL padrão de 100x100 da Apple
 */
export function getHighResArtwork(url) {
  if (!url) return '';
  return url.replace('100x100bb', '600x600bb');
}

/**
 * Embaralha um array utilizando o algoritmo de Fisher-Yates
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Realiza a busca das músicas de maior relevância (limit=4) para um artista
 * através da Apple Search API (sem necessidade de backend ou tokens).
 */
async function fetchArtistTopTracks(artistName) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&limit=4&country=BR`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`[Apple API] Status ${response.status} para ${artistName}`);
      return [];
    }

    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results
      .filter(track => track.previewUrl && track.trackName && track.artistName)
      .map(track => {
        const cleanTitle = sanitizeTrackTitle(track.trackName);
        return {
          id: track.trackId,
          title: cleanTitle || track.trackName,
          originalTitle: track.trackName,
          artist: track.artistName,
          album: track.collectionName || 'Single / Álbum',
          previewUrl: track.previewUrl,
          artwork: getHighResArtwork(track.artworkUrl100),
          artworkThumb: track.artworkUrl100,
          trackViewUrl: track.trackViewUrl,
          releaseYear: track.releaseDate ? new Date(track.releaseDate).getFullYear() : null,
        };
      });
  } catch (error) {
    console.warn(`[Apple API] Falha na busca de "${artistName}":`, error);
    return [];
  }
}

/**
 * Carrega o catálogo de um gênero disparando requisições paralelas.
 * Deduplica requisições concorrentes e armazena em cache permanente em memória.
 */
export async function fetchGenreCatalog(genreId) {
  // 1. Retorna do cache se já carregado
  if (catalogCache.has(genreId) && catalogCache.get(genreId).length > 0) {
    return catalogCache.get(genreId);
  }

  // 2. Se já houver uma requisição em andamento para este gênero, reutiliza a Promise
  if (pendingRequests.has(genreId)) {
    return pendingRequests.get(genreId);
  }

  const genre = GENRES.find(g => g.id === genreId);
  if (!genre) {
    throw new Error(`Gênero "${genreId}" não encontrado.`);
  }

  const loadPromise = (async () => {
    const fetchPromises = genre.artists.map(artist => fetchArtistTopTracks(artist));
    const settledResults = await Promise.allSettled(fetchPromises);

    const rawTracks = [];
    for (const result of settledResults) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        rawTracks.push(...result.value);
      }
    }

    // Desduplica faixas
    const seenKeys = new Set();
    const uniqueTracks = [];

    for (const track of rawTracks) {
      const key = `${track.artist.toLowerCase().trim()}|${track.title.toLowerCase().trim()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueTracks.push(track);
      }
    }

    const finalizedCatalog = shuffleArray(uniqueTracks);

    // Salva no cache
    if (finalizedCatalog.length > 0) {
      catalogCache.set(genreId, finalizedCatalog);
    }

    return finalizedCatalog;
  })();

  pendingRequests.set(genreId, loadPromise);

  try {
    const result = await loadPromise;
    return result;
  } finally {
    pendingRequests.delete(genreId);
  }
}

/**
 * Pré-carrega todos os outros gêneros em segundo plano.
 * Permite alternância instantânea entre gêneros sem espera ou erros.
 */
export function preloadAllGenres(excludeGenreId) {
  const genresToPreload = GENRES.filter(g => g.id !== excludeGenreId);
  
  // Executa com leve atraso para não competir com a primeira rodada
  setTimeout(() => {
    genresToPreload.forEach(genre => {
      if (!catalogCache.has(genre.id) && !pendingRequests.has(genre.id)) {
        fetchGenreCatalog(genre.id).catch(err => {
          console.warn(`[Preload] Aviso ao pré-carregar ${genre.name}:`, err);
        });
      }
    });
  }, 1000);
}

/**
 * Retorna uma música aleatória do catálogo de um gênero
 */
export function getRandomTrackFromCatalog(catalog, excludeIds = []) {
  if (!catalog || catalog.length === 0) return null;

  const available = catalog.filter(t => !excludeIds.includes(t.id));
  const pool = available.length > 0 ? available : catalog;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

/**
 * Filtra as músicas do catálogo para o autocomplete
 */
export function filterTracksForSearch(catalog, query) {
  if (!query || !query.trim() || !catalog) return [];
  
  const cleanQuery = query.toLowerCase().trim();
  
  return catalog
    .filter(track => {
      const matchTitle = track.title.toLowerCase().includes(cleanQuery);
      const matchArtist = track.artist.toLowerCase().includes(cleanQuery);
      return matchTitle || matchArtist;
    })
    .slice(0, 8);
}
