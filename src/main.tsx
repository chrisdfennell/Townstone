import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { unlockAudio } from "./audio/sfx";
import "./index.css";

// Browsers block audio until a user gesture — unlock on the first interaction.
window.addEventListener("pointerdown", () => unlockAudio(), { once: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
