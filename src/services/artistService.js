import { sanitizeTrackTitle } from './musicService.js';
import { GENRES } from '../config/genres.js';

// Cache em memória para catálogos de artistas com TTL (10 minutos)
const CACHE_TTL_MS = 10 * 60 * 1000;
const artistCatalogCache = new Map();

/**
 * Monta lista inicial de artistas com base nos gêneros cadastrados
 */
export function getCuratedArtists() {
  const list = [];
  for (const genre of GENRES) {
    for (const artistName of genre.artists) {
      list.push({
        id: `curated_${artistName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: artistName,
        genreId: genre.id,
        genreName: genre.shortName || genre.name,
        picture: null,
      });
    }
  }
  return list;
}

/**
 * Busca artistas na API do Deezer via JSONP no navegador (sem CORS)
 */
export function searchArtistsOnline(query) {
  if (!query || !query.trim()) return Promise.resolve([]);

  return new Promise((resolve) => {
    const cleanQuery = query.trim();

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(cleanQuery)}&limit=10`)
        .then(r => r.json())
        .then(data => {
          resolve((data.data || []).map(normalizeDeezerArtist));
        })
        .catch(() => resolve([]));
      return;
    }

    const callbackName = 'dz_art_search_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 6000);

    const cleanup = () => {
      clearTimeout(timer);
      try { window[callbackName] = () => {}; } catch (e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[callbackName] = (data) => {
      cleanup();
      if (data && Array.isArray(data.data)) {
        resolve(data.data.map(normalizeDeezerArtist));
      } else {
        resolve([]);
      }
    };

    script.onerror = () => {
      cleanup();
      resolve([]);
    };

    script.src = `https://api.deezer.com/search/artist?q=${encodeURIComponent(cleanQuery)}&limit=10&output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

function normalizeDeezerArtist(artist) {
  return {
    id: String(artist.id),
    name: artist.name,
    picture: artist.picture_medium || artist.picture_big || artist.picture_small || null,
    fans: artist.nb_fan || 0,
    link: artist.link || '',
  };
}

/**
 * Busca faixas mais tocadas de um artista pelo ID no Deezer
 */
function fetchDeezerTopTracksById(artistId) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      fetch(`https://api.deezer.com/artist/${artistId}/top?limit=50`)
        .then(r => r.json())
        .then(data => resolve(data.data || []))
        .catch(() => resolve([]));
      return;
    }

    const callbackName = 'dz_art_top_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 8000);

    const cleanup = () => {
      clearTimeout(timer);
      try { window[callbackName] = () => {}; } catch (e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[callbackName] = (data) => {
      cleanup();
      if (data && Array.isArray(data.data)) {
        resolve(data.data);
      } else {
        resolve([]);
      }
    };

    script.onerror = () => {
      cleanup();
      resolve([]);
    };

    script.src = `https://api.deezer.com/artist/${artistId}/top?limit=50&output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

/**
 * Busca faixas por texto no Deezer (segundo fallback)
 */
function searchDeezerTracksByQuery(artistName) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      fetch(`https://api.deezer.com/search?q=${encodeURIComponent(artistName)}&limit=40`)
        .then(r => r.json())
        .then(data => resolve(data.data || []))
        .catch(() => resolve([]));
      return;
    }

    const callbackName = 'dz_art_q_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 8000);

    const cleanup = () => {
      clearTimeout(timer);
      try { window[callbackName] = () => {}; } catch (e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[callbackName] = (data) => {
      cleanup();
      if (data && Array.isArray(data.data)) {
        resolve(data.data);
      } else {
        resolve([]);
      }
    };

    script.onerror = () => {
      cleanup();
      resolve([]);
    };

    script.src = `https://api.deezer.com/search?q=${encodeURIComponent(artistName)}&limit=40&output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

/**
 * Fallback Apple Search API para catálogo do artista
 */
async function fetchAppleArtistTracks(artistName) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&limit=40&country=BR`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results
      .filter(t => t.previewUrl && t.trackName)
      .map(t => {
        const cleanTitle = sanitizeTrackTitle(t.trackName);
        return {
          id: `ap_${t.trackId}`,
          title: cleanTitle || t.trackName,
          originalTitle: t.trackName,
          artist: t.artistName,
          album: t.collectionName || 'Single / Álbum',
          previewUrl: t.previewUrl,
          artwork: t.artworkUrl100 ? t.artworkUrl100.replace('100x100bb', '600x600bb') : '',
          artworkThumb: t.artworkUrl100 || '',
          trackViewUrl: t.trackViewUrl || '',
          provider: 'apple',
          releaseYear: t.releaseDate ? new Date(t.releaseDate).getFullYear() : null,
        };
      });
  } catch (e) {
    return [];
  }
}

/**
 * Carrega o catálogo completo e exclusivo para um artista
 * Ex: Detonautas -> retorna faixas apenas de Detonautas
 */
export async function fetchArtistCatalog(artistName, knownArtistId = null, knownPicture = null) {
  const cacheKey = (knownArtistId || artistName).toLowerCase().trim();
  const cached = artistCatalogCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS) && cached.data) {
    return cached.data;
  }

  let artistId = knownArtistId;
  let picture = knownPicture;
  let realArtistName = artistName;

  // 1. Se não tiver ID do Deezer, busca pelo nome para obter ID e foto
  if (!artistId || isNaN(Number(artistId))) {
    const onlineResults = await searchArtistsOnline(artistName);
    if (onlineResults && onlineResults.length > 0) {
      // Prioriza correspondência exata ou primeiro resultado
      const exactMatch = onlineResults.find(
        a => a.name.toLowerCase().trim() === artistName.toLowerCase().trim()
      );
      const chosen = exactMatch || onlineResults[0];
      artistId = chosen.id;
      picture = chosen.picture;
      realArtistName = chosen.name;
    }
  }

  let rawTracks = [];

  // 2. Se temos ID do artista, busca o top 50 faixas dele
  if (artistId && !isNaN(Number(artistId))) {
    rawTracks = await fetchDeezerTopTracksById(artistId);
  }

  // 3. Se o top do Deezer retornou poucas faixas, tenta search geral por artista no Deezer
  if (!rawTracks || rawTracks.length < 10) {
    const searchTracks = await searchDeezerTracksByQuery(realArtistName);
    if (searchTracks && searchTracks.length > 0) {
      rawTracks = [...rawTracks, ...searchTracks];
    }
  }

  // 4. Normaliza as faixas do Deezer
  const normalizedTracks = [];
  for (const t of rawTracks) {
    if (!t.preview || !t.title) continue;

    // Filtra para garantir que o artista é o esperado
    const trackArtist = t.artist?.name || t.artist || '';
    const cleanTitle = sanitizeTrackTitle(t.title);

    normalizedTracks.push({
      id: `dz_${t.id}`,
      deezerId: String(t.id),
      title: cleanTitle || t.title,
      originalTitle: t.title,
      artist: trackArtist || realArtistName,
      album: t.album?.title || 'Single / Álbum',
      previewUrl: t.preview,
      artwork: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || picture || '',
      artworkThumb: t.album?.cover_small || picture || '',
      trackViewUrl: t.link || `https://www.deezer.com/track/${t.id}`,
      provider: 'deezer',
      releaseYear: null,
    });
  }

  // 5. Fallback para Apple Music se Deezer retornar menos de 5 faixas
  if (normalizedTracks.length < 5) {
    const appleTracks = await fetchAppleArtistTracks(realArtistName);
    normalizedTracks.push(...appleTracks);
  }

  // 6. Desduplica faixas por título (removendo versões repetidas ao vivo / estúdio)
  const seenTitles = new Set();
  const uniqueTracks = [];

  for (const t of normalizedTracks) {
    const key = t.title.toLowerCase().trim();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      uniqueTracks.push(t);
    }
  }

  // Embaralha para variedade
  const shuffledTracks = [...uniqueTracks];
  for (let i = shuffledTracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledTracks[i], shuffledTracks[j]] = [shuffledTracks[j], shuffledTracks[i]];
  }

  const result = {
    id: `artist_${artistId || realArtistName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name: realArtistName,
    picture: picture || '',
    tracks: shuffledTracks,
  };

  if (shuffledTracks.length > 0) {
    artistCatalogCache.set(cacheKey, { data: result, timestamp: Date.now() });
  }

  return result;
}
