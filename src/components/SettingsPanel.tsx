import { useState, useEffect, type FC } from "react";
import type { AppSettings } from "../../electron/shared/types";

// Simple shared styles
const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.15)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    color: "#6e6e73",
    marginBottom: 4,
};

const sectionTitle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#6e6e73",
    marginBottom: 12,
};

// ── API Tab ────────────────────────────────────────────────────────

interface APITabProps {
    settings: AppSettings;
    onChange: (partial: Partial<AppSettings>) => void;
}

const APITab: FC<APITabProps> = ({ settings, onChange }) => (
    <div style={{ padding: "20px 24px" }}>
        <div style={sectionTitle}>Seed ASR Credentials</div>
        <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>App Key</label>
            <input
                style={fieldStyle}
                value={settings.appKey}
                onChange={(e) => onChange({ appKey: e.target.value })}
                placeholder="Enter App Key"
            />
        </div>
        <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Access Key</label>
            <input
                style={fieldStyle}
                type="password"
                value={settings.accessKey}
                onChange={(e) => onChange({ accessKey: e.target.value })}
                placeholder="Enter Access Key"
            />
        </div>
        <p style={{ fontSize: 12, color: "#8e8e93" }}>
            Get credentials from the{" "}
            <a
                href="https://console.volcengine.com/speech/app"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#007aff" }}
            >
                Volcengine Console
            </a>
            . Navigate to 语音识别大模型 → 流式语音识别大模型.
        </p>
    </div>
);

// ── Context Tab ────────────────────────────────────────────────────

interface ContextTabProps {
    settings: AppSettings;
    onChange: (partial: Partial<AppSettings>) => void;
}

const ContextTab: FC<ContextTabProps> = ({ settings, onChange }) => (
    <div style={{ padding: "20px 24px" }}>
        <div style={sectionTitle}>User Context</div>
        <p style={{ fontSize: 12, color: "#8e8e93", marginBottom: 12 }}>
            Provide persistent context that always applies to transcription.
        </p>
        <textarea
            style={{ ...fieldStyle, height: 100, resize: "vertical", fontFamily: "inherit" }}
            value={settings.context}
            onChange={(e) => onChange({ context: e.target.value })}
            placeholder="e.g. Technical terms, names, domain vocabulary..."
            maxLength={settings.maxContextLength}
        />
        <div style={{ fontSize: 11, color: "#8e8e93", textAlign: "right", marginTop: 4 }}>
            {settings.context.length} / {settings.maxContextLength}
        </div>
    </div>
);

// ── Controls Tab ───────────────────────────────────────────────────

interface ControlsTabProps {
    settings: AppSettings;
    onChange: (partial: Partial<AppSettings>) => void;
    audioDevices: { deviceId: string; label: string }[];
}

