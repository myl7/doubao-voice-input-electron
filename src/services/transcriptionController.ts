/**
 * TranscriptionController coordinates AudioRecorder and ASR IPC calls.
 * Equivalent to Swift's TranscriptionViewModel but as a plain class
 * (state is managed by Zustand store).
 */

import { AudioRecorder } from "./audioRecorder";
import { useTranscriptionStore } from "../stores/transcriptionStore";
import type { AppSettings } from "../../electron/shared/types";

class TranscriptionController {
    private recorder = new AudioRecorder();
    private settings: AppSettings | null = null;

    setSettings(s: AppSettings): void {
        this.settings = s;
    }

    async startRecording(): Promise<void> {
        const store = useTranscriptionStore.getState();
        if (store.recordingState !== "idle") return;
        if (!this.settings) return;

        store.setRecordingState("connecting");
        store.setTranscribedText("");
        store.setErrorMessage(null);
        store.setStatusMessage("Connecting...");

        // Build context
        const contextLines: string[] = [];
        const userCtx = this.settings.context.trim();
        if (userCtx) contextLines.push(userCtx);

        // Notify main process to start ASR WebSocket
        window.electronAPI.startASR({
            appKey: this.settings.appKey,
            accessKey: this.settings.accessKey,
            contextLines,
        });

        // Listen for ASR results
        window.electronAPI.onASRResult((result) => {
            this.handleASRResult(result);
        });

        try {
            // Start microphone recording
            await this.recorder.start(
                (pcm) => {
                    window.electronAPI.sendAudioData(pcm);
                },
                (levels) => {
                    useTranscriptionStore.getState().setAudioLevels(levels);
                },
                this.settings.selectedMicrophoneId || "",
            );

            store.setRecordingState("recording");
            store.setStatusMessage("Recording...");
        } catch (err) {
            store.setErrorMessage(
                `Failed to start recording: ${err instanceof Error ? err.message : String(err)}`,
            );
            store.setStatusMessage("Error");
            store.setRecordingState("idle");
            window.electronAPI.stopASR();
            window.electronAPI.offASRResult();
        }
    }

    async stopRecording(): Promise<void> {
        const store = useTranscriptionStore.getState();
        if (store.recordingState === "idle" || store.recordingState === "stopping") return;

        store.setRecordingState("stopping");
        store.setStatusMessage("Stopping...");

        this.recorder.stop();
        window.electronAPI.stopASR();
        window.electronAPI.offASRResult();

        store.setRecordingState("idle");
        store.setStatusMessage("Ready");
    }

    async finishRecordingAndCopy(): Promise<boolean> {
        const store = useTranscriptionStore.getState();
        if (store.recordingState !== "recording") return false;

        store.setStatusMessage("Finishing...");

        this.recorder.stop();

        // Tell main to send final packet + wait for final result
        window.electronAPI.stopASR();

        // Wait for final result (ASR may still push last packet)
        await new Promise((r) => setTimeout(r, 400));

        window.electronAPI.offASRResult();
        store.setRecordingState("idle");

        const text = useTranscriptionStore.getState().transcribedText;
        if (!text) return false;

        // Send to main process for auto-type
        window.electronAPI.recordingFinished(text);
        store.setStatusMessage("Copied");

        return true;
    }

    toggleRecording(): void {
        const store = useTranscriptionStore.getState();
        if (store.recordingState === "idle") {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    private handleASRResult(result: {
        text: string;
        isFinal: boolean;
        code: number;
        message: string;
    }): void {
        const store = useTranscriptionStore.getState();

        if (store.recordingState === "connecting") {
            store.setRecordingState("recording");
            store.setStatusMessage("Recording...");
        }

        if (result.code !== 0 && result.code !== 1000) {
            store.setErrorMessage(`ASR error (${result.code}): ${result.message}`);
            this.stopRecording();
            return;
        }

        if (result.text) {
            let text = result.text;
            if (this.settings?.removeTrailingPunctuation) {
                text = removeTrailingPunctuation(text);
            }
            store.setTranscribedText(text);
        }

        if (result.isFinal) {
            store.setStatusMessage("Completed");
        }
    }
}

function removeTrailingPunctuation(text: string): string {
    // Full-width and half-width punctuation
    return text.replace(/[。！？；：，、.!?;:,]+$/, "");
}

// Singleton
export const transcriptionController = new TranscriptionController();
