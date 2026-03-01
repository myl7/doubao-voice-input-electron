# 豆包语音输入 (Doubao Voice Input) — 项目设计文档

跨平台实时语音转文字桌面应用，使用字节跳动火山引擎 Seed ASR API，通过 WebSocket 流式传输音频并实时返回转写结果。从 macOS 原生 Swift 应用（Seedling）迁移至 Electron + React + TypeScript。

## 构建与运行

```bash
cd doubao-voice-input-electron
pnpm install
pnpm dev      # 开发模式（electron-vite dev）
pnpm build    # 生产构建（electron-vite build）
```

### 代码格式化

使用 **Prettier** 统一代码风格，配置文件为 `.prettierrc.toml`。

```bash
pnpm format        # 格式化所有文件
pnpm format:check  # 检查格式（CI 用，不修改文件）
```

构建工具为 **electron-vite**，配置文件 `electron.vite.config.ts`，输出到 `out/` 目录。三个独立的 renderer 入口：`floating.html`、`ball.html`、`settings.html`。

### 打包分发

使用 **electron-builder** 打包为可分发的安装包，配置在 `package.json` 的 `"build"` 字段中。

```bash
# 构建 Linux AppImage（当前默认 target）
CFLAGS="-Wno-error=implicit-function-declaration" pnpm run build:linux

# 构建解压目录（调试用，不打包为 AppImage）
CFLAGS="-Wno-error=implicit-function-declaration" pnpm run build:dir
```

产物输出到 `dist/` 目录。

| 配置项        | 值                                                                 |
| ------------- | ------------------------------------------------------------------ |
| `appId`       | `moe.myl.doubao-voice-input-electron`                              |
| `productName` | `Doubao Voice Input`                                               |
| Linux target  | `AppImage`（免安装、最通用）                                       |
| 应用图标      | `resources/icon.png`（256×256，electron-builder 要求至少 256×256） |

> **注意**：`@jitsi/robotjs` 在新版 GCC（≥14）下因 `-Werror=implicit-function-declaration` 编译失败，需通过 `CFLAGS` 环境变量禁用该错误。如需构建 deb 包，在 `linux.target` 数组中加入 `"deb"`，并确保系统有 `libcrypt.so.1`（Arch Linux 需安装 `libxcrypt-compat`）。

### 原生模块

