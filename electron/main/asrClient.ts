/**
 * ASR Client for Volcengine Seed ASR API.
 *
 * Binary protocol (matches Python reference implementation):
 *   Byte 0: [Version:4 | HeaderSize:4]
 *   Byte 1: [MessageType:4 | Flags:4]
 *   Byte 2: [Serialization:4 | Compression:4]
 *   Byte 3: Reserved
 *
 * Payloads are GZIP compressed (pako).
 * Final audio packet uses negative sequence number.
 */

import WebSocket from "ws";
import * as pako from "pako";
import { randomUUID } from "crypto";

// ── Constants ──────────────────────────────────────────────────────

const API_URL = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async";

// Message types
const MSG_TYPE_FULL = 0b0001; // Full request (JSON config)
const MSG_TYPE_AUDIO = 0b0010; // Audio data
const MSG_TYPE_SERVER_FULL = 0b1001; // Server full response
const MSG_TYPE_SERVER_ERROR = 0b1111; // Server error response

// Flags
const FLAG_POS_SEQUENCE = 0b0001; // Positive sequence present
// FLAG_NEG_SEQUENCE = 0b0010 (negative sequence, encoded via negative int32)
const FLAG_NEG_WITH_SEQUENCE = 0b0011; // Both

const COMPRESSION_GZIP = 0b0001;
const SERIALIZATION_JSON = 0b0001;

// ── Types ──────────────────────────────────────────────────────────

export interface ASRConfig {
    appKey: string;
    accessKey: string;
    resourceId?: string;
    language?: string;
    contextLines?: string[];
}

export interface ASRResult {
    text: string;
    isFinal: boolean;
    code: number;
    message: string;
}

// ── Binary helpers ─────────────────────────────────────────────────

function readInt32BE(buf: Buffer, offset: number): number {
    return buf.readInt32BE(offset);
}

function readUInt32BE(buf: Buffer, offset: number): number {
    return buf.readUInt32BE(offset);
}

function buildHeader(messageType: number, flags: number, compression: number): Buffer {
    const h = Buffer.alloc(4);
    h[0] = (0b0001 << 4) | 0b0001; // version=1, headerSize=1 (4 bytes)
    h[1] = (messageType << 4) | flags;
    h[2] = (SERIALIZATION_JSON << 4) | compression;
    h[3] = 0x00;
    return h;
}

function gzip(data: Buffer): Buffer {
    return Buffer.from(pako.gzip(new Uint8Array(data)));
}

function gunzip(data: Buffer): Buffer {
    return Buffer.from(pako.ungzip(new Uint8Array(data)));
}

function buildFullRequest(config: ASRConfig, sequence: number): Buffer {
    const payload = buildFullRequestPayload(config);
    const jsonBuf = Buffer.from(JSON.stringify(payload), "utf8");
    const compressed = gzip(jsonBuf);

    const header = buildHeader(MSG_TYPE_FULL, FLAG_POS_SEQUENCE, COMPRESSION_GZIP);
    const seqBuf = Buffer.alloc(4);
    seqBuf.writeInt32BE(sequence, 0);
    const sizeBuf = Buffer.alloc(4);
    sizeBuf.writeUInt32BE(compressed.length, 0);

    return Buffer.concat([header, seqBuf, sizeBuf, compressed]);
}

function buildAudioPacket(audio: Buffer, sequence: number, isFinal: boolean): Buffer {
    const flags = isFinal ? FLAG_NEG_WITH_SEQUENCE : FLAG_POS_SEQUENCE;
    const header = buildHeader(MSG_TYPE_AUDIO, flags, COMPRESSION_GZIP);

    const compressed = gzip(audio);

    const seqBuf = Buffer.alloc(4);
    const seqValue = isFinal ? -sequence : sequence;
    seqBuf.writeInt32BE(seqValue, 0);

    const sizeBuf = Buffer.alloc(4);
    sizeBuf.writeUInt32BE(compressed.length, 0);

    return Buffer.concat([header, seqBuf, sizeBuf, compressed]);
}

