import { memo, useState } from 'react'

interface InternetMediaCenterProps {
  theme?: 'gti' | 'porsche' | 'toyota' | 'honda'
  compact?: boolean
}

interface RadioTrack {
  id: string
  title: string
  artist: string
  category: string
  embedUrl: string
  isSearch?: boolean
}

const PRESET_TRACKS: RadioTrack[] = [
  {
    id: 'eurobeat',
    title: 'Running in the 90s / Deja Vu',
    artist: 'Initial D Eurobeat Special',
    category: 'DRIFT & CORRIDA',
    embedUrl: 'https://www.youtube-nocookie.com/embed/kJQP7kiw5Fk?autoplay=1&enablejsapi=1',
  },
  {
    id: 'funk',
    title: 'Mega Funk Automotivo · Grave Forte',
    artist: 'Paredão & Grave Automotivo',
    category: 'FUNK GRAVE',
    embedUrl: 'https://www.youtube-nocookie.com/embed?listType=search&list=funk+automotivo+grave+forte&autoplay=1&enablejsapi=1',
    isSearch: true,
  },
  {
    id: 'trap',
    title: 'Trap Brasil · Matuê & Poze & Ret',
    artist: 'Trap Nacional Car Drive',
    category: 'TRAP BRASIL',
    embedUrl: 'https://www.youtube-nocookie.com/embed?listType=search&list=matue+anos+luz&autoplay=1&enablejsapi=1',
    isSearch: true,
  },
  {
    id: 'synthwave',
    title: 'Nightcall · Retrowave Drive',
    artist: 'Kavinsky / Synthwave Highway',
    category: 'NIGHT DRIVE',
    embedUrl: 'https://www.youtube-nocookie.com/embed/MV_3Dpw-BRY?autoplay=1&enablejsapi=1',
  },
  {
    id: 'phonk',
    title: 'Tokyo Drift / Phonk Remix',
    artist: 'Drift Phonk Car Beats',
    category: 'PHONK DRIFT',
    embedUrl: 'https://www.youtube-nocookie.com/embed/7NOSDKb0HlU?autoplay=1&enablejsapi=1',
  },
  {
    id: 'lofi',
    title: 'Lofi Hip Hop Radio · Chill Beats',
    artist: 'Lofi Girl Drive Edition',
    category: 'CHILL & RELAX',
    embedUrl: 'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1&enablejsapi=1',
  },
  {
    id: 'exhaust',
    title: 'Porsche 911 GT3 & EA888 Exhaust Sound',
    artist: 'Pure Automotive Acoustics',
    category: 'RONCO MOTOR',
    embedUrl: 'https://www.youtube-nocookie.com/embed/V1Pl8CzNzCw?autoplay=1&enablejsapi=1',
  },
]

/**
 * InternetMediaCenter — Central de Entretenimento com Acesso Total ao YouTube e Músicas.
 *
 * Recursos:
 * - Acesso livre para tocar QUALQUER música ou vídeo digitando o nome, artista ou colando URL/link
 * - Suporte oficial ao YouTube Embed Search (busca direta por qualquer termo digitado)
 * - Botão de acesso externo ao YouTube Web em aba dedicada
 * - Rádios automotivas prontas com 1 clique (Eurobeat, Funk Automotivo, Trap, Phonk, Synthwave, Lofi)
 * - Player de vídeo adaptável à tela da multimídia com visual moderno de central automotiva
 */
