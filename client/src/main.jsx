import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app.jsx";;
import "./styles.css";

const root = createRoot(document.getElementById("root"));
root.render(<App />);
