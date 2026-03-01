import { type FC } from "react";

interface WaveformViewProps {
    levels: number[];
    compact?: boolean;
}

// Arc-shaped scale: center bar tallest, edges shortest
const ARC_SCALE = [0.6, 0.92, 1.0, 0.92, 0.6];

const WaveformView: FC<WaveformViewProps> = ({ levels, compact = false }) => {
    const barCount = 5;
    const height = compact ? 21 : 36;

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: compact ? 2 : 3,
                height,
            }}
        >
            {Array.from({ length: barCount }).map((_, i) => {
                const raw = levels[i] ?? 0;
                const scale = ARC_SCALE[i] ?? 1;
                const minH = 0.15 * scale;
                const level = Math.max(minH, raw * scale);
                const barH = Math.max(compact ? 3 : 4, level * (compact ? 18 : 30));
                return (
                    <div
                        key={i}
                        style={{
                            width: compact ? 2.5 : 3,
                            height: barH,
                            borderRadius: compact ? 1 : 1.5,
                            background: "rgba(0,0,0,0.75)",
                            transition: "height 0.12s ease-in-out",
                        }}
                    />
                );
            })}
        </div>
    );
};

export default WaveformView;
