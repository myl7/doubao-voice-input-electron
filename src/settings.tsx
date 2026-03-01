import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SettingsPanel from "./components/SettingsPanel";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <SettingsPanel />
    </StrictMode>,
);
