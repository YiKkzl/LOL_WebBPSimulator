"use client";

import { useEffect, useMemo } from "react";

import type { TeamSide } from "@/src/domain/types";
import type { ChampionData } from "@/src/hooks/useChampionData";

interface ObserverDraftDisplayProps {
  bluePicks: string[];
  champions: ChampionData[];
  pendingChampionId: string | null;
  redPicks: string[];
  version: string;
}

export function ObserverDraftDisplay({
  bluePicks,
  champions,
  pendingChampionId,
  redPicks,
  version,
}: ObserverDraftDisplayProps) {
  const championById = useMemo(
    () => new Map(champions.map((champion) => [champion.id, champion])),
    [champions],
  );

  useEffect(() => {
    if (!pendingChampionId) {
      return;
    }

    const image = new Image();
    image.src = getObserverBannerArtUrl(pendingChampionId);
  }, [pendingChampionId]);

  return (
    <div className="observer-draft-display" id="observer-draft-display">
      <ObserverTeamColumn
        championById={championById}
        picks={bluePicks}
        side="blue"
        version={version}
      />
      <div aria-hidden="true" className="observer-draft-divider" />
      <ObserverTeamColumn
        championById={championById}
        picks={redPicks}
        side="red"
        version={version}
      />
    </div>
  );
}

function ObserverTeamColumn({
  championById,
  picks,
  side,
  version,
}: {
  championById: Map<string, ChampionData>;
  picks: string[];
  side: TeamSide;
  version: string;
}) {
  const teamName = side === "blue" ? "蓝方" : "红方";

  return (
    <section className={`observer-team-column ${side}`} data-side={side}>
      <h3>{teamName}</h3>
      <ObserverBannerGroup
        championById={championById}
        championIds={picks}
        emptyText="等待选用"
        side={side}
        title="Picks"
        version={version}
      />
    </section>
  );
}

function ObserverBannerGroup({
  championById,
  championIds,
  emptyText,
  side,
  title,
  version,
}: {
  championById: Map<string, ChampionData>;
  championIds: string[];
  emptyText: string;
  side: TeamSide;
  title: string;
  version: string;
}) {
  return (
    <div className="observer-banner-group picks">
      <h4>{title}</h4>
      <div className="observer-banner-list">
        {championIds.length === 0 ? (
          <div className="observer-banner-empty">{emptyText}</div>
        ) : (
          championIds.map((championId) => (
            <ObserverChampionBanner
              champion={championById.get(championId)}
              championId={championId}
              key={championId}
              side={side}
              version={version}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ObserverChampionBanner({
  champion,
  championId,
  side,
  version,
}: {
  champion?: ChampionData;
  championId: string;
  side: TeamSide;
  version: string;
}) {
  const label = champion?.name ?? championId;

  return (
    <div
      className="observer-draft-banner pick-banner"
      data-action-type="pick"
      data-champion-id={championId}
      data-side={side}
      title={champion ? `${champion.name} (${champion.title})` : championId}
    >
      <span className="observer-banner-fallback">{label}</span>
      <img
        alt=""
        aria-hidden="true"
        className="observer-banner-placeholder"
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
        src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championId}.png`}
      />
      <img
        alt={label}
        className="observer-banner-art"
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
        src={getObserverBannerArtUrl(championId)}
      />
      <span className="observer-banner-name">{label}</span>
    </div>
  );
}

function getObserverBannerArtUrl(championId: string) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${championId}_0.jpg`;
}
