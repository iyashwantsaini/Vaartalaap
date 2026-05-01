import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ColorModeProvider } from "./styles/ColorModeProvider";
import "@fontsource-variable/inter";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ColorModeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ColorModeProvider>
  </StrictMode>
);
