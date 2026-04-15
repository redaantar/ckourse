use std::fs;
use std::path::Path;
use crate::parser::find_bundled_bin;

/// Read a subtitle file and return its contents as WebVTT.
/// Supports: .vtt (passthrough), .srt (convert), .ass/.ssa (basic convert).
/// Also supports virtual paths of the form `<video_path>#subtitle:<stream_index>`
/// for soft (embedded) subtitles extracted via ffmpeg.
pub fn read_as_vtt(path: &str) -> Result<String, String> {
    // Handle embedded subtitle virtual paths: "<video>#subtitle:<index>"
    if let Some((video_path, stream_idx)) = parse_embedded_subtitle_path(path) {
        return extract_embedded_subtitle(&video_path, stream_idx);
    }

    let p = Path::new(path);
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let raw = fs::read(p).map_err(|e| format!("Failed to read subtitle: {e}"))?;

    // Try UTF-8 first, fall back to Latin-1
    let content = match String::from_utf8(raw.clone()) {
        Ok(s) => s,
        Err(_) => raw.iter().map(|&b| b as char).collect::<String>(),
    };

    // Strip BOM if present
    let content = content.strip_prefix('\u{FEFF}').unwrap_or(&content);

    match ext.as_str() {
        "vtt" => Ok(content.to_string()),
        "srt" => Ok(srt_to_vtt(content)),
        "ass" | "ssa" => Ok(ass_to_vtt(content)),
        _ => Err(format!("Unsupported subtitle format: .{ext}")),
    }
}

/// Parse a virtual embedded subtitle path like `<video>#subtitle:<index>`.
fn parse_embedded_subtitle_path(path: &str) -> Option<(String, u64)> {
    let sep = "#subtitle:";
    let pos = path.rfind(sep)?;
    let video_path = path[..pos].to_string();
    let index: u64 = path[pos + sep.len()..].parse().ok()?;
    Some((video_path, index))
}

/// Extract an embedded subtitle stream from a video file using ffmpeg and return it as WebVTT.
fn extract_embedded_subtitle(video_path: &str, stream_index: u64) -> Result<String, String> {
    let ffmpeg_bin = find_bundled_bin("ffmpeg")
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "ffmpeg".to_string());

    let mut cmd = std::process::Command::new(&ffmpeg_bin);
    cmd.args([
        "-v", "quiet",
        "-i", video_path,
        "-map", &format!("0:{}", stream_index),
        "-f", "webvtt",
        "pipe:1",
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output().map_err(|e| format!("Failed to run ffmpeg: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffmpeg failed: {stderr}"));
    }

    String::from_utf8(output.stdout)
        .map_err(|e| format!("ffmpeg output is not valid UTF-8: {e}"))
}

/// Convert SRT to WebVTT.
/// SRT uses commas in timestamps (00:01:02,345), VTT uses dots (00:01:02.345).
fn srt_to_vtt(srt: &str) -> String {
    let mut vtt = String::from("WEBVTT\n\n");

    // Normalize line endings
    let content = srt.replace("\r\n", "\n").replace('\r', "\n");

    for block in content.split("\n\n") {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }

        let lines: Vec<&str> = block.lines().collect();
        if lines.len() < 2 {
            continue;
        }

        // Find the timestamp line (contains " --> ")
        let ts_idx = lines.iter().position(|l| l.contains(" --> "));
        let Some(ts_idx) = ts_idx else {
            continue;
        };

        // Convert timestamp: replace commas with dots
        let timestamp = lines[ts_idx].replace(',', ".");
        vtt.push_str(&timestamp);
        vtt.push('\n');

        // Append all text lines after the timestamp, stripping HTML tags
        for line in &lines[ts_idx + 1..] {
            vtt.push_str(&strip_html_tags(line));
            vtt.push('\n');
        }
        vtt.push('\n');
    }

    vtt
}

/// Basic ASS/SSA to WebVTT conversion.
/// Extracts Dialogue lines, converts timestamps, strips formatting tags.
fn ass_to_vtt(ass: &str) -> String {
    let mut vtt = String::from("WEBVTT\n\n");

    for line in ass.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("Dialogue:") {
            continue;
        }

        // Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
        let after_prefix = &trimmed["Dialogue:".len()..].trim_start();
        let parts: Vec<&str> = after_prefix.splitn(10, ',').collect();
        if parts.len() < 10 {
            continue;
        }

        let start = ass_time_to_vtt(parts[1].trim());
        let end = ass_time_to_vtt(parts[2].trim());
        let text = parts[9]
            .replace("\\N", "\n")
            .replace("\\n", "\n");

        // Strip ASS override tags like {\b1}, {\an8}, etc.
        let clean = strip_ass_tags(&text);
        let clean = clean.trim();
        if clean.is_empty() {
            continue;
        }

        vtt.push_str(&format!("{start} --> {end}\n{clean}\n\n"));
    }

    vtt
}

/// Convert ASS timestamp (H:MM:SS.cc) to VTT (HH:MM:SS.mmm)
fn ass_time_to_vtt(ts: &str) -> String {
    // ASS: 0:00:01.50 -> VTT: 00:00:01.500
    let parts: Vec<&str> = ts.splitn(2, '.').collect();
    let hms = parts[0];
    let centiseconds: u32 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    let milliseconds = centiseconds * 10;

    let hms_parts: Vec<&str> = hms.split(':').collect();
    if hms_parts.len() == 3 {
        format!(
            "{:02}:{:02}:{:02}.{:03}",
            hms_parts[0].parse::<u32>().unwrap_or(0),
            hms_parts[1].parse::<u32>().unwrap_or(0),
            hms_parts[2].parse::<u32>().unwrap_or(0),
            milliseconds
        )
    } else {
        format!("00:00:00.{milliseconds:03}")
    }
}

/// Strip HTML tags commonly found in SRT files (<i>, <b>, <u>, <font>).
fn strip_html_tags(text: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;

    for ch in text.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' && in_tag {
            in_tag = false;
        } else if !in_tag {
            result.push(ch);
        }
    }

    result
}

/// Strip ASS override tags like {\b1}, {\an8\pos(320,50)}, etc.
fn strip_ass_tags(text: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;

    for ch in text.chars() {
        if ch == '{' && !in_tag {
            in_tag = true;
        } else if ch == '}' && in_tag {
            in_tag = false;
        } else if !in_tag {
            result.push(ch);
        }
    }

    result
}