const ControlsTab: FC<ControlsTabProps> = ({ settings, onChange, audioDevices }) => {
    const ptt = settings.pushToTalk;

    return (
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Global shortcut */}
            <section>
                <div style={sectionTitle}>Global Shortcut</div>
                <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Toggle window shortcut</label>
                    <input
                        style={fieldStyle}
                        value={settings.globalShortcut}
                        onChange={(e) => onChange({ globalShortcut: e.target.value })}
                        placeholder="e.g. CommandOrControl+Option+V"
                    />
                    <p style={{ fontSize: 11, color: "#8e8e93", marginTop: 4 }}>
                        Use Electron accelerator syntax.
                    </p>
                </div>
            </section>

            {/* Microphone */}
            <section>
                <div style={sectionTitle}>Microphone</div>
                <select
                    style={fieldStyle}
                    value={settings.selectedMicrophoneId}
                    onChange={(e) => onChange({ selectedMicrophoneId: e.target.value })}
                >
                    <option value="">System Default</option>
                    {audioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                            {d.label || d.deviceId}
                        </option>
                    ))}
                </select>
            </section>

            {/* Push to Talk */}
            <section>
                <div style={sectionTitle}>Push to Talk</div>
                <label
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                        cursor: "pointer",
                    }}
                >
                    <input
                        type="checkbox"
                        checked={ptt.enabled}
                        onChange={(e) =>
                            onChange({ pushToTalk: { ...ptt, enabled: e.target.checked } })
                        }
                    />
                    <span style={{ fontSize: 13 }}>Enable Push to Talk</span>
                </label>
                {ptt.enabled && (
                    <>
                        <div style={{ marginBottom: 10 }}>
                            <label style={labelStyle}>Modifier key</label>
                            <select
                                style={fieldStyle}
                                value={ptt.modifierKey}
                                onChange={(e) =>
                                    onChange({
                                        pushToTalk: {
                                            ...ptt,
                                            modifierKey: e.target.value as typeof ptt.modifierKey,
                                        },
                                    })
                                }
                            >
                                <option value="rightControl">⌃ Right Ctrl</option>
                            </select>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                            <label style={labelStyle}>
                                Hold duration: {ptt.minimumPressDuration.toFixed(1)}s
                            </label>
                            <input
                                type="range"
                                min={0.1}
                                max={1.0}
                                step={0.1}
                                value={ptt.minimumPressDuration}
                                onChange={(e) =>
                                    onChange({
                                        pushToTalk: {
                                            ...ptt,
                                            minimumPressDuration: parseFloat(e.target.value),
                                        },
                                    })
                                }
                                style={{ width: "100%" }}
                            />
                        </div>
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={ptt.requireDoubleTap}
                                onChange={(e) =>
                                    onChange({
                                        pushToTalk: { ...ptt, requireDoubleTap: e.target.checked },
                                    })
                                }
                            />
                            <span style={{ fontSize: 13 }}>Require double-tap first</span>
                        </label>
                    </>
                )}
            </section>

            {/* Behavior */}
            <section>
                <div style={sectionTitle}>Behavior</div>
                <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Input method (text commit)</label>
                    <select
                        style={fieldStyle}
                        value={settings.inputMethod}
                        onChange={(e) =>
                            onChange({
                                inputMethod: e.target.value as typeof settings.inputMethod,
                            })
                        }
                    >
                        <option value="clipboard">Clipboard paste (Shift+Insert)</option>
                    </select>
                    <p style={{ fontSize: 11, color: "#8e8e93", marginTop: 4 }}>
                        Clipboard mode copies text and simulates Shift+Insert. Works reliably with
                        Chinese / CJK characters.
                    </p>
                </div>
                <label
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                        cursor: "pointer",
                    }}
                >
                    <input
                        type="checkbox"
                        checked={settings.autoPasteAfterClose}
                        onChange={(e) => onChange({ autoPasteAfterClose: e.target.checked })}
                    />
                    <span style={{ fontSize: 13 }}>Auto-paste after finish</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                        type="checkbox"
                        checked={settings.removeTrailingPunctuation}
                        onChange={(e) => onChange({ removeTrailingPunctuation: e.target.checked })}
                    />
                    <span style={{ fontSize: 13 }}>Remove trailing punctuation</span>
                </label>
            </section>

            {/* Appearance */}
            <section>
                <div style={sectionTitle}>Appearance</div>
                <div>
                    <label style={labelStyle}>Window position</label>
                    <select
                        style={fieldStyle}
                        value={settings.windowPositionMode}
                        onChange={(e) =>
                            onChange({
                                windowPositionMode: e.target
                                    .value as typeof settings.windowPositionMode,
                            })
                        }
                    >
                        <option value="nearMouse">Near Mouse Cursor</option>
                        <option value="rememberLast">Remember Last Position</option>
                        <option value="topCenter">Top of Screen</option>
                        <option value="bottomCenter">Bottom of Screen</option>
                    </select>
                </div>
            </section>
        </div>
    );
};

// ── About Tab ──────────────────────────────────────────────────────

