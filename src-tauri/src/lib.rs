#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|_app| {
            // En Tauri, la app se sirve desde el webview integrado.
            // PouchDB usa IndexedDB del webview, que funciona en Tauri 2.
            // No necesita configuración adicional — la SPA detecta
            // automáticamente que está standalone (no en iframe) y
            // usa el backend PouchDB.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
