import { GENRES } from '../config/genres.js';

// Cache em memória para catálogo de músicas por gênero com TTL (10 minutos)
const CACHE_TTL_MS = 10 * 60 * 1000;
const catalogCache = new Map();
const pendingRequests = new Map();

/**
 * Verifica se uma URL de áudio (especialmente do Deezer com token Akamai) está expirada ou prestes a expirar.
 * URLs do Deezer contêm hdnea=exp={timestamp}, com validade padrão de 15 minutos (900s).
 */
export function isPreviewUrlExpired(url) {
  if (!url) return true;
  try {
    const match = url.match(/exp=(\d+)/);
    if (match && match[1]) {
      const expTimestamp = parseInt(match[1], 10);
      const now = Math.floor(Date.now() / 1000);
      // Considera expirado se faltar menos de 60 segundos ou se já venceu
      return now >= (expTimestamp - 60);
    }
  } catch (e) {}
  return false;
}

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
 * Normaliza textos para comparações e buscas insensíveis a acentos,
 * caracteres diacríticos e maiúsculas/minúsculas.
 * Ex: "Não Deixe o Samba Morrer" -> "nao deixe o samba morrer"
 * Ex: "Legião Urbana" -> "legiao urbana"
 * Ex: "Álibi" -> "alibi"
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Converte faixas do Deezer em formato unificado
 */
