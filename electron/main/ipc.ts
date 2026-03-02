import { ipcMain } from "electron";
import { IPC } from "../shared/types";
import { getSettings, updateSettings } from "./settings";
import {
    hideFloatingWindow,
    showSettingsWindow,
    resizeFloatingWindow,
    broadcastToRenderers,
    getFloatingWindow,
} from "./windows";
import { registerToggleShortcut } from "./shortcut";
import { startPushToTalk } from "./pushToTalk";
import { showWindow } from "./shortcut";
import { enumerateAudioDevices } from "./audioDevices";
import { asrManager } from "./asrManager";
import { keyboardSimulator } from "./keyboardSimulator";

export function registerIpcHandlers(): void {
    // ── Settings ──────────────────────────────────────────────────────
    ipcMain.handle(IPC.SETTINGS_GET, () => getSettings());

    ipcMain.handle(IPC.SETTINGS_SET, (_event, partial) => {
        const newSettings = updateSettings(partial);

        // Re-register global shortcut if changed
        if (partial.globalShortcut) {
            registerToggleShortcut(partial.globalShortcut);
        }

        // Restart PTT monitor if config changed
        if (partial.pushToTalk) {
            startPushToTalk(newSettings.pushToTalk, {
                onActivate: () => {
                    showWindow();
                },
                onRelease: () => {
                    // Notify renderer to finish recording
                    const win = getFloatingWindow();
                    const target = win?.isVisible() ? win : null;
                    target?.webContents.send(IPC.PTT_RELEASE);
                },
            });
        }

        broadcastToRenderers(IPC.SETTINGS_GET); // signal renderers to refresh
        return newSettings;
    });

    // ── Window control ────────────────────────────────────────────────
    ipcMain.on(IPC.WINDOW_HIDE, (_event) => {
        hideFloatingWindow();
    });

    ipcMain.on(IPC.WINDOW_SHOW_SETTINGS, () => showSettingsWindow());

    // Resize floating window when text grows
    ipcMain.on("window:resize", (_event, width: number, height: number) => {
        resizeFloatingWindow(width, height);
    });

    // ── Audio devices ─────────────────────────────────────────────────
    ipcMain.handle(IPC.AUDIO_DEVICES_GET, async () => {
        return enumerateAudioDevices();
    });

    // ── ASR ───────────────────────────────────────────────────────────
    ipcMain.on(IPC.ASR_START, (_event, config) => {
        asrManager.start(config, (result) => {
            // Forward result to renderer
            const win = getFloatingWindow();
            win?.webContents.send(IPC.ASR_RESULT, result);
        });
    });

    ipcMain.on(IPC.ASR_STOP, () => {
        asrManager.stop();
    });

    ipcMain.on(IPC.ASR_AUDIO_DATA, (_event, buffer: ArrayBuffer) => {
        asrManager.sendAudio(Buffer.from(buffer));
    });

    // ── Auto-type after recording ─────────────────────────────────────
    ipcMain.on(IPC.RECORDING_FINISHED, (_event, text: string) => {
        if (!text) return;
        const settings = getSettings();
        if (!settings.autoPasteAfterClose) return;

        // Type text into the previously active application
        // We give Electron a short delay to let the previous app regain focus
        setTimeout(() => {
            keyboardSimulator.paste(text);
        }, 250);
    });
}
