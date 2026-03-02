# 豆包语音输入 (Doubao Voice Input) — 项目设计文档

跨平台实时语音转文字桌面应用，使用字节跳动火山引擎 Seed ASR API，通过 WebSocket 流式传输音频并实时返回转写结果。从 macOS 原生 Swift 应用（Seedling）迁移至 Electron + React + TypeScript。

## 构建与运行

```bash
pnpm install && pnpm dev   # 开发
pnpm build                 # 生产构建 → out/
```

打包分发（electron-builder）：

```bash
CFLAGS="-Wno-error=implicit-function-declaration" pnpm run build:linux   # → dist/
```

> `@jitsi/robotjs` 在 GCC ≥14 下需上述 `CFLAGS`（仅 macOS/Windows 使用，Linux 使用 `xdotool`）。构建 deb 包需 `libcrypt.so.1`（Arch: `libxcrypt-compat`）。

## 核心数据流

1. **启动**：`index.ts` → 创建系统托盘、注册全局快捷键、注册 IPC handler、启动 PTT 监听
2. **唤醒窗口**：全局快捷键 或 PTT 按住触发 → 创建/显示浮动窗口（非聚焦，`focusable: false` + `showInactive()`）
3. **窗口显示** → renderer 收到 `window:show` → `transcriptionController.startRecording()`
4. **录音与识别**：
    - renderer：Web Audio API 采集麦克风，重采样到 16kHz/16-bit mono PCM，200ms 分段
    - PCM 通过 IPC 发送到主进程 → `asrClient.ts` 经 WebSocket 二进制协议 + GZIP 发送
    - ASR 结果通过 IPC 推送回 renderer
5. **上屏**：关闭窗口时将文本写入系统剪切板，模拟按键粘贴到目标应用

## 关闭/上屏逻辑

- **再次按全局快捷键**：主进程发 `window:toggle-close` → renderer `handleCloseOrFinish()`：有文字则上屏，无文字则丢弃
- **✕ 按钮 / Esc**：强制丢弃（不上屏）
- **PTT 松开**：同快捷键逻辑
- 使用 `useRef` 保存最新回调引用，避免 React 闭包陷阱导致 IPC 回调读到过期状态

## ASR 二进制协议

火山引擎 Seed ASR API 使用自定义 4 字节头二进制协议（非 JSON/REST）：

- Byte 0: `[Version:4 | HeaderSize:4]`
- Byte 1: `[MessageType:4 | Flags:4]`
- Byte 2: `[Serialization:4 | Compression:4]`
- Byte 3: Reserved

消息类型：`0b0001` Full（JSON 配置）、`0b0010` Audio（PCM 数据）、`0b1001` Server Response、`0b1111` Server Error。

所有 payload 使用 GZIP（pako）压缩。结束音频流使用负序列号。

## Push-to-Talk

使用 `uiohook-napi` 做系统级键盘监听（绕过 Electron `globalShortcut` 限制，能检测按住/松开）。

当前仅支持**右 Ctrl** 键（keycode `3613` / `3665`，两个都匹配以兼容不同系统）。

状态机：

- `requireDoubleTap=false`：`idle → secondPressHeld → activated`（按住超过 `minimumPressDuration` 后激活）
- `requireDoubleTap=true`：`idle → firstPressDown → waitingForSecondPress → secondPressHeld → activated`

`hasOtherModifiers` 过滤同时按下的其他修饰键，避免组合键误触发。

## 键盘模拟

将文本写入 Electron `clipboard`，然后模拟按键粘贴。可靠支持中文/CJK。

| 环境            | 后端             | 粘贴方式                               |
| --------------- | ---------------- | -------------------------------------- |
| Linux + Wayland | `xdotool`        | `xdotool key shift+Insert`（XWayland） |
| macOS / Windows | `@jitsi/robotjs` | `Cmd+V` / `Ctrl+V`                     |

## Linux 注意事项

- 启动参数：`--enable-transparent-visuals`、`--disable-gpu-vsync`、`--disable-frame-rate-limit`（透明窗口和 VSync 修复）
- Wayland 检测：`process.env.WAYLAND_DISPLAY`，使用 `xdotool`（XWayland，必需依赖）替代 robotjs
- uiohook-napi 的 `Could not set thread priority` 和 `XkbGetKeyboard failed` 是非致命警告，不影响功能
