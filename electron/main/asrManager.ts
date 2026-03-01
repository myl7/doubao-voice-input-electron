/**
 * ASR Manager: coordinates the lifecycle of ASRClient within the main process.
 * Receives audio buffers from the renderer via IPC and forwards results back.
 */

import { ASRClient, type ASRConfig, type ASRResult } from "./asrClient";

type ResultCallback = (result: ASRResult) => void;

class ASRManager {
    private client: ASRClient | null = null;
    private state: "idle" | "connecting" | "running" | "stopping" = "idle";

    async start(config: ASRConfig, onResult: ResultCallback): Promise<void> {
        if (this.state !== "idle") {
            await this.stop();
        }

        this.state = "connecting";
        this.client = new ASRClient(onResult);

        try {
            await this.client.connect(config);
            this.state = "running";
        } catch (err) {
            console.error("[ASRManager] Connection failed:", err);
            this.client = null;
            this.state = "idle";
            onResult({
                text: "",
                isFinal: true,
                code: -1,
                message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }

    sendAudio(buffer: Buffer): void {
        if (this.state === "running" && this.client) {
            this.client.sendAudio(buffer);
        }
    }

    async stop(): Promise<void> {
        if (this.state === "idle") return;

        const client = this.client;
        this.state = "stopping";

        if (client) {
            try {
                await client.sendFinalPacket();
                await client.waitForFinalResult();
            } catch {
                /* ignore */
            }
            await client.disconnect();
        }

        this.client = null;
        this.state = "idle";
    }

    isRunning(): boolean {
        return this.state === "running";
    }
}

export const asrManager = new ASRManager();
