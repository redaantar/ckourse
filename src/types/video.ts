export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
  pause: () => void;
}
