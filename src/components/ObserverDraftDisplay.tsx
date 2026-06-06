"use client";

import { useEffect, useMemo } from "react";

import { isEmptyBan } from "@/src/domain/bp-flow";
import type { TeamSide } from "@/src/domain/types";
import type { ChampionData } from "@/src/hooks/useChampionData";

interface ObserverDraftDisplayProps {
  bluePicks: string[];
  champions: ChampionData[];
  pendingChampionId: string | null;
  redPicks: string[];
  version: string;
}

interface ObserverBanStripProps {
  blueBans: string[];
  champions: ChampionData[];
  redBans: string[];
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

export function ObserverBanStrip({ blueBans, champions, redBans, version }: ObserverBanStripProps) {
  const championById = useMemo(
    () => new Map(champions.map((champion) => [champion.id, champion])),
    [champions],
  );

  return (
    <div className="observer-ban-strip" id="observer-ban-strip">
      <ObserverBanSide championById={championById} championIds={blueBans} side="blue" version={version} />
      <div aria-hidden="true" className="observer-ban-divider" />
      <ObserverBanSide championById={championById} championIds={redBans} side="red" version={version} />
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
  return (
    <section
      aria-label={side === "blue" ? "蓝方选用旗帜" : "红方选用旗帜"}
      className={`observer-team-column ${side}`}
      data-side={side}
    >
      <ObserverBannerGroup
        championById={championById}
        championIds={picks}
        side={side}
        version={version}
      />
    </section>
  );
}

function ObserverBannerGroup({
  championById,
  championIds,
  side,
  version,
}: {
  championById: Map<string, ChampionData>;
  championIds: string[];
  side: TeamSide;
  version: string;
}) {
  return (
    <div className="observer-banner-group">
      <div className="observer-banner-list">
        {Array.from({ length: 5 }, (_, index) => {
          const championId = championIds[index];

          return championId ? (
            <ObserverChampionBanner
              champion={championById.get(championId)}
              championId={championId}
              key={championId}
              side={side}
              version={version}
            />
          ) : (
            <div className="observer-banner-empty" data-pick-slot={index + 1} key={index}>
              P{index + 1}
            </div>
          );
        })}
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

function ObserverBanSide({
  championById,
  championIds,
  side,
  version,
}: {
  championById: Map<string, ChampionData>;
  championIds: string[];
  side: TeamSide;
  version: string;
}) {
  const teamName = side === "blue" ? "蓝方禁用" : "红方禁用";

  return (
    <section className={`observer-ban-side ${side}`} aria-label={teamName} data-side={side}>
      {Array.from({ length: 5 }, (_, index) => {
        const championId = championIds[index];

        return (
          <ObserverBanSlot
            champion={championId ? championById.get(championId) : undefined}
            championId={championId}
            index={index}
            key={championId ?? index}
            side={side}
            version={version}
          />
        );
      })}
    </section>
  );
}

function ObserverBanSlot({
  champion,
  championId,
  index,
  side,
  version,
}: {
  champion?: ChampionData;
  championId?: string;
  index: number;
  side: TeamSide;
  version: string;
}) {
  const emptyBan = championId ? isEmptyBan(championId) : false;
  const label = championId ? (emptyBan ? "空" : (champion?.name ?? championId)) : `B${index + 1}`;

  return (
    <div
      className={`observer-ban-slot ${championId ? "filled" : "empty"} ${emptyBan ? "empty-ban" : ""}`}
      data-action-type={championId ? "ban" : undefined}
      data-champion-id={championId}
      data-empty-ban={emptyBan ? "true" : undefined}
      data-observer-ban-slot={index + 1}
      data-side={side}
      title={championId && champion ? `${champion.name} (${champion.title})` : label}
    >
      {championId && !emptyBan && version ? (
        <img
          alt={label}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
          src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championId}.png`}
        />
      ) : null}
      {championId && !emptyBan ? null : <span>{label}</span>}
    </div>
  );
}

function getObserverBannerArtUrl(championId: string) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_0.jpg`;
}
