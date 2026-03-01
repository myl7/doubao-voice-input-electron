import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FloatingWindow from "./components/FloatingWindow";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <FloatingWindow />
    </StrictMode>,
);
