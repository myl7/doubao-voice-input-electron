import { globalShortcut } from "electron";
import {
    createOrShowFloatingWindow,
    createOrShowBallWindow,
    hideBallWindow,
    getFloatingWindow,
    getBallWindow,
} from "./windows";
import { getSettings } from "./settings";

let registeredToggleShortcut = "";
let registeredFinishShortcut = "";

export function registerShortcuts(): void {
    const settings = getSettings();
    registerToggleShortcut(settings.globalShortcut);
}

export function registerToggleShortcut(shortcut: string): void {
    if (registeredToggleShortcut) {
        globalShortcut.unregister(registeredToggleShortcut);
    }

    const ok = globalShortcut.register(shortcut, () => {
        toggleWindow();
    });

    if (ok) {
        registeredToggleShortcut = shortcut;
    } else {
        console.error(`[Shortcut] Failed to register global shortcut: ${shortcut}`);
    }
}

export function registerFinishShortcut(_shortcut: string): void {
    // The finish shortcut is handled locally in the renderer (keyboard event listener)
    // We store it for reference but don't register globally
    registeredFinishShortcut = _shortcut;
}

export function unregisterAll(): void {
    globalShortcut.unregisterAll();
    registeredToggleShortcut = "";
    registeredFinishShortcut = "";
}

function toggleWindow(): void {
    const settings = getSettings();

    if (settings.floatingWindowMode === "floatingBall") {
        const ball = getBallWindow();
        if (ball && ball.isVisible()) {
            hideBallWindow();
        } else {
            createOrShowBallWindow();
        }
    } else {
        const win = getFloatingWindow();
        if (win && win.isVisible()) {
            // Notify renderer to finish (auto-paste if text, else just hide)
            win.webContents.send("window:toggle-close");
        } else {
            createOrShowFloatingWindow();
        }
    }
}

export function showWindow(): void {
    const settings = getSettings();
    if (settings.floatingWindowMode === "floatingBall") {
        createOrShowBallWindow();
    } else {
        createOrShowFloatingWindow();
    }
}

export { registeredFinishShortcut };
