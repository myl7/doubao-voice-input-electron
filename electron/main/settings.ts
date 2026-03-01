// eslint-disable-next-line @typescript-eslint/no-require-imports
const StoreModule = require("electron-store");
const Store = StoreModule.default ?? StoreModule;

import type { AppSettings } from "../shared/types";

const defaults: AppSettings = {
    appKey: "",
    accessKey: "",
    globalShortcut: "Ctrl+'",
    finishShortcut: "Return",
    windowPositionMode: "nearMouse",
    autoPasteAfterClose: true,
    removeTrailingPunctuation: true,
    pushToTalk: {
        enabled: true,
        modifierKey: "rightControl",
        minimumPressDuration: 0.15,
        requireDoubleTap: false,
    },
    context: "",
    contextCaptureEnabled: true,
    maxContextLength: 2000,
    selectedMicrophoneId: "",
    floatingWindowMode: "fullWindow",
};

interface StoreInstance {
    store: Record<string, unknown>;
    set(key: string, value: unknown): void;
    get<T>(key: string, defaultValue?: T): T;
}

let storeInstance: StoreInstance | null = null;

function getStore(): StoreInstance {
    if (!storeInstance) {
        storeInstance = new Store({ name: "settings", defaults }) as StoreInstance;
    }
    return storeInstance;
}

export function getSettings(): AppSettings {
    const s = getStore();
    return s.store as unknown as AppSettings;
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
    const s = getStore();
    for (const [k, v] of Object.entries(partial)) {
        s.set(k, v);
    }
    return getSettings();
}
