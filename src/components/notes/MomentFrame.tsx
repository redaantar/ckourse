import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { PlayIcon as Play } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CourseCover } from "@/components/dashboard/CourseCover";
import { formatTimestamp } from "@/lib/format";

interface MomentFrameProps {
  courseTitle: string;
  accentColor: string;
  videoPath: string;
  /** The moment the note points at; without one the course cover stands in */
  seconds?: number;
  /** Play a muted preview from the moment while the pointer is over `hovered` */
  hovered?: boolean;
  className?: string;
}

/**
 * Only local files are framed: remote sources would stream from the network for
 * every card, and `.ts` needs remuxing before WebKit can decode it.
 */
function frameSrc(videoPath: string): string | null {
  if (!videoPath || videoPath.startsWith("srv:") || videoPath.startsWith("gdrive:")) return null;
  if (/\.(ts|mkv|avi|wmv|flv)$/i.test(videoPath)) return null;
  return convertFileSrc(videoPath, "stream");
}

/** The still from the exact moment a note was written, so you recognise it before you read it. */
export function MomentFrame({ courseTitle, accentColor, videoPath, seconds, hovered = false, className }: MomentFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = seconds != null ? frameSrc(videoPath) : null;

  // Don't touch the disk until the card is near the viewport, and let go once it leaves
  useEffect(() => {
    if (!src) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  useEffect(() => setCaptured(false), [src, seconds]);

  // Copy the decoded frame into a canvas so the video (a file handle and a decoder) can be released
  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    setReady(true);
    if (captured || !video || !canvas || !video.videoWidth) return;
    const width = Math.min(video.videoWidth, 480);
    canvas.width = width;
    canvas.height = Math.round((width * video.videoHeight) / video.videoWidth);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCaptured(true);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready || seconds == null) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (hovered && !reduceMotion) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = seconds;
    }
  }, [hovered, ready, seconds]);

  // A live video only while it's still needed for the still, or for the hover preview
  const showVideo = src && visible && !failed && (!captured || hovered);
  useEffect(() => {
    if (!showVideo) setReady(false);
  }, [showVideo]);

  return (
    <div ref={ref} className={cn("relative aspect-video overflow-hidden bg-secondary", className)}>
      <CourseCover title={courseTitle} accentColor={accentColor} showTitle={false} className="absolute inset-0" />

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-300",
          captured ? "opacity-100" : "opacity-0",
        )}
      />

      {showVideo && (
        <video
          ref={videoRef}
          src={`${src}#t=${seconds}`}
          preload="metadata"
          muted
          playsInline
          disablePictureInPicture
          tabIndex={-1}
          aria-hidden="true"
          onLoadedData={capture}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-300",
            ready ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {/* Hairline inner edge, matching the covers */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />

      {seconds != null && (
        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/65 py-0.5 pr-2 pl-1.5 font-mono text-[11px] font-semibold text-white backdrop-blur-md">
          <Play weight="fill" className="size-2.5" aria-hidden="true" />
          {formatTimestamp(seconds)}
        </span>
      )}
    </div>
  );
}
