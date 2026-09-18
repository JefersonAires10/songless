import https from 'node:https';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const { id, type } = req.query || {};
  const mediaType = type === 'album' ? 'album' : 'playlist';

  if (!id) {
    return res.status(400).json({ error: 'Parâmetro "id" da playlist ou álbum é obrigatório.' });
  }

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    }
  };

  https.get(`https://open.spotify.com/embed/${mediaType}/${id}`, options, (upstreamRes) => {
    let htmlData = '';
    upstreamRes.on('data', chunk => { htmlData += chunk; });
    upstreamRes.on('end', () => {
      try {
        const idx = htmlData.indexOf('__NEXT_DATA__');
        if (idx === -1) {
          return res.status(502).json({ error: `Não foi possível ler os dados ${mediaType === 'album' ? 'do álbum' : 'da playlist'} no Spotify.` });
        }

        const start = htmlData.indexOf('>', idx) + 1;
        const end = htmlData.indexOf('</script>', start);
        const json = JSON.parse(htmlData.substring(start, end));
        const pageProps = json.props?.pageProps;

        if (pageProps?.status === 404) {
          return res.status(404).json({ error: `${mediaType === 'album' ? 'Álbum' : 'Playlist'} não encontrado(a) ou privado(a). Certifique-se de que o link é público.` });
        }

        const entity = pageProps?.state?.data?.entity;
        if (!entity) {
          return res.status(404).json({ error: `Nenhuma informação de ${mediaType === 'album' ? 'álbum' : 'playlist'} encontrada.` });
        }

        const coverUrl = entity.visualIdentity?.image?.[0]?.url ||
                         entity.coverArt?.sources?.[0]?.url ||
                         '';

        return res.status(200).json({
          id,
          type: entity.type || mediaType,
          name: entity.name || (mediaType === 'album' ? 'Álbum Importado' : 'Playlist Importada'),
          albumTitle: entity.name,
          artistName: entity.subtitle || '',
          description: entity.subtitle || '',
          cover: coverUrl,
          trackList: entity.trackList || []
        });
      } catch (err) {
        return res.status(500).json({ error: 'Erro ao interpretar resposta do Spotify: ' + err.message });
      }
    });
  }).on('error', (err) => {
    return res.status(500).json({ error: 'Falha na conexão com o Spotify: ' + err.message });
  });
}
