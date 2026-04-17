import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  PlayIcon as Play,
  PauseIcon as Pause,
  SpeakerHighIcon as SpeakerHigh,
  SpeakerLowIcon as SpeakerLow,
  SpeakerSlashIcon as SpeakerSlash,
  CornersOutIcon as CornersOut,
  CornersInIcon as CornersIn,
  SkipForwardIcon as SkipForward,
  ArrowClockwiseIcon as Clockwise,
  ArrowCounterClockwiseIcon as CounterClockwise,
  SubtitlesIcon as Subtitles,
  GaugeIcon as Gauge,
  PictureInPictureIcon as PictureInPicture,
  CaretRightIcon as CaretRight,
  GearSixIcon as GearSix,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { formatVideoTime } from "@/lib/format";
import type { Lesson, Subtitle, VideoPlayerHandle } from "@/types";
import { getSubtitleVtt } from "@/lib/store";
import { EASE_OUT } from "@/lib/constants";

interface VideoPlayerProps {
  lesson: Lesson | undefined;
  subtitles: Subtitle[];
  hasNext: boolean;
  accentColor?: string;
  autoPlay?: boolean;
  autoSkipEnabled?: boolean;
  initialTime?: number | null;
  defaultSpeed?: number;
  defaultVolume?: number;
  skipSeconds?: number;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  onEnded?: () => void;
  onNext?: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const AUTO_SKIP_SECONDS = 5;

const SUB_SIZE_OPTIONS = [
  { label: "Small", value: 14 },
  { label: "Medium", value: 18 },
  { label: "Large", value: 24 },
  { label: "XL", value: 32 },
] as const;

const SUB_COLOR_OPTIONS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Yellow", value: "#FFFF00" },
  { label: "Cyan", value: "#00FFFF" },
  { label: "Lime", value: "#C8F135" },
] as const;

const SUB_BG_OPTIONS = [
  { label: "75%", value: 0.75 },
  { label: "50%", value: 0.5 },
  { label: "25%", value: 0.25 },
  { label: "None", value: 0 },
] as const;

const SUB_BOTTOM_OPTIONS = [
  { label: "Low", value: 8 },
  { label: "Default", value: 14 },
  { label: "Mid", value: 22 },
  { label: "High", value: 32 },
] as const;

interface SubtitleStyle {
  fontSize: number;
  color: string;
  bgOpacity: number;
  bottomPct: number;
}

const SUB_STYLE_KEY = "ckourse:subtitle-style";

const DEFAULT_SUB_STYLE: SubtitleStyle = {
  fontSize: 18,
  color: "#FFFFFF",
  bgOpacity: 0.75,
  bottomPct: 14,
};

