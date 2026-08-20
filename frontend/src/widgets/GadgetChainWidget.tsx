// Gadget-chain widget — L3-4's click-to-chain ROP gadget picker. A browsable
// list of gadget cards; tapping one appends it to the "current chain" shown
// above (with an undo/remove per item). onPass hands the ordered list of
// chosen gadget ids up to LevelPlayer, which runs it through judge()'s
// 'gadget-chain' direct comparator.

import { useState } from "react";
import { X, Check } from "lucide-react";
import type { WidgetComponent } from "../engine/widgetRegistry";
import type { GadgetChainLevel } from "../engine/types";
import "./widgets.css";

export const GadgetChainWidget: WidgetComponent<GadgetChainLevel> = ({
  schema,
  onPass,
}) => {
  const [chain, setChain] = useState<string[]>([]);
  const gadgetsById = Object.fromEntries(schema.gadgets.map((g) => [g.id, g]));

  const addGadget = (id: string) => setChain((prev) => [...prev, id]);
  const removeAt = (index: number) =>
    setChain((prev) => prev.filter((_, i) => i !== index));

  return (
    <div className="widget widget-gadget-chain">
      <h2>{schema.title}</h2>
      <p>{schema.prompt}</p>

      <div className="gadget-chain-current">
        <h3>目前的 chain</h3>
        {chain.length === 0 ? (
          <p className="gadget-chain-empty">點下方的 gadget 開始串接</p>
        ) : (
          <ol className="gadget-chain-list">
            {chain.map((id, i) => (
              <li key={`${id}-${i}`} className="gadget-chain-chip">
                <span className="gadget-chain-chip-address">
                  {gadgetsById[id]?.address}
                </span>
                <span>{gadgetsById[id]?.description}</span>
                <button
                  type="button"
                  className="gadget-chain-remove"
                  aria-label="移除"
                  onClick={() => removeAt(i)}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="gadget-chain-candidates">
        <h3>候選 gadget</h3>
        {schema.gadgets.map((gadget) => (
          <button
            key={gadget.id}
            type="button"
            className="gadget-chain-candidate"
            onClick={() => addGadget(gadget.id)}
          >
            <span className="gadget-chain-candidate-address">
              {gadget.address}
            </span>
            <span>{gadget.description}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="widget-primary-btn"
        disabled={chain.length === 0}
        onClick={() => onPass(chain)}
      >
        <Check size={16} />
        Submit
      </button>
    </div>
  );
};
