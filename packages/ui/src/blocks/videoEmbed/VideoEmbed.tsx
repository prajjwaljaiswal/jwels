'use client';

export interface VideoEmbedSettings {
  provider: 'youtube' | 'vimeo' | 'mp4';
  urlOrId: string;
  aspectRatio: '16:9' | '4:5' | '1:1';
  caption: string;
}

const aspectClass: Record<VideoEmbedSettings['aspectRatio'], string> = {
  '16:9': 'aspect-video',
  '4:5': 'aspect-[4/5]',
  '1:1': 'aspect-square',
};

function youtubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1]! : null;
}

function vimeoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/vimeo\.com\/(\d+)/);
  return m ? m[1]! : null;
}

export function VideoEmbedRenderer({ settings: s }: { settings: VideoEmbedSettings }) {
  let body: React.ReactNode = null;
  if (s.provider === 'youtube') {
    const id = youtubeId(s.urlOrId);
    body = id ? (
      <iframe
        className="w-full h-full"
        src={`https://www.youtube.com/embed/${id}`}
        title={s.caption || 'YouTube video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    ) : <Placeholder text="Paste a YouTube URL or video ID" />;
  } else if (s.provider === 'vimeo') {
    const id = vimeoId(s.urlOrId);
    body = id ? (
      <iframe
        className="w-full h-full"
        src={`https://player.vimeo.com/video/${id}`}
        title={s.caption || 'Vimeo video'}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    ) : <Placeholder text="Paste a Vimeo URL or video ID" />;
  } else {
    body = s.urlOrId ? (
      <video className="w-full h-full" src={s.urlOrId} controls />
    ) : <Placeholder text="Paste an MP4 URL" />;
  }

  return (
    <section className="px-6 sm:px-10 py-10">
      <div className={`max-w-4xl mx-auto rounded-lg overflow-hidden bg-black ${aspectClass[s.aspectRatio]}`}>
        {body}
      </div>
      {s.caption && <p className="text-center text-sm text-ink-600 mt-3">{s.caption}</p>}
    </section>
  );
}

function Placeholder({ text }: { text: string }) {
  return <div className="w-full h-full flex items-center justify-center text-white/70 text-sm">{text}</div>;
}

export function defaultVideoEmbed(): VideoEmbedSettings {
  return { provider: 'youtube', urlOrId: '', aspectRatio: '16:9', caption: '' };
}
