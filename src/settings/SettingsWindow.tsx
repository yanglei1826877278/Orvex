import { emit } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import {
  closeWindow,
  createBackupArchive,
  importBackgroundImage,
  restoreBackupArchive,
} from '../lib/tauri'
import { useLauncherState } from '../hooks/useLauncherState'
import type {
  AppearanceSettings,
  HotkeySetting,
  SettingsState,
  SortMode,
  ThemeMode,
  UpdateSource,
} from '../types/launcher'

type SettingsTab = 'general' | 'appearance' | 'hotkeys' | 'about'

const tabs: Array<{ key: SettingsTab; label: string }> = [
  { key: 'general', label: '通用' },
  { key: 'appearance', label: '外观' },
  { key: 'hotkeys', label: '热键' },
  { key: 'about', label: '关于' },
]

const fontColorPresets = ['#111111', '#333333', '#555555', '#1a56db', '#047857', '#b91c1c']

function SettingsWindow() {
  const { settingsState, loading, error, updateSettings } = useLauncherState()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [draft, setDraft] = useState<SettingsState | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (settingsState) {
      setDraft(settingsState)
    }
  }, [settingsState])

  useEffect(() => {
    if (!draft || !settingsState) {
      return
    }

    const hasChanged =
      draft.theme !== settingsState.theme ||
      draft.backgroundType !== settingsState.backgroundType ||
      draft.backgroundImagePath !== settingsState.backgroundImagePath ||
      draft.frostedGlass !== settingsState.frostedGlass ||
      draft.frostedGlassStrength !== settingsState.frostedGlassStrength ||
      draft.sidebarOpacity !== settingsState.sidebarOpacity ||
      draft.contentOpacity !== settingsState.contentOpacity ||
      draft.backgroundOpacity !== settingsState.backgroundOpacity ||
      draft.transparentDragonHeader !== settingsState.transparentDragonHeader ||
      draft.showCategoryCounts !== settingsState.showCategoryCounts ||
      draft.showIconTitles !== settingsState.showIconTitles ||
      draft.appearance.category_font_size !== settingsState.appearance.category_font_size ||
      draft.appearance.category_font_color !== settingsState.appearance.category_font_color ||
      draft.appearance.item_font_size !== settingsState.appearance.item_font_size ||
      draft.appearance.item_font_color !== settingsState.appearance.item_font_color

    if (!hasChanged) {
      return
    }

    void emit('orvex://appearance-preview', draft)
  }, [draft, settingsState])

  useEffect(() => {
    return () => {
      if (settingsState) {
        void emit('orvex://appearance-preview', settingsState)
      }
    }
  }, [settingsState])

  useEffect(() => {
    if (!status) {
      return
    }

    const timer = window.setTimeout(() => setStatus(''), 2800)
    return () => window.clearTimeout(timer)
  }, [status])

  function updateDraft(partial: Partial<SettingsState>) {
    setDraft((current) => (current ? { ...current, ...partial } : current))
  }

  function updateAppearanceDraft(partial: Partial<AppearanceSettings>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            appearance: {
              ...current.appearance,
              ...partial,
            },
          }
        : current,
    )
  }

  function updateHotkeyField(key: 'panelHotkey' | 'todoHotkey' | 'pickerHotkey', next: HotkeySetting) {
    setDraft((current) => (current ? { ...current, [key]: next } : current))
  }

  async function handleSave() {
    if (!draft) {
      return
    }

    const hotkeyConflict = findHotkeyConflict(draft)
    if (hotkeyConflict) {
      setStatus(hotkeyConflict)
      return
    }

    setSaving(true)
    try {
      await updateSettings({
        ...draft,
        backupRetentionDays: clampNumber(draft.backupRetentionDays, 1, 365),
        frostedGlassStrength: clampNumber(draft.frostedGlassStrength, 0, 32),
        sidebarOpacity: clampNumber(draft.sidebarOpacity, 0, 100),
        contentOpacity: clampNumber(draft.contentOpacity, 0, 100),
        backgroundOpacity: clampNumber(draft.backgroundOpacity, 0, 100),
      })
      await emit('orvex://settings-updated')
    } catch (caughtError) {
      setStatus(caughtError instanceof Error ? caughtError.message : '保存设置失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleBackupNow() {
    setBackingUp(true)
    try {
      const backupPath = await createBackupArchive()
      setStatus(`备份已创建：${backupPath}`)
    } catch (caughtError) {
      setStatus(caughtError instanceof Error ? caughtError.message : '创建备份失败')
    } finally {
      setBackingUp(false)
    }
  }

  async function handleRestoreFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''

    if (!selectedFile) {
      return
    }

    setRestoring(true)
    try {
      const content = await selectedFile.text()
      const result = await restoreBackupArchive(content)
      setDraft(result.settingsState)
      await emit('orvex://settings-updated')
      await emit('orvex://launcher-state-updated')
      setStatus('备份已恢复')
    } catch (caughtError) {
      setStatus(caughtError instanceof Error ? caughtError.message : '恢复备份失败')
    } finally {
      setRestoring(false)
    }
  }

  async function handleSelectBackgroundImage() {
    try {
      const selectedPath = await open({
        directory: false,
        multiple: false,
        title: '选择背景图片',
        filters: [
          {
            name: '图片',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'],
          },
        ],
      })

      if (typeof selectedPath !== 'string' || !selectedPath) {
        return
      }

      const importedPath = await importBackgroundImage(selectedPath)
      updateDraft({ backgroundImagePath: importedPath })
      setStatus('已选择背景图片，保存后生效')
    } catch (caughtError) {
      setStatus(caughtError instanceof Error ? caughtError.message : '选择背景图片失败')
    }
  }

  async function handleCheckUpdate() {
    if (!draft) {
      return
    }

    setCheckingUpdate(true)
    window.setTimeout(() => {
      setCheckingUpdate(false)
      setStatus(`当前未接入 ${draft.updateSource === 'gitee' ? 'Gitee' : 'GitHub'} 更新检测`)
    }, 320)
  }

  if (loading || !draft) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden bg-white font-[system-ui] text-[#333333]">
        <div className="w-[360px] rounded-[14px] border border-[#ececec] bg-white p-5 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <p className="text-[15px] font-semibold text-[#111111]">
            {error ? '设置载入失败' : '正在载入设置...'}
          </p>
          {error ? <p className="mt-2 text-[13px] text-[#666666]">{error}</p> : null}
          {error ? (
            <button
              type="button"
              className="mt-4 h-9 rounded-[10px] border border-[#dddddd] px-4 text-[13px] text-[#444444] transition hover:bg-[#f7f7f7]"
              onClick={() => void closeWindow()}
            >
              关闭
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-screen overflow-hidden bg-white font-[system-ui] text-[#333333]"
      style={{ colorScheme: 'light' }}
    >
      <aside className="w-[160px] border-r border-[#ececec] bg-[#fafafa] px-3 py-4">
        <div className="space-y-1">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab
            return (
              <button
                key={tab.key}
                type="button"
                className="relative flex h-10 w-full items-center rounded-[10px] px-4 text-left text-[14px] transition"
                style={{
                  background: isActive ? '#f0f0f0' : 'transparent',
                  color: '#333333',
                }}
                onClick={() => setActiveTab(tab.key)}
              >
                {isActive ? (
                  <span className="absolute left-0 top-2 h-6 w-[3px] rounded-r-full bg-[#333333]" />
                ) : null}
                <span className="pl-1">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-8 py-7">
          <div className="mb-6">
            <h1 className="text-[24px] font-semibold text-[#111111]">{tabTitle(activeTab)}</h1>
            <p className="mt-2 text-[13px] text-[#888888]">{tabDescription(activeTab)}</p>
          </div>

          {error ? (
            <div className="mb-4 rounded-[12px] border border-[#f1d2d2] bg-[#fff6f6] px-4 py-3 text-[13px] text-[#b42318]">
              {error}
            </div>
          ) : null}

          {status ? (
            <div className="mb-4 rounded-[12px] border border-[#e9e9e9] bg-[#f8f8f8] px-4 py-3 text-[13px] text-[#555555]">
              {status}
            </div>
          ) : null}

          {activeTab === 'general' ? (
            <SettingsGroup>
              <SettingRow label="开机自启">
                <SettingField hint="开启后，Orvex 会在系统登录后自动启动。">
                  <Toggle
                    checked={draft.launchAtStartup}
                    onChange={(checked) => updateDraft({ launchAtStartup: checked })}
                  />
                </SettingField>
              </SettingRow>
              <SettingRow label="启动时显示面板">
                <Toggle
                  checked={draft.showPanelOnStartup}
                  onChange={(checked) => updateDraft({ showPanelOnStartup: checked })}
                />
              </SettingRow>
              <SettingRow label="启动应用后自动关闭">
                <SettingField hint="开启后，从主面板启动项目会自动收起面板。">
                  <Toggle
                    checked={draft.closePanelAfterLaunch}
                    onChange={(checked) => updateDraft({ closePanelAfterLaunch: checked })}
                  />
                </SettingField>
              </SettingRow>
              <SettingRow label="排序方式">
                <ChoiceGroup<SortMode>
                  value={draft.sortMode}
                  options={[
                    { value: 'custom', label: '自定义' },
                    { value: 'usage', label: '使用次数' },
                    { value: 'name', label: '名称' },
                  ]}
                  onChange={(value) => updateDraft({ sortMode: value })}
                />
              </SettingRow>
              <SettingRow label="数据备份">
                <div className="flex items-center gap-3">
                  <ActionButton
                    label={backingUp ? '备份中...' : '立即备份'}
                    disabled={backingUp}
                    onClick={() => void handleBackupNow()}
                  />
                  <ActionButton
                    label={restoring ? '恢复中...' : '从备份恢复'}
                    disabled={restoring}
                    onClick={() => restoreFileInputRef.current?.click()}
                  />
                </div>
              </SettingRow>
              <SettingRow label="备份保留天数">
                <NumberInput
                  value={draft.backupRetentionDays}
                  min={1}
                  max={365}
                  onChange={(value) => updateDraft({ backupRetentionDays: value })}
                />
              </SettingRow>
            </SettingsGroup>
          ) : null}

          {activeTab === 'appearance' ? (
            <SettingsGroup>
              <SettingRow label="主题">
                <ChoiceGroup<ThemeMode>
                  value={draft.theme}
                  options={[
                    { value: 'light', label: '浅色' },
                    { value: 'dark', label: '深色' },
                  ]}
                  onChange={(value) => updateDraft({ theme: value })}
                />
              </SettingRow>
              <SettingRow label="背景类型">
                <ChoiceGroup<'image' | 'solid'>
                  value={draft.backgroundType}
                  options={[
                    { value: 'image', label: '图片' },
                    { value: 'solid', label: '纯色' },
                  ]}
                  onChange={(value) => updateDraft({ backgroundType: value })}
                />
              </SettingRow>
              {draft.backgroundType === 'image' ? (
                <SettingRow label="图片路径">
                  <div className="flex items-center gap-3">
                    <TextInput
                      value={draft.backgroundImagePath}
                      placeholder="选择背景图片"
                      onChange={(value) => updateDraft({ backgroundImagePath: value })}
                    />
                    <ActionButton
                      label="选择文件"
                      onClick={() => void handleSelectBackgroundImage()}
                    />
                  </div>
                </SettingRow>
              ) : null}
              <SettingRow label="毛玻璃效果">
                <SettingField hint="关闭后不启用模糊，开启后可继续调节模糊强度。">
                  <div className="flex min-w-[320px] flex-col items-end gap-3">
                    <Toggle
                      checked={draft.frostedGlass}
                      onChange={(checked) => updateDraft({ frostedGlass: checked })}
                    />
                    <SliderInput
                      min={0}
                      max={32}
                      value={draft.frostedGlassStrength}
                      suffix="px"
                      disabled={!draft.frostedGlass}
                      onChange={(value) => updateDraft({ frostedGlassStrength: value })}
                    />
                  </div>
                </SettingField>
              </SettingRow>
              <SettingRow label="左侧列表透明度">
                <SliderInput
                  value={draft.sidebarOpacity}
                  onChange={(value) => updateDraft({ sidebarOpacity: value })}
                />
              </SettingRow>
              <SettingRow label="右侧内容透明度">
                <SliderInput
                  value={draft.contentOpacity}
                  onChange={(value) => updateDraft({ contentOpacity: value })}
                />
              </SettingRow>
              <SettingRow label="背景透明度">
                <SliderInput
                  value={draft.backgroundOpacity}
                  onChange={(value) => updateDraft({ backgroundOpacity: value })}
                />
              </SettingRow>
              <SettingRow label="龙之题头透明">
                <SettingField hint="开启后，顶部题头会和背景、内容区自然贴合在一起。">
                  <Toggle
                    checked={draft.transparentDragonHeader}
                    onChange={(checked) => updateDraft({ transparentDragonHeader: checked })}
                  />
                </SettingField>
              </SettingRow>
              <SettingRow label="显示图标标题">
                <Toggle
                  checked={draft.showIconTitles}
                  onChange={(checked) => updateDraft({ showIconTitles: checked })}
                />
              </SettingRow>
              <SettingRow label="分类显示数量">
                <Toggle
                  checked={draft.showCategoryCounts}
                  onChange={(checked) => updateDraft({ showCategoryCounts: checked })}
                />
              </SettingRow>
              <SettingRow label="文字样式">
                <div className="flex w-full flex-col gap-4 py-2">
                  <TypographyControl
                    label="分类列表文字"
                    value={draft.appearance.category_font_size}
                    min={12}
                    max={18}
                    color={draft.appearance.category_font_color}
                    onSizeChange={(value) =>
                      updateAppearanceDraft({ category_font_size: value })
                    }
                    onColorChange={(value) =>
                      updateAppearanceDraft({ category_font_color: value })
                    }
                  />
                  <TypographyControl
                    label="应用名称文字"
                    value={draft.appearance.item_font_size}
                    min={11}
                    max={16}
                    color={draft.appearance.item_font_color}
                    onSizeChange={(value) => updateAppearanceDraft({ item_font_size: value })}
                    onColorChange={(value) => updateAppearanceDraft({ item_font_color: value })}
                  />
                </div>
              </SettingRow>
            </SettingsGroup>
          ) : null}

          {activeTab === 'hotkeys' ? (
            <SettingsGroup>
              <SettingRow label="主面板热键">
                <SettingField hint="桌面任意位置都可呼出主面板。">
                  <HotkeyEditor
                    value={draft.panelHotkey}
                    placeholder="按下快捷键"
                    onChange={(value) => updateHotkeyField('panelHotkey', value)}
                  />
                </SettingField>
              </SettingRow>
              <SettingRow label="待办热键">
                <SettingField hint="用于呼出或收起待办小窗。">
                  <HotkeyEditor
                    value={draft.todoHotkey}
                    placeholder="按下快捷键"
                    onChange={(value) => updateHotkeyField('todoHotkey', value)}
                  />
                </SettingField>
              </SettingRow>
              <SettingRow label="拾色器热键">
                <SettingField hint="用于呼出或收起拾色器小窗。">
                  <HotkeyEditor
                    value={draft.pickerHotkey}
                    placeholder="按下快捷键"
                    onChange={(value) => updateHotkeyField('pickerHotkey', value)}
                  />
                </SettingField>
              </SettingRow>
            </SettingsGroup>
          ) : null}

          {activeTab === 'about' ? (
            <SettingsGroup>
              <SettingRow label="Orvex">
                <div className="flex items-center gap-4">
                  <div className="rounded-[12px] border border-[#e8e8e8] bg-[#fafafa] px-4 py-2 text-[18px] font-semibold tracking-[0.24em] text-[#111111]">
                    ORVEX
                  </div>
                  <span className="text-[13px] text-[#666666]">版本号 v0.1.0</span>
                </div>
              </SettingRow>
              <SettingRow label="更新源">
                <SettingField hint="更新检测还没接上，当前仅保存来源偏好。">
                  <ChoiceGroup<UpdateSource>
                    value={draft.updateSource}
                    options={[
                      { value: 'gitee', label: 'Gitee' },
                      { value: 'github', label: 'GitHub' },
                    ]}
                    onChange={(value) => updateDraft({ updateSource: value })}
                  />
                </SettingField>
              </SettingRow>
              <SettingRow label="检查更新">
                <SettingField hint="在线检查更新暂未接入。">
                  <ActionButton
                    label={checkingUpdate ? '检查中...' : '检查更新'}
                    disabled={checkingUpdate}
                    onClick={() => void handleCheckUpdate()}
                  />
                </SettingField>
              </SettingRow>
            </SettingsGroup>
          ) : null}
        </div>

        <div className="flex h-[72px] items-center justify-between border-t border-[#ececec] bg-white px-8">
          <div className="text-[12px] text-[#999999]">{status || ' '}</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="h-10 rounded-[10px] border border-[#dddddd] px-5 text-[14px] text-[#555555] transition hover:bg-[#f7f7f7]"
              onClick={() => {
                if (settingsState) {
                  setDraft(settingsState)
                  void emit('orvex://appearance-preview', settingsState)
                }
                void closeWindow()
              }}
            >
              取消
            </button>
            <button
              type="button"
              disabled={saving}
              className="h-10 rounded-[10px] bg-[#333333] px-5 text-[14px] text-white transition hover:bg-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleSave()}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>

      <input
        ref={restoreFileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleRestoreFileChange}
      />
    </div>
  )
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[16px] border border-[#ececec] bg-white">{children}</div>
}

function SettingRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-6 border-b border-[#f0f0f0] px-5 py-2 last:border-b-0">
      <span className="shrink-0 text-[14px] text-[#333333]">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function SettingField({
  children,
  hint,
}: {
  children: ReactNode
  hint?: string
}) {
  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      {children}
      {hint ? <p className="text-right text-[12px] text-[#999999]">{hint}</p> : null}
    </div>
  )
}

function TypographyControl({
  label,
  value,
  min,
  max,
  color,
  onSizeChange,
  onColorChange,
}: {
  label: string
  value: number
  min: number
  max: number
  color: string
  onSizeChange: (value: number) => void
  onColorChange: (value: string) => void
}) {
  return (
    <div className="rounded-[14px] border border-[#ededed] bg-[#fafafa] px-4 py-4">
      <p className="text-[13px] font-semibold text-[#222222]">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(event) => onSizeChange(clampNumber(Number(event.target.value), min, max))}
          className="h-2 flex-1 accent-[#333333]"
        />
        <span className="w-12 text-right text-[12px] text-[#666666]">{value}px</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {fontColorPresets.map((preset) => {
          const isActive = normalizeHexColor(preset) === normalizeHexColor(color)
          return (
            <button
              key={preset}
              type="button"
              aria-label={`选择颜色 ${preset}`}
              title={preset}
              onClick={() => onColorChange(preset)}
              className="h-6 w-6 rounded-full transition"
              style={{
                backgroundColor: preset,
                boxShadow: isActive ? `0 0 0 2px #ffffff, 0 0 0 4px ${preset}` : 'none',
              }}
            />
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#777777]">自定义</span>
          <label
            className="relative block h-9 w-9 cursor-pointer overflow-hidden rounded-full border border-[#d9d9d9] bg-white"
            style={{ boxShadow: `inset 0 0 0 6px ${normalizeHexColor(color)}` }}
          >
            <input
              type="color"
              value={toColorInputValue(color)}
              onChange={(event) => onColorChange(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <input
          type="text"
          value={toColorInputValue(color)}
          onChange={(event) => onColorChange(event.target.value)}
          className="h-9 w-[118px] rounded-[10px] border border-[#dddddd] bg-white px-3 text-[12px] uppercase tracking-[0.08em] text-[#444444] outline-none"
        />
      </div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      className="ml-auto inline-flex h-7 w-12 items-center rounded-full p-1 transition"
      style={{ background: checked ? '#333333' : '#d9d9d9' }}
      onClick={() => onChange(!checked)}
    >
      <span
        className="h-5 w-5 rounded-full bg-white transition"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  )
}

function ChoiceGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="ml-auto flex flex-wrap justify-end gap-2">
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className="rounded-full border px-3 py-1.5 text-[13px] transition"
            style={{
              borderColor: isActive ? '#333333' : '#dddddd',
              background: isActive ? '#333333' : '#ffffff',
              color: isActive ? '#ffffff' : '#555555',
            }}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function ActionButton({
  label,
  disabled = false,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="h-9 rounded-[10px] border border-[#dddddd] bg-white px-4 text-[13px] text-[#444444] transition hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(clampNumber(Number(event.target.value || min), min, max))}
      className="ml-auto h-9 w-[120px] rounded-[10px] border border-[#dddddd] bg-white px-3 text-right text-[13px] text-[#333333] outline-none"
    />
  )
}

function TextInput({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 min-w-[260px] flex-1 rounded-[10px] border border-[#dddddd] bg-white px-3 text-[13px] text-[#333333] outline-none placeholder:text-[#b0b0b0]"
    />
  )
}

function SliderInput({
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = '',
  disabled = false,
}: {
  value: number
  min?: number
  max?: number
  suffix?: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <div className="ml-auto flex w-[280px] items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max))}
        className="h-2 flex-1 accent-[#333333] disabled:cursor-not-allowed disabled:opacity-40"
      />
      <span className="w-12 text-right text-[13px] text-[#666666]">
        {value}
        {suffix}
      </span>
    </div>
  )
}

function HotkeyEditor({
  value,
  placeholder,
  onChange,
}: {
  value: HotkeySetting
  placeholder: string
  onChange: (value: HotkeySetting) => void
}) {
  const [isListening, setIsListening] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const originalValueRef = useRef<HotkeySetting>(value)

  useEffect(() => {
    if (!isListening) {
      return
    }

    inputRef.current?.focus()
  }, [isListening])

  function beginListening() {
    originalValueRef.current = value
    setIsListening(true)
  }

  function cancelListening() {
    onChange(originalValueRef.current)
    setIsListening(false)
  }

  function clearHotkey(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onChange({ value: '', enabled: false })
    setIsListening(false)
  }

  return (
    <div className="ml-auto flex items-center justify-end gap-3">
      <input
        ref={inputRef}
        type="text"
        readOnly
        value={isListening ? '请按下快捷键...' : formatHotkeyDisplay(value.value)}
        placeholder={placeholder}
        onKeyDown={(event) => {
          if (!isListening) {
            return
          }

          if (event.key === 'Escape') {
            event.preventDefault()
            cancelListening()
            return
          }

          const shortcut = formatShortcutValue(event)
          if (shortcut === null) {
            return
          }

          event.preventDefault()
          onChange({ value: shortcut, enabled: shortcut !== '' })
          setIsListening(false)
        }}
        onBlur={() => {
          if (isListening) {
            cancelListening()
          }
        }}
        onClick={beginListening}
        className="h-9 w-[200px] cursor-pointer rounded-[10px] border bg-white px-3 text-[13px] text-[#333333] outline-none placeholder:text-[#b0b0b0]"
        style={{
          borderColor: isListening ? '#333333' : '#dddddd',
          color: isListening ? '#333333' : value.value ? '#333333' : '#999999',
        }}
      />
      <button
        type="button"
        aria-label="清空热键"
        title="清空热键"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] leading-none text-[#999999] transition hover:bg-[#f3f3f3] hover:text-[#333333]"
        onClick={clearHotkey}
      >
        ×
      </button>
      <span className="text-[13px] text-[#666666]">启用</span>
      <Toggle checked={value.enabled} onChange={(checked) => onChange({ ...value, enabled: checked })} />
    </div>
  )
}

function formatShortcutValue(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Tab') {
    return null
  }

  const modifiers: string[] = []
  if (event.ctrlKey) {
    modifiers.push('Ctrl')
  }
  if (event.shiftKey) {
    modifiers.push('Shift')
  }
  if (event.altKey) {
    modifiers.push('Alt')
  }
  if (event.metaKey) {
    modifiers.push('Meta')
  }

  const normalizedKey = normalizeHotkeyKey(event.key)
  if (normalizedKey === null) {
    return null
  }

  return [...modifiers, normalizedKey].join('+')
}

function normalizeHotkeyKey(key: string) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    return null
  }

  if (key === ' ') {
    return 'Space'
  }

  if (key.length === 1) {
    return key.toUpperCase()
  }

  return key
}

function formatHotkeyDisplay(value: string) {
  if (!value) {
    return '未设置'
  }

  return value.split('+').join(' + ')
}

function findHotkeyConflict(draft: SettingsState) {
  const entries = [
    { label: '主面板', key: 'panelHotkey', setting: draft.panelHotkey },
    { label: '待办', key: 'todoHotkey', setting: draft.todoHotkey },
    { label: '拾色器', key: 'pickerHotkey', setting: draft.pickerHotkey },
  ] as const

  const seen = new Map<string, string>()

  for (const entry of entries) {
    const normalizedValue = entry.setting.value.trim()
    if (!entry.setting.enabled || !normalizedValue) {
      continue
    }

    const conflictLabel = seen.get(normalizedValue)
    if (conflictLabel) {
      return `与 ${conflictLabel} 热键冲突`
    }

    seen.set(normalizedValue, entry.label)
  }

  return null
}

function tabTitle(tab: SettingsTab) {
  switch (tab) {
    case 'general':
      return '通用'
    case 'appearance':
      return '外观'
    case 'hotkeys':
      return '热键'
    case 'about':
      return '关于'
  }
}

function tabDescription(tab: SettingsTab) {
  switch (tab) {
    case 'general':
      return '管理启动行为、面板关闭方式、排序方式和数据备份。'
    case 'appearance':
      return '调整主题、背景与主面板视觉细节。'
    case 'hotkeys':
      return '为主面板、待办和拾色器配置快捷键。'
    case 'about':
      return '查看版本信息并设置更新源。'
  }
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min
  }

  return Math.min(max, Math.max(min, value))
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim()
  const candidate = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
  if (/^[0-9a-fA-F]{6}$/.test(candidate)) {
    return `#${candidate.toLowerCase()}`
  }

  return '#333333'
}

function toColorInputValue(value: string) {
  return normalizeHexColor(value)
}

export default SettingsWindow
