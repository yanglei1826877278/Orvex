import { useEffect, useState, type KeyboardEvent } from 'react'

const storageKey = 'orvex.picker.recent.v1'
const starterColors = ['#D97706', '#0F766E', '#2563EB', '#E11D48', '#7C3AED']

function PickerWindow() {
  const [color, setColor] = useState('#D97706')
  const [draft, setDraft] = useState('#D97706')
  const [copied, setCopied] = useState('')
  const [recentColors, setRecentColors] = useState<string[]>(starterColors)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        setRecentColors(parsed.filter((value) => typeof value === 'string'))
      }
    } catch (error) {
      console.warn('Failed to load picker colors', error)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(recentColors))
  }, [recentColors])

  useEffect(() => {
    setRecentColors((current) => {
      const next = [color, ...current.filter((entry) => entry !== color)]
      return next.slice(0, 8)
    })
  }, [color])

  useEffect(() => {
    if (!copied) {
      return
    }

    const timer = window.setTimeout(() => setCopied(''), 1800)
    return () => window.clearTimeout(timer)
  }, [copied])

  const rgb = hexToRgb(color)
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const contrastColor = getContrastColor(rgb.r, rgb.g, rgb.b)

  function commitDraft(nextValue: string) {
    const normalized = normalizeHex(nextValue)
    if (!normalized) {
      setDraft(color)
      return
    }

    setColor(normalized)
    setDraft(normalized)
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    commitDraft(draft)
  }

  async function handleCopy(label: string, value: string) {
    const succeeded = await copyText(value)
    setCopied(succeeded ? `${label} 已复制` : `${label} 复制失败`)
  }

  return (
    <div
      className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_28%),linear-gradient(180deg,_#f7fbff_0%,_#eef4ff_100%)] text-[#14213d]"
      style={{
        colorScheme: 'light',
        fontFamily: "'IBM Plex Sans','Segoe UI',sans-serif",
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-[760px] flex-col px-6 py-6">
        <div className="rounded-[28px] border border-[#d9e5ff] bg-[rgba(255,255,255,0.92)] p-6 shadow-[0_28px_72px_rgba(37,99,235,0.14)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#3b82f6]">
                Fast Palette
              </p>
              <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-[#12203c]">
                拾色器
              </h1>
              <p className="mt-2 text-[14px] leading-6 text-[#5c6f97]">
                选中颜色后，一键复制 HEX、RGB 或 HSL，热键呼出就能马上取色。
              </p>
            </div>

            <div className="rounded-[22px] border border-white/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#6f89b8]">Status</p>
              <p className="mt-2 text-[14px] font-medium text-[#233865]">
                {copied || '待复制'}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
            <div
              className="relative overflow-hidden rounded-[28px] border border-white/70 p-6 shadow-[0_18px_34px_rgba(30,64,175,0.12)]"
              style={{
                background: `linear-gradient(135deg, ${color} 0%, ${mixColor(color, '#FFFFFF', 0.34)} 100%)`,
                color: contrastColor,
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.36),_transparent_32%)]" />
              <div className="relative">
                <p className="text-[11px] uppercase tracking-[0.24em] opacity-80">Live Sample</p>
                <p className="mt-6 text-[42px] font-semibold tracking-[-0.05em]">{color}</p>
                <p className="mt-3 max-w-[240px] text-[14px] leading-6 opacity-85">
                  当前颜色会实时映射到右侧数值，也会自动收进最近颜色。
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#deebff] bg-[#fdfefe] p-5 shadow-[0_18px_40px_rgba(63,84,122,0.08)]">
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={color}
                  onChange={(event) => {
                    const nextColor = event.target.value.toUpperCase()
                    setColor(nextColor)
                    setDraft(nextColor)
                  }}
                  className="h-20 w-20 cursor-pointer rounded-[22px] border border-[#cfe0ff] bg-white p-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] uppercase tracking-[0.22em] text-[#6f89b8]">Hex Code</p>
                  <input
                    type="text"
                    value={draft}
                    placeholder="#D97706"
                    onChange={(event) => setDraft(event.target.value.toUpperCase())}
                    onBlur={() => commitDraft(draft)}
                    onKeyDown={handleDraftKeyDown}
                    className="mt-2 h-11 w-full rounded-[16px] border border-[#d6e5ff] bg-white px-4 text-[16px] font-medium text-[#152445] outline-none transition focus:border-[#6ea8ff] focus:ring-2 focus:ring-[#cfe3ff]"
                  />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <ValueCard
                  label="RGB"
                  value={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`}
                  onCopy={() => void handleCopy('RGB', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)}
                />
                <ValueCard
                  label="HSL"
                  value={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`}
                  onCopy={() => void handleCopy('HSL', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`)}
                />
                <ValueCard
                  label="HEX"
                  value={color}
                  onCopy={() => void handleCopy('HEX', color)}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-[#dce8ff] bg-white/80 p-5 shadow-[0_14px_30px_rgba(70,98,156,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] uppercase tracking-[0.22em] text-[#6f89b8]">Recent Colors</p>
                <p className="mt-1 text-[13px] text-[#5f7299]">点一下就能切回最近用过的颜色。</p>
              </div>
              <button
                type="button"
                onClick={() => setRecentColors(starterColors)}
                className="rounded-full border border-[#d5e4ff] px-3 py-1.5 text-[12px] text-[#4c6590] transition hover:bg-[#f5f9ff]"
              >
                重置最近颜色
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {recentColors.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => {
                    setColor(entry)
                    setDraft(entry)
                  }}
                  className="group flex items-center gap-2 rounded-full border border-[#d5e3ff] bg-white px-3 py-2 shadow-[0_8px_18px_rgba(72,96,148,0.06)] transition hover:-translate-y-[1px] hover:border-[#9dc2ff]"
                >
                  <span
                    className="h-5 w-5 rounded-full border border-white/80 shadow-[0_0_0_1px_rgba(15,23,42,0.06)]"
                    style={{ backgroundColor: entry }}
                  />
                  <span className="text-[12px] font-medium text-[#29406f]">{entry}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ValueCard({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-[#dbe8ff] bg-[#fbfdff] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#7a93bf]">{label}</p>
        <p className="mt-1 truncate text-[14px] font-medium text-[#162644]">{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="rounded-full bg-[#162644] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#0c1931]"
      >
        复制
      </button>
    </div>
  )
}

function normalizeHex(value: string) {
  const trimmed = value.trim().replace(/^#/, '')
  if (!/^[\da-fA-F]+$/.test(trimmed)) {
    return null
  }

  if (trimmed.length === 3) {
    return `#${trimmed
      .split('')
      .map((part) => `${part}${part}`)
      .join('')
      .toUpperCase()}`
  }

  if (trimmed.length !== 6) {
    return null
  }

  return `#${trimmed.toUpperCase()}`
}

function hexToRgb(value: string) {
  const normalized = normalizeHex(value) ?? '#000000'
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(lightness * 100) }
  }

  const delta = max - min
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)

  let hue = 0
  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0)
  } else if (max === green) {
    hue = (blue - red) / delta + 2
  } else {
    hue = (red - green) / delta + 4
  }

  return {
    h: Math.round((hue / 6) * 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  }
}

function mixColor(base: string, target: string, amount: number) {
  const from = hexToRgb(base)
  const to = hexToRgb(target)
  const clampAmount = Math.max(0, Math.min(amount, 1))

  const mixed = {
    r: Math.round(from.r + (to.r - from.r) * clampAmount),
    g: Math.round(from.g + (to.g - from.g) * clampAmount),
    b: Math.round(from.b + (to.b - from.b) * clampAmount),
  }

  return `rgb(${mixed.r}, ${mixed.g}, ${mixed.b})`
}

function getContrastColor(r: number, g: number, b: number) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? '#12203C' : '#F8FBFF'
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(textarea)
      return copied
    } catch {
      return false
    }
  }
}

export default PickerWindow
