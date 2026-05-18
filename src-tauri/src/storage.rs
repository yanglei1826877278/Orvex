use std::{
  fs,
  path::{Path, PathBuf},
  process::Command,
  sync::Mutex,
  time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::models::{
  BackupArchive,
  BackgroundType,
  CreateCategoryPayload,
  CreateLauncherItemPayload,
  CreateLauncherItemFromPathPayload,
  LauncherItemKind,
  LauncherState,
  LaunchResult,
  RestoreBackupResult,
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
  backgrounds_dir: PathBuf,
  backups_dir: PathBuf,
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
    let settings_file = data_dir.join("config.json");
    let legacy_settings_file = data_dir.join("settings.json");
    let icons_dir = data_dir.join("icons");
    let backgrounds_dir = data_dir.join("backgrounds");
    let backups_dir = data_dir.join("backups");
    fs::create_dir_all(&icons_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&backgrounds_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&backups_dir).map_err(|error| error.to_string())?;
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
    } else if legacy_settings_file.exists() {
      let raw = fs::read_to_string(&legacy_settings_file).map_err(|error| error.to_string())?;
      let migrated = serde_json::from_str(&raw).unwrap_or_else(|_| SettingsState::seed());
      persist_json(&settings_file, &migrated).map_err(|error| error.to_string())?;
      migrated
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
      backgrounds_dir,
      backups_dir,
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

  pub fn import_background_image(&self, source_path: String) -> Result<String, String> {
    prepare_background_image_path(BackgroundType::Image, &source_path, &self.backgrounds_dir)
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
    let background_image_path =
      prepare_background_image_path(payload.background_type.clone(), &payload.background_image_path, &self.backgrounds_dir)?;
    settings.launch_at_startup = payload.launch_at_startup;
    settings.show_panel_on_startup = payload.show_panel_on_startup;
    settings.close_panel_after_launch = payload.close_panel_after_launch;
    settings.sort_mode = payload.sort_mode;
    settings.backup_retention_days = payload.backup_retention_days.clamp(1, 365);
    settings.theme = payload.theme;
    settings.background_type = payload.background_type;
    settings.background_image_path = background_image_path;
    settings.frosted_glass = payload.frosted_glass;
    settings.frosted_glass_strength = payload.frosted_glass_strength.clamp(0, 32);
    settings.sidebar_opacity = payload.sidebar_opacity.clamp(0, 100);
    settings.content_opacity = payload.content_opacity.clamp(0, 100);
    settings.background_opacity = payload.background_opacity.clamp(0, 100);
    settings.transparent_dragon_header = payload.transparent_dragon_header;
    settings.appearance.category_font_size = payload.appearance.category_font_size.clamp(12, 18);
    settings.appearance.category_font_color =
      normalize_hex_color(&payload.appearance.category_font_color, "#333333");
    settings.appearance.item_font_size = payload.appearance.item_font_size.clamp(11, 16);
    settings.appearance.item_font_color =
      normalize_hex_color(&payload.appearance.item_font_color, "#333333");
    settings.show_icon_titles = payload.show_icon_titles;
    settings.panel_hotkey = payload.panel_hotkey;
    settings.todo_hotkey = payload.todo_hotkey;
    settings.picker_hotkey = payload.picker_hotkey;
    settings.update_source = payload.update_source;
    persist_json(&self.settings_file, &*settings).map_err(|error| error.to_string())?;
    Ok(settings.clone())
  }

  pub fn create_backup(&self) -> Result<String, String> {
    let launcher_state = self.load()?;
    let settings_state = self.load_settings()?;
    let archive = BackupArchive {
      launcher_state,
      settings_state: settings_state.clone(),
    };
    let timestamp = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .map_err(|error| error.to_string())?
      .as_secs();
    let backup_path = self
      .backups_dir
      .join(format!("orvex-backup-{timestamp}.json"));

    persist_json(&backup_path, &archive).map_err(|error| error.to_string())?;
    cleanup_old_backups(&self.backups_dir, settings_state.backup_retention_days)?;

    Ok(backup_path.display().to_string())
  }

  pub fn restore_backup(&self, content: String) -> Result<RestoreBackupResult, String> {
    let archive: BackupArchive =
      serde_json::from_str(&content).map_err(|error| format!("备份文件无法解析：{error}"))?;

    let mut launcher_state = self.state.lock().map_err(|error| error.to_string())?;
    let mut settings_state = self.settings.lock().map_err(|error| error.to_string())?;

    *launcher_state = archive.launcher_state;
    *settings_state = archive.settings_state;

    persist_json(&self.launcher_file, &*launcher_state).map_err(|error| error.to_string())?;
    persist_json(&self.settings_file, &*settings_state).map_err(|error| error.to_string())?;

    Ok(RestoreBackupResult {
      launcher_state: launcher_state.clone(),
      settings_state: settings_state.clone(),
    })
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

fn cleanup_old_backups(backups_dir: &Path, retention_days: u32) -> Result<(), String> {
  let retention = Duration::from_secs(u64::from(retention_days.max(1)) * 24 * 60 * 60);
  let now = SystemTime::now();

  for entry in fs::read_dir(backups_dir).map_err(|error| error.to_string())? {
    let entry = entry.map_err(|error| error.to_string())?;
    let metadata = entry.metadata().map_err(|error| error.to_string())?;
    let modified = metadata.modified().map_err(|error| error.to_string())?;

    let expired = now
      .duration_since(modified)
      .map(|age| age > retention)
      .unwrap_or(false);

    if expired {
      fs::remove_file(entry.path()).map_err(|error| error.to_string())?;
    }
  }

  Ok(())
}

fn normalize_hex_color(value: &str, fallback: &str) -> String {
  let trimmed = value.trim();
  let candidate = trimmed.strip_prefix('#').unwrap_or(trimmed);

  if candidate.len() == 6 && candidate.chars().all(|character| character.is_ascii_hexdigit()) {
    return format!("#{}", candidate.to_ascii_lowercase());
  }

  fallback.to_string()
}

fn prepare_background_image_path(
  background_type: BackgroundType,
  raw_path: &str,
  backgrounds_dir: &Path,
) -> Result<String, String> {
  if !matches!(background_type, BackgroundType::Image) {
    return Ok(String::new());
  }

  let trimmed = raw_path.trim();
  if trimmed.is_empty() {
    return Ok(String::new());
  }

  let source_path = Path::new(trimmed);
  if !source_path.exists() {
    return Err("背景图片不存在，请重新选择。".into());
  }

  let extension = source_path
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| value.to_ascii_lowercase())
    .unwrap_or_else(|| "png".to_string());
  let target_path = backgrounds_dir.join(format!("panel-background.{extension}"));

  if source_path == target_path {
    return Ok(target_path.display().to_string());
  }

  fs::copy(source_path, &target_path)
    .map_err(|error| format!("复制背景图片失败：{error}"))?;

  Ok(target_path.display().to_string())
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
pub fn import_background_image(
  source_path: String,
  storage: tauri::State<'_, StorageState>,
) -> Result<String, String> {
  storage.import_background_image(source_path)
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
pub fn create_backup_archive(storage: tauri::State<'_, StorageState>) -> Result<String, String> {
  storage.create_backup()
}

#[tauri::command]
pub fn restore_backup_archive(
  content: String,
  storage: tauri::State<'_, StorageState>,
) -> Result<RestoreBackupResult, String> {
  storage.restore_backup(content)
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
