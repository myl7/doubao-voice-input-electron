import { type FC, useEffect } from "react";
import {
    useTranscriptionStore,
    isRecording,
    isConnecting,
    isProcessing,
} from "../stores/transcriptionStore";
import { transcriptionController } from "../services/transcriptionController";
import WaveformView from "./WaveformView";

const FloatingBall: FC = () => {
    const store = useTranscriptionStore();
    const recording = isRecording(store);
    const connecting = isConnecting(store);
    const processing = isProcessing(store);

    useEffect(() => {
        window.electronAPI.getSettings().then((s) => {
            store.setSettings(s);
            transcriptionController.setSettings(s);
            transcriptionController.setDirectInputMode(true);
        });

        window.electronAPI.onPTTRelease(() => {
            transcriptionController.finishRecordingDirectInput().then(() => {
                window.electronAPI.hideWindow();
            });
        });

        window.electronAPI.onSettingsChanged(() => {
            window.electronAPI.getSettings().then((s) => {
                store.setSettings(s);
                transcriptionController.setSettings(s);
            });
        });

        return () => {
            window.electronAPI.offPTTRelease();
            window.electronAPI.offSettingsChanged();
            window.electronAPI.offASRResult();
            transcriptionController.setDirectInputMode(false);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-start when component mounts
    useEffect(() => {
        if (store.settings && store.recordingState === "idle") {
            transcriptionController.startRecording();
        }
    }, [store.settings]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleClick = (): void => {
        // Left-click on ball finishes recording
        if (recording && store.transcribedText) {
            transcriptionController.finishRecordingDirectInput().then(() => {
                window.electronAPI.hideWindow();
            });
        }
    };

    return (
        <div
            style={{
                width: 96,
                height: 96,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
            }}
            onClick={handleClick}
        >
            {/* Ambient glow */}
            <div
                style={{
                    position: "absolute",
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(0,122,255,0.35)",
                    filter: "blur(10px)",
                }}
            />

            {/* Ball */}
            <div
                style={{
                    position: "relative",
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(145deg, #1c84ff, #0051d3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 3px 12px rgba(0,100,255,0.5)",
                }}
            >
                {connecting || processing ? (
                    <div
                        style={{
                            width: 14,
                            height: 14,
                            border: "2px solid rgba(255,255,255,0.35)",
                            borderTop: "2px solid #fff",
                            borderRadius: "50%",
                            animation: "spin 0.8s linear infinite",
                        }}
                    />
                ) : recording ? (
                    <WaveformView levels={store.audioLevels} compact />
                ) : null}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default FloatingBall;
