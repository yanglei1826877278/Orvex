use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
  pub id: String,
  pub title: String,
  pub caption: String,
  pub description: String,
  pub accent: String,
  pub sort: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherItem {
  pub id: String,
  pub order: u32,
  pub category_id: String,
  pub name: String,
  pub alias: String,
  pub kind: LauncherItemKind,
  pub summary: String,
  pub path: String,
  pub icon_path: Option<String>,
  pub hotkey: String,
  pub usage: String,
  pub monogram: String,
  pub accent: String,
  pub launch_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LauncherItemKind {
  App,
  Folder,
  Workspace,
  Url,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherState {
  pub categories: Vec<Category>,
  pub items: Vec<LauncherItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SettingsState {
  pub launch_at_startup: bool,
  pub show_panel_on_startup: bool,
  pub close_panel_after_launch: bool,
  pub sort_mode: SortMode,
  pub backup_retention_days: u32,
  pub theme: ThemeMode,
  pub background_type: BackgroundType,
  pub background_image_path: String,
  pub frosted_glass: bool,
  pub frosted_glass_strength: u8,
  pub sidebar_opacity: u8,
  pub content_opacity: u8,
  pub background_opacity: u8,
  #[serde(default = "default_item_card_color")]
  pub item_card_color: String,
  #[serde(default = "default_item_card_opacity")]
  pub item_card_opacity: u8,
  #[serde(default = "default_icon_shell_color")]
  pub icon_shell_color: String,
  #[serde(default = "default_icon_shell_opacity")]
  pub icon_shell_opacity: u8,
  pub transparent_dragon_header: bool,
  pub appearance: AppearanceSettings,
  pub show_category_counts: bool,
  pub show_icon_titles: bool,
  pub panel_hotkey: HotkeySetting,
  pub todo_hotkey: HotkeySetting,
  pub picker_hotkey: HotkeySetting,
  pub update_source: UpdateSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceSettings {
  pub category_font_size: u8,
  pub category_font_color: String,
  pub item_font_size: u8,
  pub item_font_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
  Dark,
  Light,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortMode {
  Custom,
  Usage,
  Name,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BackgroundType {
  Image,
  Solid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UpdateSource {
  Gitee,
  Github,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct HotkeySetting {
  pub value: String,
  pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryPayload {
  pub title: String,
  pub caption: String,
  pub description: String,
  pub accent: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLauncherItemPayload {
  pub category_id: String,
  pub name: String,
  pub alias: String,
  pub kind: LauncherItemKind,
  pub summary: String,
  pub path: String,
  pub icon_source_path: Option<String>,
  pub hotkey: String,
  pub usage: String,
  pub monogram: String,
  pub accent: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLauncherItemFromPathPayload {
  pub category_id: String,
  pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryPayload {
  pub id: String,
  pub title: String,
  pub caption: String,
  pub description: String,
  pub accent: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLauncherItemPayload {
  pub id: String,
  pub order: u32,
  pub category_id: String,
  pub name: String,
  pub alias: String,
  pub kind: LauncherItemKind,
  pub summary: String,
  pub path: String,
  pub icon_source_path: Option<String>,
  pub hotkey: String,
  pub usage: String,
  pub monogram: String,
  pub accent: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsPayload {
  pub launch_at_startup: bool,
  pub show_panel_on_startup: bool,
  pub close_panel_after_launch: bool,
  pub sort_mode: SortMode,
  pub backup_retention_days: u32,
  pub theme: ThemeMode,
  pub background_type: BackgroundType,
  pub background_image_path: String,
  pub frosted_glass: bool,
  pub frosted_glass_strength: u8,
  pub sidebar_opacity: u8,
  pub content_opacity: u8,
  pub background_opacity: u8,
  pub item_card_color: String,
  pub item_card_opacity: u8,
  pub icon_shell_color: String,
  pub icon_shell_opacity: u8,
  pub transparent_dragon_header: bool,
  pub appearance: AppearanceSettings,
  pub show_category_counts: bool,
  pub show_icon_titles: bool,
  pub panel_hotkey: HotkeySetting,
  pub todo_hotkey: HotkeySetting,
  pub picker_hotkey: HotkeySetting,
  pub update_source: UpdateSource,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderLauncherItemsPayload {
  pub item_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResult {
  pub item_id: String,
  pub launched: bool,
  pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupArchive {
  pub launcher_state: LauncherState,
  pub settings_state: SettingsState,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreBackupResult {
  pub launcher_state: LauncherState,
  pub settings_state: SettingsState,
}

impl LauncherState {
  pub fn seed() -> Self {
    Self {
      categories: vec![],
      items: vec![],
    }
  }

  pub fn create_category(&mut self, payload: CreateCategoryPayload) -> Category {
    let next_sort = self
      .categories
      .iter()
      .map(|category| category.sort)
      .max()
      .unwrap_or(0)
      + 1;

    let category = Category {
      id: format!("cat-{}", Uuid::new_v4().simple()),
      title: payload.title,
      caption: payload.caption,
      description: payload.description,
      accent: payload.accent,
      sort: next_sort,
    };

    self.categories.push(category.clone());
    category
  }

  pub fn create_item(&mut self, payload: CreateLauncherItemPayload) -> LauncherItem {
    let next_order = self
      .items
      .iter()
      .map(|item| item.order)
      .max()
      .unwrap_or(0)
      .saturating_add(1);

    let item = LauncherItem {
      id: format!("item-{}", Uuid::new_v4().simple()),
      order: next_order,
      category_id: payload.category_id,
      name: payload.name,
      alias: payload.alias,
      kind: payload.kind,
      summary: payload.summary,
      path: payload.path,
      icon_path: None,
      hotkey: payload.hotkey,
      usage: payload.usage,
      monogram: payload.monogram,
      accent: payload.accent,
      launch_count: 0,
    };

    self.items.push(item.clone());
    item
  }

  pub fn create_item_from_path(
    &mut self,
    payload: CreateLauncherItemFromPathPayload,
  ) -> Result<LauncherItem, String> {
    let path = Path::new(&payload.path);
    let file_name = path
      .file_name()
      .and_then(|value| value.to_str())
      .ok_or_else(|| "无法识别拖入文件名。".to_string())?;
    let stem = path
      .file_stem()
      .and_then(|value| value.to_str())
      .ok_or_else(|| "无法识别拖入文件名称。".to_string())?;
    let extension = path
      .extension()
      .and_then(|value| value.to_str())
      .unwrap_or_default()
      .to_ascii_lowercase();

    let kind = match extension.as_str() {
      "exe" | "lnk" | "bat" | "cmd" => LauncherItemKind::App,
      _ => {
        if path.is_dir() {
          LauncherItemKind::Folder
        } else {
          LauncherItemKind::App
        }
      }
    };

    let monogram = stem
      .chars()
      .filter(|value| !value.is_whitespace() && *value != '-' && *value != '_')
      .take(2)
      .collect::<String>()
      .to_uppercase();

    let item = LauncherItem {
      id: format!("item-{}", Uuid::new_v4().simple()),
      order: self
        .items
        .iter()
        .map(|item| item.order)
        .max()
        .unwrap_or(0)
        .saturating_add(1),
      category_id: payload.category_id,
      name: stem.to_string(),
      alias: file_name.to_string(),
      kind,
      summary: "拖入生成的启动项".into(),
      path: payload.path,
      icon_path: None,
      hotkey: String::new(),
      usage: "新导入".into(),
      monogram: if monogram.is_empty() {
        "AP".into()
      } else {
        monogram
      },
      accent: "#1d4ed8".into(),
      launch_count: 0,
    };

    self.items.push(item.clone());
    Ok(item)
  }

  pub fn update_category(&mut self, payload: UpdateCategoryPayload) -> bool {
    if let Some(category) = self.categories.iter_mut().find(|category| category.id == payload.id) {
      category.title = payload.title;
      category.caption = payload.caption;
      category.description = payload.description;
      category.accent = payload.accent;
      return true;
    }

    false
  }

  pub fn update_item(&mut self, payload: UpdateLauncherItemPayload) -> bool {
    if let Some(item) = self.items.iter_mut().find(|item| item.id == payload.id) {
      item.order = payload.order;
      item.category_id = payload.category_id;
      item.name = payload.name;
      item.alias = payload.alias;
      item.kind = payload.kind;
      item.summary = payload.summary;
      item.path = payload.path;
      item.icon_path = None;
      item.hotkey = payload.hotkey;
      item.usage = payload.usage;
      item.monogram = payload.monogram;
      item.accent = payload.accent;
      return true;
    }

    false
  }

  pub fn delete_category(&mut self, category_id: &str) -> bool {
    if category_id == "all" {
      return false;
    }

    let before = self.categories.len();
    self.categories.retain(|category| category.id != category_id);
    self.items.retain(|item| item.category_id != category_id);
    before != self.categories.len()
  }

  pub fn delete_item(&mut self, item_id: &str) -> bool {
    let before = self.items.len();
    self.items.retain(|item| item.id != item_id);
    before != self.items.len()
  }

  pub fn find_item(&self, item_id: &str) -> Option<LauncherItem> {
    self.items.iter().find(|item| item.id == item_id).cloned()
  }

  pub fn reorder_items(&mut self, item_ids: &[String]) -> bool {
    if item_ids.len() != self.items.len() {
      return false;
    }

    let expected_ids = self
      .items
      .iter()
      .map(|item| item.id.as_str())
      .collect::<std::collections::HashSet<_>>();
    let received_ids = item_ids
      .iter()
      .map(|item_id| item_id.as_str())
      .collect::<std::collections::HashSet<_>>();

    if expected_ids != received_ids {
      return false;
    }

    for (index, item_id) in item_ids.iter().enumerate() {
      if let Some(item) = self.items.iter_mut().find(|item| item.id == *item_id) {
        item.order = index as u32;
      }
    }

    self.items.sort_by_key(|item| item.order);
    true
  }

  pub fn increment_launch_count(&mut self, item_id: &str) -> bool {
    if let Some(item) = self.items.iter_mut().find(|item| item.id == item_id) {
      item.launch_count += 1;
      item.usage = match item.kind {
        LauncherItemKind::Url => format!("已访问 {} 次", item.launch_count),
        LauncherItemKind::Folder | LauncherItemKind::Workspace => {
          format!("已打开 {} 次", item.launch_count)
        }
        LauncherItemKind::App => format!("已启动 {} 次", item.launch_count),
      };
      return true;
    }

    false
  }
}

impl SettingsState {
  pub fn seed() -> Self {
    Self {
      launch_at_startup: false,
      show_panel_on_startup: true,
      close_panel_after_launch: false,
      sort_mode: SortMode::Custom,
      backup_retention_days: 7,
      theme: ThemeMode::Light,
      background_type: BackgroundType::Solid,
      background_image_path: String::new(),
      frosted_glass: true,
      frosted_glass_strength: 14,
      sidebar_opacity: 92,
      content_opacity: 92,
      background_opacity: 88,
      item_card_color: default_item_card_color(),
      item_card_opacity: default_item_card_opacity(),
      icon_shell_color: default_icon_shell_color(),
      icon_shell_opacity: default_icon_shell_opacity(),
      transparent_dragon_header: false,
      appearance: AppearanceSettings {
        category_font_size: 14,
        category_font_color: "#333333".into(),
        item_font_size: 13,
        item_font_color: "#333333".into(),
      },
      show_category_counts: true,
      show_icon_titles: true,
      panel_hotkey: HotkeySetting {
        value: "Ctrl+Q".into(),
        enabled: true,
      },
      todo_hotkey: HotkeySetting {
        value: "Ctrl+Shift+Q".into(),
        enabled: true,
      },
      picker_hotkey: HotkeySetting {
        value: String::new(),
        enabled: false,
      },
      update_source: UpdateSource::Gitee,
    }
  }
}

impl Default for SettingsState {
  fn default() -> Self {
    Self::seed()
  }
}

impl Default for AppearanceSettings {
  fn default() -> Self {
    Self {
      category_font_size: 14,
      category_font_color: "#333333".into(),
      item_font_size: 13,
      item_font_color: "#333333".into(),
    }
  }
}

impl Default for ThemeMode {
  fn default() -> Self {
    Self::Light
  }
}

impl Default for SortMode {
  fn default() -> Self {
    Self::Custom
  }
}

impl Default for BackgroundType {
  fn default() -> Self {
    Self::Solid
  }
}

impl Default for UpdateSource {
  fn default() -> Self {
    Self::Gitee
  }
}

fn default_icon_shell_color() -> String {
  "#ffffff".into()
}

fn default_item_card_color() -> String {
  "#ffffff".into()
}

fn default_item_card_opacity() -> u8 {
  78
}

fn default_icon_shell_opacity() -> u8 {
  94
}
