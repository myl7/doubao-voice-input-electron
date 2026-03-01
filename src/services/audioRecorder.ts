/**
 * Audio recorder using Web Audio API.
 *
 * Records from the microphone at 16kHz/16-bit mono PCM and emits
 * 200ms segments to the callback. Also computes FFT frequency bands
 * for waveform visualization.
 *
 * The PCM data is sent to the main process via IPC (electronAPI.sendAudioData)
 * which forwards it to the ASR WebSocket.
 */

const TARGET_SAMPLE_RATE = 16000;
const SEGMENT_DURATION_S = 0.2; // 200ms
const SEGMENT_SAMPLES = TARGET_SAMPLE_RATE * SEGMENT_DURATION_S; // 3200

// 5 speech-focused frequency bands (85-8000 Hz)
const FFT_SIZE = 2048;
const BAND_RANGES_HZ = [
    [85, 250],
    [250, 500],
    [500, 1200],
    [1200, 3000],
    [3000, 8000],
] as const;

export type LevelCallback = (bands: number[]) => void;
export type AudioCallback = (pcm: ArrayBuffer) => void;

export class AudioRecorder {
    private audioContext: AudioContext | null = null;
    private stream: MediaStream | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private processorNode: ScriptProcessorNode | null = null;
    private analyserNode: AnalyserNode | null = null;
    private segmentPcmBuffer: Int16Array = new Int16Array(SEGMENT_SAMPLES * 4); // extra space
    private segmentPcmFill = 0;
    private levelTimer: ReturnType<typeof setInterval> | null = null;
    private isRunning = false;

    async start(onAudio: AudioCallback, onLevel: LevelCallback, deviceId = ""): Promise<void> {
        if (this.isRunning) return;

        const constraints: MediaStreamConstraints = {
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: TARGET_SAMPLE_RATE,
                ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            },
        };

        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        const inputSampleRate = this.stream.getAudioTracks()[0].getSettings().sampleRate ?? 44100;

        this.audioContext = new AudioContext({ sampleRate: inputSampleRate });
        this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

        // Analyser for FFT visualization
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = FFT_SIZE;
        this.analyserNode.smoothingTimeConstant = 0;

        // ScriptProcessor for PCM capture (deprecated but widely available)
        const bufferSize = 4096;
        this.segmentPcmFill = 0;

        this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

        const resampledRate = TARGET_SAMPLE_RATE;
        const ratio = resampledRate / inputSampleRate;

        this.processorNode.onaudioprocess = (e) => {
            if (!this.isRunning) return;

            const inputData = e.inputBuffer.getChannelData(0);

            // Naive linear resampling if needed
            const resampled =
                inputSampleRate === TARGET_SAMPLE_RATE
                    ? inputData
                    : this.resample(inputData, ratio);

            // Convert float32 → int16
            for (let i = 0; i < resampled.length; i++) {
                const s = Math.max(-1, Math.min(1, resampled[i]));
                const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;

                if (this.segmentPcmFill >= this.segmentPcmBuffer.length) {
                    // Grow buffer
                    const bigger = new Int16Array(this.segmentPcmBuffer.length * 2);
                    bigger.set(this.segmentPcmBuffer);
                    this.segmentPcmBuffer = bigger;
                }

                this.segmentPcmBuffer[this.segmentPcmFill++] = int16;

                // Emit full segment
                if (this.segmentPcmFill >= SEGMENT_SAMPLES) {
                    const segment = this.segmentPcmBuffer.slice(0, SEGMENT_SAMPLES);
                    const buf = segment.buffer.slice(
                        segment.byteOffset,
                        segment.byteOffset + segment.byteLength,
                    );
                    onAudio(buf);
                    // Shift remaining
                    this.segmentPcmBuffer.copyWithin(0, SEGMENT_SAMPLES, this.segmentPcmFill);
                    this.segmentPcmFill -= SEGMENT_SAMPLES;
                }
            }
        };

        this.sourceNode.connect(this.analyserNode);
        this.sourceNode.connect(this.processorNode);
        this.processorNode.connect(this.audioContext.destination);

        // Level polling at ~30fps
        const freqData = new Float32Array(this.analyserNode.frequencyBinCount);
        this.levelTimer = setInterval(() => {
            if (!this.analyserNode || !this.isRunning) return;
            this.analyserNode.getFloatFrequencyData(freqData);
            const bands = this.computeBands(freqData, inputSampleRate);
            onLevel(bands);
        }, 33);

        this.isRunning = true;
    }

    stop(): void {
        if (!this.isRunning) return;
        this.isRunning = false;

        if (this.levelTimer) {
            clearInterval(this.levelTimer);
            this.levelTimer = null;
        }

        this.processorNode?.disconnect();
        this.analyserNode?.disconnect();
        this.sourceNode?.disconnect();

        this.processorNode = null;
        this.analyserNode = null;
        this.sourceNode = null;

        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;

        this.audioContext?.close();
        this.audioContext = null;

        // Flush remaining buffer
        this.segmentPcmFill = 0;
    }

    private resample(input: Float32Array, ratio: number): Float32Array {
        const outputLength = Math.round(input.length * ratio);
        const output = new Float32Array(outputLength);
        for (let i = 0; i < outputLength; i++) {
            const srcIdx = i / ratio;
            const lo = Math.floor(srcIdx);
            const hi = Math.min(lo + 1, input.length - 1);
            const frac = srcIdx - lo;
            output[i] = input[lo] * (1 - frac) + input[hi] * frac;
        }
        return output;
    }

    private computeBands(freqData: Float32Array, sampleRate: number): number[] {
        const binCount = freqData.length;
        const nyquist = sampleRate / 2;
        const hzPerBin = nyquist / binCount;
        const DYNAMIC_RANGE_DB = 18;

        return BAND_RANGES_HZ.map(([lo, hi]) => {
            const loIdx = Math.round(lo / hzPerBin);
            const hiIdx = Math.min(Math.round(hi / hzPerBin), binCount - 1);

            if (hiIdx <= loIdx) return 0;

            let sum = 0;
            for (let i = loIdx; i < hiIdx; i++) {
                sum += freqData[i]; // already in dB from AnalyserNode
            }
            const avgDb = sum / (hiIdx - loIdx);

            // Normalize to 0..1 (treat -100dB floor, -100+DYNAMIC_RANGE as max)
            const normalized = (avgDb + 100) / DYNAMIC_RANGE_DB;
            return Math.max(0, Math.min(1, normalized));
        });
    }
}