function loadSubStyle(): SubtitleStyle {
  try {
    const raw = localStorage.getItem(SUB_STYLE_KEY);
    if (raw) return { ...DEFAULT_SUB_STYLE, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_SUB_STYLE;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer({
  lesson,
  subtitles,
  hasNext,
  accentColor,
  autoPlay,
  autoSkipEnabled = true,
  initialTime,
  defaultSpeed = 1,
  defaultVolume = 100,
  skipSeconds = 10,
  onTimeUpdate,
  onDurationChange,
  onPlayStateChange,
  onEnded,
  onNext,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      if (videoRef.current) {
        videoRef.current.currentTime = seconds;
        setVideoTime(seconds);
        onTimeUpdate?.(seconds);
      }
    },
    pause() {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    },
  }), [onTimeUpdate]);

  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(defaultVolume / 100);
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(defaultSpeed);
  const [activeSubtitleIdx, setActiveSubtitleIdx] = useState(-1);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreviewTime, setSeekPreviewTime] = useState<number | null>(null);
  const [seekPreviewX, setSeekPreviewX] = useState(0);
  const [hasEnded, setHasEnded] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subStyle, setSubStyle] = useState<SubtitleStyle>(loadSubStyle);
  const [subMenuView, setSubMenuView] = useState<"tracks" | "settings">(
    "tracks",
  );
  const [autoSkipRemaining, setAutoSkipRemaining] = useState(AUTO_SKIP_SECONDS);
  const [autoSkipCancelled, setAutoSkipCancelled] = useState(false);

  // Auto-skip countdown when video ends
  const autoSkipFiredRef = useRef(false);
  useEffect(() => {
    if (!hasEnded || !hasNext || !autoSkipEnabled || autoSkipCancelled) {
      setAutoSkipRemaining(AUTO_SKIP_SECONDS);
      autoSkipFiredRef.current = false;
      return;
    }
    if (autoSkipFiredRef.current) return;
    if (autoSkipRemaining <= 0) {
      autoSkipFiredRef.current = true;
      onNext?.();
      return;
    }
    const timer = setTimeout(() => {
      setAutoSkipRemaining((t) => t - 0.05);
    }, 50);
    return () => clearTimeout(timer);
  }, [hasEnded, hasNext, autoSkipEnabled, autoSkipCancelled, autoSkipRemaining, onNext]);

  // Reset auto-skip cancelled state when lesson changes
  useEffect(() => {
    setAutoSkipCancelled(false);
  }, [lesson?.id]);

  // Persist subtitle style to localStorage
  useEffect(() => {
    localStorage.setItem(SUB_STYLE_KEY, JSON.stringify(subStyle));
  }, [subStyle]);

  // Parsed subtitle cues per track index
  const [parsedTracks, setParsedTracks] = useState<
    Map<number, { start: number; end: number; text: string }[]>
  >(new Map());

  // Track preferred subtitle language and speed across lesson changes
  const preferredSubLangRef = useRef<string | null>(null);
  const playbackSpeedRef = useRef(playbackSpeed);

  const videoSrc = lesson ? convertFileSrc(lesson.videoPath, "stream") : undefined;

  // Reset state when lesson changes
  useEffect(() => {
    setHasEnded(false);
    setVideoTime(0);
    setVideoDuration(0);
    setIsPlaying(false);
    setShowControls(true);
    setParsedTracks(new Map());
  }, [lesson?.id]);

  // Restore subtitle selection by language when lesson changes
  useEffect(() => {
    if (preferredSubLangRef.current && subtitles.length > 0) {
      const idx = subtitles.findIndex(
        (s) => s.language === preferredSubLangRef.current,
      );
      setActiveSubtitleIdx(idx >= 0 ? idx : -1);
    }
  }, [lesson?.id, subtitles]);

  // Track whether we've applied initial setup for the current lesson
  const initialSeekAppliedRef = useRef<number | null>(null);

  // Reset the flag when lesson changes
  useEffect(() => {
    initialSeekAppliedRef.current = null;
  }, [lesson?.id]);

  // Apply initial position, speed, volume, and autoplay when video is ready
  // initialTime === null means "settings not loaded yet" — wait before applying
  useEffect(() => {
    if (!videoRef.current || !lesson?.id) return;
    if (initialTime === null) return; // settings not ready yet
    if (initialSeekAppliedRef.current === lesson.id) return;
    const video = videoRef.current;

    const applyInitial = () => {
      if (initialSeekAppliedRef.current === lesson.id) return;
      initialSeekAppliedRef.current = lesson.id;
      if (initialTime && initialTime > 0 && initialTime < video.duration) {
        video.currentTime = initialTime;
      }
      video.playbackRate = playbackSpeedRef.current;
      video.volume = defaultVolume / 100;
      if (autoPlay) {
        video.play();
      }
    };

    // If metadata is already loaded, apply immediately
    if (video.readyState >= 1) {
      applyInitial();
    } else {
      video.addEventListener("loadedmetadata", applyInitial);
      return () => video.removeEventListener("loadedmetadata", applyInitial);
    }
  }, [lesson?.id, initialTime, autoPlay, defaultVolume]);

  // Parse subtitle files into cue arrays
  useEffect(() => {
    setParsedTracks(new Map());
    if (subtitles.length === 0) return;

    let cancelled = false;
    Promise.all(
      subtitles.map(async (sub, idx) => {
        const vtt = await getSubtitleVtt(sub.path);
        return [idx, parseVttCues(vtt)] as [
          number,
          { start: number; end: number; text: string }[],
        ];
      }),
    ).then((entries) => {
      if (!cancelled) setParsedTracks(new Map(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [subtitles]);

  // Get the active cue text for the current time
  const activeCueText =
    activeSubtitleIdx >= 0
      ? getActiveCue(parsedTracks.get(activeSubtitleIdx), videoTime)
      : null;

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        setShowSpeedMenu(false);
        setShowSubtitleMenu(false);
        setShowVolumeSlider(false);
      }
    }, 3000);
  }, []);

  const handleMouseMove = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

  const handleMouseLeave = useCallback(() => {
    if (videoRef.current && !videoRef.current.paused) {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
        setShowSubtitleMenu(false);
        setShowVolumeSlider(false);
      }, 800);
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!videoRef.current) return;
      // Don't capture when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;

      const v = videoRef.current;
      switch (e.key) {
        case "Escape":
          if (document.fullscreenElement) {
            e.preventDefault();
            document.exitFullscreen();
          }
          break;
        case " ":
        case "k":
          e.preventDefault();
          if (hasEnded) {
            handleReplay();
          } else {
            v.paused ? v.play() : v.pause();
          }
          resetHideTimer();
          break;
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - skipSeconds);
          resetHideTimer();
          break;
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration, v.currentTime + skipSeconds);
          resetHideTimer();
          break;
        case "ArrowUp":
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.1);
          setVolume(v.volume);
          if (v.muted) {
            v.muted = false;
            setIsMuted(false);
          }
          resetHideTimer();
          break;
        case "ArrowDown":
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.1);
          setVolume(v.volume);
          resetHideTimer();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          resetHideTimer();
          break;
        case "j":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - skipSeconds);
          resetHideTimer();
          break;
        case "l":
          e.preventDefault();
          v.currentTime = Math.min(v.duration, v.currentTime + skipSeconds);
          resetHideTimer();
          break;
        case "c":
          e.preventDefault();
          cycleSubtitles();
          resetHideTimer();
          break;
        case "p":
          e.preventDefault();
          togglePiP();
          break;
        case ",":
          if (e.shiftKey) {
            e.preventDefault();
            const idx = SPEED_OPTIONS.indexOf(playbackSpeed);
            if (idx > 0) changeSpeed(SPEED_OPTIONS[idx - 1]);
          }
          break;
        case ".":
          if (e.shiftKey) {
            e.preventDefault();
            const idx = SPEED_OPTIONS.indexOf(playbackSpeed);
            if (idx < SPEED_OPTIONS.length - 1)
              changeSpeed(SPEED_OPTIONS[idx + 1]);
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playbackSpeed, hasEnded, skipSeconds, resetHideTimer]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (hasEnded) {
      handleReplay();
      return;
    }
    videoRef.current.paused
      ? videoRef.current.play()
      : videoRef.current.pause();
  }, [hasEnded]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.volume = val;
    setVolume(val);
    if (val === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
    } else if (videoRef.current.muted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  }, []);

  const changeSpeed = useCallback((speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    playbackSpeedRef.current = speed;
    setShowSpeedMenu(false);
  }, []);

  const cycleSubtitles = useCallback(() => {
    if (subtitles.length === 0) return;
    setActiveSubtitleIdx((prev) => {
      const next = prev + 1 >= subtitles.length ? -1 : prev + 1;
      preferredSubLangRef.current =
        next >= 0 ? (subtitles[next].language ?? null) : null;
      return next;
    });
  }, [subtitles]);

  const selectSubtitle = useCallback(
    (idx: number) => {
      setActiveSubtitleIdx(idx);
      preferredSubLangRef.current =
        idx >= 0 ? (subtitles[idx]?.language ?? null) : null;
      setShowSubtitleMenu(false);
    },
    [subtitles],
  );

  // Fullscreen via DOM Fullscreen API (enabled by macos-private-api on macOS)
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }, []);

  // Sync isFullscreen state with DOM fullscreen changes
  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      // PiP not supported or denied
    }
  }, []);

  const skipForward = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(
      videoRef.current.duration,
      videoRef.current.currentTime + skipSeconds,
    );
    resetHideTimer();
  }, [resetHideTimer]);

  const skipBackward = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      videoRef.current.currentTime - skipSeconds,
    );
    resetHideTimer();
  }, [resetHideTimer]);

  const handleReplay = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setHasEnded(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    toggleFullscreen();
  }, [toggleFullscreen]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setVideoTime(t);
      onTimeUpdate?.(t);
    }
  }, [onTimeUpdate]);

  const handleDurationChange = useCallback(() => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setVideoDuration(dur);
      onDurationChange?.(dur);
    }
  }, [onDurationChange]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setHasEnded(false);
    onPlayStateChange?.(true);
    resetHideTimer();
  }, [onPlayStateChange, resetHideTimer]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    onPlayStateChange?.(false);
    setShowControls(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  }, [onPlayStateChange]);

  const handleEnded = useCallback(() => {
    setHasEnded(true);
    setIsPlaying(false);
    setShowControls(true);
    onPlayStateChange?.(false);
    onEnded?.();
  }, [onEnded, onPlayStateChange]);

  const handleProgress = useCallback(() => {
    if (!videoRef.current || !videoRef.current.duration) return;
    const buf = videoRef.current.buffered;
    if (buf.length > 0) {
      setBuffered(buf.end(buf.length - 1) / videoRef.current.duration);
    }
  }, []);

  const getSeekRatio = (e: ReactMouseEvent | MouseEvent) => {
    if (!seekBarRef.current) return 0;
    const rect = seekBarRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const handleSeekMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!videoRef.current || !videoDuration) return;
      e.preventDefault();
      setIsSeeking(true);
      const ratio = getSeekRatio(e);
      videoRef.current.currentTime = ratio * videoDuration;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!videoRef.current) return;
        const r = getSeekRatio(ev);
        videoRef.current.currentTime = r * videoDuration;
        setVideoTime(r * videoDuration);
      };

      const handleMouseUp = () => {
        setIsSeeking(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [videoDuration],
  );

  const handleSeekHover = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!seekBarRef.current || !videoDuration) return;
      const rect = seekBarRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      setSeekPreviewTime(ratio * videoDuration);
      setSeekPreviewX(e.clientX - rect.left);
    },
    [videoDuration],
  );

  const handleSeekLeave = useCallback(() => {
    setSeekPreviewTime(null);
  }, []);

  useEffect(() => {
    if (!showSpeedMenu && !showSubtitleMenu) return;
    const handleClick = () => {
      setShowSpeedMenu(false);
      setShowSubtitleMenu(false);
    };
    // Delay to avoid closing immediately
    const timer = setTimeout(
      () => window.addEventListener("click", handleClick),
      0,
    );
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleClick);
    };
  }, [showSpeedMenu, showSubtitleMenu]);

  const VolumeIcon = isMuted || volume === 0 ? SpeakerSlash : volume < 0.5 ? SpeakerLow : SpeakerHigh;
  const progress = videoDuration > 0 ? (videoTime / videoDuration) * 100 : 0;

  if (!videoSrc) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-black">
        <div className="flex aspect-video items-center justify-center bg-card">
          <p className="font-sans text-sm text-muted-foreground">
            No lesson selected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="group/player relative overflow-hidden rounded-xl border border-border bg-black"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: showControls ? "default" : "none" }}
    >
      <video
        ref={videoRef}
        key={lesson?.id}
        className="aspect-video w-full bg-black"
        src={videoSrc}
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onProgress={handleProgress}
        onClick={togglePlay}
        onDoubleClick={handleDoubleClick}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          console.log("[video] loadedmetadata", {
            src: v.currentSrc,
            duration: v.duration,
            readyState: v.readyState,
            videoWidth: v.videoWidth,
            videoHeight: v.videoHeight,
          });
        }}
        onStalled={() => console.warn("[video] stalled", videoSrc)}
        onAbort={() => console.warn("[video] abort", videoSrc)}
        onError={(e) => {
          const v = e.currentTarget;
          const err = v.error;
          const codeName = err
            ? ["", "MEDIA_ERR_ABORTED", "MEDIA_ERR_NETWORK", "MEDIA_ERR_DECODE", "MEDIA_ERR_SRC_NOT_SUPPORTED"][err.code] ?? `code=${err.code}`
            : "unknown";
          console.error("[video] error", {
            src: v.currentSrc,
            code: err?.code,
            codeName,
            message: err?.message,
            networkState: v.networkState,
            readyState: v.readyState,
          });
        }}
      />

      {activeCueText && (
        <div
          className="pointer-events-none absolute inset-x-0 flex justify-center px-8"
          style={{ bottom: `${subStyle.bottomPct}%` }}
        >
          <span
            className="inline-block max-w-[80%] rounded px-3 py-1.5 text-center font-sans leading-relaxed"
            style={{
              fontSize: isFullscreen
                ? subStyle.fontSize * 1.5
                : subStyle.fontSize,
              color: subStyle.color,
              backgroundColor: `rgba(0, 0, 0, ${subStyle.bgOpacity})`,
              textShadow:
                subStyle.bgOpacity < 0.25
                  ? "0 1px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.6)"
                  : "none",
            }}
            dangerouslySetInnerHTML={{ __html: activeCueText }}
          />
        </div>
      )}

      {hasEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div
            className="flex flex-col items-center gap-5"
            style={{
              animation: `fadeInUp 400ms ${EASE_OUT} both`,
            }}
          >
            <p className="font-heading text-base font-semibold text-white">
              Lesson Complete
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReplay}
                className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 font-sans text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <CounterClockwise className="size-4" />
                Replay
              </button>
              {hasNext && (
                <div className="relative">
                  {autoSkipEnabled && !autoSkipCancelled && (
                    <svg
                      className="absolute -inset-1 size-[calc(100%+8px)]"
                      viewBox="0 0 100 40"
                      preserveAspectRatio="none"
                    >
                      <rect
                        x="1"
                        y="1"
                        width="98"
                        height="38"
                        rx="10"
                        ry="10"
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="2"
                      />
                      <rect
                        x="1"
                        y="1"
                        width="98"
                        height="38"
                        rx="10"
                        ry="10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-primary"
                        strokeDasharray={`${((AUTO_SKIP_SECONDS - autoSkipRemaining) / AUTO_SKIP_SECONDS) * 272} 272`}
                        style={{ transition: "stroke-dasharray 50ms linear" }}
                      />
                    </svg>
                  )}
                  <button
                    onClick={onNext}
                    className="relative flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-sans text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Next Lesson
                    {autoSkipEnabled && !autoSkipCancelled && (
                      <span className="font-mono text-xs font-normal opacity-70">
                        {Math.ceil(autoSkipRemaining)}
                      </span>
                    )}
                    <CaretRight className="size-4" weight="bold" />
                  </button>
                  {autoSkipEnabled && !autoSkipCancelled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAutoSkipCancelled(true);
                      }}
                      className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-white/20 font-sans text-[10px] text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                      title="Cancel auto-skip"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!isPlaying && !hasEnded && videoDuration > 0 && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div
            className="flex size-16 items-center justify-center rounded-full text-white backdrop-blur-sm transition-transform hover:scale-110"
            style={{
              transitionTimingFunction: EASE_OUT,
              background: accentColor
                ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}15)`
                : "rgba(255,255,255,0.15)",
              boxShadow: accentColor
                ? `0 0 24px ${accentColor}20`
                : "none",
            }}
          >
            <Play className="size-7 translate-x-0.5" weight="fill" />
          </div>
        </button>
      )}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col bg-linear-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-10 transition-opacity duration-300",
          showControls || isSeeking ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <div
          ref={seekBarRef}
          className="group/seek relative mb-2 h-1 cursor-pointer rounded-full bg-white/20"
          onMouseDown={handleSeekMouseDown}
          onMouseMove={handleSeekHover}
          onMouseLeave={handleSeekLeave}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/15"
            style={{ width: `${buffered * 100}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow-md transition-opacity group-hover/seek:opacity-100"
            style={{ left: `${progress}%` }}
          />
          <div className="absolute -inset-y-1 inset-x-0 group-hover/seek:-inset-y-0.5" />
          {seekPreviewTime !== null && (
            <div
              className="absolute -top-8 -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 font-mono text-[10px] text-white"
              style={{ left: `${seekPreviewX}px` }}
            >
              {formatVideoTime(seekPreviewTime)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <ControlButton onClick={togglePlay} tooltip={isPlaying ? "Pause (K)" : "Play (K)"}>
            {isPlaying ? (
              <Pause className="size-5" weight="fill" />
            ) : (
              <Play className="size-5" weight="fill" />
            )}
          </ControlButton>

          <ControlButton onClick={skipBackward} tooltip="Back 10s (J)">
            <CounterClockwise className="size-4" weight="bold" />
          </ControlButton>

          <ControlButton onClick={skipForward} tooltip="Forward 10s (L)">
            <Clockwise className="size-4" weight="bold" />
          </ControlButton>

          {hasNext && (
            <ControlButton onClick={onNext} tooltip="Next lesson">
              <SkipForward className="size-4" weight="fill" />
            </ControlButton>
          )}

          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <ControlButton onClick={toggleMute} tooltip={isMuted ? "Unmute (M)" : "Mute (M)"}>
              <VolumeIcon className="size-4" />
            </ControlButton>
            <div
              className={cn(
                "flex items-center overflow-hidden transition-all duration-200",
                showVolumeSlider ? "w-20 opacity-100 ml-0.5" : "w-0 opacity-0",
              )}
            >
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="volume-slider h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-primary [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              />
            </div>
          </div>

          <span className="ml-1 font-mono text-[11px] text-white/70 select-none">
            {formatVideoTime(videoTime)}
            {videoDuration > 0 && (
              <span className="text-white/40">
                {" / "}
                {formatVideoTime(videoDuration)}
              </span>
            )}
          </span>

          <div className="flex-1" />

          <div className="relative">
            <ControlButton
              onClick={(e) => {
                e.stopPropagation();
                setShowSpeedMenu((s) => !s);
                setShowSubtitleMenu(false);
              }}
              tooltip="Playback speed"
              active={playbackSpeed !== 1}
            >
              {playbackSpeed !== 1 ? (
                <span className="font-mono text-[11px] font-bold">{playbackSpeed}x</span>
              ) : (
                <Gauge className="size-4" />
              )}
            </ControlButton>
            {showSpeedMenu && (
              <PopupMenu>
                <p className="mb-1 px-2 font-sans text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Speed
                </p>
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={(e) => {
                      e.stopPropagation();
                      changeSpeed(s);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2 py-1 font-mono text-xs transition-colors hover:bg-white/10",
                      s === playbackSpeed
                        ? "text-primary font-semibold"
                        : "text-white/80",
                    )}
                  >
                    {s}x
                    {s === 1 && (
                      <span className="text-[10px] text-white/30">Normal</span>
                    )}
                  </button>
                ))}
              </PopupMenu>
            )}
          </div>

          {subtitles.length > 0 && (
            <div className="relative">
              <ControlButton
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSubtitleMenu((s) => {
                    if (!s) setSubMenuView("tracks");
                    return !s;
                  });
                  setShowSpeedMenu(false);
                }}
                tooltip="Subtitles (C)"
                active={activeSubtitleIdx >= 0}
              >
                <Subtitles className="size-4" />
              </ControlButton>
              {showSubtitleMenu && (
                <PopupMenu wide={subMenuView === "settings"}>
                  {subMenuView === "tracks" ? (
                    <>
                      <div className="mb-1 flex items-center justify-between px-2">
                        <p className="font-sans text-[10px] font-semibold uppercase tracking-wider text-white/40">
                          Subtitles
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubMenuView("settings");
                          }}
                          className="rounded p-0.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <GearSix className="size-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectSubtitle(-1);
                        }}
                        className={cn(
                          "w-full rounded px-2 py-1 text-left font-sans text-xs transition-colors hover:bg-white/10",
                          activeSubtitleIdx === -1
                            ? "text-primary font-semibold"
                            : "text-white/80",
                        )}
                      >
                        Off
                      </button>
                      {subtitles.map((sub, i) => (
                        <button
                          key={sub.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectSubtitle(i);
                          }}
                          className={cn(
                            "w-full rounded px-2 py-1 text-left font-sans text-xs transition-colors hover:bg-white/10",
                            activeSubtitleIdx === i
                              ? "text-primary font-semibold"
                              : "text-white/80",
                          )}
                        >
                          {sub.language ?? "Subtitles"}
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="mb-2 flex items-center gap-2 px-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubMenuView("tracks");
                          }}
                          className="font-sans text-xs text-white/50 transition-colors hover:text-white"
                        >
                          &larr;
                        </button>
                        <p className="font-sans text-[10px] font-semibold uppercase tracking-wider text-white/50">
                          Subtitle Style
                        </p>
                      </div>

                      <SubSettingRow label="Size">
                        {SUB_SIZE_OPTIONS.map((opt) => (
                          <SubSettingChip
                            key={opt.value}
                            label={opt.label}
                            active={subStyle.fontSize === opt.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubStyle((s) => ({ ...s, fontSize: opt.value }));
                            }}
                          />
                        ))}
                      </SubSettingRow>

                      <SubSettingRow label="Color">
                        {SUB_COLOR_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubStyle((s) => ({ ...s, color: opt.value }));
                            }}
                            className={cn(
                              "size-5 rounded-full border-2 transition-all hover:scale-110",
                              subStyle.color === opt.value
                                ? "border-primary scale-110"
                                : "border-white/20 hover:border-white/40",
                            )}
                            style={{ backgroundColor: opt.value }}
                            title={opt.label}
                          />
                        ))}
                      </SubSettingRow>

                      <SubSettingRow label="Background">
                        {SUB_BG_OPTIONS.map((opt) => (
                          <SubSettingChip
                            key={opt.value}
                            label={opt.label}
                            active={subStyle.bgOpacity === opt.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubStyle((s) => ({ ...s, bgOpacity: opt.value }));
                            }}
                          />
                        ))}
                      </SubSettingRow>

                      <SubSettingRow label="Position" last>
                        {SUB_BOTTOM_OPTIONS.map((opt) => (
                          <SubSettingChip
                            key={opt.value}
                            label={opt.label}
                            active={subStyle.bottomPct === opt.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubStyle((s) => ({ ...s, bottomPct: opt.value }));
                            }}
                          />
                        ))}
                      </SubSettingRow>
                    </>
                  )}
                </PopupMenu>
              )}
            </div>
          )}

          <ControlButton onClick={togglePiP} tooltip="Picture-in-Picture (P)">
            <PictureInPicture className="size-4" />
          </ControlButton>

          <ControlButton onClick={toggleFullscreen} tooltip={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (F)"}>
            {isFullscreen ? (
              <CornersIn className="size-4" />
            ) : (
              <CornersOut className="size-4" />
            )}
          </ControlButton>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
});

