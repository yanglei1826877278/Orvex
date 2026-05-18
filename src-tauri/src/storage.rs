use std::{
  fs,
  path::{Path, PathBuf},
  process::Command,
  sync::Mutex,
};

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::models::{
  CreateCategoryPayload,
  CreateLauncherItemPayload,
  CreateLauncherItemFromPathPayload,
  LauncherItemKind,
  LauncherState,
  LaunchResult,
  SettingsState,
  UpdateSettingsPayload,
  UpdateCategoryPayload,
  UpdateLauncherItemPayload,
};

pub struct StorageState {
  data_dir: PathBuf,
  launcher_file: PathBuf,
  settings_file: PathBuf,
  icons_dir: PathBuf,
  state: Mutex<LauncherState>,
  settings: Mutex<SettingsState>,
}

impl StorageState {
  pub fn new(app: &AppHandle) -> Result<Self, String> {
    let data_dir = app
      .path()
      .app_data_dir()
      .map_err(|error| error.to_string())?;

    fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;

    let launcher_file = data_dir.join("app_data.json");
    let settings_file = data_dir.join("settings.json");
    let icons_dir = data_dir.join("icons");
    fs::create_dir_all(&icons_dir).map_err(|error| error.to_string())?;
    let state = if launcher_file.exists() {
      let raw = fs::read_to_string(&launcher_file).map_err(|error| error.to_string())?;
      serde_json::from_str(&raw).unwrap_or_else(|_| LauncherState::seed())
    } else {
      let seed = LauncherState::seed();
      persist_json(&launcher_file, &seed).map_err(|error| error.to_string())?;
      seed
    };

    let settings = if settings_file.exists() {
      let raw = fs::read_to_string(&settings_file).map_err(|error| error.to_string())?;
      serde_json::from_str(&raw).unwrap_or_else(|_| SettingsState::seed())
    } else {
      let seed = SettingsState::seed();
      persist_json(&settings_file, &seed).map_err(|error| error.to_string())?;
      seed
    };

    Ok(Self {
      data_dir,
      launcher_file,
      settings_file,
      icons_dir,
      state: Mutex::new(state),
      settings: Mutex::new(settings),
    })
  }

  pub fn data_dir(&self) -> String {
    self.data_dir.display().to_string()
  }

  pub fn load(&self) -> Result<LauncherState, String> {
    let state = self.state.lock().map_err(|error| error.to_string())?;
    Ok(state.clone())
  }

  pub fn load_settings(&self) -> Result<SettingsState, String> {
    let settings = self.settings.lock().map_err(|error| error.to_string())?;
    Ok(settings.clone())
  }

  pub fn create_category(&self, payload: CreateCategoryPayload) -> Result<LauncherState, String> {
    let mut state = self.state.lock().map_err(|error| error.to_string())?;
    state.create_category(payload);
    persist_json(&self.launcher_file, &*state).map_err(|error| error.to_string())?;
    Ok(state.clone())
  }

  pub fn create_item(&self, payload: CreateLauncherItemPayload) -> Result<LauncherState, String> {
    let mut state = self.state.lock().map_err(|error| error.to_string())?;
    state.create_item(payload);
    persist_json(&self.launcher_file, &*state).map_err(|error| error.to_string())?;
    Ok(state.clone())
  }

  pub fn create_item_from_path(
    &self,
    payload: CreateLauncherItemFromPathPayload,
  ) -> Result<LauncherState, String> {
    let mut state = self.state.lock().map_err(|error| error.to_string())?;
    let mut item = state.create_item_from_path(payload)?;

    if let Some(icon_relative_path) = extract_icon_to_cache(&item.id, &item.path, &self.icons_dir)? {
      if let Some(found) = state.items.iter_mut().find(|candidate| candidate.id == item.id) {
        found.icon_path = Some(icon_relative_path.clone());
        item.icon_path = Some(icon_relative_path);
      }
    }

    persist_json(&self.launcher_file, &*state).map_err(|error| error.to_string())?;
    Ok(state.clone())
  }

