// Persistent bottom navigation bar — Duolingo's actual mobile home-screen
// structure (top info row + bottom sticky nav), repo-owner-confirmed scope:
// exactly 4 items (Home / 速查 / About / Profile), no streak/XP/hearts items
// since those retention mechanics are explicitly out of scope for this app
// (see docs/design/STYLE.md's "定位" section).
//
// Rendered by App.tsx below <main>, hidden on "/" (EntryPage, before a
// session exists — nothing to navigate to yet) and on "/level/:levelId"
// (the lesson screen already has its own bottom-pinned primary CTA button,
// see LevelPage.tsx / pages.css's ".widget-primary-btn { position: fixed;
// bottom: 0 }" — stacking a second fixed bottom bar there would visually
// collide with it, so the lesson screen keeps just the one, matching how
// Duolingo itself hides its bottom nav during an active lesson).

import { NavLink } from "react-router-dom";
import { Home, BookOpen, Info, CircleUser } from "lucide-react";
import "./BottomNav.css";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

// BookOpen matches the in-lesson cheat-sheet trigger's icon (see
// LevelPage.tsx's .lesson-cheatsheet-btn) — same affordance, same icon.
// Profile access lives only here now — the sticky header used to duplicate
// it with its own CircleUser icon button, which was redundant once this nav
// exists on every page that has a header.
const NAV_ITEMS: NavItem[] = [
  { to: "/path", label: "首頁", icon: Home },
  { to: "/reference", label: "速查", icon: BookOpen },
  { to: "/about", label: "關於", icon: Info },
  { to: "/profile", label: "個人", icon: CircleUser },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="主要導覽">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `bottom-nav-item${isActive ? " bottom-nav-item-active" : ""}`
          }
        >
          <Icon size={22} />
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
