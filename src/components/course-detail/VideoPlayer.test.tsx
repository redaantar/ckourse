import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VideoPlayer } from "./VideoPlayer";
import type { Lesson, VideoPlayerHandle } from "@/types";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke, convertFileSrc: (path: string, scheme: string) => `${scheme}://localhost/${encodeURIComponent(path)}` }));
vi.mock("@/lib/posthog", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/store", () => ({ getSubtitleVtt: vi.fn() }));
vi.mock("@/lib/drive", () => ({ driveAuthStatus: vi.fn(), driveConnect: vi.fn(), driveCredentialsStatus: vi.fn() }));
const lesson = (id: number): Lesson => ({ id, title: "TS", videoPath: `/Users/test/Desktop/Cours été #1/lesson ${id}.TS`, duration: 4, completed: false, isLastWatched: false, lastPosition: 2.25, favorited: true });
function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (reason: string) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(cleanup);
beforeEach(() => { invoke.mockReset(); vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); });
describe("local TS preparation", () => {
  it("waits for the cache then restores position and retains timestamp controls", async () => {
    const pending = deferred(); invoke.mockReturnValue(pending.promise);
    const onTimeUpdate = vi.fn(); const ref = createRef<VideoPlayerHandle>();
    const view = render(<MemoryRouter><VideoPlayer ref={ref} lesson={lesson(1)} subtitles={[]} hasNext={false} initialTime={2.25} autoPlay onTimeUpdate={onTimeUpdate} /></MemoryRouter>);
    const video = view.container.querySelector("video")!;
    expect(video.getAttribute("src")).toBeNull();
    expect(invoke).toHaveBeenCalledWith("prepare_local_video", { path: lesson(1).videoPath, requestId: expect.any(String) });
    await act(async () => pending.resolve("/cache/compatible.mp4"));
    expect(video.src).toContain("compatible.mp4");
    Object.defineProperty(video, "duration", { configurable: true, value: 4 });
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(2.25);
    expect(video.play).toHaveBeenCalled();
    Object.defineProperty(video, "readyState", { configurable: true, value: 1 });
    act(() => ref.current!.seekTo(3));
    expect(video.currentTime).toBe(3);
    expect(onTimeUpdate).toHaveBeenCalledWith(3);
  });
  it("keeps a timestamp clicked while the video is being prepared", async () => {
    const pending = deferred(); invoke.mockReturnValue(pending.promise);
    const ref = createRef<VideoPlayerHandle>();
    const view = render(<MemoryRouter><VideoPlayer ref={ref} lesson={lesson(1)} subtitles={[]} hasNext={false} initialTime={1} /></MemoryRouter>);
    act(() => ref.current!.seekTo(3));
    await act(async () => pending.resolve("/cache/ready.mp4"));
    const video = view.container.querySelector("video")!;
    Object.defineProperty(video, "duration", { configurable: true, value: 4 });
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(3);
  });
  it("keeps ordinary MP4 playback on its existing path", () => {
    const mp4 = { ...lesson(1), videoPath: "/Users/test/Desktop/lesson.mp4" };
    const view = render(<MemoryRouter><VideoPlayer lesson={mp4} subtitles={[]} hasNext={false} initialTime={2.25} /></MemoryRouter>);
    expect(invoke).not.toHaveBeenCalled();
    const video = view.container.querySelector("video")!;
    expect(video.src).toContain("lesson.mp4");
    Object.defineProperty(video, "duration", { configurable: true, value: 4 });
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(2.25);
  });
  it("ignores a stale preparation after changing lessons", async () => {
    const first = deferred(), second = deferred();
    const queue = [first.promise, second.promise];
    invoke.mockImplementation((command: string) => command === "prepare_local_video" ? queue.shift() : Promise.resolve());
    const player = (id: number) => <MemoryRouter><VideoPlayer lesson={lesson(id)} subtitles={[]} hasNext={false} /></MemoryRouter>;
    const view = render(player(1)); view.rerender(player(2));
    const firstRequest = invoke.mock.calls[0][1].requestId;
    expect(invoke).toHaveBeenCalledWith("cancel_local_video_preparation", { requestId: firstRequest });
    await act(async () => first.resolve("/cache/first.mp4"));
    expect(view.container.querySelector("video")!.getAttribute("src")).toBeNull();
    await act(async () => second.resolve("/cache/second.mp4"));
    expect(view.container.querySelector("video")!.src).toContain("second.mp4");
  });
  it("allows preparation to be retried after an error", async () => {
    invoke.mockRejectedValueOnce("Not enough free disk space").mockResolvedValueOnce("/cache/retried.mp4");
    const view = render(<MemoryRouter><VideoPlayer lesson={lesson(1)} subtitles={[]} hasNext={false} /></MemoryRouter>);
    await waitFor(() => expect(view.getByText("Not enough free disk space")).toBeTruthy());
    fireEvent.click(view.getByText("Try again"));
    await waitFor(() => expect(view.container.querySelector("video")!.src).toContain("retried.mp4"));
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