  pub fn update_category(&self, payload: UpdateCategoryPayload) -> Result<LauncherState, String> {
    let mut state = self.state.lock().map_err(|error| error.to_string())?;
    if !state.update_category(payload) {
      return Err("分类不存在。".into());
    }
    persist_json(&self.launcher_file, &*state).map_err(|error| error.to_string())?;
    Ok(state.clone())
  }

  pub fn update_item(&self, payload: UpdateLauncherItemPayload) -> Result<LauncherState, String> {
    let mut state = self.state.lock().map_err(|error| error.to_string())?;
    if !state.update_item(payload) {
      return Err("启动项不存在。".into());
    }
    persist_json(&self.launcher_file, &*state).map_err(|error| error.to_string())?;
    Ok(state.clone())
  }

  pub fn delete_category(&self, category_id: String) -> Result<LauncherState, String> {
    let mut state = self.state.lock().map_err(|error| error.to_string())?;
    if !state.delete_category(&category_id) {
      return Err("分类不存在，或该分类不可删除。".into());
    }
    persist_json(&self.launcher_file, &*state).map_err(|error| error.to_string())?;
    Ok(state.clone())
  }

  pub fn delete_item(&self, item_id: String) -> Result<LauncherState, String> {
    let mut state = self.state.lock().map_err(|error| error.to_string())?;
    if !state.delete_item(&item_id) {
      return Err("启动项不存在。".into());
    }
    persist_json(&self.launcher_file, &*state).map_err(|error| error.to_string())?;
    Ok(state.clone())
  }

  pub fn launch_item(&self, item_id: String) -> Result<LaunchResult, String> {
    let mut state = self.state.lock().map_err(|error| error.to_string())?;
    let item = state
      .find_item(&item_id)
      .ok_or_else(|| "启动项不存在。".to_string())?;
    state.increment_launch_count(&item_id);
    persist_json(&self.launcher_file, &*state).map_err(|error| error.to_string())?;
    drop(state);

    let launch_detail = match item.kind {
      LauncherItemKind::Url => {
        Command::new("cmd")
          .args(["/C", "start", "", &item.path])
          .spawn()
          .map_err(|error| error.to_string())?;
        "已打开网址".to_string()
      }
      LauncherItemKind::Folder | LauncherItemKind::Workspace => {
        Command::new("explorer")
          .arg(&item.path)
          .spawn()
          .map_err(|error| error.to_string())?;
        "已打开文件夹".to_string()
      }
      LauncherItemKind::App => {
        Command::new(&item.path)
          .spawn()
          .map_err(|error| error.to_string())?;
        "已启动应用".to_string()
      }
    };

    Ok(LaunchResult {
      item_id,
      launched: true,
      detail: launch_detail,
    })
  }

  pub fn update_settings(&self, payload: UpdateSettingsPayload) -> Result<SettingsState, String> {
    let mut settings = self.settings.lock().map_err(|error| error.to_string())?;
    settings.theme = payload.theme;
    persist_json(&self.settings_file, &*settings).map_err(|error| error.to_string())?;
    Ok(settings.clone())
  }
}

fn persist_json<T: Serialize>(path: &Path, state: &T) -> Result<(), std::io::Error> {
  let content = serde_json::to_string_pretty(state)
    .map_err(|error| std::io::Error::other(error.to_string()))?;
  let temp_path = path.with_extension("json.tmp");
  fs::write(&temp_path, content)?;
  if path.exists() {
    fs::remove_file(path)?;
  }
  fs::rename(temp_path, path)?;
  Ok(())
}

