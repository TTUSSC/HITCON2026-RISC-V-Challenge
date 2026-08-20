// Reference page ("/reference") — full-page version of the in-lesson
// cheat sheet, reachable from the bottom nav's "速查" item at any time, not
// just mid-lesson. Renders the exact same CheatSheetContent used by the
// in-lesson slide-up sheet (components/CheatSheet.tsx) at full-page scale,
// with this app's persistent header/bottom-nav chrome around it instead of
// overlay chrome — no syscall/register/instruction data duplicated here.

import { BookOpen } from "lucide-react";
import { CheatSheetContent } from "../components/CheatSheetContent";
import "./pages.css";

export function ReferencePage() {
  return (
    <div className="reference-page">
      <h1 className="reference-title">
        <BookOpen size={22} />
        速查表
      </h1>
      <CheatSheetContent />
    </div>
  );
}
