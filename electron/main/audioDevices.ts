/**
 * Audio device enumeration using the Web Audio API information exposed
 * to the renderer. In the main process we return a placeholder list;
 * the renderer enumerates real devices via navigator.mediaDevices.enumerateDevices().
 *
 * This module exists so IPC wiring is consistent, but actual enumeration
 * happens in the renderer and is sent back via IPC when needed.
 */
import type { AudioDevice } from "../shared/types";

export function enumerateAudioDevices(): AudioDevice[] {
    // Actual enumeration is done in the renderer via Web Audio API.
    // The main process forwards the list when the settings window requests it.
    return [];
}
