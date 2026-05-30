"use client";

import { useMemo } from "react";

import { isEmptyBan } from "@/src/domain/bp-flow";
import type { TeamSide } from "@/src/domain/types";
import type { ChampionData } from "@/src/hooks/useChampionData";

interface ObserverDraftDisplayProps {
  blueBans: string[];
  bluePicks: string[];
  champions: ChampionData[];
  redBans: string[];
  redPicks: string[];
}

export function ObserverDraftDisplay({
  blueBans,
  bluePicks,
  champions,
  redBans,
  redPicks,
}: ObserverDraftDisplayProps) {
  const championById = useMemo(
    () => new Map(champions.map((champion) => [champion.id, champion])),
    [champions],
  );

  return (
    <div className="observer-draft-display" id="observer-draft-display">
      <ObserverTeamColumn
        bans={blueBans}
        championById={championById}
        picks={bluePicks}
        side="blue"
      />
      <div aria-hidden="true" className="observer-draft-divider" />
      <ObserverTeamColumn
        bans={redBans}
        championById={championById}
        picks={redPicks}
        side="red"
      />
    </div>
  );
}

function ObserverTeamColumn({
  bans,
  championById,
  picks,
  side,
}: {
  bans: string[];
  championById: Map<string, ChampionData>;
  picks: string[];
  side: TeamSide;
}) {
  const teamName = side === "blue" ? "蓝方" : "红方";

  return (
    <section className={`observer-team-column ${side}`} data-side={side}>
      <h3>{teamName}</h3>
      <ObserverBannerGroup
        actionType="pick"
        championById={championById}
        championIds={picks}
        emptyText="等待选用"
        side={side}
        title="Picks"
      />
      <ObserverBannerGroup
        actionType="ban"
        championById={championById}
        championIds={bans}
        emptyText="等待禁用"
        side={side}
        title="Bans"
      />
    </section>
  );
}

function ObserverBannerGroup({
  actionType,
  championById,
  championIds,
  emptyText,
  side,
  title,
}: {
  actionType: "ban" | "pick";
  championById: Map<string, ChampionData>;
  championIds: string[];
  emptyText: string;
  side: TeamSide;
  title: string;
}) {
  return (
    <div className={`observer-banner-group ${actionType}s`}>
      <h4>{title}</h4>
      <div className="observer-banner-list">
        {championIds.length === 0 ? (
          <div className="observer-banner-empty">{emptyText}</div>
        ) : (
          championIds.map((championId) => (
            <ObserverChampionBanner
              actionType={actionType}
              champion={championById.get(championId)}
              championId={championId}
              key={championId}
              side={side}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ObserverChampionBanner({
  actionType,
  champion,
  championId,
  side,
}: {
  actionType: "ban" | "pick";
  champion?: ChampionData;
  championId: string;
  side: TeamSide;
}) {
  const emptyBan = isEmptyBan(championId);
  const label = emptyBan ? "空 Ban" : (champion?.name ?? championId);

  return (
    <div
      className={`observer-draft-banner ${actionType === "ban" ? "ban-banner" : "pick-banner"}`}
      data-action-type={actionType}
      data-champion-id={championId}
      data-empty-ban={emptyBan ? "true" : undefined}
      data-side={side}
      title={emptyBan ? label : champion ? `${champion.name} (${champion.title})` : championId}
    >
      <span className="observer-banner-fallback">{label}</span>
      {!emptyBan ? (
        <img
          alt={label}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
          src={`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_0.jpg`}
        />
      ) : null}
      <span className="observer-banner-name">{label}</span>
      {actionType === "ban" ? (
        <span aria-hidden="true" className="observer-ban-symbol">
          &#8856;
        </span>
      ) : null}
    </div>
  );
}
