// Augment React CSSProperties for Electron-specific CSS properties
import "react";

declare module "react" {
    interface CSSProperties {
        WebkitAppRegion?: "drag" | "no-drag";
    }
}
