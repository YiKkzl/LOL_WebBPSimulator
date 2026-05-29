"use client";

import type { ChampionData } from "@/src/hooks/useChampionData";

interface TeamPanelProps {
  side: "blue" | "red";
  picks: string[];
  bans: string[];
  champions: ChampionData[];
  version: string;
}

export function TeamPanel({ side, picks, bans, champions, version }: TeamPanelProps) {
  const title = side === "blue" ? "蓝方" : "红方";

  return (
    <div className={`team-panel ${side}-team`}>
      <h3>{title}</h3>
      <div className="picks">
        <h4>选用 (Picks)</h4>
        <div className="slot-container">{renderSlots(picks, "P", champions, version)}</div>
      </div>
      <div className="bans">
        <h4>禁用 (Bans)</h4>
        <div className="slot-container">{renderSlots(bans, "B", champions, version)}</div>
      </div>
    </div>
  );
}

function renderSlots(values: string[], placeholder: "B" | "P", champions: ChampionData[], version: string) {
  return Array.from({ length: 5 }, (_, index) => {
    const championId = values[index];

    if (!championId) {
      return (
        <div className="bp-slot" key={index}>
          {placeholder}
          {index + 1}
        </div>
      );
    }

    if (championId.startsWith("EmptyBan_")) {
      return (
        <div className="bp-slot empty-ban" key={index}>
          空
        </div>
      );
    }

    const champion = champions.find((item) => item.id === championId);
    return (
      <div
        className="bp-slot"
        data-champion-name={champion?.name}
        data-champion-title={champion?.title}
        key={index}
      >
        {version ? (
          <img
            alt={champion?.name ?? championId}
            src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championId}.png`}
            title={champion ? `${champion.name} (${champion.title})` : championId}
          />
        ) : (
          championId.slice(0, 3)
        )}
      </div>
    );
  });
}