function ControlButton({
  onClick,
  tooltip,
  active,
  children,
}: {
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  tooltip?: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={cn(
        "group/btn relative rounded-md p-1.5 transition-colors hover:bg-white/10",
        active ? "text-primary" : "text-white/80 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function PopupMenu({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute bottom-full right-0 mb-2 rounded-lg border border-white/10 bg-black/90 p-1.5 shadow-xl backdrop-blur-md",
        wide ? "min-w-44" : "min-w-28",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function SubSettingRow({
  label,
  last,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(!last && "mb-2.5")}>
      <p className="mb-1 px-2 font-sans text-[10px] font-medium text-white/35">
        {label}
      </p>
      <div className="flex items-center gap-1 px-1.5">{children}</div>
    </div>
  );
}

function SubSettingChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-1 py-1 font-sans text-[10px] transition-colors hover:bg-white/10",
        active
          ? "bg-white/10 font-semibold text-primary"
          : "text-white/60",
      )}
    >
      {label}
    </button>
  );
}

function parseVttTimestamp(ts: string): number {
  // Handles both "HH:MM:SS.mmm" and "MM:SS.mmm"
  const parts = ts.trim().split(":");
  if (parts.length === 3) {
    const [h, m, rest] = parts;
    const [s, ms] = rest.split(".");
    return (
      parseInt(h) * 3600 +
      parseInt(m) * 60 +
      parseInt(s) +
      parseInt(ms || "0") / 1000
    );
  }
  if (parts.length === 2) {
    const [m, rest] = parts;
    const [s, ms] = rest.split(".");
    return parseInt(m) * 60 + parseInt(s) + parseInt(ms || "0") / 1000;
  }
  return 0;
}

function parseVttCues(
  vtt: string,
): { start: number; end: number; text: string }[] {
  const cues: { start: number; end: number; text: string }[] = [];
  const blocks = vtt
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n\n");

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const tsLine = lines.find((l) => l.includes(" --> "));
    if (!tsLine) continue;

    const [startStr, endStr] = tsLine.split(" --> ");
    const start = parseVttTimestamp(startStr);
    const end = parseVttTimestamp(endStr.split(" ")[0]); // strip position metadata

    const tsIdx = lines.indexOf(tsLine);
    const text = lines
      .slice(tsIdx + 1)
      .join("\n")
      .trim();
    if (text) {
      // Convert newlines to <br> for HTML rendering, escape HTML
      const safe = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
      cues.push({ start, end, text: safe });
    }
  }

  return cues;
}

function getActiveCue(
  cues: { start: number; end: number; text: string }[] | undefined,
  time: number,
): string | null {
  if (!cues) return null;
  for (const cue of cues) {
    if (time >= cue.start && time <= cue.end) {
      return cue.text;
    }
  }
  return null;
}
