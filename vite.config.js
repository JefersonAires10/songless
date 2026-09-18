import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'node:https';

/**
 * Plugin que provê endpoint local para extrair faixas do embed do Spotify sem restrições de CORS
 */
function spotifyPlaylistPlugin() {
  const handler = (req, res) => {
    // Tratamento de preflight CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      const url = new URL(req.url, 'http://localhost');
      const mediaId = url.searchParams.get('id');
      const mediaType = url.searchParams.get('type') === 'album' ? 'album' : 'playlist';

      if (!mediaId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Parâmetro "id" da playlist ou álbum é obrigatório.' }));
        return;
      }

      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        }
      };

      https.get(`https://open.spotify.com/embed/${mediaType}/${mediaId}`, options, (upstreamRes) => {
        let htmlData = '';
        upstreamRes.on('data', chunk => { htmlData += chunk; });
        upstreamRes.on('end', () => {
          try {
            const idx = htmlData.indexOf('__NEXT_DATA__');
            if (idx === -1) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Não foi possível ler os dados ${mediaType === 'album' ? 'do álbum' : 'da playlist'} no Spotify.` }));
              return;
            }

            const start = htmlData.indexOf('>', idx) + 1;
            const end = htmlData.indexOf('</script>', start);
            const json = JSON.parse(htmlData.substring(start, end));
            const pageProps = json.props?.pageProps;

            if (pageProps?.status === 404) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `${mediaType === 'album' ? 'Álbum' : 'Playlist'} não encontrado(a) ou privado(a). Certifique-se de que o link é público.` }));
              return;
            }

            const entity = pageProps?.state?.data?.entity;
            if (!entity) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Nenhuma informação de ${mediaType === 'album' ? 'álbum' : 'playlist'} encontrada.` }));
              return;
            }

            const coverUrl = entity.visualIdentity?.image?.[0]?.url ||
                             entity.coverArt?.sources?.[0]?.url ||
                             '';

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              id: mediaId,
              type: entity.type || mediaType,
              name: entity.name || (mediaType === 'album' ? 'Álbum Importado' : 'Playlist Importada'),
              albumTitle: entity.name,
              artistName: entity.subtitle || '',
              description: entity.subtitle || '',
              cover: coverUrl,
              trackList: entity.trackList || []
            }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Erro ao interpretar resposta do Spotify: ' + err.message }));
          }
        });
      }).on('error', (err) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Falha na conexão com o Spotify: ' + err.message }));
      });
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: e.message }));
    }
  };

  return {
    name: 'spotify-playlist-proxy',
    configureServer(server) {
      server.middlewares.use('/api/spotify-playlist', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/spotify-playlist', handler);
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), spotifyPlaylistPlugin()],
  server: {
    port: 3000,
    host: true,
  },
});
