import type { ReactNode } from 'react'
import { useWindowFrame } from '../hooks/useWindowFrame'
import {
  closeWindow,
  minimizeWindow,
  startWindowDrag,
  startWindowResize,
  toggleMaximizeWindow,
} from '../lib/tauri'

type WindowFrameProps = {
  children: ReactNode
  title?: string
  subtitle?: string
  compact?: boolean
  variant?: 'dark' | 'light'
  headerLeftAddon?: ReactNode
}

const resizeHandles = [
  { direction: 'NorthWest', className: 'left-0 top-0 h-3 w-3 cursor-nwse-resize' },
  { direction: 'North', className: 'left-3 right-3 top-0 h-1.5 cursor-ns-resize' },
  { direction: 'NorthEast', className: 'right-0 top-0 h-3 w-3 cursor-nesw-resize' },
  { direction: 'West', className: 'bottom-3 left-0 top-3 w-1.5 cursor-ew-resize' },
  { direction: 'East', className: 'bottom-3 right-0 top-3 w-1.5 cursor-ew-resize' },
  { direction: 'SouthWest', className: 'bottom-0 left-0 h-3 w-3 cursor-nesw-resize' },
  { direction: 'South', className: 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize' },
  { direction: 'SouthEast', className: 'bottom-0 right-0 h-3 w-3 cursor-nwse-resize' },
] as const

export function WindowFrame({
  children,
  title = 'Orvex 启动器',
  subtitle = '自定义窗口框架',
  compact = false,
  variant = 'dark',
  headerLeftAddon,
}: WindowFrameProps) {
  const { isMaximized } = useWindowFrame()
  const isLight = variant === 'light'
  const frameBorderColor = isLight ? 'rgba(15, 23, 42, 0.10)' : 'var(--line)'
  const frameBackground = isLight ? 'rgba(255,255,255,0.88)' : 'var(--surface)'
  const headerBackground = isLight
    ? 'rgba(255,255,255,0.88)'
    : 'var(--surface-elevated)'
  const titleColor = isLight ? '#0f172a' : 'var(--paper)'
  const subtitleColor = isLight ? '#64748b' : 'var(--soft)'
  const logoBackground = isLight ? 'rgba(15,23,42,0.04)' : 'var(--surface-soft)'

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent">
      {resizeHandles.map((handle) => (
        <button
          key={handle.direction}
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className={`absolute z-50 bg-transparent ${handle.className}`}
          onMouseDown={(event) => {
            event.preventDefault()
            void startWindowResize(handle.direction)
          }}
        />
      ))}

      <div
        className={[
          'relative min-h-screen overflow-hidden rounded-[26px] border shadow-[var(--shadow)]',
          isMaximized ? 'rounded-none border-transparent shadow-none' : '',
          isLight ? 'backdrop-blur-[20px]' : '',
        ].join(' ')}
        style={{
          borderColor: frameBorderColor,
          background: frameBackground,
        }}
      >
        <header
          className={[
            'relative z-40 flex items-center justify-between border-b px-4',
            compact ? 'h-11' : 'h-14',
          ].join(' ')}
          style={{
            borderColor: frameBorderColor,
            background: headerBackground,
          }}
        >
          <div
            className="absolute inset-0 z-0"
            onMouseDown={(event) => {
              if (event.buttons === 1) {
                void startWindowDrag()
              }
            }}
            onDoubleClick={() => void toggleMaximizeWindow()}
            data-tauri-drag-region
          />

          <div className="relative z-10 flex items-center gap-3">
            <div
              className={[
                'pointer-events-none flex items-center gap-3 rounded-full select-none',
                compact ? 'px-2 py-1.5' : 'px-3 py-2',
              ].join(' ')}
            >
              <div
                className={[
                  'flex items-center justify-center rounded-full border font-semibold tracking-[0.22em]',
                  compact ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-xs',
                ].join(' ')}
                style={{
                  borderColor: frameBorderColor,
                  background: logoBackground,
                  color: titleColor,
                }}
              >
                OR
              </div>
              <div>
                <p
                  className={[
                    'uppercase tracking-[0.28em]',
                    compact ? 'text-[10px]' : 'text-[11px]',
                  ].join(' ')}
                  style={{ color: subtitleColor }}
                >
                  {title}
                </p>
                {subtitle ? (
                  <p
                    className={[
                      'font-semibold',
                      compact ? 'mt-0 text-[12px]' : 'mt-0.5 text-sm',
                    ].join(' ')}
                    style={{ color: titleColor }}
                  >
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            {headerLeftAddon ? <div className="pointer-events-auto">{headerLeftAddon}</div> : null}
          </div>

          <div className="relative z-10 flex items-center gap-2">
            <FrameButton
              label="最小化"
              onClick={() => void minimizeWindow()}
              variant={variant}
            >
              <span className="block h-px w-3 bg-current" />
            </FrameButton>
            <FrameButton
              label="最大化"
              onClick={() => void toggleMaximizeWindow()}
              variant={variant}
            >
              <span className="grid h-3.5 w-3.5 place-items-center border border-current text-[10px] leading-none">
                {isMaximized ? '❐' : ''}
              </span>
            </FrameButton>
            <FrameButton
              label="关闭"
              tone="danger"
              onClick={() => void closeWindow()}
              variant={variant}
            >
              <span className="relative block h-3.5 w-3.5">
                <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 rotate-45 bg-current" />
                <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 -rotate-45 bg-current" />
              </span>
            </FrameButton>
          </div>
        </header>

        <div className="relative">{children}</div>
      </div>
    </div>
  )
}

type FrameButtonProps = {
  label: string
  tone?: 'default' | 'danger'
  variant?: 'dark' | 'light'
  onClick: () => void
  children: ReactNode
}

function FrameButton({
  label,
  tone = 'default',
  variant = 'dark',
  onClick,
  children,
}: FrameButtonProps) {
  const isLight = variant === 'light'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        'flex h-9 w-11 items-center justify-center rounded-[12px] border transition',
        tone === 'danger'
          ? 'hover:border-[rgba(220,38,38,0.24)] hover:bg-[#dc2626] hover:text-white'
          : isLight
            ? 'hover:border-[rgba(15,23,42,0.14)] hover:bg-[rgba(15,23,42,0.04)]'
            : 'hover:border-[var(--line-strong)] hover:bg-[var(--surface-soft)]',
      ].join(' ')}
      style={{
        borderColor: isLight ? 'rgba(15, 23, 42, 0.10)' : 'var(--line)',
        background: 'transparent',
        color: isLight ? '#0f172a' : 'var(--paper)',
      }}
    >
      {children}
    </button>
  )
}
