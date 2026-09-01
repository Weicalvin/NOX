import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/player/AppShell";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("root missing");
createRoot(root).render(<AppShell />);
