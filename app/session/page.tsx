"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { BpBoard } from "@/src/components/BpBoard";
import type { UserRole } from "@/src/domain/types";
import { useBpSession } from "@/src/hooks/useBpSession";
import { useChampionData } from "@/src/hooks/useChampionData";

export default function SessionPage() {
  return (
    <Suspense fallback={<InitialLoading />}>
      <SessionView />
    </Suspense>
  );
}

export function SessionView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const role = parseRole(searchParams.get("role"));
  const globalSessionId = searchParams.get("global_session");
  const gameNumber = Number(searchParams.get("game") ?? 0);
  const championData = useChampionData();
  const session = useBpSession({
    sessionId,
    role,
    globalSessionId,
    gameNumber: Number.isFinite(gameNumber) ? gameNumber : 0,
  });
  const backUrl = globalSessionId
    ? `/?mode=global&global_session=${encodeURIComponent(globalSessionId)}`
    : "/";

  function returnFromSession() {
    window.location.assign(backUrl);
  }

  if (!sessionId) {
    return (
      <main className="legacy-page">
        <div className="error-message">
          <h3>缺少对局ID</h3>
          <p>请使用包含 session 参数的链接进入。</p>
          <button onClick={() => router.push("/")} type="button">
            返回
          </button>
        </div>
      </main>
    );
  }

  if (championData.isLoading || session.isLoading) {
    return (
      <main className="legacy-page">
        <div id="initial-screen-container">
          <h1 id="main-title">YiKkBP模拟器</h1>
          <p>加载中...</p>
        </div>
      </main>
    );
  }

  if (championData.error) {
    return (
      <main className="legacy-page">
        <div className="error-message">
          <h3>无法加载英雄数据</h3>
          <p>{championData.error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="legacy-page">
      <BpBoard
        champions={championData.champions}
        onBack={returnFromSession}
        session={session}
        tags={championData.tags}
        version={championData.version}
      />
    </main>
  );
}

function InitialLoading() {
  return (
    <main className="legacy-page">
      <div id="initial-screen-container">
        <h1 id="main-title">YiKkBP模拟器</h1>
        <p>加载中...</p>
      </div>
    </main>
  );
}

function parseRole(value: string | null): UserRole {
  if (value === "host" || value === "blue" || value === "red" || value === "observer" || value === "referee") {
    return value;
  }

  return "observer";
}
