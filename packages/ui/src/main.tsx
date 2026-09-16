import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/heebo/400.css";
import "@fontsource/heebo/500.css";
import "@fontsource/heebo/700.css";
import "@fontsource/rubik/400.css";
import "@fontsource/rubik/500.css";
import "@fontsource/rubik/600.css";
import "@fontsource/rubik/700.css";
import "@fontsource/frank-ruhl-libre/500.css";
import "@fontsource/frank-ruhl-libre/700.css";
import "@fontsource/frank-ruhl-libre/900.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./theme.css";
import { App } from "./App";

const el = document.getElementById("root");
if (el === null) throw new Error("no #root");
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
