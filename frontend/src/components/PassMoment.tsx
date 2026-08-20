// "電鍋跳起" pass-moment / reward celebration, shown when a level is passed
// (see LevelPage.tsx's pass flow). SVG and card markup ported verbatim from
// the approved style demo (see task spec) — the rice-cooker shapes are
// deliberate/approved, do not redesign.

import "./PassMoment.css";

export interface PassMomentProps {
  /** e.g. derived from the passed level's title. */
  message: string;
  /** Present only when this level granted a reward. */
  code?: string;
  onContinue: () => void;
}

export function PassMoment({ message, code, onContinue }: PassMomentProps) {
  return (
    <div className="pass-moment-overlay">
      <div className="pass-card">
        <div className="icon">
          <svg
            viewBox="0 0 64 68"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <ellipse
              cx="32"
              cy="65"
              rx="20"
              ry="2.5"
              fill="var(--coffee)"
              opacity=".08"
            />
            <path
              d="M13 33 Q12 33 12 36 L14 58 Q14.5 61 18 61 L46 61 Q49.5 61 50 58 L52 36 Q52 33 51 33 Z"
              fill="#E2572B"
              stroke="#B8431E"
              strokeWidth="1.6"
            />
            <path d="M13 37 L4 35 L3 38 L4 41 L13 41 Z" fill="#221a14" />
            <path d="M51 37 L60 35 L61 38 L60 41 L51 41 Z" fill="#221a14" />
            <path
              d="M30 45 Q25 50.5 27 56.5 L37 56.5 Q39 50.5 34 45 Z"
              fill="#EEF1F2"
              stroke="#221a14"
              strokeWidth="1.3"
            />
            <line
              x1="32"
              y1="47.5"
              x2="32"
              y2="54"
              stroke="#221a14"
              strokeWidth="1.1"
            />
            <circle cx="32" cy="50" r="1.2" fill="var(--rice)" />
            <rect x="16" y="60" width="5" height="3.5" rx="1" fill="#221a14" />
            <rect x="43" y="60" width="5" height="3.5" rx="1" fill="#221a14" />
            <path d="M13 34 Q13 25 32 25 Q51 25 51 34 Z" fill="#D3D8DA" />
            <path
              d="M13 34 Q13 25 32 25 Q51 25 51 34 Z"
              fill="none"
              stroke="#9AA2A8"
              strokeWidth="1.4"
            />
            <path
              d="M12 33.5 L52 33.5 L50.5 36.5 L13.5 36.5 Z"
              fill="#F2F4F5"
              stroke="#9AA2A8"
              strokeWidth="1.2"
            />
            <path
              d="M27.5 23 Q27.5 19.5 30 19.5 L34 19.5 Q36.5 19.5 36.5 23 Z"
              fill="#221a14"
            />
          </svg>
        </div>
        <div className="pass-card-body">
          <h3>過關！</h3>
          <p>{message}</p>
          {code && <span className="code">{code}</span>}
          <button
            type="button"
            className="widget-primary-btn"
            onClick={onContinue}
          >
            繼續
          </button>
        </div>
      </div>
    </div>
  );
}
