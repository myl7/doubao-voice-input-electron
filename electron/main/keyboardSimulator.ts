/**
 * Keyboard simulation for auto-paste.
 *
 * On Linux/Wayland: uses xdotool for key simulation.
 * On macOS/Windows: uses robotjs.
 * Falls back gracefully if no backend is available.
 *
 * Input methods:
 *   - "clipboard": copy text to clipboard, then simulate Shift+Insert to paste
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { clipboard } from "electron";

const execFileAsync = promisify(execFile);

const isWayland = !!process.env.WAYLAND_DISPLAY;

class KeyboardSimulator {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private robot: any = null;
    private robotAvailable = false;

    constructor() {
        if (!isWayland) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                this.robot = require("@jitsi/robotjs");
                this.robotAvailable = true;
            } catch {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    this.robot = require("robotjs");
                    this.robotAvailable = true;
                } catch {
                    console.warn("[Keyboard] robotjs not available, keyboard simulation disabled");
                }
            }
        }
    }

    /**
     * Copy text to system clipboard and simulate Shift+Insert to paste.
     * Works reliably with CJK characters on Wayland.
     */
    private async pasteViaClipboard(text: string): Promise<void> {
        clipboard.writeText(text);
        if (isWayland) {
            try {
                // Shift+Insert via xdotool (X11/XWayland) for reliable paste
                await execFileAsync("xdotool", ["key", "shift+Insert"]);
            } catch (err) {
                console.error("[Keyboard] xdotool clipboard paste error:", err);
            }
        } else if (this.robotAvailable) {
            try {
                const modifier = process.platform === "darwin" ? "command" : "control";
                this.robot.keyTap("v", modifier);
            } catch (err) {
                console.error("[Keyboard] clipboard paste error:", err);
            }
        }
    }

    /**
     * Paste text after recording finishes.
     * Writes to clipboard and simulates Shift+Insert (or Cmd/Ctrl+V on non-Linux).
     */
    paste(text?: string): void {
        if (!text) return;
        this.pasteViaClipboard(text).catch((err) => {
            console.error("[Keyboard] paste error:", err);
        });
    }
}

export const keyboardSimulator = new KeyboardSimulator();
