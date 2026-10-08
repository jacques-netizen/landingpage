// Turns a logical media id from content/media.json into something a <video>
// can play. Swapping a placeholder for the real film is a manifest edit only.
import { media, type MediaItem } from "@/lib/content";

export type VideoSource = {
  id: string;
  src: string;
  kind: "mp4" | "hls";
  poster: string | null;
  captions: string | null;
  loop: boolean;
  placeholder: boolean;
};

function fromItem(id: string, item: MediaItem): VideoSource {
  if (item.provider === "mux") {
    return {
      id,
      src: `https://stream.mux.com/${item.id}.m3u8`,
      kind: "hls",
      poster: item.poster || `https://image.mux.com/${item.id}/thumbnail.webp?width=720&time=0`,
      captions: item.captions,
      loop: Boolean(item.loop),
      placeholder: Boolean(item.placeholder),
    };
  }
  return {
    id,
    src: item.id,
    kind: item.id.endsWith(".m3u8") ? "hls" : "mp4",
    poster: item.poster,
    captions: item.captions,
    loop: Boolean(item.loop),
    placeholder: Boolean(item.placeholder),
  };
}

export function videoSource(id: string): VideoSource | null {
  const item = media[id];
  return item ? fromItem(id, item) : null;
}
