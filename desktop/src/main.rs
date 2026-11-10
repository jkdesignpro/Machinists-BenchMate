// Machinists BenchMate desktop wrapper (Tauri 2).
// Serves the static UI in ../app from the app bundle; nothing is loaded from
// the network. The only native API the page can reach is `save_file`.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

const BRIDGE_JS: &str = include_str!("bridge.js");

/// File-type filter for the save dialog, from the suggested file name.
fn filter_for(name: &str, mime: &str) -> Option<(&'static str, &'static str)> {
    let ext = name.rsplit_once('.').map(|(_, e)| e.to_ascii_lowercase());
    match (ext.as_deref(), mime) {
        (Some("dxf"), _) | (_, "application/dxf") => Some(("DXF drawing", "dxf")),
        (Some("json"), _) | (_, "application/json") => Some(("JSON file", "json")),
        (Some("csv"), _) | (_, "text/csv") => Some(("CSV file", "csv")),
        (Some("nc"), _) => Some(("NC program", "nc")),
        (Some("txt"), _) | (_, "text/plain") => Some(("Text file", "txt")),
        _ => None,
    }
}

/// Keep only a plain file name (no folders) for the dialog's suggestion.
fn clean_name(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or("");
    let base: String = base.chars().filter(|c| !c.is_control()).collect();
    if base.trim().is_empty() {
        "benchmate.txt".into()
    } else {
        base
    }
}

/// Show a native save dialog and write `contents` to the chosen file.
/// Returns the saved path, or None when the user cancels.
#[tauri::command]
async fn save_file(
    app: tauri::AppHandle,
    name: String,
    contents: String,
    mime: String,
) -> Result<Option<String>, String> {
    let name = clean_name(&name);
    let mut dialog = app.dialog().file().set_file_name(&name);
    if let Some((label, ext)) = filter_for(&name, &mime) {
        dialog = dialog.add_filter(label, &[ext]);
    }
    let Some(picked) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, contents.as_bytes()).map_err(|e| e.to_string())?;
    Ok(Some(path.display().to_string()))
}

/// Only the bundled UI may be shown in the window.
fn is_local(url: &tauri::Url) -> bool {
    match url.scheme() {
        "tauri" | "about" | "blob" => true,
        "http" | "https" => url.host_str() == Some("tauri.localhost"),
        _ => false,
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_file])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Machinists BenchMate")
                .inner_size(1280.0, 840.0)
                .min_inner_size(480.0, 400.0)
                .center()
                .initialization_script(BRIDGE_JS)
                .on_navigation(is_local)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Machinists BenchMate");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_plain_file_names() {
        assert_eq!(clean_name("../../etc/passwd"), "passwd");
        assert_eq!(clean_name("C:\\x\\part.dxf"), "part.dxf");
        assert_eq!(clean_name(""), "benchmate.txt");
    }

    #[test]
    fn filters_follow_extension_or_type() {
        assert_eq!(filter_for("a.DXF", ""), Some(("DXF drawing", "dxf")));
        assert_eq!(filter_for("tools", "application/json"), Some(("JSON file", "json")));
        assert_eq!(filter_for("x.bin", ""), None);
    }

    #[test]
    fn only_bundled_pages_load() {
        let ok = |s: &str| is_local(&tauri::Url::parse(s).unwrap());
        assert!(ok("tauri://localhost/index.html"));
        assert!(ok("http://tauri.localhost/index.html"));
        assert!(!ok("https://example.com/"));
    }
}
