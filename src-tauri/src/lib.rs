use std::sync::Mutex;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::ShortcutEvent;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

mod models;
mod storage;

use crate::models::SettingsState;

#[derive(Default)]
struct ShortcutBindingsState {
  bindings: Mutex<ShortcutBindings>,
}

#[derive(Default, Clone, Copy)]
struct ShortcutBindings {
  panel: Option<u32>,
  todo: Option<u32>,
  picker: Option<u32>,
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

fn show_settings_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
  if let Some(settings) = app.get_webview_window("settings") {
    settings.show()?;
    settings.set_focus()?;
    return Ok(());
  }

  WebviewWindowBuilder::new(
    app,
    "settings",
    WebviewUrl::App("index.html?window=settings".into()),
  )
    .title("Orvex 设置")
    .inner_size(720.0, 560.0)
    .resizable(false)
    .maximizable(false)
    .closable(true)
    .decorations(true)
    .visible(true)
    .center()
    .build()?
    .set_focus()?;

  Ok(())
}

fn show_todo_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
  if let Some(todo_window) = app.get_webview_window("todo") {
    todo_window.show()?;
    todo_window.set_focus()?;
    return Ok(());
  }

  WebviewWindowBuilder::new(app, "todo", WebviewUrl::App("index.html?window=todo".into()))
    .title("Orvex 待办")
    .inner_size(420.0, 560.0)
    .min_inner_size(360.0, 420.0)
    .resizable(true)
    .maximizable(false)
    .closable(true)
    .decorations(true)
    .visible(true)
    .center()
    .build()?
    .set_focus()?;

  Ok(())
}

fn show_picker_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
  if let Some(picker_window) = app.get_webview_window("picker") {
    picker_window.show()?;
    picker_window.set_focus()?;
    return Ok(());
  }

  WebviewWindowBuilder::new(
    app,
    "picker",
    WebviewUrl::App("index.html?window=picker".into()),
  )
    .title("Orvex 拾色器")
    .inner_size(420.0, 520.0)
    .min_inner_size(360.0, 420.0)
    .resizable(true)
    .maximizable(false)
    .closable(true)
    .decorations(true)
    .visible(true)
    .center()
    .build()?
    .set_focus()?;

  Ok(())
}

fn show_launcher_panel<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
  if let Some(panel) = app.get_webview_window("launcher-panel") {
    panel.show()?;
    panel.set_focus()?;
  }

  Ok(())
}

fn toggle_launcher_panel<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
  if let Some(panel) = app.get_webview_window("launcher-panel") {
    if panel.is_visible()? {
      panel.hide()?;
    } else {
      panel.show()?;
      panel.set_focus()?;
    }
  }

  Ok(())
}

fn toggle_todo_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
  if let Some(todo_window) = app.get_webview_window("todo") {
    if todo_window.is_visible()? {
      todo_window.hide()?;
    } else {
      todo_window.show()?;
      todo_window.set_focus()?;
    }
    return Ok(());
  }

  show_todo_window(app)
}

fn toggle_picker_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
  if let Some(picker_window) = app.get_webview_window("picker") {
    if picker_window.is_visible()? {
      picker_window.hide()?;
    } else {
      picker_window.show()?;
      picker_window.set_focus()?;
    }
    return Ok(());
  }

  show_picker_window(app)
}

fn assign_shortcut<R: tauri::Runtime>(
  target: &mut Option<u32>,
  manager: &tauri_plugin_global_shortcut::GlobalShortcut<R>,
  enabled: bool,
  value: &str,
  label: &str,
) -> Result<(), String> {
  if !enabled || value.trim().is_empty() {
    *target = None;
    return Ok(());
  }

  let shortcut = value
    .parse::<Shortcut>()
    .map_err(|error| format!("{label}格式无效：{error}"))?;
  let shortcut_id = shortcut.id();

  match manager.register(shortcut) {
    Ok(()) => {
      *target = Some(shortcut_id);
    }
    Err(error) => {
      let message = error.to_string();
      if message.to_ascii_lowercase().contains("already registered") {
        log::warn!("{label} `{value}` 已被其他程序占用，跳过注册。");
        *target = None;
      } else {
        return Err(message);
      }
    }
  }

  Ok(())
}

fn apply_global_shortcuts<R: tauri::Runtime>(
  app: &tauri::AppHandle<R>,
  settings: &SettingsState,
) -> Result<(), String> {
  let manager = app.global_shortcut();
  manager.unregister_all().map_err(|error| error.to_string())?;

  let mut bindings = ShortcutBindings::default();

  assign_shortcut(
    &mut bindings.panel,
    manager,
    settings.panel_hotkey.enabled,
    &settings.panel_hotkey.value,
    "主面板热键",
  )?;
  assign_shortcut(
    &mut bindings.todo,
    manager,
    settings.todo_hotkey.enabled,
    &settings.todo_hotkey.value,
    "待办热键",
  )?;
  assign_shortcut(
    &mut bindings.picker,
    manager,
    settings.picker_hotkey.enabled,
    &settings.picker_hotkey.value,
    "拾色器热键",
  )?;

  let shortcut_state = app.state::<ShortcutBindingsState>();
  let mut state = shortcut_state
    .bindings
    .lock()
    .map_err(|error| error.to_string())?;
  *state = bindings;

  Ok(())
}

#[tauri::command]
fn update_settings_state(
  app: tauri::AppHandle,
  payload: models::UpdateSettingsPayload,
  storage: tauri::State<'_, storage::StorageState>,
) -> Result<SettingsState, String> {
  let next_settings = storage.update_settings(payload)?;
  apply_global_shortcuts(&app, &next_settings)?;
  Ok(next_settings)
}

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
  show_settings_window(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn hide_launcher_panel(app: tauri::AppHandle) -> Result<(), String> {
  if let Some(panel) = app.get_webview_window("launcher-panel") {
    panel.hide().map_err(|error| error.to_string())?;
  }

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      app.manage(ShortcutBindingsState::default());
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
          .with_handler(|app, _shortcut: &Shortcut, event: ShortcutEvent| {
            if event.state() != ShortcutState::Pressed {
              return;
            }

            let bindings = app.state::<ShortcutBindingsState>();
            let bindings = match bindings.bindings.lock() {
              Ok(guard) => *guard,
              Err(_) => return,
            };

            if bindings.panel == Some(event.id) {
              let _ = toggle_launcher_panel(app);
            } else if bindings.todo == Some(event.id) {
              let _ = toggle_todo_window(app);
            } else if bindings.picker == Some(event.id) {
              let _ = toggle_picker_window(app);
            }
          })
          .build(),
      )?;
      let storage = storage::StorageState::new(&app.handle())?;
      let initial_settings = storage.load_settings().unwrap_or_else(|_| SettingsState::seed());
      let show_panel_on_startup = initial_settings.show_panel_on_startup;
      app.manage(storage);
      create_launcher_panel(&app.handle())?;
      if let Err(error) = apply_global_shortcuts(&app.handle(), &initial_settings) {
        return Err(error.into());
      }
      if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.hide();
      }
      if show_panel_on_startup {
        show_launcher_panel(&app.handle())?;
      }
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
      update_settings_state,
      open_settings_window,
      hide_launcher_panel,
      storage::create_backup_archive,
      storage::restore_backup_archive,
      storage::delete_category,
      storage::delete_launcher_item,
      storage::launch_item,
      storage::open_item_location
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
