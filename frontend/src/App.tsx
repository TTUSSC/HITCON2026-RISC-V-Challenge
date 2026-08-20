import { ThemeToggle } from "./components/ThemeToggle";
import "./App.css";

function App() {
  return (
    <>
      <header className="app-header">
        <span className="app-title">HITCON 2026 · RISC-V Booth</span>
        <ThemeToggle />
      </header>
      <main className="app-main">
        <p>
          Widget UI is under construction — see
          docs/design/platform-architecture.md.
        </p>
      </main>
    </>
  );
}

export default App;
