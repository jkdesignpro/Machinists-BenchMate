fn main() {
    // Declaring the app's commands makes Tauri generate an `allow-save-file`
    // permission, so the capability file must grant it explicitly.
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["save_file"])),
    )
    .expect("failed to run tauri-build");
}
