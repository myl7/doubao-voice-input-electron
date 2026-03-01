import { create } from "zustand";
import type { AppSettings } from "../../electron/shared/types";

// Extend Window with the electron API
declare global {
    interface Window {
        electronAPI: import("../../electron/preload/index").ElectronAPI;
    }
}

type RecordingState = "idle" | "connecting" | "recording" | "stopping";

interface TranscriptionState {
    // Recording
    recordingState: RecordingState;
    transcribedText: string;
    errorMessage: string | null;
    statusMessage: string;
    audioLevels: number[]; // 5 FFT bands [0..1]

    // Settings cache
    settings: AppSettings | null;

    // Direct input mode (Ball mode)
    directInputMode: boolean;

    // Actions
    setRecordingState: (s: RecordingState) => void;
    setTranscribedText: (t: string) => void;
    setErrorMessage: (e: string | null) => void;
    setStatusMessage: (m: string) => void;
    setAudioLevels: (levels: number[]) => void;
    setSettings: (s: AppSettings) => void;
    setDirectInputMode: (enabled: boolean) => void;
    reset: () => void;
}

export const useTranscriptionStore = create<TranscriptionState>((set) => ({
    recordingState: "idle",
    transcribedText: "",
    errorMessage: null,
    statusMessage: "Ready",
    audioLevels: [0, 0, 0, 0, 0],
    settings: null,
    directInputMode: false,

    setRecordingState: (s) => set({ recordingState: s }),
    setTranscribedText: (t) => set({ transcribedText: t }),
    setErrorMessage: (e) => set({ errorMessage: e }),
    setStatusMessage: (m) => set({ statusMessage: m }),
    setAudioLevels: (levels) => set({ audioLevels: levels }),
    setSettings: (s) => set({ settings: s }),
    setDirectInputMode: (enabled) => set({ directInputMode: enabled }),
    reset: () =>
        set({
            recordingState: "idle",
            transcribedText: "",
            errorMessage: null,
            statusMessage: "Ready",
            audioLevels: [0, 0, 0, 0, 0],
        }),
}));

// Selectors
export const isRecording = (s: TranscriptionState) =>
    s.recordingState === "recording" || s.recordingState === "connecting";

export const isConnecting = (s: TranscriptionState) => s.recordingState === "connecting";

export const isProcessing = (s: TranscriptionState) => s.recordingState === "stopping";
