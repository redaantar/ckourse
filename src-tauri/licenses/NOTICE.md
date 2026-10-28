# Bundled media tools

ckourse runs FFmpeg and ffprobe as separate executables. They retain their own
licenses; see FFmpeg-LICENSE.md and the output of each tool's `-L` option.

Apple Silicon local build:
- FFmpeg 6.1.1, provided by ffmpeg-static 5.3.0.
  Binary/build provider: https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1
  Upstream source: https://ffmpeg.org/releases/ffmpeg-6.1.1.tar.xz
- ffprobe n4.4.1, provided by @ffprobe-installer/darwin-arm64 5.0.1.
  Binary/build provider: https://github.com/SavageCore/node-ffprobe-installer
  Upstream source: https://ffmpeg.org/releases/ffmpeg-4.4.1.tar.xz

See the providers for build recipes and dependency licenses, including x264
for the FFmpeg binary. FFmpeg-README.md describes the upstream project.
