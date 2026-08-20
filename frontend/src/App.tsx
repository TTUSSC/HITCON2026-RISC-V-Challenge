import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { Flag, Award, Cpu } from "lucide-react";
import { ThemeToggle } from "./components/ThemeToggle";
import { BottomNav } from "./components/BottomNav";
import { EntryPage } from "./pages/EntryPage";
import { MapPage } from "./pages/MapPage";
import { LevelPage } from "./pages/LevelPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AboutPage } from "./pages/AboutPage";
import { ReferencePage } from "./pages/ReferencePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { useSessionStore } from "./engine/sessionStore";
import { levels } from "./engine/levels";
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

// Compact top info row — real SessionProgress data, not fake streak/XP (see
// docs/design/STYLE.md's "定位": streak/XP/hearts are explicitly-rejected
// retention mechanics for this app). Shares HeaderTitle's hasStarted gate:
// before any level has been entered there's no progress worth showing.
function HeaderProgress() {
  const hasStarted = useSessionStore((s) => s.events.length > 0);
  const events = useSessionStore((s) => s.events);
  const rewardCount = useSessionStore((s) => s.rewards.length);

  if (!hasStarted) return null;

  const passedCount = events.filter((e) => e.passedAt !== undefined).length;

  return (
    <div className="app-header-progress" aria-label="通關進度">
      <span className="app-header-progress-item">
        <Flag size={14} />
        {passedCount}/{levels.length}
      </span>
      <span className="app-header-progress-item">
        <Award size={14} />
        {rewardCount}
      </span>
    </div>
  );
}

// Bottom nav is hidden on "/" (EntryPage, before a session exists — nothing
// to navigate to yet) and on "/level/:levelId" (the lesson screen already
// has its own bottom-pinned primary CTA button; see BottomNav.tsx's file
// header for why the two shouldn't stack).
function AppShell() {
  const location = useLocation();
  const showBottomNav =
    location.pathname !== "/" && !location.pathname.startsWith("/level/");

  return (
    <>
      <header className="app-header">
        {/* Duolingo's header always leads with the current course's flag —
            this app has no course to switch (single RISC-V curriculum), so
            this is a static brand badge in that same visual slot rather
            than an interactive control. */}
        <span className="app-arch-badge" aria-label="RISC-V" title="RISC-V">
          <Cpu size={16} />
          RV32
        </span>
        <HeaderTitle />
        <HeaderProgress />
        <div className="app-header-actions">
          <ThemeToggle />
        </div>
      </header>
      <main className={`app-main${showBottomNav ? " app-main-with-nav" : ""}`}>
        <Routes>
          <Route path="/" element={<EntryPage />} />
          <Route path="/path" element={<MapPage />} />
          <Route path="/level/:levelId" element={<LevelPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/reference" element={<ReferencePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {showBottomNav && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
