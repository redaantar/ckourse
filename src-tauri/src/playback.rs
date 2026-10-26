//! Local transport streams are prepared outside the course folder. Lesson paths
//! and database IDs always refer to the original; the MP4 is disposable cache.
use sha2::{Digest, Sha256};
use std::{fs, path::{Path, PathBuf}, process::Command, sync::Mutex, time::UNIX_EPOCH};
use tauri::Manager;

static PREPARATION: Mutex<()> = Mutex::new(());

fn cache_key(source: &Path) -> Result<String, String> {
    let metadata = fs::metadata(source).map_err(|e| format!("Cannot read source video: {e}"))?;
    let modified = metadata.modified().map_err(|e| e.to_string())?
        .duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let mut hash = Sha256::new();
    hash.update(format!("ts-mp4-v1\0{}\0{}\0{modified}", source.display(), metadata.len()));
    Ok(format!("{:x}", hash.finalize()))
}

fn bundled_tool(name: &str) -> Result<PathBuf, String> {
    crate::parser::find_bundled_bin(name)
        .ok_or_else(|| format!("Bundled {name} is missing. Please reinstall ckourse."))
}

fn prepare(source: &Path, cache: &Path) -> Result<PathBuf, String> {
    prepare_with_tools(source, cache, &bundled_tool("ffmpeg")?, &bundled_tool("ffprobe")?)
}

