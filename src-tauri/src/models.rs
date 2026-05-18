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
  pub sort_mode: SortMode,
  pub backup_retention_days: u32,
  pub theme: ThemeMode,
  pub background_type: BackgroundType,
  pub background_image_path: String,
  pub frosted_glass: bool,
  pub card_opacity: u8,
  pub background_opacity: u8,
  pub show_icon_titles: bool,
  pub panel_hotkey: HotkeySetting,
  pub todo_hotkey: HotkeySetting,
  pub picker_hotkey: HotkeySetting,
  pub update_source: UpdateSource,
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
  pub category_id: String,
  pub name: String,
  pub alias: String,
  pub kind: LauncherItemKind,
  pub summary: String,
  pub path: String,
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
  pub sort_mode: SortMode,
  pub backup_retention_days: u32,
  pub theme: ThemeMode,
  pub background_type: BackgroundType,
  pub background_image_path: String,
  pub frosted_glass: bool,
  pub card_opacity: u8,
  pub background_opacity: u8,
  pub show_icon_titles: bool,
  pub panel_hotkey: HotkeySetting,
  pub todo_hotkey: HotkeySetting,
  pub picker_hotkey: HotkeySetting,
  pub update_source: UpdateSource,
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
      categories: vec![
        Category {
          id: "all".into(),
          title: "全部项目".into(),
          caption: "总览视图".into(),
          description: "总览当前最常用的启动入口，适合做默认面板。".into(),
          accent: "#d36c44".into(),
          sort: 0,
        },
        Category {
          id: "dev".into(),
          title: "开发工具".into(),
          caption: "编码与交付".into(),
          description: "把编辑器、终端、容器和接口调试工具拢到一处。".into(),
          accent: "#499287".into(),
          sort: 1,
        },
        Category {
          id: "workspace".into(),
          title: "工作资料".into(),
          caption: "文档与记录".into(),
          description: "文档、白板和知识库都从这里滑进来。".into(),
          accent: "#d8b36a".into(),
          sort: 2,
        },
        Category {
          id: "system".into(),
          title: "系统工具".into(),
          caption: "设备与控制".into(),
          description: "PowerShell、设置与桌面操作在这里预留位置。".into(),
          accent: "#9a7eff".into(),
          sort: 3,
        },
      ],
      items: vec![
        LauncherItem {
          id: "code".into(),
          category_id: "dev".into(),
          name: "VS Code".into(),
          alias: "主力编辑器".into(),
          kind: LauncherItemKind::App,
          summary: "编辑项目、读 PRD、继续往 Tauri 和 Rust 模块里写代码。".into(),
          path: "C:\\Tools\\Microsoft VS Code\\Code.exe".into(),
          icon_path: None,
          hotkey: "01".into(),
          usage: "已启动 42 次".into(),
          monogram: "VS".into(),
          accent: "#2f80ed".into(),
          launch_count: 42,
        },
        LauncherItem {
          id: "terminal".into(),
          category_id: "system".into(),
          name: "PowerShell".into(),
          alias: "命令行入口".into(),
          kind: LauncherItemKind::App,
          summary: "执行 Cargo、npm、Tauri 命令和本地自动化脚本。".into(),
          path: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe".into(),
          icon_path: None,
          hotkey: "02".into(),
          usage: "已启动 33 次".into(),
          monogram: "PS".into(),
          accent: "#4bb5ff".into(),
          launch_count: 33,
        },
        LauncherItem {
          id: "docker".into(),
          category_id: "dev".into(),
          name: "Docker Desktop".into(),
          alias: "运行环境总控".into(),
          kind: LauncherItemKind::App,
          summary: "给后面的本地服务、Everything 集成和辅助进程预热环境。".into(),
          path: "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe".into(),
          icon_path: None,
          hotkey: "03".into(),
          usage: "已启动 18 次".into(),
          monogram: "DK".into(),
          accent: "#1d9bf0".into(),
          launch_count: 18,
        },
        LauncherItem {
          id: "postman".into(),
          category_id: "dev".into(),
          name: "Postman".into(),
          alias: "接口调试台".into(),
          kind: LauncherItemKind::App,
          summary: "后面调试更新源、图标服务或插件接口时会用到。".into(),
          path: "C:\\Users\\Public\\Postman.lnk".into(),
          icon_path: None,
          hotkey: "04".into(),
          usage: "已启动 9 次".into(),
          monogram: "PM".into(),
          accent: "#ff7f50".into(),
          launch_count: 9,
        },
        LauncherItem {
          id: "figma".into(),
          category_id: "workspace".into(),
          name: "Figma Board".into(),
          alias: "界面草图板".into(),
          kind: LauncherItemKind::Url,
          summary: "沉淀视觉稿、窗口比例和后续图标语言。".into(),
          path: "https://figma.com/files/orvex".into(),
          icon_path: None,
          hotkey: "05".into(),
          usage: "已访问 12 次".into(),
          monogram: "FG".into(),
          accent: "#ef5da8".into(),
          launch_count: 12,
        },
        LauncherItem {
          id: "docs".into(),
          category_id: "workspace".into(),
          name: "项目文档".into(),
          alias: "PRD 档案".into(),
          kind: LauncherItemKind::Folder,
          summary: "当前的 PRD、后续设计说明和开发记录都从这里打开。".into(),
          path: "I:\\Project\\Rust\\Orvex\\文档".into(),
          icon_path: None,
          hotkey: "06".into(),
          usage: "已打开 27 次".into(),
          monogram: "MD".into(),
          accent: "#d8b36a".into(),
          launch_count: 27,
        },
        LauncherItem {
          id: "settings".into(),
          category_id: "system".into(),
          name: "Windows 设置".into(),
          alias: "系统开关".into(),
          kind: LauncherItemKind::App,
          summary: "以后调自启、通知权限和多显示器测试时会频繁切这里。".into(),
          path: "ms-settings:".into(),
          icon_path: None,
          hotkey: "07".into(),
          usage: "已启动 11 次".into(),
          monogram: "WS".into(),
          accent: "#9a7eff".into(),
          launch_count: 11,
        },
        LauncherItem {
          id: "repo".into(),
          category_id: "dev".into(),
          name: "Orvex 工作区".into(),
          alias: "当前仓库".into(),
          kind: LauncherItemKind::Workspace,
          summary: "直接回到仓库根目录，接着推进 Rust 与 React 双栈开发。".into(),
          path: "I:\\Project\\Rust\\Orvex".into(),
          icon_path: None,
          hotkey: "08".into(),
          usage: "常驻置顶".into(),
          monogram: "OX".into(),
          accent: "#57c785".into(),
          launch_count: 99,
        },
      ],
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
    let item = LauncherItem {
      id: format!("item-{}", Uuid::new_v4().simple()),
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
      sort_mode: SortMode::Custom,
      backup_retention_days: 7,
      theme: ThemeMode::Dark,
      background_type: BackgroundType::Solid,
      background_image_path: String::new(),
      frosted_glass: true,
      card_opacity: 92,
      background_opacity: 88,
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

impl Default for ThemeMode {
  fn default() -> Self {
    Self::Dark
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
