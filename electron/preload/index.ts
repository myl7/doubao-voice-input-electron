import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/types";
import type { AppSettings, ASRResult, AudioDevice } from "../shared/types";

// Expose a safe API to the renderer
const api = {
    // Settings
    getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    updateSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
        ipcRenderer.invoke(IPC.SETTINGS_SET, partial),

    // Window
    hideWindow: () => ipcRenderer.send(IPC.WINDOW_HIDE),
    showSettings: () => ipcRenderer.send(IPC.WINDOW_SHOW_SETTINGS),
    resizeWindow: (width: number, height: number) =>
        ipcRenderer.send("window:resize", width, height),

    // Audio devices
    getAudioDevices: (): Promise<AudioDevice[]> => ipcRenderer.invoke(IPC.AUDIO_DEVICES_GET),

    // ASR
    startASR: (config: { appKey: string; accessKey: string; contextLines: string[] }) =>
        ipcRenderer.send(IPC.ASR_START, config),
    stopASR: () => ipcRenderer.send(IPC.ASR_STOP),
    sendAudioData: (buffer: ArrayBuffer) => ipcRenderer.send(IPC.ASR_AUDIO_DATA, buffer),
    onASRResult: (cb: (result: ASRResult) => void) => {
        ipcRenderer.on(IPC.ASR_RESULT, (_event, result) => cb(result));
    },
    offASRResult: () => ipcRenderer.removeAllListeners(IPC.ASR_RESULT),

    // Recording finished (triggers auto-type via ydotool)
    recordingFinished: (text: string) => ipcRenderer.send(IPC.RECORDING_FINISHED, text),

    // PTT events from main
    onPTTRelease: (cb: () => void) => {
        ipcRenderer.on(IPC.PTT_RELEASE, () => cb());
    },
    offPTTRelease: () => ipcRenderer.removeAllListeners(IPC.PTT_RELEASE),

    // Window show (re-activate recording)
    onWindowShow: (cb: () => void) => {
        ipcRenderer.on("window:show", () => cb());
    },
    offWindowShow: () => ipcRenderer.removeAllListeners("window:show"),

    // Toggle close (shortcut pressed while visible → finish or discard)
    onToggleClose: (cb: () => void) => {
        ipcRenderer.on("window:toggle-close", () => cb());
    },
    offToggleClose: () => ipcRenderer.removeAllListeners("window:toggle-close"),

    // Settings changed broadcast
    onSettingsChanged: (cb: () => void) => {
        ipcRenderer.on(IPC.SETTINGS_GET, () => cb());
    },
    offSettingsChanged: () => ipcRenderer.removeAllListeners(IPC.SETTINGS_GET),
};

contextBridge.exposeInMainWorld("electronAPI", api);

export type ElectronAPI = typeof api;
