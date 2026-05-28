"use client";

import { useEffect, useMemo, useState } from "react";

export interface ChampionData {
  id: string;
  name: string;
  title: string;
  key: string;
  tags: string[];
  searchTerms: string;
}

interface DataDragonChampion {
  id: string;
  name: string;
  title: string;
  key: string;
  tags: string[];
}

interface DataDragonResponse {
  data: Record<string, DataDragonChampion>;
}

export function useChampionData() {
  const [version, setVersion] = useState("");
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadChampionData() {
      try {
        setIsLoading(true);
        const versionResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        if (!versionResponse.ok) {
          throw new Error(`Data Dragon versions HTTP ${versionResponse.status}`);
        }

        const versions = (await versionResponse.json()) as string[];
        const latestVersion = versions[0];
        if (!latestVersion) {
          throw new Error("Data Dragon version list is empty");
        }

        const championResponse = await fetch(
          `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/zh_CN/champion.json`,
        );
        if (!championResponse.ok) {
          throw new Error(`Champion data HTTP ${championResponse.status}`);
        }

        const championJson = (await championResponse.json()) as DataDragonResponse;
        const nextChampions = Object.values(championJson.data)
          .map((champion) => ({
            id: champion.id,
            name: champion.name,
            title: champion.title,
            key: champion.key,
            tags: champion.tags,
            searchTerms: `${champion.id} ${champion.name} ${champion.title}`.toLowerCase(),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

        if (!cancelled) {
          setVersion(latestVersion);
          setChampions(nextChampions);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadChampionData();

    return () => {
      cancelled = true;
    };
  }, []);

  const tags = useMemo(() => {
    const values = new Set<string>();
    champions.forEach((champion) => champion.tags.forEach((tag) => values.add(tag)));
    return Array.from(values).sort();
  }, [champions]);

  return { version, champions, tags, isLoading, error };
}

