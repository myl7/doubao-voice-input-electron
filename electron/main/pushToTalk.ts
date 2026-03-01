/**
 * Push-to-Talk: modifier key hold detection.
 *
 * Uses uiohook-napi for cross-platform low-level keyboard monitoring.
 * Falls back to a no-op if the native module is unavailable.
 *
 * State machine (same logic as Swift ModifierKeyMonitor):
 *   requireDoubleTap=false:  idle → secondPressHeld → activated
 *   requireDoubleTap=true:   idle → firstPressDown → waitingForSecondPress → secondPressHeld → activated
 */

import type { PushToTalkConfig, ModifierKey } from "../shared/types";

type PTTCallbacks = {
    onActivate: () => void;
    onRelease: () => void;
};

// uiohook key codes for modifier keys
const MOD_KEYCODES: Record<ModifierKey, number[]> = {
    rightControl: [3613, 3665], // UiohookKey.CtrlRight + observed keycode on some systems
};

// State machine states
type State = "idle" | "firstPressDown" | "waitingForSecondPress" | "secondPressHeld" | "activated";

const DOUBLE_TAP_INTERVAL_MS = 300;
const FIRST_TAP_MAX_DURATION_MS = 250;

class PushToTalkMonitor {
    private config: PushToTalkConfig;
    private callbacks: PTTCallbacks;
    private state: State = "idle";
    private _firstPressTime = 0;
    private firstReleaseTime = 0;
    private doubleTapTimer: ReturnType<typeof setTimeout> | null = null;
    private activationTimer: ReturnType<typeof setTimeout> | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private uiohook: any = null;
    private started = false;

    constructor(config: PushToTalkConfig, callbacks: PTTCallbacks) {
        this.config = config;
        this.callbacks = callbacks;
    }

    start(): void {
        if (this.started) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { uIOhook } = require("uiohook-napi");
            this.uiohook = uIOhook;

            const targetCodes = MOD_KEYCODES[this.config.modifierKey];

            uIOhook.on(
                "keydown",
                (e: {
                    keycode: number;
                    ctrlKey: boolean;
                    altKey: boolean;
                    shiftKey: boolean;
                    metaKey: boolean;
                }) => {
                    if (targetCodes.includes(e.keycode)) {
                        // Check no other modifier is pressed alongside target
                        if (this.hasOtherModifiers(e)) return;
                        this.handleKeyDown();
                    }
                },
            );

            uIOhook.on("keyup", (e: { keycode: number }) => {
                if (targetCodes.includes(e.keycode)) {
                    this.handleKeyUp();
                }
            });

            uIOhook.start();
            this.started = true;
            console.log(`[PTT] Started monitoring ${this.config.modifierKey} key`);
        } catch (err) {
            console.warn("[PTT] uiohook-napi not available, Push-to-Talk disabled:", err);
        }
    }

    stop(): void {
        if (!this.started) return;
        try {
            this.uiohook?.stop();
        } catch {
            /* ignore */
        }
        this.clearTimers();
        this.resetState();
        this.started = false;
    }

    private hasOtherModifiers(e: {
        ctrlKey: boolean;
        altKey: boolean;
        shiftKey: boolean;
        metaKey: boolean;
    }): boolean {
        const key = this.config.modifierKey;
        const { ctrlKey, altKey, shiftKey, metaKey } = e;
        if (key !== "rightControl" && ctrlKey) return true;
        if (altKey) return true;
        if (shiftKey) return true;
        if (metaKey) return true;
        return false;
    }

    private handleKeyDown(): void {
        const now = Date.now();

        switch (this.state) {
            case "idle":
                if (this.config.requireDoubleTap) {
                    this.state = "firstPressDown";
                    this._firstPressTime = now;
                } else {
                    this.state = "secondPressHeld";
                    this.scheduleActivation();
                }
                break;

            case "waitingForSecondPress": {
                const timeSinceRelease = now - this.firstReleaseTime;
                if (timeSinceRelease <= DOUBLE_TAP_INTERVAL_MS) {
                    this.clearTimers();
                    this.state = "secondPressHeld";
                    this.scheduleActivation();
                } else {
                    // Too slow — treat as new first press
                    this.resetState();
                    this.state = "firstPressDown";
                    this._firstPressTime = now;
                }
                break;
            }

            default:
                break;
        }
    }

    private handleKeyUp(): void {
        const now = Date.now();

        switch (this.state) {
            case "firstPressDown": {
                const duration = now - this._firstPressTime;
                if (duration <= FIRST_TAP_MAX_DURATION_MS) {
                    this.state = "waitingForSecondPress";
                    this.firstReleaseTime = now;
                    // Timeout for double-tap window
                    this.doubleTapTimer = setTimeout(() => {
                        if (this.state === "waitingForSecondPress") {
                            this.resetState();
                        }
                    }, DOUBLE_TAP_INTERVAL_MS);
                } else {
                    // Held too long for first tap
                    this.resetState();
                }
                break;
            }

            case "secondPressHeld":
                // Released before activation threshold
                this.clearTimers();
                this.resetState();
                break;

            case "activated":
                this.callbacks.onRelease();
                this.resetState();
                break;

            default:
                break;
        }
    }

    private scheduleActivation(): void {
        this.activationTimer = setTimeout(() => {
            if (this.state === "secondPressHeld") {
                this.state = "activated";
                this.callbacks.onActivate();
            }
        }, this.config.minimumPressDuration * 1000);
    }

    private clearTimers(): void {
        if (this.doubleTapTimer) {
            clearTimeout(this.doubleTapTimer);
            this.doubleTapTimer = null;
        }
        if (this.activationTimer) {
            clearTimeout(this.activationTimer);
            this.activationTimer = null;
        }
    }

    private resetState(): void {
        this.clearTimers();
        this.state = "idle";
        this._firstPressTime = 0;
        this.firstReleaseTime = 0;
    }
}

let monitor: PushToTalkMonitor | null = null;

export function startPushToTalk(config: PushToTalkConfig, callbacks: PTTCallbacks): void {
    stopPushToTalk();
    if (!config.enabled) return;
    monitor = new PushToTalkMonitor(config, callbacks);
    monitor.start();
}

export function stopPushToTalk(): void {
    monitor?.stop();
    monitor = null;
}
