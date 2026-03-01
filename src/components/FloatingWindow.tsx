import { type FC, useEffect, useRef, useCallback } from "react";
import {
    useTranscriptionStore,
    isRecording,
    isConnecting,
    isProcessing,
} from "../stores/transcriptionStore";
import { transcriptionController } from "../services/transcriptionController";
import WaveformView from "./WaveformView";

const FloatingWindow: FC = () => {
    const store = useTranscriptionStore();
    const recording = isRecording(store);
    const connecting = isConnecting(store);
    const processing = isProcessing(store);
    const textRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const closeOrFinishRef = useRef<() => void>(() => {});

    // Load settings on mount and set up listeners
    useEffect(() => {
        window.electronAPI.getSettings().then((s) => {
            store.setSettings(s);
            transcriptionController.setSettings(s);
        });

        // PTT release → finish if text, else hide
        window.electronAPI.onPTTRelease(() => {
            closeOrFinishRef.current();
        });

        // Window shown again → restart recording
        window.electronAPI.onWindowShow(() => {
            store.setTranscribedText("");
            store.setRecordingState("idle");
            transcriptionController.startRecording();
        });

        // Shortcut pressed while visible → finish or discard
        window.electronAPI.onToggleClose(() => {
            closeOrFinishRef.current();
        });

        // Settings updated
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
            window.electronAPI.offWindowShow();
            window.electronAPI.offToggleClose();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-start recording when window opens
    useEffect(() => {
        if (store.settings && store.recordingState === "idle") {
            transcriptionController.startRecording();
        }
    }, [store.settings]); // eslint-disable-line react-hooks/exhaustive-deps

    // Resize window as text grows
    useEffect(() => {
        resizeWindow();
    }, [store.transcribedText]); // eslint-disable-line react-hooks/exhaustive-deps

    function resizeWindow(): void {
        if (!rootRef.current) return;

        const MIN_W = 200,
            MAX_W = 420;
        const MIN_H = 70,
            MAX_H = 470;
        const H_PAD = 56; // 20*2 + extra
        const BUTTON_AREA = 48;
        const TEXT_PAD = 16;

        const text = store.transcribedText || " ";
        const font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

        // Measure text width
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        ctx.font = font;
        const naturalW = ctx.measureText(text).width;

        const desiredTextW = Math.min(Math.max(naturalW + 10, MIN_W - H_PAD), MAX_W - H_PAD);
        const finalW = desiredTextW + H_PAD;

        // Approximate height: wrap at desiredTextW
        const charsPerLine = Math.floor(desiredTextW / ctx.measureText("M").width);
        const lineCount = Math.max(1, Math.ceil(text.length / charsPerLine));
        const lineHeight = 22;
        const textH = Math.min(lineCount * lineHeight, MAX_H - BUTTON_AREA - TEXT_PAD);
        const finalH = Math.max(MIN_H, textH + TEXT_PAD + BUTTON_AREA);

        window.electronAPI.resizeWindow(Math.round(finalW), Math.round(finalH));
    }

    const handleClose = useCallback(() => {
        transcriptionController.stopRecording();
        window.electronAPI.hideWindow();
    }, []);

    const handleFinish = useCallback(async () => {
        const ok = await transcriptionController.finishRecordingAndCopy();
        if (ok) {
            await new Promise((r) => setTimeout(r, 300));
        }
        window.electronAPI.hideWindow();
    }, []);

    // Close = finish if there's text, otherwise discard
    const handleCloseOrFinish = useCallback(() => {
        if (store.transcribedText) {
            handleFinish();
        } else {
            handleClose();
        }
    }, [store.transcribedText, handleFinish, handleClose]);

    // Keep ref in sync so IPC callbacks always call the latest version
    closeOrFinishRef.current = handleCloseOrFinish;

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape") {
                handleClose();
            }
            if (e.key === "Enter") {
                handleCloseOrFinish();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [handleClose, handleCloseOrFinish]);

    return (
        <div
            ref={rootRef}
            style={
                {
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 28,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.72)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.6) inset",
                    border: "1px solid rgba(255,255,255,0.5)",
                    WebkitAppRegion: "drag" as React.CSSProperties["WebkitAppRegion"],
                } as React.CSSProperties
            }
        >
            {/* Text area */}
            <div
                style={
                    {
                        flex: 1,
                        overflowY: "auto",
                        padding: "12px 20px 4px",
                        userSelect: "text",
                        WebkitAppRegion: "no-drag" as React.CSSProperties["WebkitAppRegion"],
                    } as React.CSSProperties
                }
            >
                <p
                    ref={textRef}
                    style={{
                        fontSize: 15,
                        lineHeight: "22px",
                        color: "#1c1c1e",
                        minHeight: "1em",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                    }}
                >
                    {store.transcribedText}
                </p>
            </div>

            {/* Button row */}
            <div
                style={
                    {
                        display: "flex",
                        alignItems: "center",
                        padding: "4px 20px 12px",
                        WebkitAppRegion: "no-drag" as React.CSSProperties["WebkitAppRegion"],
                    } as React.CSSProperties
                }
            >
                {/* Waveform (left) */}
                {recording && !connecting && <WaveformView levels={store.audioLevels} />}

                <div style={{ flex: 1 }} />

                {/* Buttons (right) */}
                <div style={{ display: "flex", gap: 8 }}>
                    {connecting || processing ? (
                        <Spinner />
                    ) : (
                        <>
                            <CircleButton
                                label="✕"
                                accent={false}
                                title="Discard (Esc)"
                                onClick={handleClose}
                            />
                            {recording && store.transcribedText && (
                                <CircleButton
                                    label="↑"
                                    accent={true}
                                    title="Submit"
                                    onClick={handleCloseOrFinish}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

interface CircleButtonProps {
    label: string;
    accent: boolean;
    title: string;
    onClick: () => void;
}

const CircleButton: FC<CircleButtonProps> = ({ label, accent, title, onClick }) => (
    <button
        title={title}
        onClick={onClick}
        style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: accent ? "#007aff" : "rgba(120,120,128,0.12)",
            color: accent ? "#fff" : "#3c3c43",
            backdropFilter: accent ? "none" : "blur(8px)",
            transition: "opacity 0.1s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
    >
        {label}
    </button>
);

const Spinner: FC = () => (
    <div
        style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        }}
    >
        <div
            style={{
                width: 16,
                height: 16,
                border: "2px solid rgba(0,0,0,0.1)",
                borderTop: "2px solid #007aff",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
            }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

export default FloatingWindow;
