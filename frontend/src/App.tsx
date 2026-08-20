import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { CircleUser } from "lucide-react";
import { ThemeToggle } from "./components/ThemeToggle";
import { EntryPage } from "./pages/EntryPage";
import { MapPage } from "./pages/MapPage";
import { LevelPage } from "./pages/LevelPage";
import { ProfilePage } from "./pages/ProfilePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { useSessionStore } from "./engine/sessionStore";
import "./App.css";

// /path is home (Duolingo convention: EntryPage is one-time onboarding, a
// player never navigates back to it once they've picked an entry point —
// repo owner's explicit decision). The header title only becomes a clickable
// "go home" link once a session has actually started (at least one entered
// level) — on EntryPage itself, before any pick, there's nothing to go home
// to yet, so it stays plain text there.
function HeaderTitle() {
  const hasStarted = useSessionStore((s) => s.events.length > 0);
  if (!hasStarted) {
    return <span className="app-title">TTUSSC RISC-V Challenge</span>;
  }
  return (
    <Link to="/path" className="app-title app-title-link">
      TTUSSC RISC-V Challenge
    </Link>
  );
}

function App() {
  return (
    <BrowserRouter>
      <header className="app-header">
        <HeaderTitle />
        <div className="app-header-actions">
          <Link to="/profile" className="header-icon-btn" aria-label="個人頁">
            <CircleUser size={20} />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<EntryPage />} />
          <Route path="/path" element={<MapPage />} />
          <Route path="/level/:levelId" element={<LevelPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
