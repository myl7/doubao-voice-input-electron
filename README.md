# 豆包语音输入 (Doubao Voice Input)

> **⚠️ Alpha 版本**：本项目目前处于 alpha 阶段（v0.1.0），功能和 API 可能发生变化，可能存在已知或未知的 bug。欢迎反馈问题和建议！

跨平台实时语音转文字桌面应用。按下快捷键或长按指定按键，即可将语音实时转写为文字并自动输入到当前应用中。

基于字节跳动火山引擎 Seed ASR 流式语音识别 API。

## 功能特性

- **全局快捷键唤醒**：默认 `Ctrl+'`，随时呼出语音输入窗口
- **Push-to-Talk**：按住右 Ctrl 键即开始录音，松开自动完成输入
- **两种窗口模式**：
    - **Full 模式**：浮动窗口显示完整转写文本和波形动画，关闭时自动将文字输入到之前的应用
    - **Ball 模式**：迷你悬浮球，转写文字实时逐字输入到当前焦点应用
- **流式识别**：边说边转写，实时显示识别结果
- **不污染剪贴板**：Linux/Wayland 下通过 `ydotool` 直接模拟键盘输入，无需经过剪贴板
- **灵活的窗口定位**：鼠标附近、记住上次位置、屏幕顶部居中、底部居中
- **上下文提示**：支持自定义 ASR 上下文，提高特定领域识别准确率
- **系统托盘**：最小化到托盘，不占用任务栏

## 安装

### 下载

从 [Releases](https://github.com/myl/doubao-voice-input-electron/releases) 页面下载对应平台的安装包。

> **注意**：当前为 alpha 版本，请从 [v0.1.0 Release](https://github.com/myl/doubao-voice-input-electron/releases/tag/v0.1.0) 下载。

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

使用 AUR helper 安装：

```bash
# 使用 yay
yay -S doubao-voice-input-electron-bin

# 或手动构建
git clone https://aur.archlinux.org/doubao-voice-input-electron-bin.git
cd doubao-voice-input-electron-bin
makepkg -si
```

### 开机自启（systemd）

安装后可通过 systemd 用户服务配置开机自启：

```bash
systemctl --user enable --now doubao-voice-input-electron.service
```

查看服务状态：

```bash
systemctl --user status doubao-voice-input-electron.service
```

停止并禁用自启：

```bash
systemctl --user disable --now doubao-voice-input-electron.service
```

### 从源码构建

需要 Node.js ≥ 18 和 pnpm。

```bash
git clone https://github.com/myl/doubao-voice-input-electron.git
cd doubao-voice-input-electron
pnpm install
pnpm build:linux
```

构建全部产物（包括 Arch Linux 包）：

```bash
make build-all
```

| Make 目标             | 说明                          |
| --------------------- | ----------------------------- |
| `make build`          | 仅编译（electron-vite build） |
| `make build-linux`    | 构建 AppImage + deb           |
| `make build-pkgbuild` | 构建 Linux 包并打 Arch 包     |
| `make build-all`      | 构建所有（包含 Arch 包）      |
| `make clean`          | 清理构建产物                  |

构建产物在 `dist/` 目录下。

## 使用前准备

### 1. 获取火山引擎 API 密钥

本应用使用字节跳动火山引擎的 Seed ASR 语音识别服务，需要注册并获取 API 密钥：

1. 注册 [火山引擎](https://www.volcengine.com/) 账号
2. 开通语音识别（Seed ASR）服务
3. 获取 **App Key** 和 **Access Key**

### 2. 配置应用

启动应用后，右键点击系统托盘图标，选择 **Settings**（设置），在 **API** 标签页填入：

- **App Key**：火山引擎应用 Key
- **Access Key**：火山引擎 Access Key

### 3. Linux/Wayland 环境额外配置

在 Wayland 环境下，键盘模拟使用 `ydotool`，需要额外配置：

```bash
# 安装 ydotool
# Arch Linux
sudo pacman -S ydotool

# Ubuntu/Debian
sudo apt install ydotool

# 启用 ydotoold 守护进程
systemctl --user enable --now ydotoold

# 配置 uinput 权限
sudo usermod -aG input $USER
echo 'KERNEL=="uinput", GROUP="input", MODE="0660"' | sudo tee /etc/udev/rules.d/80-uinput.rules
sudo udevadm control --reload-rules
```

配置完成后需注销重新登录使权限生效。

## 使用方法

### 快捷键模式

1. 按下全局快捷键（默认 `Ctrl+'`）呼出语音输入窗口
2. 对着麦克风说话，文字会实时显示在窗口中
3. 再次按下快捷键，窗口关闭并自动将文字输入到之前的应用

### Push-to-Talk 模式

1. 按住右 Ctrl 键（超过 0.15 秒后激活）
2. 说话，实时识别
3. 松开右 Ctrl 键，自动完成输入

### 关闭行为

| 操作                     | 效果                                       |
| ------------------------ | ------------------------------------------ |
| 再按快捷键 / 松开 PTT 键 | 有文字 → 自动输入到应用；无文字 → 直接关闭 |
| 点击 ✕ 按钮 / 按 Esc     | 丢弃文字，不输入                           |

## 设置说明

| 设置项       | 默认值    | 说明                                      |
| ------------ | --------- | ----------------------------------------- |
| 全局快捷键   | `Ctrl+'`  | 唤醒/关闭语音输入窗口                     |
| 窗口模式     | Full 模式 | Full（完整窗口）/ Ball（悬浮球）          |
| 窗口定位     | 鼠标附近  | 鼠标附近 / 记住位置 / 顶部居中 / 底部居中 |
| 自动输入     | 开启      | 关闭窗口时自动将文字输入到应用            |
| 移除末尾标点 | 开启      | 自动去除识别结果末尾的标点符号            |
| Push-to-Talk | 开启      | 按住右 Ctrl 键触发录音                    |
| 双击触发     | 关闭      | 是否需要双击 PTT 键才触发                 |
| 上下文提示   | 空        | 为 ASR 提供上下文，提升识别准确率         |
| 麦克风选择   | 默认      | 指定录音使用的麦克风设备                  |

## 技术栈

- **Electron** + **React** + **TypeScript**
- **electron-vite** 构建工具
- **Zustand** 状态管理
- **火山引擎 Seed ASR** 流式语音识别（WebSocket 二进制协议）
- **ydotool** / **robotjs** 键盘模拟
