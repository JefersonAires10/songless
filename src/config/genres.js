/**
 * Configuração de categorias e seeds de artistas consagrados.
 * Em vez de buscar paradas passageiras, utilizamos seeds de artistas consagrados
 * para consultar a Apple Search API com limit=4, garantindo apenas hinos atemporais.
 */

export const GENRES = [
  {
    id: 'mpb_classica',
    name: 'MPB Clássica',
    shortName: 'MPB',
    tagline: 'Grandes vozes e poesias da música popular brasileira',
    accentColor: '#1DB954',
    artists: [
      'Belchior',
      'Milton Nascimento',
      'Chico Buarque',
      'Caetano Veloso',
      'Gilberto Gil',
      'Elis Regina',
      'Djavan',
      'Gal Costa',
      'Tim Maia',
      'Jorge Ben Jor',
      'Maria Bethânia',
      'Rita Lee'
    ]
  },
  {
    id: 'sertanejo_universitario',
    name: 'Sertanejo Universitário',
    shortName: 'Sertanejo Atual',
    tagline: 'Os maiores sucessos de arenas, festivais e da nova geração',
    accentColor: '#06b6d4',
    artists: [
      'Marília Mendonça',
      'Henrique & Juliano',
      'Jorge & Mateus',
      'Gusttavo Lima',
      'Maiara & Maraisa',
      'Zé Neto & Cristiano',
      'Luan Santana',
      'Matheus & Kauan',
      'Cristiano Araújo',
      'Marcos & Belutti',
      'Fernando & Sorocaba',
      'Simone & Simaria',
      'Michel Teló'
    ]
  },
  {
    id: 'sertanejo_classico',
    name: 'Sertanejo Raiz & Clássicos',
    shortName: 'Sertanejo Raiz',
    tagline: 'Os maiores modões e clássicos românticos do sertanejo',
    accentColor: '#f59e0b',
    artists: [
      'Chitãozinho & Xororó',
      'Zezé Di Camargo & Luciano',
      'Leandro & Leonardo',
      'João Paulo & Daniel',
      'Bruno & Marrone',
      'Milionário & José Rico',
      'Trio Parada Dura',
      'Chrystian & Ralf',
      'Tião Carreiro & Pardinho',
      'Roberta Miranda',
      'Gian & Giovani',
      'Rick & Renner',
      'Sérgio Reis'
    ]
  },
  {
    id: 'rock_nacional',
    name: 'Rock Nacional',
    shortName: 'Rock BR',
    tagline: 'Os maiores hinos das décadas de ouro do rock brasileiro',
    accentColor: '#e91429',
    artists: [
      'Legião Urbana',
      'Os Paralamas do Sucesso',
      'Engenheiros do Hawaii',
      'Titãs',
      'Cazuza',
      'Barão Vermelho',
      'Capital Inicial',
      'Skank',
      'Charlie Brown Jr.',
      'Detonautas',
      'Kid Abelha',
      'RPM',
      'Ira!'
    ]
  },
  {
    id: 'rock_internacional',
    name: 'Rock Internacional Clássico',
    shortName: 'Rock Clássico',
    tagline: 'Lendas do rock que moldaram a história da música mundial',
    accentColor: '#3b82f6',
    artists: [
      'Queen',
      'The Beatles',
      'Led Zeppelin',
      'Pink Floyd',
      'AC/DC',
      'The Rolling Stones',
      "Guns N' Roses",
      'Nirvana',
      'Aerosmith',
      'Bon Jovi',
      'Dire Straits',
      'Deep Purple'
    ]
  },
  {
    id: 'pop_retro',
    name: 'Pop Hits 80s/90s/2000s',
    shortName: 'Pop Nostalgia',
    tagline: 'Os maiores clássicos das pistas e rádios mundiais',
    accentColor: '#a855f7',
    artists: [
      'Michael Jackson',
      'Madonna',
      'Elton John',
      'Britney Spears',
      'Coldplay',
      'George Michael',
      'Whitney Houston',
      'ABBA',
      'Cyndi Lauper',
      'Backstreet Boys',
      'Rihanna',
      'Shakira'
    ]
  }
];

export const DEFAULT_GENRE_ID = 'mpb_classica';
