use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

mod models;
mod storage;

#[derive(Default)]
struct PanelBehaviorState {
  auto_hide_on_blur: AtomicBool,
}

fn create_launcher_panel<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
  if app.get_webview_window("launcher-panel").is_some() {
    return Ok(());
  }

  WebviewWindowBuilder::new(app, "launcher-panel", WebviewUrl::App("index.html".into()))
    .title("Orvex Launcher Panel")
    .inner_size(720.0, 480.0)
    .min_inner_size(520.0, 360.0)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .shadow(true)
    .visible(false)
    .build()?;

  Ok(())
}

fn set_panel_auto_hide<R: tauri::Runtime>(app: &tauri::AppHandle<R>, enabled: bool) {
  app
    .state::<PanelBehaviorState>()
    .auto_hide_on_blur
    .store(enabled, Ordering::Relaxed);
}

fn show_launcher_panel<R: tauri::Runtime>(
  app: &tauri::AppHandle<R>,
  enable_auto_hide: bool,
) -> tauri::Result<()> {
  set_panel_auto_hide(app, enable_auto_hide);
  if let Some(panel) = app.get_webview_window("launcher-panel") {
    panel.show()?;
    panel.set_focus()?;
  }

  Ok(())
}

fn toggle_launcher_panel<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
  if let Some(panel) = app.get_webview_window("launcher-panel") {
    if panel.is_visible()? {
      set_panel_auto_hide(app, false);
      panel.hide()?;
    } else {
      set_panel_auto_hide(app, true);
      panel.show()?;
      panel.set_focus()?;
    }
  }

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .on_window_event(|window, event| {
      if window.label() == "launcher-panel" {
        if let WindowEvent::Focused(focused) = event {
          let auto_hide_enabled = window
            .app_handle()
            .state::<PanelBehaviorState>()
            .auto_hide_on_blur
            .load(Ordering::Relaxed);
          if !focused && auto_hide_enabled {
            window
              .app_handle()
              .state::<PanelBehaviorState>()
              .auto_hide_on_blur
              .store(false, Ordering::Relaxed);
            let _ = window.hide();
          }
        }
      }
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      app.manage(PanelBehaviorState::default());
      app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
          .with_handler(|app, shortcut, event| {
            if shortcut.matches(Modifiers::CONTROL, Code::KeyQ)
              && event.state() == ShortcutState::Pressed
            {
              let _ = toggle_launcher_panel(app);
            }
          })
          .build(),
      )?;
      let storage = storage::StorageState::new(&app.handle())?;
      app.manage(storage);
      create_launcher_panel(&app.handle())?;
      let launcher_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyQ);
      if let Err(error) = app.global_shortcut().register(launcher_shortcut) {
        if error.to_string().to_ascii_lowercase().contains("already registered") {
          log::warn!("global shortcut Ctrl+Q already registered by another process, skipping registration");
        } else {
          return Err(error.into());
        }
      }
      if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.hide();
      }
      show_launcher_panel(&app.handle(), false)?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      storage::load_launcher_state,
      storage::load_settings_state,
      storage::get_storage_directory,
      storage::create_category,
      storage::create_launcher_item,
      storage::create_launcher_item_from_path,
      storage::update_category,
      storage::update_launcher_item,
      storage::update_settings_state,
      storage::delete_category,
      storage::delete_launcher_item,
      storage::launch_item,
      storage::open_item_location
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