function parseResponse(data: Buffer): ASRResult | null {
    if (data.length < 4) return null;

    const headerSize = (data[0] & 0x0f) * 4;
    const messageType = (data[1] >> 4) & 0x0f;
    const typeFlags = data[1] & 0x0f;
    const compression = data[2] & 0x0f;

    let offset = headerSize;

    // Read sequence if present
    if (typeFlags & 0x01) {
        offset += 4; // skip sequence
    }

    const isLastPackage = !!(typeFlags & 0x02);

    // Skip extra 4 bytes if flag 0x04
    if (typeFlags & 0x04) {
        offset += 4;
    }

    let code = 0;
    let payloadSize = 0;

    if (messageType === MSG_TYPE_SERVER_FULL) {
        if (offset + 4 > data.length) return null;
        payloadSize = readUInt32BE(data, offset);
        offset += 4;
    } else if (messageType === MSG_TYPE_SERVER_ERROR) {
        if (offset + 8 > data.length) return null;
        code = readInt32BE(data, offset);
        offset += 4;
        payloadSize = readUInt32BE(data, offset);
        offset += 4;
    } else {
        return null;
    }

    const payloadEnd = offset + payloadSize;
    if (payloadEnd > data.length) return null;

    let payload: Buffer = Buffer.from(data.subarray(offset, payloadEnd));

    if (payload.length === 0) {
        return {
            text: "",
            isFinal: isLastPackage,
            code,
            message: code !== 0 ? `Error ${code}` : "",
        };
    }

    if (compression === COMPRESSION_GZIP) {
        try {
            payload = gunzip(payload);
        } catch {
            return null;
        }
    }

    let json: Record<string, unknown>;
    try {
        json = JSON.parse(payload.toString("utf8"));
    } catch {
        return null;
    }

    if (typeof json.code === "number") code = json.code;
    const message = (json.message as string) ?? (code !== 0 ? `Error ${code}` : "");

    let text = "";
    if (json.result && typeof (json.result as Record<string, unknown>).text === "string") {
        text = (json.result as { text: string }).text;
    }

    return { text, isFinal: isLastPackage, code, message };
}

function buildFullRequestPayload(config: ASRConfig): object {
    // resourceId is embedded in the WebSocket headers during connect()
    void config.resourceId;

    const request: Record<string, unknown> = {
        model_name: "bigmodel",
        enable_itn: true,
        enable_punc: true,
        enable_ddc: true,
        show_utterances: true,
        enable_nonstream: true,
        end_window_size: 3000,
    };

    if (config.contextLines && config.contextLines.length > 0) {
        const contextText = config.contextLines.join(" ");
        const contextDict = {
            context_type: "dialog_ctx",
            context_data: [{ text: contextText }],
        };
        request.corpus = { context: JSON.stringify(contextDict) };
    }

    return {
        user: { uid: "doubao_voice_input_electron_user" },
        audio: {
            format: "pcm",
            codec: "raw",
            rate: 16000,
            bits: 16,
            channel: 1,
        },
        request,
    };
}

// ── ASR Client ─────────────────────────────────────────────────────

export class ASRClient {
    private ws: WebSocket | null = null;
    private sequence = 1;
    private isConnected = false;
    private onResult: (result: ASRResult) => void;
    private receivedFinal = false;

    constructor(onResult: (result: ASRResult) => void) {
        this.onResult = onResult;
    }

    async connect(config: ASRConfig): Promise<void> {
        if (this.ws) await this.disconnect();

        this.sequence = 1;
        this.receivedFinal = false;
        this.isConnected = false;

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(API_URL, {
                headers: {
                    "X-Api-Resource-Id": config.resourceId ?? "volc.seedasr.sauc.duration",
                    "X-Api-Access-Key": config.accessKey,
                    "X-Api-App-Key": config.appKey,
                    "X-Api-Request-Id": randomUUID(),
                },
            });

            ws.binaryType = "nodebuffer";

            ws.on("open", async () => {
                this.ws = ws;
                this.isConnected = true;

                // Send full request packet
                const packet = buildFullRequest(config, this.sequence++);
                ws.send(packet, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            ws.on("message", (data: Buffer) => {
                const result = parseResponse(data);
                if (!result) return;

                this.onResult(result);

                if (result.isFinal) {
                    this.receivedFinal = true;
                }
            });

            ws.on("error", (err) => {
                if (!this.isConnected) {
                    reject(err);
                } else {
                    console.error("[ASR] WebSocket error:", err);
                    this.isConnected = false;
                }
            });

            ws.on("close", () => {
                this.isConnected = false;
            });
        });
    }

    sendAudio(audio: Buffer): void {
        if (!this.isConnected || !this.ws) return;
        const packet = buildAudioPacket(audio, this.sequence++, false);
        this.ws.send(packet);
    }

    async sendFinalPacket(): Promise<void> {
        if (!this.isConnected || !this.ws) return;
        const packet = buildAudioPacket(Buffer.alloc(0), this.sequence++, true);
        return new Promise((resolve) => {
            this.ws!.send(packet, () => resolve());
        });
    }

    async waitForFinalResult(timeoutMs = 3000): Promise<void> {
        const deadline = Date.now() + timeoutMs;
        while (!this.receivedFinal && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50));
        }
    }

    async disconnect(): Promise<void> {
        this.isConnected = false;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.sequence = 1;
        this.receivedFinal = false;
    }
}
