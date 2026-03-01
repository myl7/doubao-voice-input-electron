import { BrowserWindow, screen, app, ipcMain, type WebContents } from "electron";
import { join } from "path";
import { getSettings, updateSettings } from "./settings";
import type { WindowPositionMode } from "../shared/types";

let floatingWindow: BrowserWindow | null = null;
let ballWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

// ------------------------------------------------------------------
// Position helpers
// ------------------------------------------------------------------

function calcWindowPosition(
    mode: WindowPositionMode,
    winW: number,
    winH: number,
): { x: number; y: number } {
    const display = screen.getPrimaryDisplay();
    const { x: wa, y: wb, width: dw, height: dh } = display.workArea;

    const settings = getSettings();

    switch (mode) {
        case "rememberLast": {
            const sx = settings.windowPositionX;
            const sy = settings.windowPositionY;
            if (sx !== undefined && sy !== undefined) return { x: sx, y: sy };
            // fallthrough to center
            return { x: wa + Math.round((dw - winW) / 2), y: wb + Math.round((dh - winH) / 2) };
        }
        case "nearMouse": {
            const { x: mx, y: my } = screen.getCursorScreenPoint();
            const offset = 20;
            const margin = 10;
            let x = mx + offset;
            let y = my + offset;
            if (x + winW + margin > wa + dw) x = mx - offset - winW;
            if (x < wa + margin) x = wa + margin;
            if (y + winH + margin > wb + dh) y = wb + dh - winH - margin;
            if (y < wb + margin) y = wb + margin;
            return { x: Math.round(x), y: Math.round(y) };
        }
        case "topCenter":
            return {
                x: wa + Math.round((dw - winW) / 2),
                y: wb + 50,
            };
        case "bottomCenter":
            return {
                x: wa + Math.round((dw - winW) / 2),
                y: wb + dh - winH - 50,
            };
    }
}

function calcBallPosition(): { x: number; y: number } {
    const settings = getSettings();
    const mode = settings.windowPositionMode;
    if (mode === "rememberLast") {
        const bx = settings.ballPositionX;
        const by = settings.ballPositionY;
        if (bx !== undefined && by !== undefined) return { x: bx, y: by };
    }
    const display = screen.getPrimaryDisplay();
    const { x: wa, width: dw, height: dh } = display.workArea;
    return { x: wa + dw - 80, y: dh - 120 };
}

// ------------------------------------------------------------------
// Floating window (Full Mode)
// ------------------------------------------------------------------

export function getFloatingWindow(): BrowserWindow | null {
    return floatingWindow;
}

