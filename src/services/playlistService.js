import { sanitizeTrackTitle, searchTrackPreviewFallback, normalizeText } from './musicService.js';

const PLAYLISTS_STORAGE_KEY = 'songless_custom_playlists_v1';

/**
 * Identifica o provedor e extrai o ID a partir de um link, URI ou ID direto
 */
export function parsePlaylistUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. Spotify Álbum
  // Ex: https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=...
  // Ex: https://open.spotify.com/intl-pt/album/4m2880jivSbbyEGAKfITCa
  // Ex: spotify:album:4m2880jivSbbyEGAKfITCa
  const spotifyAlbum = trimmed.match(/(?:spotify\.com\/(?:[a-zA-Z0-9_-]+\/)*album\/|spotify:album:)([a-zA-Z0-9]{22})/i);
  if (spotifyAlbum) {
    return { provider: 'spotify', type: 'album', id: spotifyAlbum[1] };
  }

  // 2. Spotify Playlist
  // Ex: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
  // Ex: https://open.spotify.com/intl-pt/playlist/37i9dQZF1DXcBWIGoYBM5M
  // Ex: spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  const spotifyPlaylist = trimmed.match(/(?:spotify\.com\/(?:[a-zA-Z0-9_-]+\/)*playlist\/|spotify:playlist:)([a-zA-Z0-9]{22})/i);
  if (spotifyPlaylist) {
    return { provider: 'spotify', type: 'playlist', id: spotifyPlaylist[1] };
  }

  // 3. Deezer Álbum
  // Ex: https://www.deezer.com/album/302127
  // Ex: https://www.deezer.com/br/album/302127
  // Ex: deezer:album:302127
  const deezerAlbum = trimmed.match(/(?:deezer\.com\/(?:[a-zA-Z0-9_-]+\/)*album\/|deezer:album:)(\d+)/i);
  if (deezerAlbum) {
    return { provider: 'deezer', type: 'album', id: deezerAlbum[1] };
  }

  // 4. Deezer Playlist
  // Ex: https://www.deezer.com/playlist/3155776842
  // Ex: https://www.deezer.com/br/playlist/3155776842
  // Ex: deezer:playlist:3155776842
  const deezerPlaylist = trimmed.match(/(?:deezer\.com\/(?:[a-zA-Z0-9_-]+\/)*playlist\/|deezer:playlist:)(\d+)/i);
  if (deezerPlaylist) {
    return { provider: 'deezer', type: 'playlist', id: deezerPlaylist[1] };
  }

  // 5. ID direto do Spotify (22 caracteres alfanuméricos)
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return { provider: 'spotify', type: 'playlist', id: trimmed };
  }

  // 6. ID direto numérico do Deezer
  if (/^\d{6,15}$/.test(trimmed)) {
    return { provider: 'deezer', type: 'playlist', id: trimmed };
  }

  return null;
}

/**
 * Carrega playlist do Deezer via JSONP no browser (sem restrições de CORS)
 */
