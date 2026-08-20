// About page ("/about") — repo owner's exact scope: (1) a short, honest
// description of how this platform actually connects to RISC-V, (2) a brief
// club introduction at the bottom using TTUSSC's own official description.
//
// Not marketing copy — this audience will see through fluff immediately.
// Every technical claim here is grounded in the real implementation: judge
// kind `emulator` levels run the player's actual assembled machine code
// through a real WASM build of rv32emu, not a simulation/quiz (see
// docs/design/platform-architecture.md's Judge Catalog + Emulator Sandbox
// sections). Curriculum scope (calling convention / syscalls / buffer
// overflow / ROP) mirrors the branch structure in engine/levels.ts's
// BRANCH_TITLES, without duplicating that file's content data here.

// repo owner's explicit add: credit the actual upstream open-source project
// this app's emulator is built on — jserv (Jim Huang, 黃敬群)'s rv32emu —
// both his identity and the project itself must be real links, not a
// name-drop. Placed right after the platform-description paragraphs since
// that's where the emulator is mentioned.

import { ExternalLink } from "lucide-react";
import "./pages.css";

export function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-section">
        <h1 className="about-title">這個平台在教什麼</h1>
        <p className="about-body">
          這裡教的是真的 RISC-V
          組合語言，不是選擇題也不是模擬器動畫。你寫的每一行指令，都會被真的組譯成
          RV32 機械碼，丟進瀏覽器裡跑的真實 WASM RISC-V
          模擬器（rv32emu）執行。過關與否，看的是執行完後真正的暫存器、記憶體、exit
          code，不是你輸入的字串長得像不像答案。
        </p>
        <p className="about-body">
          內容從最基本的暫存器與算術指令開始，往上疊到呼叫慣例（calling
          convention：<code>a0</code>-<code>a7</code>
          怎麼傳參數、<code>ra</code> 怎麼決定函式跳回哪）、syscall（
          <code>ecall</code> 搭配 <code>a7</code> 編號， 真的做{" "}
          <code>write</code>/<code>read</code>/<code>open</code>/
          <code>exit</code>），最後進到記憶體安全的部分：buffer overflow
          怎麼覆寫你不該碰的位址，以及 ROP（return-oriented
          programming）怎麼串現有的程式碼片段，做出攻擊者想要的行為。每一關都是同一套真實
          RISC-V 工具鏈在跑，沒有為了好教而簡化成別的東西。
        </p>
        <p className="about-body about-credit">
          本平台的模擬器基於{" "}
          <a
            href="https://github.com/sysprog21/rv32emu"
            target="_blank"
            rel="noreferrer"
          >
            rv32emu
          </a>
          （感謝 jserv 老師）打造。
        </p>
      </section>

      <section className="about-section about-club-section">
        <h2 className="about-club-heading">關於 TTUSSC</h2>
        <p className="about-body about-club-quote">
          「科學開源服務社致力於推廣開源文化、技術學習與志工服務。加入我們，讓開源點亮你的生活！」
        </p>
        <p className="about-club-attribution">—— TTUSSC 官方介紹</p>
        <a
          href="https://ttussc.org"
          target="_blank"
          rel="noreferrer"
          className="about-club-link"
        >
          ttussc.org
          <ExternalLink size={16} />
        </a>
      </section>
    </div>
  );
}