const AboutTab: FC = () => (
    <div
        style={{
            padding: "40px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
        }}
    >
        <div style={{ fontSize: 56 }}>🎙️</div>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>豆包语音输入</h2>
        <p style={{ fontSize: 13, color: "#8e8e93" }}>Version 1.0.0</p>
        <p style={{ fontSize: 13, color: "#8e8e93", textAlign: "center", maxWidth: 320 }}>
            Real-time speech-to-text using the Volcengine Seed ASR API
        </p>
    </div>
);

// ── Settings Root ──────────────────────────────────────────────────

type Tab = "api" | "context" | "controls" | "about";

const tabLabel: Record<Tab, string> = {
    api: "API",
    context: "Context",
    controls: "Controls",
    about: "About",
};

const SettingsPanel: FC = () => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [pending, setPending] = useState<Partial<AppSettings>>({});
    const [activeTab, setActiveTab] = useState<Tab>("api");
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        window.electronAPI.getSettings().then(setSettings);

        // Enumerate audio devices via browser API
        navigator.mediaDevices.enumerateDevices().then((devices) => {
            setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
        });
    }, []);

    if (!settings) {
        return <div style={{ padding: 24, color: "#8e8e93" }}>Loading...</div>;
    }

    const merged: AppSettings = { ...settings, ...pending };

    const handleChange = (partial: Partial<AppSettings>): void => {
        setPending((prev) => ({ ...prev, ...partial }));
    };

    const handleSave = async (): Promise<void> => {
        if (Object.keys(pending).length === 0) return;
        const updated = await window.electronAPI.updateSettings(pending);
        setSettings(updated);
        setPending({});
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    const handleCancel = (): void => {
        setPending({});
        window.close();
    };

    const tabs: Tab[] = ["api", "context", "controls", "about"];

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                background: "#f5f5f7",
            }}
        >
            {/* Tab bar */}
            <div
                style={{
                    display: "flex",
                    borderBottom: "1px solid rgba(0,0,0,0.1)",
                    background: "rgba(255,255,255,0.8)",
                    backdropFilter: "blur(10px)",
                    padding: "0 16px",
                }}
            >
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: "12px 20px",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: activeTab === tab ? 600 : 400,
                            color: activeTab === tab ? "#007aff" : "#6e6e73",
                            borderBottom:
                                activeTab === tab ? "2px solid #007aff" : "2px solid transparent",
                            marginBottom: -1,
                        }}
                    >
                        {tabLabel[tab]}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: "auto" }}>
                {activeTab === "api" && <APITab settings={merged} onChange={handleChange} />}
                {activeTab === "context" && (
                    <ContextTab settings={merged} onChange={handleChange} />
                )}
                {activeTab === "controls" && (
                    <ControlsTab
                        settings={merged}
                        onChange={handleChange}
                        audioDevices={audioDevices.map((d) => ({
                            deviceId: d.deviceId,
                            label: d.label,
                        }))}
                    />
                )}
                {activeTab === "about" && <AboutTab />}
            </div>

            {/* Bottom buttons */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    padding: "12px 20px",
                    borderTop: "1px solid rgba(0,0,0,0.1)",
                    background: "rgba(255,255,255,0.8)",
                }}
            >
                <button
                    onClick={handleCancel}
                    style={{
                        padding: "7px 18px",
                        borderRadius: 8,
                        border: "1px solid rgba(0,0,0,0.15)",
                        background: "transparent",
                        fontSize: 13,
                        cursor: "pointer",
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    style={{
                        padding: "7px 18px",
                        borderRadius: 8,
                        border: "none",
                        background: "#007aff",
                        color: "#fff",
                        fontSize: 13,
                        cursor: "pointer",
                        fontWeight: 500,
                    }}
                >
                    {saved ? "✓ Saved" : "Save"}
                </button>
            </div>
        </div>
    );
};

export default SettingsPanel;