fn extract_icon_to_cache(
  item_id: &str,
  source_path: &str,
  icons_dir: &Path,
) -> Result<Option<String>, String> {
  let lower = source_path.to_ascii_lowercase();
  let supports_icon = lower.ends_with(".exe") || lower.ends_with(".lnk");

  if !supports_icon {
    return Ok(None);
  }

  let output_path = icons_dir.join(format!("{item_id}.png"));
  let escaped_source = source_path.replace('\'', "''");
  let escaped_output = output_path.to_string_lossy().replace('\'', "''");

  let script = format!(
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Drawing; \
     $path='{escaped_source}'; \
     $output='{escaped_output}'; \
     $icon=[System.Drawing.Icon]::ExtractAssociatedIcon($path); \
     if ($null -eq $icon) {{ exit 2 }}; \
     $bitmap=$icon.ToBitmap(); \
     $bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png);"
  );

  let status = Command::new("powershell")
    .args(["-NoProfile", "-Command", &script])
    .status()
    .map_err(|error| error.to_string())?;

  if !status.success() {
    return Ok(None);
  }

  Ok(Some(format!("icons/{item_id}.png")))
}

#[tauri::command]
pub fn load_launcher_state(storage: tauri::State<'_, StorageState>) -> Result<LauncherState, String> {
  storage.load()
}

#[tauri::command]
pub fn get_storage_directory(storage: tauri::State<'_, StorageState>) -> String {
  storage.data_dir()
}

#[tauri::command]
pub fn load_settings_state(storage: tauri::State<'_, StorageState>) -> Result<SettingsState, String> {
  storage.load_settings()
}

#[tauri::command]
pub fn create_category(
  payload: CreateCategoryPayload,
  storage: tauri::State<'_, StorageState>,
) -> Result<LauncherState, String> {
  storage.create_category(payload)
}

#[tauri::command]
pub fn create_launcher_item(
  payload: CreateLauncherItemPayload,
  storage: tauri::State<'_, StorageState>,
) -> Result<LauncherState, String> {
  storage.create_item(payload)
}

#[tauri::command]
pub fn create_launcher_item_from_path(
  payload: CreateLauncherItemFromPathPayload,
  storage: tauri::State<'_, StorageState>,
) -> Result<LauncherState, String> {
  storage.create_item_from_path(payload)
}

#[tauri::command]
pub fn update_category(
  payload: UpdateCategoryPayload,
  storage: tauri::State<'_, StorageState>,
) -> Result<LauncherState, String> {
  storage.update_category(payload)
}

#[tauri::command]
pub fn update_launcher_item(
  payload: UpdateLauncherItemPayload,
  storage: tauri::State<'_, StorageState>,
) -> Result<LauncherState, String> {
  storage.update_item(payload)
}

#[tauri::command]
pub fn update_settings_state(
  payload: UpdateSettingsPayload,
  storage: tauri::State<'_, StorageState>,
) -> Result<SettingsState, String> {
  storage.update_settings(payload)
}

#[tauri::command]
pub fn delete_category(
  category_id: String,
  storage: tauri::State<'_, StorageState>,
) -> Result<LauncherState, String> {
  storage.delete_category(category_id)
}

#[tauri::command]
pub fn delete_launcher_item(
  item_id: String,
  storage: tauri::State<'_, StorageState>,
) -> Result<LauncherState, String> {
  storage.delete_item(item_id)
}

#[tauri::command]
pub fn launch_item(
  item_id: String,
  storage: tauri::State<'_, StorageState>,
) -> Result<LaunchResult, String> {
  storage.launch_item(item_id)
}

#[tauri::command]
pub fn open_item_location(
  item_id: String,
  storage: tauri::State<'_, StorageState>,
) -> Result<LaunchResult, String> {
  let state = storage.state.lock().map_err(|error| error.to_string())?;
  let item = state
    .find_item(&item_id)
    .ok_or_else(|| "启动项不存在。".to_string())?;
  drop(state);

  match item.kind {
    LauncherItemKind::Url => {
      return Err("网址类型没有本地文件位置。".into());
    }
    LauncherItemKind::Folder | LauncherItemKind::Workspace => {
      Command::new("explorer")
        .arg(&item.path)
        .spawn()
        .map_err(|error| error.to_string())?;
    }
    LauncherItemKind::App => {
      Command::new("explorer")
        .args(["/select,", &item.path])
        .spawn()
        .map_err(|error| error.to_string())?;
    }
  }

  Ok(LaunchResult {
    item_id,
    launched: true,
    detail: "已打开所在位置".into(),
  })
}