function normalizeDeezerTracks(items, targetArtist = '') {
  const normTarget = normalizeText(targetArtist);
  return items
    .filter(track => {
      if (!track.preview || !track.title || !(track.artist?.name || track.artist)) return false;
      if (normTarget) {
        const trackArtist = normalizeText(track.artist?.name || track.artist || '');
        const trackTitle = normalizeText(track.title || '');
        const isMatch = trackArtist.includes(normTarget) || normTarget.includes(trackArtist) || trackTitle.includes(normTarget);
        if (!isMatch) return false;
      }
      return true;
    })
    .map(track => {
      const cleanTitle = sanitizeTrackTitle(track.title);
      const artistName = track.artist?.name || track.artist || 'Artista';
      return {
        id: `dz_${track.id}`,
        deezerId: String(track.id),
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
        .then(data => resolve(normalizeDeezerTracks(data.data || [], artistName)))
        .catch(() => resolve([]));
      return;
    }

    const callbackName = 'deezer_cb_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const script = document.createElement('script');

    // Timeout rápido de 3000ms: se o Deezer atrasar ou falhar no mobile, cai imediatamente para a Apple API
    const timer = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 3000);

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
        resolve(normalizeDeezerTracks(data.data, artistName));
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
  // 1. Retorna do cache em memória se já carregado e válido (menos de 10 minutos)
  const cached = catalogCache.get(genreId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS) && cached.catalog?.length > 0) {
    return cached.catalog;
  }

  // 1.5. Verifica cache em sessionStorage para carregamento instantâneo no mobile
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem('songless_cat_' + genreId);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          catalogCache.set(genreId, { catalog: parsed, timestamp: Date.now() });
          return parsed;
        }
      }
    } catch (e) {}
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
      const key = `${normalizeText(track.artist)}|${normalizeText(track.title)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueTracks.push(track);
      }
    }

    const finalizedCatalog = shuffleArray(uniqueTracks);

    // Salva no cache em memória e sessionStorage
    if (finalizedCatalog.length > 0) {
      catalogCache.set(genreId, { catalog: finalizedCatalog, timestamp: Date.now() });
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.setItem('songless_cat_' + genreId, JSON.stringify(finalizedCatalog));
        } catch (e) {}
      }
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
 * Filtra as músicas do catálogo para o autocomplete (insensível a acentuação e tolerante a múltiplos termos)
 */
export function filterTracksForSearch(catalog, query) {
  if (!query || !query.trim() || !catalog || !Array.isArray(catalog)) return [];
  
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return [];
  
  const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);

  return catalog
    .filter(track => {
      const normTitle = normalizeText(track.title);
      const normArtist = normalizeText(track.artist);
      const combined = `${normTitle} ${normArtist}`;

      // Correspondência direta com a busca inteira no título/artista
      if (normTitle.includes(cleanQuery) || normArtist.includes(cleanQuery)) {
        return true;
      }
      // Ou correspondência de todos os termos digitados na combinação (título + artista)
      return queryTokens.every(token => combined.includes(token));
    })
    .slice(0, 10);
}

/**
 * Busca preview e dados de uma faixa específica via Deezer (JSONP) ou Apple Search API
 */
export async function searchTrackPreviewFallback(trackTitle, artistName) {
  const query = `${artistName} ${trackTitle}`.trim();
  if (!query) return null;

  // 1. Tenta Deezer via JSONP
  const deezerResult = await new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`)
        .then(r => r.json())
        .then(data => {
          const t = data.data?.[0];
          resolve(t?.preview ? {
            previewUrl: t.preview,
            artwork: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '',
            artworkThumb: t.album?.cover_small || '',
            trackViewUrl: t.link || '',
          } : null);
        })
        .catch(() => resolve(null));
      return;
    }

    const callbackName = 'dz_track_cb_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); resolve(null); }, 4000);

    const cleanup = () => {
      clearTimeout(timer);
      try { window[callbackName] = () => {}; } catch (e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[callbackName] = (data) => {
      cleanup();
      const t = data?.data?.[0];
      if (t?.preview) {
        resolve({
          previewUrl: t.preview,
          artwork: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '',
          artworkThumb: t.album?.cover_small || '',
          trackViewUrl: t.link || '',
        });
      } else {
        resolve(null);
      }
    };

    script.onerror = () => { cleanup(); resolve(null); };
    script.src = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1&output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });

  if (deezerResult) return deezerResult;

  // 2. Fallback para Apple Search
  try {
    const appleUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1&country=BR`;
    const res = await fetch(appleUrl);
    const data = await res.json();
    const item = data?.results?.[0];
    if (item?.previewUrl) {
      return {
        previewUrl: item.previewUrl,
        artwork: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '',
        artworkThumb: item.artworkUrl100 || '',
        trackViewUrl: item.trackViewUrl || '',
      };
    }
  } catch (e) {}

  return null;
}

/**
 * Busca uma faixa específica por ID no Deezer para obter um novo token de preview válido
 */
export function fetchDeezerTrackById(trackId) {
  const cleanId = String(trackId).replace(/^dz_art_|^dz_|^pl_dz_/, '');
  if (!cleanId || isNaN(Number(cleanId))) return Promise.resolve(null);

  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      fetch(`https://api.deezer.com/track/${cleanId}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.preview) {
            resolve({
              previewUrl: data.preview,
              deezerId: String(data.id),
              artwork: data.album?.cover_xl || data.album?.cover_big || data.album?.cover_medium || '',
              artworkThumb: data.album?.cover_small || '',
            });
          } else {
            resolve(null);
          }
        })
        .catch(() => resolve(null));
      return;
    }

    const callbackName = 'dz_track_id_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); resolve(null); }, 5000);

    const cleanup = () => {
      clearTimeout(timer);
      try { window[callbackName] = () => {}; } catch (e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[callbackName] = (data) => {
      cleanup();
      if (data && data.preview) {
        resolve({
          previewUrl: data.preview,
          deezerId: String(data.id),
          artwork: data.album?.cover_xl || data.album?.cover_big || data.album?.cover_medium || '',
          artworkThumb: data.album?.cover_small || '',
        });
      } else {
        resolve(null);
      }
    };

    script.onerror = () => { cleanup(); resolve(null); };
    script.src = `https://api.deezer.com/track/${cleanId}?output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

/**
 * Garante uma URL de áudio válida e renovada para a música (resolve URLs expiradas do Deezer)
 */
export async function refreshTrackPreview(track) {
  if (!track) return null;

  // Se a URL ainda for válida e não estiver expirando, mantém
  if (track.previewUrl && !isPreviewUrlExpired(track.previewUrl)) {
    return track.previewUrl;
  }

  console.log(`[MusicService] Renovando áudio de "${track.title}" (${track.artist})...`);

  // 1. Tenta renovar pelo Deezer ID direto
  const deezerId = track.deezerId || (track.id ? String(track.id).replace(/^dz_art_|^dz_|^pl_dz_/, '') : null);
  if (deezerId && !isNaN(Number(deezerId))) {
    try {
      const refreshed = await fetchDeezerTrackById(deezerId);
      if (refreshed?.previewUrl) {
        track.previewUrl = refreshed.previewUrl;
        track.deezerId = deezerId;
        if (refreshed.artwork && !track.artwork) track.artwork = refreshed.artwork;
        if (refreshed.artworkThumb && !track.artworkThumb) track.artworkThumb = refreshed.artworkThumb;
        console.log(`[MusicService] Áudio renovado com sucesso via Deezer ID: ${deezerId}`);
        return refreshed.previewUrl;
      }
    } catch (e) {
      console.warn('[MusicService] Falha ao renovar via Deezer ID:', e);
    }
  }

  // 2. Fallback: busca online por título e artista
  try {
    const queryArtist = track.artist || '';
    const queryTitle = track.originalTitle || track.title || '';
    const fallback = await searchTrackPreviewFallback(queryTitle, queryArtist);
    if (fallback?.previewUrl) {
      track.previewUrl = fallback.previewUrl;
      if (fallback.artwork && !track.artwork) track.artwork = fallback.artwork;
      if (fallback.artworkThumb && !track.artworkThumb) track.artworkThumb = fallback.artworkThumb;
      console.log(`[MusicService] Áudio renovado com sucesso via busca online: "${queryTitle}"`);
      return fallback.previewUrl;
    }
  } catch (e) {
    console.warn('[MusicService] Falha ao renovar via busca online:', e);
  }

  return track.previewUrl || null;
}


