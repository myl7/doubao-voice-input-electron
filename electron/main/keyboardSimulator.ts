/**
 * Keyboard simulation for Ball Mode (direct text input) and auto-paste.
 *
 * On Linux/Wayland: uses ydotool (uinput-based, supports Unicode/CJK).
 * On macOS/Windows: uses robotjs.
 * Falls back gracefully if no backend is available.
 */

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Text diff: find common prefix, compute deletions + insertion
interface TextDiff {
    commonPrefixLength: number;
    deleteCount: number;
    insertText: string;
}

function computeDiff(old: string, newText: string): TextDiff {
    let commonPrefix = 0;
    const minLen = Math.min(old.length, newText.length);
    while (commonPrefix < minLen && old[commonPrefix] === newText[commonPrefix]) {
        commonPrefix++;
    }
    return {
        commonPrefixLength: commonPrefix,
        deleteCount: old.length - commonPrefix,
        insertText: newText.slice(commonPrefix),
    };
}

const isWayland = !!process.env.WAYLAND_DISPLAY;

class KeyboardSimulator {
    private lastSentText = "";
    private isProcessing = false;
    private pendingText: string | null = null;
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

    reset(): void {
        this.lastSentText = "";
        this.isProcessing = false;
        this.pendingText = null;
    }

    applyText(newText: string): void {
        this.pendingText = newText;
        if (!this.isProcessing) {
            this.processPending();
        }
    }

    private async processPending(): Promise<void> {
        this.isProcessing = true;
        while (this.pendingText !== null) {
            const text = this.pendingText;
            this.pendingText = null;
            await this.animateToText(text);
        }
        this.isProcessing = false;
    }

    private async animateToText(initialTarget: string): Promise<void> {
        let target = initialTarget;

        while (true) {
            const diff = computeDiff(this.lastSentText, target);

            if (diff.deleteCount === 0 && diff.insertText.length === 0) break;

            if (diff.deleteCount > 0) {
                await this.tapKey("BackSpace");
                this.lastSentText = this.lastSentText.slice(0, -1);
            } else {
                const ch = diff.insertText[0];
                await this.typeCharacter(ch);
                this.lastSentText += ch;
            }

            // Absorb newer pending text
            if (this.pendingText !== null) {
                target = this.pendingText;
                this.pendingText = null;
            }

            // 5ms delay between keystrokes
            const next = computeDiff(this.lastSentText, target);
            if (next.deleteCount > 0 || next.insertText.length > 0) {
                await new Promise((r) => setTimeout(r, 5));
            }
        }
    }

    private async tapKey(key: string): Promise<void> {
        if (isWayland) {
            try {
                await execFileAsync("ydotool", ["key", key.toLowerCase()]);
            } catch (err) {
                console.error("[Keyboard] ydotool key error:", err);
            }
        } else if (this.robotAvailable) {
            this.robot.keyTap(key.toLowerCase());
        }
    }

    private async typeCharacter(ch: string): Promise<void> {
        if (isWayland) {
            try {
                await execFileAsync("ydotool", ["type", "--", ch]);
            } catch (err) {
                console.error("[Keyboard] ydotool type error:", err);
            }
        } else if (this.robotAvailable) {
            try {
                this.robot.typeString(ch);
            } catch (err) {
                console.error("[Keyboard] typeString error:", err);
            }
        }
    }

    /** Type text directly via ydotool on Linux, or simulate Cmd+V / Ctrl+V on macOS/Windows */
    paste(text?: string): void {
        if (isWayland) {
            if (!text) return;
            execFileAsync("ydotool", ["type", "--", text]).catch((err) => {
                console.error("[Keyboard] ydotool paste error:", err);
            });
        } else if (this.robotAvailable) {
            try {
                const modifier = process.platform === "darwin" ? "command" : "control";
                this.robot.keyTap("v", modifier);
            } catch (err) {
                console.error("[Keyboard] paste error:", err);
            }
        }
    }
}

export const keyboardSimulator = new KeyboardSimulator();
