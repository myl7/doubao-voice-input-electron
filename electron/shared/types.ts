// Shared types between main and renderer processes

export interface AppSettings {
    appKey: string;
    accessKey: string;
    globalShortcut: string;
    finishShortcut: string;
    windowPositionMode: WindowPositionMode;
    windowPositionX?: number;
    windowPositionY?: number;
    ballPositionX?: number;
    ballPositionY?: number;
    autoPasteAfterClose: boolean;
    removeTrailingPunctuation: boolean;
    pushToTalk: PushToTalkConfig;
    context: string;
    contextCaptureEnabled: boolean;
    maxContextLength: number;
    selectedMicrophoneId: string;
    floatingWindowMode: FloatingWindowMode;
}

export type FloatingWindowMode = "fullWindow" | "floatingBall";

export type WindowPositionMode = "rememberLast" | "nearMouse" | "topCenter" | "bottomCenter";

export interface PushToTalkConfig {
    enabled: boolean;
    modifierKey: ModifierKey;
    minimumPressDuration: number;
    requireDoubleTap: boolean;
}

export type ModifierKey = "rightControl";

export interface AudioDevice {
    id: string;
    label: string;
}

export interface ASRResult {
    text: string;
    isFinal: boolean;
    code: number;
    message: string;
}

export interface CapturedContext {
    text: string;
    applicationName: string;
    capturedAt: number;
}

// IPC channel names
export const IPC = {
    // Settings
    SETTINGS_GET: "settings:get",
    SETTINGS_SET: "settings:set",

    // Window control
    WINDOW_HIDE: "window:hide",
    WINDOW_FINISH: "window:finish",
    WINDOW_SHOW_SETTINGS: "window:show-settings",

    // Audio devices
    AUDIO_DEVICES_GET: "audio:devices-get",

    // ASR (main process runs the WebSocket)
    ASR_START: "asr:start",
    ASR_STOP: "asr:stop",
    ASR_AUDIO_DATA: "asr:audio-data",
    ASR_RESULT: "asr:result",
    ASR_STATUS: "asr:status",

    // Context capture
    CONTEXT_CAPTURED: "context:captured",

    // Keyboard simulation
    KEYBOARD_APPLY_TEXT: "keyboard:apply-text",
    KEYBOARD_RESET: "keyboard:reset",

    // Global shortcut changed
    SHORTCUT_CHANGED: "shortcut:changed",

    // Push-to-talk events (main -> renderer)
    PTT_ACTIVATE: "ptt:activate",
    PTT_RELEASE: "ptt:release",

    // Recording state (renderer -> main, for auto-paste)
    RECORDING_FINISHED: "recording:finished",
} as const;
