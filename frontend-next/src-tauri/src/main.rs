#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::process::{Command, Child};
use std::sync::Mutex;

struct BackendProcess(Mutex<Option<Child>>);

fn start_backend(app: &tauri::AppHandle) {
    let resource_dir = app.path().resource_dir().expect("failed to resolve resource dir");
    let backend_path = resource_dir.join("backend/royalentry");

    let child = Command::new(&backend_path)
        .env("SERVER_PORT", "3000")
        .spawn()
        .expect("failed to start backend");

    app.state::<BackendProcess>().0.lock().unwrap().replace(child);
}

fn main() {
    tauri::Builder::default()
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            start_backend(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.app_handle().try_state::<BackendProcess>() {
                    if let Some(mut child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running RoyalEntry");
}
