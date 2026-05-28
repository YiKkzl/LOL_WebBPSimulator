"use client";

import { useMemo, useState } from "react";

import { getUnavailableChampionIds } from "@/src/domain/session-state";
import type { BpSessionState, UserRole } from "@/src/domain/types";
import type { ChampionData } from "@/src/hooks/useChampionData";

interface ChampionPoolProps {
  champions: ChampionData[];
  tags: string[];
  version: string;
  state: BpSessionState;
  role: UserRole;
  pendingChampionId: string | null;
  onSelectChampion: (championId: string) => void;
}

const tagNameMap: Record<string, string> = {
  Fighter: "战士",
  Tank: "坦克",
  Mage: "法师",
  Assassin: "刺客",
  Marksman: "射手",
  Support: "辅助",
};

export function ChampionPool({
  champions,
  tags,
  version,
  state,
  role,
  pendingChampionId,
  onSelectChampion,
}: ChampionPoolProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const unavailableIds = useMemo(() => new Set(getUnavailableChampionIds(state)), [state]);
  const systemBanIds = useMemo(() => new Set(state.systemBannedChampions), [state.systemBannedChampions]);
  const pickedIds = useMemo(
    () => new Set([...state.bluePicks, ...state.redPicks]),
    [state.bluePicks, state.redPicks],
  );
  const query = searchTerm.toLowerCase().trim();
  const visibleChampions = champions.filter((champion) => {
    const matchesSearch = !query || champion.searchTerms.includes(query);
    const matchesTag = !activeTag || champion.tags.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="champion-pool-container">
      <input
        id="search-box"
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="搜索英雄..."
        type="text"
        value={searchTerm}
      />
      <div className="tag-filter-container" id="tag-filters">
        <button
          className={`tag-filter-button ${activeTag === null ? "active" : ""}`}
          onClick={() => setActiveTag(null)}
          type="button"
        >
          全部
        </button>
        {tags.map((tag) => (
          <button
            className={`tag-filter-button ${activeTag === tag ? "active" : ""}`}
            data-tag={tag}
            key={tag}
            onClick={() => setActiveTag(tag)}
            type="button"
          >
            {tagNameMap[tag] ?? tag}
          </button>
        ))}
      </div>
      <div
        className={role === "observer" ? "observer-mode" : role === "referee" ? "referee-mode" : ""}
        id="champion-pool"
      >
        {visibleChampions.length === 0 ? (
          <div className="no-results-message">
            {query || activeTag ? "没有找到匹配的英雄" : "没有可用的英雄"}
          </div>
        ) : (
          visibleChampions.map((champion) => {
            const isSystemBanned = systemBanIds.has(champion.id);
            const isPicked = pickedIds.has(champion.id);
            const isUnavailable = unavailableIds.has(champion.id);
            const classNames = [
              "champion-item",
              isSystemBanned ? "system-banned" : "",
              !isSystemBanned && isUnavailable && !isPicked ? "banned" : "",
              isPicked ? "picked" : "",
              champion.id === pendingChampionId ? "pending" : "",
              role === "referee" && !isSystemBanned ? "referee-can-ban" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                aria-label={champion.name}
                className={classNames}
                data-id={champion.id}
                data-name={champion.name}
                key={champion.id}
                onClick={() => onSelectChampion(champion.id)}
                title={`${champion.name} (${champion.title})`}
                type="button"
              >
                {version ? (
                  <img
                    alt={champion.name}
                    src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion.id}.png`}
                  />
                ) : (
                  champion.id.slice(0, 3)
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

