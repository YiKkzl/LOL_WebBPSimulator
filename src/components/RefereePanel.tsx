"use client";

import type { ChampionData } from "@/src/hooks/useChampionData";

interface RefereePanelProps {
  championIds: string[];
  champions: ChampionData[];
  version: string;
  canUnban: boolean;
  onToggleChampion: (championId: string) => void;
}

export function RefereePanel({
  championIds,
  champions,
  version,
  canUnban,
  onToggleChampion,
}: RefereePanelProps) {
  return (
    <div className="system-banned-section" id="system-banned-section">
      <h4>系统禁用英雄</h4>
      <div className="system-banned-champions" id="system-banned-champions">
        {championIds.length === 0 ? (
          <div className="empty-message">当前没有系统禁用的英雄</div>
        ) : (
          championIds.map((championId) => {
            const champion = champions.find((item) => item.id === championId);
            return (
              <button
                className={`system-banned-item ${canUnban ? "referee-can-unban" : ""}`}
                data-id={championId}
                disabled={!canUnban}
                key={championId}
                onClick={() => onToggleChampion(championId)}
                title={champion ? `${champion.name} (${champion.title})` : championId}
                type="button"
              >
                {version ? (
                  <img
                    alt={champion?.name ?? championId}
                    src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championId}.png`}
                  />
                ) : (
                  championId.slice(0, 3)
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

