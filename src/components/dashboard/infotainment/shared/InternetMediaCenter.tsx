import { memo, useState } from 'react'

interface InternetMediaCenterProps {
  theme?: 'gti' | 'porsche' | 'toyota'
  compact?: boolean
}

interface RadioTrack {
  id: string
  title: string
  artist: string
  category: string
  youtubeId: string
}

const PRESET_TRACKS: RadioTrack[] = [
  {
    id: 'eurobeat',
    title: 'Running in the 90s / Deja Vu',
    artist: 'Initial D Eurobeat Special',
    category: 'DRIFT & CORRIDA',
    youtubeId: 'kJQP7kiw5Fk',
  },
  {
    id: 'synthwave',
    title: 'Nightcall · Retrowave Drive',
    artist: 'Kavinsky / Synthwave Highway',
    category: 'NIGHT DRIVE',
    youtubeId: 'MV_3Dpw-BRY',
  },
  {
    id: 'phonk',
    title: 'Tokyo Drift / Phonk Remix',
    artist: 'Drift Phonk Car Beats',
    category: 'PHONK DRIFT',
    youtubeId: '7NOSDKb0HlU',
  },
  {
    id: 'lofi',
    title: 'Lofi Hip Hop Radio · Chill Beats',
    artist: 'Lofi Girl Drive Edition',
    category: 'CHILL & RELAX',
    youtubeId: 'jfKfPfyJRdk',
  },
  {
    id: 'exhaust',
    title: 'Porsche 911 GT3 & EA888 Exhaust Sound',
    artist: 'Pure Automotive Acoustics',
    category: 'RONCO MOTOR',
    youtubeId: 'V1Pl8CzNzCw',
  },
]

/**
 * InternetMediaCenter — Central de Entretenimento com YouTube Integrado e Streaming de Músicas.
 *
 * Recursos:
 * - Acesso ao YouTube com reprodutor de vídeo embutido (YouTube iframe Player)
 * - Músicas e Rádios Automotivas temáticas (Eurobeat, Synthwave, Lofi, Phonk, Exhaust)
 * - Campo de busca / URL para o usuário colar qualquer link do YouTube e assistir na tela do carro
 * - Visualizador de áudio dinâmico (Equalizador de espectro com barras pulsantes)
 * - Controle de volume e visual de tela multimídia moderna
 */
export const InternetMediaCenter = memo(function InternetMediaCenter({
  theme: _theme = 'gti',
  compact = false,
}: InternetMediaCenterProps) {
  const [selectedTrack, setSelectedTrack] = useState<RadioTrack>(PRESET_TRACKS[0])
  const [activeVideoId, setActiveVideoId] = useState<string>(PRESET_TRACKS[0].youtubeId)
  const [customUrl, setCustomUrl] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [viewType, setViewType] = useState<'video' | 'player'>('video')

  // Extrair ID do YouTube a partir de qualquer formato de link (youtube.com/watch?v=, youtu.be/, ou ID direto)
  const handleLoadCustomVideo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customUrl.trim()) return

    let videoId = customUrl.trim()
    if (videoId.includes('v=')) {
      videoId = videoId.split('v=')[1]?.split('&')[0] || videoId
    } else if (videoId.includes('youtu.be/')) {
      videoId = videoId.split('youtu.be/')[1]?.split('?')[0] || videoId
    } else if (videoId.includes('embed/')) {
      videoId = videoId.split('embed/')[1]?.split('?')[0] || videoId
    }

    if (videoId) {
      setActiveVideoId(videoId)
      setSelectedTrack({
        id: 'custom',
        title: 'Vídeo Carregado pelo Piloto',
        artist: 'YouTube Streaming',
        category: 'PERSONALIZADO',
        youtubeId: videoId,
      })
      setIsPlaying(true)
      setViewType('video')
      setCustomUrl('')
    }
  }

  const selectTrack = (track: RadioTrack) => {
    setSelectedTrack(track)
    setActiveVideoId(track.youtubeId)
    setIsPlaying(true)
  }

  return (
    <div className={`w-full flex flex-col items-center select-none font-mono ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {/* ── Barra Superior: Status da Conexão & Modo de Exibição ── */}
      <div className="w-full flex items-center justify-between px-1 text-[8px] sm:text-[9px] border-b border-white/10 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
          <span className="font-black text-red-500 tracking-wider">YOUTUBE & MÍDIA</span>
          <span className="text-zinc-500 hidden xs:inline">· ONLINE 4G</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewType('video')}
            className={`px-1.5 py-0.5 rounded text-[7px] font-bold transition-colors cursor-pointer ${
              viewType === 'video' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            🎬 VÍDEO
          </button>
          <button
            onClick={() => setViewType('player')}
            className={`px-1.5 py-0.5 rounded text-[7px] font-bold transition-colors cursor-pointer ${
              viewType === 'player' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            🎵 MÚSICAS
          </button>
        </div>
      </div>

      {/* ── Visualização: VÍDEO DO YOUTUBE EMBUTIDO ── */}
      {viewType === 'video' ? (
        <div className="w-full flex flex-col items-center">
          {/* Tela de Vídeo 16:9 */}
          <div className="relative w-full h-[120px] sm:h-[135px] rounded-xl overflow-hidden bg-black border border-white/10 shadow-inner">
            {isPlaying ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeVideoId}?autoplay=1&enablejsapi=1`}
                title="YouTube Video Player"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
                <span className="text-red-400 text-[7px] mt-1 font-bold">CLIQUE PARA DAR PLAY</span>
              </div>
            )}
          </div>

          {/* Faixa atual */}
          <div className="w-full flex items-center justify-between px-1 mt-1 text-[8px] text-zinc-400">
            <span className="truncate max-w-[200px] text-white font-bold">
              {selectedTrack.title}
            </span>
            <span className="text-zinc-500 text-[7px]">{selectedTrack.category}</span>
          </div>
        </div>
      ) : (
        /* ── Visualização: PLAYER DE MÚSICA & RÁDIOS AUTOMOTIVAS ── */
        <div className="w-full flex flex-col items-center gap-1.5 py-1">
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

          {/* Seletor Rápido de Rádios Automotivas */}
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

      {/* ── Campo de Entrada: Colar Link ou ID do YouTube ── */}
      <form onSubmit={handleLoadCustomVideo} className="w-full flex items-center gap-1 mt-0.5">
        <input
          type="text"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder="Cole link ou ID do YouTube (ex: lofi, música, ronco)..."
          className="flex-1 px-2 py-1 rounded-lg bg-black/80 border border-white/10 text-white placeholder-zinc-500 text-[8px] focus:outline-none focus:border-red-500"
        />
        <button
          type="submit"
          className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-[8px] transition-all cursor-pointer shadow"
        >
          CARREGAR
        </button>
      </form>
    </div>
  )
})
