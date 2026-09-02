use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // En Tauri, la app se sirve desde el webview integrado.
            // PouchDB usa IndexedDB del webview, que funciona en Tauri 2.
            // No necesita configuración adicional — la SPA detecta
            // automáticamente que está standalone (no en iframe) y
            // usa el backend PouchDB.

            // Check de actualizaciones al arrancar (desktop).
            // El updater plugin está configurado en tauri.conf.json con
            // endpoints + pubkey. Si hay una versión nueva, muestra un
            // diálogo preguntando si actualizar. Si el usuario acepta,
            // descarga e instala el nuevo paquete (.deb/.rpm/.AppImage en
            // Linux, .msi/.exe en Windows, .dmg/.app en macOS) y reinicia.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match handle.updater() {
                    Ok(updater) => match updater.check().await {
                        Ok(Some(update)) => {
                            let body = format!(
                                "Hay una nueva versión de LOF (v{}).\n\n¿Querés actualizar ahora?\n\nLa app se va a cerrar y se va a instalar la nueva versión.",
                                update.version
                            );
                            let should_update = handle
                                .dialog()
                                .message(body)
                                .title("Nueva versión disponible")
                                .buttons(MessageDialogButtons::OkCancel)
                                .kind(MessageDialogKind::Info)
                                .blocking_show();

                            if should_update {
                                match update
                                    .download_and_install(
                                        |_, _| {},
                                        || {},
                                    )
                                    .await
                                {
                                    Ok(_) => {
                                        // En Windows, download_and_install
                                        // ya lanza el installer y sale. En
                                        // Linux/macOS hay que reiniciar.
                                        handle.restart();
                                    }
                                    Err(e) => {
                                        eprintln!("Error al instalar la actualización: {e}");
                                        let _ = handle
                                            .dialog()
                                            .message(format!(
                                                "No se pudo instalar la actualización: {e}\n\nPodés descargarla manualmente desde github.com/sosamilton/lof-pba/releases"
                                            ))
                                            .title("Error de actualización")
                                            .kind(MessageDialogKind::Error)
                                            .blocking_show();
                                    }
                                }
                            }
                        }
                        Ok(None) => {
                            // No hay actualizaciones — silencioso
                        }
                        Err(e) => {
                            eprintln!("Error al buscar actualizaciones: {e}");
                        }
                    },
                    Err(e) => {
                        eprintln!("Error al iniciar el updater: {e}");
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
