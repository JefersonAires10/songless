import { GENRES } from '../config/genres.js';

// Cache em memória para catálogo de músicas por gênero
const catalogCache = new Map();
const pendingRequests = new Map();

/**
 * Embaralha array com Fisher-Yates
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
 * Converte faixas do Deezer em formato unificado
 */
function normalizeDeezerTracks(items) {
  return items
    .filter(track => track.preview && track.title && (track.artist?.name || track.artist))
    .map(track => {
      const cleanTitle = sanitizeTrackTitle(track.title);
      const artistName = track.artist?.name || track.artist || 'Artista';
      return {
        id: `dz_${track.id}`,
        title: cleanTitle || track.title,
        originalTitle: track.title,
        artist: artistName,
        album: track.album?.title || 'Single / Álbum',
        previewUrl: track.preview,
        artwork: track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || '',
        artworkThumb: track.album?.cover_small || track.album?.cover_medium || '',
        trackViewUrl: track.link || '',
        releaseYear: null,
      };
    });
}

/**
 * Busca faixas no Deezer via JSONP no browser (sem restrições de CORS)
 * O Deezer garante que o áudio de preview comece estritamente em 0:00 (INTRODUÇÃO da música).
 */
function fetchDeezerArtistTracks(artistName) {
  return new Promise((resolve) => {
    // Se estiver em ambiente Node/teste, faz fetch direto
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      fetch(`https://api.deezer.com/search?q=${encodeURIComponent(artistName)}&limit=5`)
        .then(r => r.json())
        .then(data => resolve(normalizeDeezerTracks(data.data || [])))
        .catch(() => resolve([]));
      return;
    }

    const callbackName = 'deezer_cb_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 8000);

    const cleanup = () => {
      clearTimeout(timer);
      try {
        window[callbackName] = () => {}; // Mantém no-op para não estourar erro se a resposta chegar atrasada
      } catch (e) {}
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    window[callbackName] = (data) => {
      cleanup();
      if (data && Array.isArray(data.data)) {
        resolve(normalizeDeezerTracks(data.data));
      } else {
        resolve([]);
      }
    };

    script.onerror = () => {
      cleanup();
      resolve([]);
    };

    script.src = `https://api.deezer.com/search?q=${encodeURIComponent(artistName)}&limit=5&output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

/**
 * Fallback via Apple Search API caso o Deezer não retorne resultados para um artista específico
 */
async function fetchAppleArtistTracks(artistName) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&limit=5&country=BR`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results
      .filter(track => track.previewUrl && track.trackName && track.artistName)
      .map(track => {
        const cleanTitle = sanitizeTrackTitle(track.trackName);
        return {
          id: `ap_${track.trackId}`,
          title: cleanTitle || track.trackName,
          originalTitle: track.trackName,
          artist: track.artistName,
          album: track.collectionName || 'Single / Álbum',
          previewUrl: track.previewUrl,
          artwork: track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : '',
          artworkThumb: track.artworkUrl100,
          trackViewUrl: track.trackViewUrl,
          releaseYear: track.releaseDate ? new Date(track.releaseDate).getFullYear() : null,
        };
      });
  } catch (error) {
    clearTimeout(timeoutId);
    return [];
  }
}

/**
 * Busca faixas de um artista priorizando Deezer (para introdução da música em 0:00)
 * com fallback para Apple API
 */
async function fetchArtistTopTracks(artistName) {
  const deezerTracks = await fetchDeezerArtistTracks(artistName);
  if (deezerTracks && deezerTracks.length > 0) {
    return deezerTracks;
  }
  return await fetchAppleArtistTracks(artistName);
}

/**
 * Carrega o catálogo do gênero selecionado com deduplicação de requisições e cache permanente
 */
export async function fetchGenreCatalog(genreId) {
  // 1. Retorna do cache em memória se já carregado
  if (catalogCache.has(genreId) && catalogCache.get(genreId).length > 0) {
    return catalogCache.get(genreId);
  }

  // 2. Reutiliza requisição em andamento para o mesmo gênero
  if (pendingRequests.has(genreId)) {
    return pendingRequests.get(genreId);
  }

  const genre = GENRES.find(g => g.id === genreId);
  if (!genre) {
    throw new Error(`Gênero "${genreId}" não encontrado.`);
  }

  const loadPromise = (async () => {
    // Busca todos os artistas consagrados do gênero
    const fetchPromises = genre.artists.map(artist => fetchArtistTopTracks(artist));
    const settledResults = await Promise.allSettled(fetchPromises);

    const rawTracks = [];
    for (const result of settledResults) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        rawTracks.push(...result.value);
      }
    }

    // Desduplica faixas (mesmo artista e título)
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