- `uiohook-napi`：Push-to-Talk 底层键盘监听（optional dependency，有 prebuild）
- `@jitsi/robotjs`：键盘模拟，用于 macOS/Windows 下的自动粘贴和 Ball 模式输入（optional dependency）
- Linux/Wayland 环境下使用 `ydotool`（uinput，支持 Unicode/中文）替代 robotjs

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                            │
│                                                             │
│  index.ts ── 入口，初始化 tray/shortcut/ipc/PTT            │
│  tray.ts ── 系统托盘菜单                                    │
│  shortcut.ts ── globalShortcut 注册与 toggle 逻辑           │
│  windows.ts ── 窗口创建/定位/显示/隐藏                       │
│  ipc.ts ── 所有 IPC handler 注册                            │
│  settings.ts ── electron-store 读写（持久化到 JSON）         │
│  asrManager.ts ── ASR 生命周期管理                           │
│  asrClient.ts ── Seed ASR WebSocket 二进制协议               │
│  pushToTalk.ts ── 修饰键按住检测（uiohook-napi）            │
│  keyboardSimulator.ts ── 键盘模拟（robotjs / ydotool）       │
│  audioDevices.ts ── 音频设备枚举                             │
│                                                             │
├──── preload/index.ts ── contextBridge 暴露 electronAPI ─────┤
│                                                             │
│                    Renderer Process(es)                      │
│                                                             │
│  stores/transcriptionStore.ts ── Zustand 状态管理            │
│  services/transcriptionController.ts ── 录音+ASR 协调器      │
│  services/audioRecorder.ts ── Web Audio API 录音             │
│  components/FloatingWindow.tsx ── 全模式窗口                 │
│  components/FloatingBall.tsx ── 迷你球模式窗口               │
│  components/SettingsPanel.tsx ── 设置面板                    │
│  components/WaveformView.tsx ── 波形可视化                   │
│                                                             │
├──── shared/types.ts ── 主进程与渲染进程共享的类型定义 ────────┤
└─────────────────────────────────────────────────────────────┘
```

## 核心数据流

1. **启动**：`index.ts` → 创建系统托盘（`tray.ts`）、注册全局快捷键（`shortcut.ts`）、注册 IPC handler（`ipc.ts`）、启动 PTT 监听（`pushToTalk.ts`）
2. **唤醒窗口**：全局快捷键 或 PTT 按住触发 → `shortcut.ts` 调用 `windows.ts` 创建/显示浮动窗口
3. **窗口显示** → renderer 收到 `window:show` IPC 事件 → `transcriptionController.startRecording()`
4. **录音与识别**：
    - `audioRecorder.ts`（renderer）：Web Audio API 采集麦克风，重采样到 16kHz/16-bit mono PCM，200ms 分段，FFT 计算 5 频段音量
    - PCM 数据通过 IPC（`asr:audio-data`）发送到主进程
    - `asrManager.ts`（main）→ `asrClient.ts`：WebSocket 连接 Seed ASR，二进制协议 + GZIP 压缩发送音频
    - ASR 返回结果通过 IPC（`asr:result`）推送回 renderer
5. **上屏**：
    - **Full 模式**：关闭窗口时通过 `ydotool type` 直接输入到之前的应用（不污染剪贴板）
    - **Ball 模式**：实时通过 `keyboardSimulator` 逐字符输入到当前焦点应用

## 窗口模式

| 模式          | 窗口类           | 特点                                                                                                    |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| **Full Mode** | `FloatingWindow` | 非聚焦浮动窗口（`focusable: false` + `showInactive()`），显示完整转写文本和波形，关闭时有文字则自动上屏 |
| **Ball Mode** | `FloatingBall`   | 迷你悬浮球，非激活面板，转写文字实时通过键盘模拟输入到当前应用                                          |

窗口定位支持四种模式：`nearMouse`（鼠标附近）、`rememberLast`（记住上次位置）、`topCenter`、`bottomCenter`。

## 关闭/上屏逻辑

- **再次按全局快捷键**：主进程发 `window:toggle-close` → renderer 的 `handleCloseOrFinish()`：有文字则上屏（`recordingFinished` IPC → 剪贴板 + auto-paste），无文字则丢弃
- **✕ 按钮 / Esc**：强制丢弃（不上屏）
- **PTT 松开**：同快捷键逻辑，有文字上屏
- 使用 `useRef` 保存最新回调引用，避免 React 闭包陷阱导致 IPC 回调读到过期状态

## ASR 二进制协议

火山引擎 Seed ASR API 使用自定义 4 字节头二进制协议（非 JSON/REST）：

- Byte 0: `[Version:4 | HeaderSize:4]`
- Byte 1: `[MessageType:4 | Flags:4]`
- Byte 2: `[Serialization:4 | Compression:4]`
- Byte 3: Reserved

消息类型：`0b0001` Full（JSON 配置）、`0b0010` Audio（PCM 数据）、`0b1001` Server Response、`0b1111` Server Error。

所有 payload（JSON 配置和 PCM 音频）使用 GZIP（pako）压缩。结束音频流使用负序列号。

## Push-to-Talk

使用 `uiohook-napi` 做系统级键盘监听（绕过 Electron 的 `globalShortcut` 限制，能检测按住/松开）。

当前仅支持 **右 Ctrl** 键（keycode: `3613` / `3665`，不同系统可能不同，两个都匹配）。

状态机（与原 Swift 版 `ModifierKeyMonitor` 一致）：

- `requireDoubleTap=false`：`idle → secondPressHeld → activated`（按住超过 `minimumPressDuration` 后激活）
- `requireDoubleTap=true`：`idle → firstPressDown → waitingForSecondPress → secondPressHeld → activated`

`hasOtherModifiers` 过滤同时按下的其他修饰键，避免组合键误触发。

## 键盘模拟

`keyboardSimulator.ts` 根据平台选择后端：

| 环境            | 后端                | 方式                                        |
| --------------- | ------------------- | ------------------------------------------- |
| Linux + Wayland | `ydotool`（uinput） | `execFile('ydotool', ['type', '--', text])` |
| macOS / Windows | `@jitsi/robotjs`    | `robot.keyTap('v', 'command'/'control')`    |

`ydotool` 通过 Linux 内核 `/dev/uinput` 接口工作，不依赖 X11 或特定 Wayland 协议，兼容所有混成器（KDE/GNOME/Sway 等），且原生支持 Unicode/中文输入。需要 `ydotoold` 守护进程运行。

Full 模式关闭时直接通过 `ydotool type` 输入全部文本，不经过剪贴板。Ball 模式下使用 diff 算法（`computeDiff`）计算旧文本到新文本的最小编辑，逐字符删除/插入，实现实时跟随 ASR 结果更新。

## 设置

通过 `electron-store` 持久化到 `~/.config/doubao-voice-input-electron/settings.json`。

| 设置项                            | 默认值         | 说明                                        |
| --------------------------------- | -------------- | ------------------------------------------- |
| `appKey`                          | `''`           | 火山引擎应用 Key                            |
| `accessKey`                       | `''`           | 火山引擎 Access Key                         |
| `globalShortcut`                  | `Ctrl+'`       | 全局唤醒快捷键（Electron accelerator 语法） |
| `floatingWindowMode`              | `fullWindow`   | `fullWindow` / `floatingBall`               |
| `windowPositionMode`              | `nearMouse`    | 窗口定位策略                                |
| `autoPasteAfterClose`             | `true`         | 关闭时自动粘贴                              |
| `removeTrailingPunctuation`       | `true`         | 移除末尾标点                                |
| `pushToTalk.enabled`              | `true`         | PTT 开关                                    |
| `pushToTalk.modifierKey`          | `rightControl` | PTT 触发键                                  |
| `pushToTalk.minimumPressDuration` | `0.15`         | 按住最短时间（秒）                          |
| `pushToTalk.requireDoubleTap`     | `false`        | 是否需要双击                                |
| `context`                         | `''`           | ASR 上下文提示文本                          |
| `contextCaptureEnabled`           | `true`         | 自动捕获上下文                              |
| `maxContextLength`                | `2000`         | 上下文最大字符数                            |
| `selectedMicrophoneId`            | `''`           | 指定麦克风设备                              |