export function fetchDeezerPlaylist(playlistId) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      fetch(`https://api.deezer.com/playlist/${playlistId}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) {
            reject(new Error(data.error.message || 'Playlist não encontrada.'));
            return;
          }
          resolve(normalizeDeezerPlaylist(data));
        })
        .catch(err => reject(new Error('Falha ao conectar à API do Deezer: ' + err.message)));
      return;
    }

    const callbackName = 'dz_pl_cb_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo limite esgotado ao buscar playlist no Deezer.'));
    }, 10000);

    const cleanup = () => {
      clearTimeout(timer);
      try { window[callbackName] = () => {}; } catch (e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[callbackName] = (data) => {
      cleanup();
      if (!data) {
        reject(new Error('Resposta vazia da API do Deezer.'));
        return;
      }
      if (data.error) {
        reject(new Error(data.error.message || 'Playlist não encontrada no Deezer.'));
        return;
      }
      resolve(normalizeDeezerPlaylist(data));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Erro de rede ao buscar playlist no Deezer.'));
    };

    script.src = `https://api.deezer.com/playlist/${playlistId}?output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

function normalizeDeezerPlaylist(data) {
  const rawTracks = data.tracks?.data || [];
  const coverUrl = data.picture_xl || data.picture_big || data.picture_medium || '';

  const tracks = rawTracks
    .filter(t => t.preview && t.title)
    .map(t => {
      const cleanTitle = sanitizeTrackTitle(t.title);
      return {
        id: `dz_${t.id}`,
        deezerId: String(t.id),
        title: cleanTitle || t.title,
        originalTitle: t.title,
        artist: t.artist?.name || 'Artista',
        album: t.album?.title || data.title || 'Playlist',
        previewUrl: t.preview,
        artwork: t.album?.cover_xl || t.album?.cover_big || coverUrl,
        artworkThumb: t.album?.cover_small || coverUrl,
        trackViewUrl: t.link || `https://www.deezer.com/track/${t.id}`,
        provider: 'deezer',
        releaseYear: null,
      };
    });

  return {
    id: `dz_${data.id}`,
    provider: 'deezer',
    type: 'playlist',
    name: data.title || 'Playlist Deezer',
    cover: coverUrl,
    tracks,
  };
}

/**
 * Carrega álbum do Deezer via JSONP no browser (sem restrições de CORS)
 */
export function fetchDeezerAlbum(albumId) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      fetch(`https://api.deezer.com/album/${albumId}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) {
            reject(new Error(data.error.message || 'Álbum não encontrado no Deezer.'));
            return;
          }
          resolve(normalizeDeezerAlbum(data));
        })
        .catch(err => reject(new Error('Falha ao conectar à API do Deezer: ' + err.message)));
      return;
    }

    const callbackName = 'dz_alb_cb_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo limite esgotado ao buscar álbum no Deezer.'));
    }, 10000);

    const cleanup = () => {
      clearTimeout(timer);
      try { window[callbackName] = () => {}; } catch (e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[callbackName] = (data) => {
      cleanup();
      if (!data) {
        reject(new Error('Resposta vazia da API do Deezer.'));
        return;
      }
      if (data.error) {
        reject(new Error(data.error.message || 'Álbum não encontrado no Deezer.'));
        return;
      }
      resolve(normalizeDeezerAlbum(data));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Erro de rede ao buscar álbum no Deezer.'));
    };

    script.src = `https://api.deezer.com/album/${albumId}?output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

function normalizeDeezerAlbum(data) {
  const rawTracks = data.tracks?.data || [];
  const coverUrl = data.cover_xl || data.cover_big || data.cover_medium || '';
  const albumTitle = data.title || 'Álbum';
  const albumArtist = data.artist?.name || 'Artista';

  const tracks = rawTracks
    .filter(t => t.preview && t.title)
    .map(t => {
      const cleanTitle = sanitizeTrackTitle(t.title);
      return {
        id: `dz_${t.id}`,
        deezerId: String(t.id),
        title: cleanTitle || t.title,
        originalTitle: t.title,
        artist: t.artist?.name || albumArtist,
        album: albumTitle,
        previewUrl: t.preview,
        artwork: coverUrl,
        artworkThumb: data.cover_small || coverUrl,
        trackViewUrl: t.link || `https://www.deezer.com/track/${t.id}`,
        provider: 'deezer',
        releaseYear: data.release_date ? new Date(data.release_date).getFullYear() : null,
      };
    });

  return {
    id: `dz_alb_${data.id}`,
    provider: 'deezer',
    type: 'album',
    name: `${albumTitle} - ${albumArtist}`,
    cover: coverUrl,
    tracks,
  };
}

/**
 * Carrega playlist ou álbum do Spotify através do endpoint proxy local / serverless
 */
export async function fetchSpotifyPlaylist(playlistId, type = 'playlist') {
  const isAlbum = type === 'album';
  const response = await fetch(`/api/spotify-playlist?id=${encodeURIComponent(playlistId)}&type=${encodeURIComponent(type)}`);
  
  if (!response.ok) {
    let errorMsg = `Não foi possível carregar ${isAlbum ? 'o álbum' : 'a playlist'} do Spotify.`;
    try {
      const errData = await response.json();
      if (errData?.error) errorMsg = errData.error;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const rawTracks = data.trackList || [];
  const coverUrl = data.cover || '';
  const mediaType = data.type || type || 'playlist';
  const isAlbumResolved = mediaType === 'album';

  // Separa faixas com preview direto e faixas sem preview
  const tracksWithPreview = [];
  const tracksNeedingPreview = [];

  for (const t of rawTracks) {
    if (!t.title) continue;

    const cleanTitle = sanitizeTrackTitle(t.title);
    const artistName = t.subtitle || data.artistName || 'Artista';
    const trackId = t.uid || (t.uri ? t.uri.replace('spotify:track:', '') : Math.random().toString(36).substring(2));
    const trackUrl = t.uri ? `https://open.spotify.com/track/${t.uri.replace('spotify:track:', '')}` : `https://open.spotify.com/${isAlbumResolved ? 'album' : 'playlist'}/${playlistId}`;

    if (t.audioPreview?.url) {
      tracksWithPreview.push({
        id: `sp_${trackId}`,
        title: cleanTitle || t.title,
        originalTitle: t.title,
        artist: artistName,
        album: data.albumTitle || data.name || (isAlbumResolved ? 'Álbum' : 'Playlist'),
        previewUrl: t.audioPreview.url,
        artwork: coverUrl,
        artworkThumb: coverUrl,
        trackViewUrl: trackUrl,
        provider: 'spotify',
        releaseYear: null,
      });
    } else {
      tracksNeedingPreview.push({
        id: `sp_${trackId}`,
        title: cleanTitle || t.title,
        originalTitle: t.title,
        artist: artistName,
        album: data.albumTitle || data.name || (isAlbumResolved ? 'Álbum' : 'Playlist'),
        trackViewUrl: trackUrl,
        provider: 'spotify',
        releaseYear: null,
      });
    }
  }

  // Se restam faixas sem preview, busca fallback online (Deezer/Apple)
  let resolvedTracks = [...tracksWithPreview];

  if (tracksNeedingPreview.length > 0) {
    const toResolve = tracksNeedingPreview.slice(0, 30);
    const results = await Promise.allSettled(
      toResolve.map(track => searchTrackPreviewFallback(track.title, track.artist))
    );

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      if (res.status === 'fulfilled' && res.value?.previewUrl) {
        resolvedTracks.push({
          ...toResolve[i],
          previewUrl: res.value.previewUrl,
          artwork: res.value.artwork || coverUrl,
          artworkThumb: res.value.artworkThumb || coverUrl,
          trackViewUrl: toResolve[i].trackViewUrl || res.value.trackViewUrl,
        });
      }
    }
  }

  const displayName = isAlbumResolved
    ? (data.artistName ? `${data.albumTitle || data.name} - ${data.artistName}` : (data.name || 'Álbum do Spotify'))
    : (data.name || 'Playlist do Spotify');

  return {
    id: `sp_${isAlbumResolved ? 'alb_' : ''}${data.id}`,
    provider: 'spotify',
    type: isAlbumResolved ? 'album' : 'playlist',
    name: displayName,
    cover: coverUrl,
    tracks: resolvedTracks,
  };
}

/**
 * Importa qualquer playlist ou álbum a partir do link, validando quantidade mínima de faixas e desduplicando
 */
export async function importPlaylistFromInput(input) {
  const parsed = parsePlaylistUrl(input);
  if (!parsed) {
    throw new Error('Link inválido. Insira um link válido do Spotify ou Deezer de uma playlist ou álbum (ex: https://open.spotify.com/album/... ou /playlist/...).');
  }

  let media;
  if (parsed.provider === 'spotify') {
    media = await fetchSpotifyPlaylist(parsed.id, parsed.type);
  } else if (parsed.provider === 'deezer') {
    if (parsed.type === 'album') {
      media = await fetchDeezerAlbum(parsed.id);
    } else {
      media = await fetchDeezerPlaylist(parsed.id);
    }
  } else {
    throw new Error('Provedor não suportado.');
  }

  // Desduplica faixas por título e artista
  const seen = new Set();
  const uniqueTracks = [];

  for (const t of media.tracks) {
    const key = `${normalizeText(t.artist)}|${normalizeText(t.title)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTracks.push(t);
    }
  }

  media.tracks = uniqueTracks;

  if (media.tracks.length < 3) {
    throw new Error(`${media.type === 'album' ? 'O álbum' : 'A playlist'} "${media.name}" possui apenas ${media.tracks.length} música(s) com prévia de áudio liberada. O jogo requer no mínimo 3 músicas para jogar.`);
  }

  return media;
}

/**
 * Gerenciamento de Playlists Customizadas no LocalStorage
 */
export function getSavedPlaylists() {
  try {
    const saved = localStorage.getItem(PLAYLISTS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[PlaylistService] Erro ao ler playlists do localStorage:', e);
  }
  return [];
}

export function saveCustomPlaylist(playlist) {
  try {
    const current = getSavedPlaylists();
    // Substitui se já existir pelo mesmo id ou adiciona no topo
    const filtered = current.filter(p => p.id !== playlist.id);
    const updated = [playlist, ...filtered].slice(0, 20); // Guarda até 20 playlists
    localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('[PlaylistService] Erro ao salvar playlist:', e);
    return getSavedPlaylists();
  }
}

export function deleteCustomPlaylist(playlistId) {
  try {
    const current = getSavedPlaylists();
    const updated = current.filter(p => p.id !== playlistId);
    localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('[PlaylistService] Erro ao excluir playlist:', e);
    return getSavedPlaylists();
  }
}