fn prepare_with_tools(source: &Path, cache: &Path, ffmpeg: &Path, ffprobe: &Path) -> Result<PathBuf, String> {
    // Serialize requests, including React StrictMode/retries, and publish only
    // complete files. No temporary file is ever placed beside the source.
    let _guard = PREPARATION.lock().map_err(|e| e.to_string())?;
    let source = source.canonicalize().map_err(|e| format!("Cannot open source video: {e}"))?;
    if !source.is_file() || !source.extension().is_some_and(|e| e.eq_ignore_ascii_case("ts")) {
        return Err("Expected a local .ts video".into());
    }
    fs::create_dir_all(cache).map_err(|e| format!("Cannot create playback cache: {e}"))?;
    let key = cache_key(&source)?;
    let destination = cache.join(format!("{key}.mp4"));
    if fs::metadata(&destination).is_ok_and(|m| m.len() > 0) {
        return Ok(destination);
    }
    let temporary = cache.join(format!("{key}-{}.tmp.mp4", uuid::Uuid::new_v4()));
    let probe = Command::new(ffprobe)
        .args(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,pix_fmt", "-of", "json"])
        .arg(&source).output().map_err(|e| format!("Cannot inspect video: {e}"))?;
    if !probe.status.success() { return Err("Cannot inspect this transport stream".into()); }
    let info: serde_json::Value = serde_json::from_slice(&probe.stdout).map_err(|e| e.to_string())?;
    let stream = &info["streams"][0];
    let copy_video = stream["codec_name"] == "h264" && stream["pix_fmt"] == "yuv420p";
    let result = (|| {
        for transcode in if copy_video { vec![false, true] } else { vec![true] } {
            let mut command = Command::new(ffmpeg);
            command.args(["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-fflags", "+genpts", "-i"])
                .arg(&source)
                .args(["-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn", "-map_metadata", "-1"]);
            if transcode {
                command.args(["-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2"]);
            } else { command.args(["-c:v", "copy"]); }
            // AAC covers TS audio codecs unsupported by WebKit (MP2, AC3, ...).
            command.args(["-c:a", "aac", "-b:a", "192k", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart"])
                .arg(&temporary);
            let output = command.output().map_err(|e| format!("Cannot prepare video: {e}"))?;
            if output.status.success() && fs::metadata(&temporary).is_ok_and(|m| m.len() > 0) {
                if cache_key(&source)? != key { return Err("Source changed during preparation. Please retry.".into()); }
                fs::rename(&temporary, &destination).map_err(|e| format!("Cannot save playback cache (check free disk space): {e}"))?;
                return Ok(destination);
            }
        }
        Err("Cannot prepare this video. Check that it is readable, unencrypted, and that the Mac has enough free disk space.".into())
    })();
    let _ = fs::remove_file(&temporary);
    result
}

#[tauri::command]
pub async fn prepare_local_video(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("playback");
    tauri::async_runtime::spawn_blocking(move || prepare(Path::new(&path), &cache)
        .map(|p| p.to_string_lossy().into_owned()))
        .await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cache_identity_tracks_source_path_and_content_metadata() {
        let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        fs::create_dir_all(&dir).unwrap();
        let a = dir.join("lesson.ts");
        let b = dir.join("other.ts");
        fs::write(&a, b"first").unwrap();
        fs::write(&b, b"first").unwrap();
        let key = cache_key(&a).unwrap();
        assert_eq!(key, cache_key(&a).unwrap());
        assert_ne!(key, cache_key(&b).unwrap());
        fs::write(&a, b"changed-length").unwrap();
        assert_ne!(key, cache_key(&a).unwrap());
        fs::remove_dir_all(dir).unwrap();
    }
    // Uses the exact native binaries shipped in the app, not Homebrew tools.
    #[cfg(target_os = "macos")]
    #[test]
    #[ignore = "requires scripts/download-ffmpeg.sh"]
    fn transport_stream_preparation_preserves_sources_and_learning_data() {
        use crate::{db, parser};
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("ckourse-media-{}", uuid::Uuid::new_v4()));
        let course = dir.join("Cours été #1");
        fs::create_dir_all(&course).unwrap();
        let bins = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries");
        let ffmpeg = bins.join("ffmpeg-aarch64-apple-darwin");
        let ffprobe = bins.join("ffprobe-aarch64-apple-darwin");
        for (name, codec, audio) in [("01 H264.TS", "libx264", true), ("02 MPEG2.ts", "mpeg2video", true), ("03 silent.ts", "libx264", false)] {
            let source = course.join(name);
            let mut generator = Command::new(&ffmpeg);
            generator.args(["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25"]);
            if audio { generator.args(["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"]); }
            assert!(generator.args(["-t", "4", "-c:v", codec, "-pix_fmt", "yuv420p", "-c:a", "mp2", "-f", "mpegts"]).arg(&source).status().unwrap().success());
            fs::set_permissions(&source, fs::Permissions::from_mode(0o444)).unwrap();
        }
        fs::set_permissions(&course, fs::Permissions::from_mode(0o555)).unwrap();
        let parsed = parser::parse_folder(&course).unwrap();
        assert_eq!(parsed.total_video_count, 3);
        let conn = db::init_db(&dir.join("database")).unwrap();
        let id = db::save_parsed_course(&conn, &parsed, &db::SaveCourseInput {
            title: "TS course".into(), author: "Test".into(), accent_color: "#abcdef".into(), category: "Test".into(),
        }).unwrap();
        let detail = db::get_course_detail(&conn, id).unwrap().unwrap();
        let lesson = &detail.sections[0].lessons[0];
        db::save_lesson_position(&conn, lesson.id, 2.25).unwrap();
        db::set_last_watched(&conn, id, lesson.id).unwrap();
        db::toggle_lesson_completed(&conn, lesson.id).unwrap();
        db::toggle_bookmark(&conn, id).unwrap();
        db::toggle_favorite(&conn, lesson.id).unwrap();
        db::add_note(&conn, id, lesson.id, &lesson.title, "At [00:02](timestamp:2): important").unwrap();
        let before = serde_json::to_value(db::get_course_detail(&conn, id).unwrap()).unwrap();
        let notes = serde_json::to_value(db::get_course_notes(&conn, id).unwrap()).unwrap();
        for entry in fs::read_dir(&course).unwrap() {
            let source = entry.unwrap().path();
            let original = fs::read(&source).unwrap();
            let cached = prepare_with_tools(&source, &dir.join("cache"), &ffmpeg, &ffprobe).unwrap();
            assert!(!cached.starts_with(&course));
            let modified = fs::metadata(&cached).unwrap().modified().unwrap();
            assert_eq!(cached, prepare_with_tools(&source, &dir.join("cache"), &ffmpeg, &ffprobe).unwrap());
            assert_eq!(modified, fs::metadata(&cached).unwrap().modified().unwrap());
            assert_eq!(original, fs::read(&source).unwrap());
            let probe = Command::new(&ffprobe).args(["-v", "error", "-show_streams", "-show_format", "-of", "json"]).arg(&cached).output().unwrap();
            let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
            assert_eq!(info["streams"][0]["codec_name"], "h264");
            let duration: f64 = info["format"]["duration"].as_str().unwrap().parse().unwrap();
            assert!((duration - 4.0).abs() < 0.25, "timeline drift: {duration}");
            assert!(Command::new(&ffmpeg).args(["-v", "error", "-ss", "2.25", "-i"]).arg(&cached).args(["-t", "0.5", "-f", "null", "-"]).status().unwrap().success());
        }
        assert_eq!(before, serde_json::to_value(db::get_course_detail(&conn, id).unwrap()).unwrap());
        assert_eq!(notes, serde_json::to_value(db::get_course_notes(&conn, id).unwrap()).unwrap());
        assert!(db::get_course_by_id(&conn, id).unwrap().unwrap().bookmarked);
        assert_eq!(fs::read_dir(&course).unwrap().count(), 3);
        let broken = dir.join("broken.ts");
        fs::write(&broken, b"invalid video").unwrap();
        assert!(prepare_with_tools(&broken, &dir.join("bad-cache"), &ffmpeg, &ffprobe).is_err());
        assert_eq!(fs::read_dir(dir.join("bad-cache")).unwrap().count(), 0);
        // A separate read-only mounted image can be supplied for an EROFS test.
        if let Ok(path) = std::env::var("CKOURSE_READONLY_SOURCE") {
            let source = Path::new(&path);
            assert!(fs::File::create(source.with_file_name("write-must-fail")).is_err());
            let original = fs::read(source).unwrap();
            prepare_with_tools(source, &dir.join("volume-cache"), &ffmpeg, &ffprobe).unwrap();
            assert_eq!(original, fs::read(source).unwrap());
        }
        fs::set_permissions(&course, fs::Permissions::from_mode(0o755)).unwrap();
        if std::env::var_os("CKOURSE_KEEP_MEDIA_TESTS").is_some() { println!("MEDIA_TEST_DIR={}", dir.display()); }
        else { fs::remove_dir_all(&dir).unwrap(); }
    }

}
