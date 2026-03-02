# 豆包语音输入 (Doubao Voice Input)

实时语音转文字桌面应用，按下快捷键或长按指定按键，语音识别结果自动输入到当前应用。

基于字节跳动火山引擎 Seed ASR 流式语音识别 API。

## 功能特性

- **全局快捷键唤醒**：默认 `Ctrl+'`，随时呼出浮动语音输入窗口
- **Push-to-Talk**：按住右 Ctrl 键开始录音，松开自动完成输入
- **流式识别**：边说边转写，实时显示识别结果
- **自动粘贴**：关闭窗口后自动将文字输入到之前的应用
- **灵活的窗口定位**：鼠标附近、记住上次位置、屏幕顶部居中、底部居中
- **上下文提示**：支持自定义 ASR 上下文，提高特定领域识别准确率
- **系统托盘**：最小化到托盘，不占用任务栏

## 安装

### 下载

从 [Releases](https://github.com/myl/doubao-voice-input-electron/releases) 页面下载对应平台的安装包。

| 平台             | 文件                                         |
| ---------------- | -------------------------------------------- |
| Linux (通用)     | `doubao-voice-input-electron-0.1.0.AppImage` |
| Debian/Ubuntu    | `doubao-voice-input-electron-0.1.0.deb`      |
| Arch Linux (AUR) | `doubao-voice-input-electron-bin`            |

#### Linux AppImage

```bash
chmod +x doubao-voice-input-electron-0.1.0.AppImage
./doubao-voice-input-electron-0.1.0.AppImage
```

#### Debian/Ubuntu

```bash
sudo dpkg -i doubao-voice-input-electron-0.1.0.deb
```

#### Arch Linux (AUR)

```bash
yay -S doubao-voice-input-electron-bin
```

### 开机自启（systemd）

```bash
systemctl --user enable --now doubao-voice-input-electron.service
```

### 从源码构建

需要 Node.js ≥ 18 和 pnpm。

```bash
git clone https://github.com/myl/doubao-voice-input-electron.git
cd doubao-voice-input-electron
pnpm install
pnpm build:linux   # → dist/
```

## 使用前准备

### 1. 获取火山引擎 API 密钥

1. 注册 [火山引擎](https://www.volcengine.com/) 账号
2. 开通语音识别（Seed ASR）服务
3. 获取 **App Key** 和 **Access Key**

### 2. 配置应用

启动后右键点击系统托盘图标，选择 **Settings**，在 **API** 标签页填入 App Key 和 Access Key。

### 3. Linux/Wayland 环境

Wayland 下键盘模拟依赖 `xdotool`（通过 XWayland），需确保已安装：

```bash
# Arch Linux
sudo pacman -S xdotool

# Debian/Ubuntu
sudo apt install xdotool
```

## 使用方法

### 快捷键模式

1. 按下全局快捷键（默认 `Ctrl+'`）呼出语音输入窗口
2. 对着麦克风说话，文字实时显示
3. 再次按下快捷键，窗口关闭并自动将文字输入到之前的应用

### Push-to-Talk 模式

按住右 Ctrl 键（超过最短按压时间后激活），松开后自动完成输入。

### 关闭行为

| 操作                     | 效果                                     |
| ------------------------ | ---------------------------------------- |
| 再按快捷键 / 松开 PTT 键 | 有文字则自动输入到应用，无文字则直接关闭 |
| 点击 ✕ 按钮 / 按 Esc     | 丢弃文字，不输入                         |

## 配置说明

| 设置项       | 默认值   | 说明                                      |
| ------------ | -------- | ----------------------------------------- |
| 全局快捷键   | `Ctrl+'` | 唤醒/关闭语音输入窗口                     |
| 窗口定位     | 鼠标附近 | 鼠标附近 / 记住位置 / 顶部居中 / 底部居中 |
| 自动输入     | 开启     | 关闭窗口时自动将文字输入到应用            |
| 移除末尾标点 | 开启     | 自动去除识别结果末尾的标点符号            |
| Push-to-Talk | 开启     | 按住右 Ctrl 键触发录音                    |
| 双击触发     | 关闭     | 需要双击 PTT 键才触发                     |
| 上下文提示   | 空       | 为 ASR 提供上下文，提升识别准确率         |
| 麦克风选择   | 默认     | 指定录音使用的麦克风设备                  |

## License

Copyright (C) 2024 Yulong Ming <i@myl.moe>.

Apache License, Version 2.0.