Settings UI 分为 API、Context、Controls、About 四个 tab。

## IPC 通道

定义在 `shared/types.ts` 的 `IPC` 常量对象中，主要通道：

| 通道                        | 方向            | 用途                            |
| --------------------------- | --------------- | ------------------------------- |
| `settings:get/set`          | renderer ↔ main | 读写设置（invoke/handle）       |
| `window:hide`               | renderer → main | 隐藏窗口                        |
| `window:show`               | main → renderer | 窗口重新显示，重启录音          |
| `window:toggle-close`       | main → renderer | 快捷键关闭，触发上屏逻辑        |
| `asr:start/stop/audio-data` | renderer → main | ASR 控制和音频数据              |
| `asr:result`                | main → renderer | ASR 识别结果推送                |
| `ptt:activate/release`      | main → renderer | PTT 按住/松开事件               |
| `recording:finished`        | renderer → main | 录音完成，触发 ydotool 自动输入 |
| `keyboard:apply-text/reset` | renderer → main | Ball 模式键盘模拟               |

## 依赖

| 包                    | 用途                          |
| --------------------- | ----------------------------- |
| `electron`            | 桌面框架                      |
| `electron-vite`       | 构建工具（Vite for Electron） |
| `electron-builder`    | 打包分发（AppImage/deb 等）   |
| `react` / `react-dom` | UI 框架                       |
| `zustand`             | 状态管理                      |
| `ws`                  | WebSocket 客户端（主进程）    |
| `pako`                | GZIP 压缩/解压                |
| `electron-store`      | 设置持久化                    |
| `uiohook-napi`        | 系统级键盘监听（PTT）         |
| `@jitsi/robotjs`      | 键盘模拟（非 Wayland 环境）   |
| `prettier`            | 代码格式化                    |

## Linux 特殊处理

- 启动参数：`--enable-transparent-visuals`、`--disable-gpu-vsync`、`--disable-frame-rate-limit`（解决透明窗口和 VSync 错误）
- Wayland 环境检测：`process.env.WAYLAND_DISPLAY`
- 键盘模拟使用 `ydotool`（通过 `/dev/uinput`）替代 robotjs 和 xdotool
    - `ydotool` 需要 `ydotoold` 守护进程：`systemctl --user enable --now ydotoold`
    - 需要 uinput 权限：用户加入 `input` 组 + udev 规则 `KERNEL=="uinput", GROUP="input", MODE="0660"`
    - 不依赖 X11/XWayland，不依赖特定 Wayland 协议（如 `zwp_virtual_keyboard_v1`），兼容 KDE/GNOME/Sway 等所有混成器
    - 原生支持 Unicode/中文输入
- uiohook-napi 的 `Could not set thread priority` 和 `XkbGetKeyboard failed` 是非致命警告，不影响功能