export function createOrShowFloatingWindow(): BrowserWindow {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
        if (!floatingWindow.isVisible()) {
            repositionFloatingWindow();
            floatingWindow.showInactive();
            floatingWindow.webContents.send("window:show");
        }
        return floatingWindow;
    }

    const winW = 200;
    const winH = 70;
    const pos = calcWindowPosition(getSettings().windowPositionMode, winW, winH);

    floatingWindow = new BrowserWindow({
        width: winW,
        height: winH,
        x: pos.x,
        y: pos.y,
        frame: false,
        transparent: true,
        resizable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: true,
        focusable: false,
        vibrancy: "under-window",
        visualEffectState: "active",
        webPreferences: {
            preload: join(__dirname, "../preload/index.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    floatingWindow.setAlwaysOnTop(true, "floating");

    if (process.env["ELECTRON_RENDERER_URL"]) {
        floatingWindow.loadURL(process.env["ELECTRON_RENDERER_URL"] + "/floating.html");
    } else {
        floatingWindow.loadFile(join(__dirname, "../renderer/floating.html"));
    }

    floatingWindow.on("moved", () => {
        if (floatingWindow) {
            const [wx, wy] = floatingWindow.getPosition();
            updateSettings({ windowPositionX: wx, windowPositionY: wy });
        }
    });

    return floatingWindow;
}

export function repositionFloatingWindow(): void {
    if (!floatingWindow || floatingWindow.isDestroyed()) return;
    const settings = getSettings();
    const mode = settings.windowPositionMode;
    if (mode === "rememberLast") return; // keep current position

    const [winW, winH] = floatingWindow.getSize();
    const pos = calcWindowPosition(mode, winW, winH);
    floatingWindow.setPosition(pos.x, pos.y, false);
}

export function hideFloatingWindow(): void {
    floatingWindow?.hide();
}

export function resizeFloatingWindow(width: number, height: number): void {
    if (!floatingWindow || floatingWindow.isDestroyed()) return;
    const [cx, cy] = floatingWindow.getPosition();
    const [ow, oh] = floatingWindow.getSize();
    // Keep centered
    const nx = cx - Math.round((width - ow) / 2);
    const ny = cy - Math.round((height - oh) / 2);
    floatingWindow.setBounds({ x: nx, y: ny, width, height }, true);
}

// ------------------------------------------------------------------
// Floating ball (Mini Mode)
// ------------------------------------------------------------------

export function getBallWindow(): BrowserWindow | null {
    return ballWindow;
}

export function createOrShowBallWindow(): BrowserWindow {
    if (ballWindow && !ballWindow.isDestroyed()) {
        if (!ballWindow.isVisible()) {
            const pos = calcBallPosition();
            ballWindow.setPosition(pos.x, pos.y);
            ballWindow.show();
        }
        return ballWindow;
    }

    const size = 96; // includes glow padding
    const pos = calcBallPosition();

    ballWindow = new BrowserWindow({
        width: size,
        height: size,
        x: pos.x,
        y: pos.y,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        focusable: false, // Never steal focus
        webPreferences: {
            preload: join(__dirname, "../preload/index.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    ballWindow.setIgnoreMouseEvents(false);
    ballWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    ballWindow.setAlwaysOnTop(true, "floating");

    if (process.env["ELECTRON_RENDERER_URL"]) {
        ballWindow.loadURL(process.env["ELECTRON_RENDERER_URL"] + "/ball.html");
    } else {
        ballWindow.loadFile(join(__dirname, "../renderer/ball.html"));
    }

    ballWindow.on("moved", () => {
        if (ballWindow) {
            const [bx, by] = ballWindow.getPosition();
            updateSettings({ ballPositionX: bx, ballPositionY: by });
        }
    });

    return ballWindow;
}

export function hideBallWindow(): void {
    ballWindow?.hide();
}

// ------------------------------------------------------------------
// Settings window
// ------------------------------------------------------------------

export function showSettingsWindow(): void {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 560,
        height: 520,
        title: "Settings",
        resizable: false,
        webPreferences: {
            preload: join(__dirname, "../preload/index.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    settingsWindow.setMenuBarVisibility(false);

    if (process.env["ELECTRON_RENDERER_URL"]) {
        settingsWindow.loadURL(process.env["ELECTRON_RENDERER_URL"] + "/settings.html");
    } else {
        settingsWindow.loadFile(join(__dirname, "../renderer/settings.html"));
    }

    settingsWindow.on("closed", () => {
        settingsWindow = null;
    });
}

// ------------------------------------------------------------------
// Broadcast to all renderer windows
// ------------------------------------------------------------------

export function broadcastToRenderers(channel: string, ...args: unknown[]): void {
    const windows = [floatingWindow, ballWindow, settingsWindow].filter(
        (w): w is BrowserWindow => w !== null && !w.isDestroyed(),
    );
    for (const win of windows) {
        win.webContents.send(channel, ...args);
    }
}

export function getFloatingWebContents(): WebContents | null {
    return floatingWindow?.webContents ?? null;
}

export function getBallWebContents(): WebContents | null {
    return ballWindow?.webContents ?? null;
}

// Cleanup
app.on("before-quit", () => {
    ipcMain.removeAllListeners();
});
