import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            lib: {
                entry: resolve("electron/main/index.ts"),
            },
        },
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            lib: {
                entry: resolve("electron/preload/index.ts"),
            },
        },
    },
    renderer: {
        root: ".",
        build: {
            rollupOptions: {
                input: {
                    floating: resolve(__dirname, "floating.html"),
                    ball: resolve(__dirname, "ball.html"),
                    settings: resolve(__dirname, "settings.html"),
                },
            },
        },
        resolve: {
            alias: {
                "@renderer": resolve("src"),
                "@shared": resolve("electron/shared"),
            },
        },
        plugins: [react()],
    },
});