export const InternetMediaCenter = memo(function InternetMediaCenter({
  theme: _theme = 'gti',
  compact = false,
}: InternetMediaCenterProps) {
  const [selectedTrack, setSelectedTrack] = useState<RadioTrack>(PRESET_TRACKS[0])
  const [currentEmbedUrl, setCurrentEmbedUrl] = useState<string>(PRESET_TRACKS[0].embedUrl)
  const [searchQuery, setSearchQuery] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [viewType, setViewType] = useState<'video' | 'player'>('video')
  const [isExpanded, setIsExpanded] = useState(false)

  // Submeter busca livre ou carregar URL/ID do YouTube
  const handleSearchOrPlay = (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchQuery.trim()
    if (!query) return

    let finalEmbedUrl = ''
    let title = query

    // Caso 1: Link direto do YouTube com parâmetro v=
    if (query.includes('v=')) {
      const videoId = query.split('v=')[1]?.split('&')[0]
      if (videoId) {
        finalEmbedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1`
        title = `Vídeo: ${videoId}`
      }
    }
    // Caso 2: Link encurtado youtu.be/
    else if (query.includes('youtu.be/')) {
      const videoId = query.split('youtu.be/')[1]?.split('?')[0]
      if (videoId) {
        finalEmbedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1`
        title = `Vídeo: ${videoId}`
      }
    }
    // Caso 3: Link de embed já formatado
    else if (query.includes('embed/')) {
      const videoId = query.split('embed/')[1]?.split('?')[0]
      if (videoId) {
        finalEmbedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1`
        title = `Vídeo: ${videoId}`
      }
    }
    // Caso 4: ID exato de 11 caracteres (sem espaços)
    else if (/^[a-zA-Z0-9_-]{11}$/.test(query)) {
      finalEmbedUrl = `https://www.youtube-nocookie.com/embed/${query}?autoplay=1&enablejsapi=1`
      title = `Vídeo ID: ${query}`
    }
    // Caso 5: Nome de música, artista ou pesquisa livre (ex: "matue", "phonk", "funk automotivo")
    // Usa a API oficial de pesquisa do YouTube Embed!
    else {
      finalEmbedUrl = `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(
        query
      )}&autoplay=1&enablejsapi=1`
      title = `Busca: "${query}"`
    }

    if (finalEmbedUrl) {
      setCurrentEmbedUrl(finalEmbedUrl)
      setSelectedTrack({
        id: 'custom-' + Date.now(),
        title,
        artist: 'YouTube Online',
        category: 'ONLINE',
        embedUrl: finalEmbedUrl,
      })
      setIsPlaying(true)
      setViewType('video')
      setSearchQuery('')
    }
  }

  const selectTrack = (track: RadioTrack) => {
    setSelectedTrack(track)
    setCurrentEmbedUrl(track.embedUrl)
    setIsPlaying(true)
    setViewType('video')
  }

  // Abrir o YouTube oficial em nova aba
  const openExternalYouTube = () => {
    const targetUrl = searchQuery.trim()
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery.trim())}`
      : 'https://www.youtube.com'
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={`w-full flex flex-col items-center select-none font-mono ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {/* ── Barra Superior: Status da Conexão & Modo de Exibição ── */}
      <div className="w-full flex items-center justify-between px-1 text-[8px] sm:text-[9px] border-b border-white/10 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
          <span className="font-black text-red-500 tracking-wider">YOUTUBE ONLINE</span>
          <span className="text-zinc-500 hidden xs:inline">· 4G INTERNET</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewType('video')}
            className={`px-1.5 py-0.5 rounded text-[7px] font-bold transition-colors cursor-pointer ${
              viewType === 'video' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            🎬 TELA VÍDEO
          </button>
          <button
            onClick={() => setViewType('player')}
            className={`px-1.5 py-0.5 rounded text-[7px] font-bold transition-colors cursor-pointer ${
              viewType === 'player' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            📻 PLAYLISTS
          </button>
          <button
            onClick={openExternalYouTube}
            className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-0.5"
            title="Abrir YouTube oficial no navegador"
          >
            <span>🌐</span>
            <span>ABRIR SITE</span>
          </button>
        </div>
      </div>

      {/* ── Visualização 1: PLAYER DE VÍDEO DO YOUTUBE INTEGRADO ── */}
      {viewType === 'video' ? (
        <div className="w-full flex flex-col items-center">
          {/* Tela de Vídeo com Proporção Ampla */}
          <div
            className={`relative w-full rounded-xl overflow-hidden bg-black border border-white/15 shadow-inner transition-all duration-200 ${
              isExpanded ? 'h-[160px] sm:h-[185px]' : 'h-[120px] sm:h-[135px]'
            }`}
          >
            {isPlaying ? (
              <iframe
                src={currentEmbedUrl}
                title="YouTube Video Player"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div
                onClick={() => setIsPlaying(true)}
                className="w-full h-full flex flex-col items-center justify-center bg-zinc-950/90 text-center p-2 cursor-pointer group hover:bg-zinc-900/90 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center text-lg shadow-[0_0_15px_rgba(220,38,38,0.7)] group-hover:scale-110 transition-transform mb-1">
                  ▶
                </div>
                <strong className="text-white text-[10px] line-clamp-1">{selectedTrack.title}</strong>
                <span className="text-zinc-400 text-[8px]">{selectedTrack.artist}</span>
                <span className="text-red-400 text-[7px] mt-1 font-bold">CLIQUE PARA DAR PLAY NO YOUTUBE</span>
              </div>
            )}
          </div>

          {/* Faixa atual e botão de tela ampliada */}
          <div className="w-full flex items-center justify-between px-1 mt-1 text-[8px] text-zinc-400">
            <div className="flex items-center gap-1 truncate max-w-[210px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate text-white font-bold">{selectedTrack.title}</span>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[7px] font-bold text-zinc-400 hover:text-white px-1.5 py-0.2 rounded bg-zinc-900 border border-white/5 cursor-pointer"
            >
              {isExpanded ? '⤓ REDUZIR' : '⤢ EXPANDIR'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Visualização 2: PLAYLISTS E ESTAÇÕES AUTOMOTIVAS ── */
        <div className="w-full flex flex-col items-center gap-1.5 py-0.5">
          {/* Cartão de Mídia com Equalizador */}
          <div className="w-full flex items-center justify-between p-2 rounded-xl bg-zinc-900/80 border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 text-sm">
                📻
              </div>
              <div className="flex flex-col">
                <strong className="text-white text-[9px] line-clamp-1">{selectedTrack.title}</strong>
                <span className="text-zinc-400 text-[8px]">{selectedTrack.artist}</span>
              </div>
            </div>

            {/* Equalizador Visualizador de Áudio (Barras animadas) */}
            <div className="flex items-end gap-1 h-6">
              {[60, 90, 40, 100, 75, 45, 85].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full ${
                    isPlaying ? 'bg-red-500 animate-pulse' : 'bg-zinc-700'
                  }`}
                  style={{
                    height: isPlaying ? `${h}%` : '20%',
                    animationDuration: `${0.4 + i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Lista de Canais Prontos */}
          <div className="w-full flex flex-col gap-1 max-h-[75px] overflow-y-auto pr-0.5">
            {PRESET_TRACKS.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTrack(t)}
                className={`w-full flex items-center justify-between px-2 py-1 rounded-lg border text-left text-[8px] transition-colors cursor-pointer ${
                  selectedTrack.id === t.id
                    ? 'bg-red-600/20 border-red-500/50 text-white'
                    : 'bg-zinc-950/60 border-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className={selectedTrack.id === t.id ? 'text-red-400' : 'text-zinc-600'}>
                    {selectedTrack.id === t.id ? '▶' : '•'}
                  </span>
                  <span className="truncate">{t.title}</span>
                </div>
                <span className="text-[7px] text-zinc-500 uppercase">{t.category}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Campo de Pesquisa Livre / Link de Qualquer Vídeo ou Música ── */}
      <form onSubmit={handleSearchOrPlay} className="w-full flex items-center gap-1 mt-0.5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Digite qualquer música, artista ou link do YouTube..."
          className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/90 border border-white/15 text-white placeholder-zinc-500 text-[8px] focus:outline-none focus:border-red-500 shadow-inner"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-[8px] transition-all cursor-pointer shadow flex items-center gap-1"
        >
          <span>🔍</span>
          <span>TOCAR</span>
        </button>
      </form>
    </div>
  )
})
