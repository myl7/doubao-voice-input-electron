import { app, BrowserWindow } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { createTray } from "./tray";
import { registerShortcuts, unregisterAll } from "./shortcut";
import { registerIpcHandlers } from "./ipc";
import { getSettings } from "./settings";
import { startPushToTalk } from "./pushToTalk";
import { showWindow } from "./shortcut";
import { getFloatingWindow, getBallWindow } from "./windows";
import { IPC } from "../shared/types";
import { asrManager } from "./asrManager";

// Single instance lock
if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

app.on("second-instance", () => {
    showWindow();
});

// Disable hardware acceleration for transparent windows on Linux
if (process.platform === "linux") {
    app.commandLine.appendSwitch("enable-transparent-visuals");
    app.commandLine.appendSwitch("disable-gpu-vsync");
    app.commandLine.appendSwitch("disable-frame-rate-limit");
}

app.whenReady().then(() => {
    // Set app user model id (Windows)
    electronApp.setAppUserModelId("moe.myl.doubao-voice-input-electron");

    // Optimise devtools shortcuts in dev
    app.on("browser-window-created", (_, window) => {
        optimizer.watchWindowShortcuts(window);
    });

    // Register IPC handlers first
    registerIpcHandlers();

    // Create system tray
    createTray();

    // Register global shortcuts
    registerShortcuts();

    // Start Push-to-Talk monitor
    const settings = getSettings();
    startPushToTalk(settings.pushToTalk, {
        onActivate: () => {
            showWindow();
        },
        onRelease: () => {
            const win = getFloatingWindow();
            const ball = getBallWindow();
            const target = win?.isVisible() ? win : ball?.isVisible() ? ball : null;
            target?.webContents.send(IPC.PTT_RELEASE);
        },
    });

    app.on("activate", () => {
        // On macOS re-show window when dock icon clicked (though we hide dock)
        if (BrowserWindow.getAllWindows().length === 0) {
            showWindow();
        }
    });
});

// On macOS keep app running even when all windows closed
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        // On non-macOS we still keep running (tray app)
        // app.quit() // uncomment if you want to quit without tray
    }
});

app.on("before-quit", async () => {
    unregisterAll();
    await asrManager.stop();
});

// Hide from dock on macOS (menu bar app)
if (process.platform === "darwin") {
    app.dock?.hide();
}
