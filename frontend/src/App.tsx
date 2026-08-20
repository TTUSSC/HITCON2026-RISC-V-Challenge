import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeToggle } from "./components/ThemeToggle";
import { EntryPage } from "./pages/EntryPage";
import { LevelPage } from "./pages/LevelPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <header className="app-header">
        <span className="app-title">HITCON 2026 · RISC-V Booth</span>
        <ThemeToggle />
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<EntryPage />} />
          <Route path="/level/:levelId" element={<LevelPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
