// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK's DMA-BUF renderer paints the video black for a moment
    // whenever playback flushes (changing speed, seeking) on some GPU and
    // Wayland setups, e.g. Intel + NVIDIA laptops. Must be set before WebKit
    // starts; a value the user set themselves wins.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    ckourse_lib::run()
}
