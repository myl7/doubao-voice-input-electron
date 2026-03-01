import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FloatingBall from "./components/FloatingBall";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <FloatingBall />
    </StrictMode>,
);
