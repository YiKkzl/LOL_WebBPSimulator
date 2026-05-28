"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DistributeView } from "@/app/distribute/page";
import { SessionView } from "@/app/session/page";
import { BpBoard } from "@/src/components/BpBoard";
import { ModeSelection } from "@/src/components/ModeSelection";
import {
  createGlobalSessionWithGames,
  ensureGlobalGameSession,
  findGlobalSessionForGameSession,
  getGlobalSessionRecord,
  type GlobalSessionRecord,
  useBpSession,
} from "@/src/hooks/useBpSession";
import { useChampionData } from "@/src/hooks/useChampionData";

const gameNumbers = [1, 2, 3, 4, 5] as const;

export default function Home() {
  return (
    <Suspense fallback={<InitialLoading />}>
      <HomeView />
    </Suspense>
  );
}

function HomeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeMode = searchParams.get("mode");
  const routeGlobalSessionId = searchParams.get("global_session");
  const championData = useChampionData();
  const session = useBpSession();
  const [globalSession, setGlobalSession] = useState<GlobalSessionRecord | null>(null);
  const [isCreatingGlobal, setIsCreatingGlobal] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const currentGlobalSessionId =
    globalSession?.global_session_id ?? (routeMode === "global" ? routeGlobalSessionId : null);
  const isGlobalSelectionLoading =
    isCreatingGlobal ||
    (routeMode === "global" &&
      Boolean(routeGlobalSessionId) &&
      globalSession?.global_session_id !== routeGlobalSessionId &&
      !globalError);

  useEffect(() => {
    if (routeMode !== "global" || !routeGlobalSessionId) {
      return;
    }

    if (globalSession?.global_session_id === routeGlobalSessionId) {
      return;
    }

    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setGlobalError(null);
        }
        return getGlobalSessionRecord(routeGlobalSessionId);
      })
      .then((record) => {
        if (!cancelled) {
          setGlobalSession(record);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setGlobalSession(null);
          setGlobalError(caught instanceof Error ? caught.message : String(caught));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [globalSession?.global_session_id, routeGlobalSessionId, routeMode]);

  if (routeMode === "distribute") {
    return <DistributeView />;
  }

  if (searchParams.get("session")) {
    return <SessionView />;
  }

  async function startCompetitive() {
    await session.startCompetitive();
  }

  async function startGlobal() {
    setIsCreatingGlobal(true);
    setGlobalError(null);
    try {
      const nextGlobalSession = await createGlobalSessionWithGames();
      setGlobalSession(nextGlobalSession);
      router.push(globalSelectionUrl(nextGlobalSession.global_session_id));
    } catch (caught) {
      setGlobalError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsCreatingGlobal(false);
    }
  }

  async function openGlobalGame(gameNumber: number) {
    if (!currentGlobalSessionId) {
      return;
    }

    try {
      const nextSessionId = await ensureGlobalGameSession(currentGlobalSessionId, gameNumber);
      setGlobalSession((current) =>
        current ? setGlobalGameSessionId(current, gameNumber, nextSessionId) : current,
      );
      router.push(globalDistributeUrl(currentGlobalSessionId, gameNumber));
    } catch (caught) {
      setGlobalError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function joinGlobalObserver(gameNumber: number) {
    if (!currentGlobalSessionId) {
      return;
    }

    try {
      const existingSessionId = globalSession ? getGlobalGameSessionId(globalSession, gameNumber) : null;
      const sessionId = existingSessionId ?? (await ensureGlobalGameSession(currentGlobalSessionId, gameNumber));
      setGlobalSession((current) =>
        current ? setGlobalGameSessionId(current, gameNumber, sessionId) : current,
      );
      router.push(globalObserverUrl(currentGlobalSessionId, gameNumber, sessionId));
    } catch (caught) {
      setGlobalError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function joinObserver(sessionId: string) {
    const trimmedSessionId = sessionId.trim();
    if (!trimmedSessionId) {
      return;
    }

    try {
      const globalContext = await findGlobalSessionForGameSession(trimmedSessionId);
      if (globalContext) {
        router.push(
          globalObserverUrl(
            globalContext.global_session_id,
            globalContext.game_number,
            trimmedSessionId,
          ),
        );
        return;
      }
    } catch {
      // Fall through to the normal observer route.
    }

    router.push(`/?session=${encodeURIComponent(trimmedSessionId)}&role=observer`);
  }

  if (session.isSessionActive) {
    if (championData.isLoading) {
      return (
        <main className="legacy-page">
          <div id="initial-screen-container">
            <h1 id="main-title">YiKkBP模拟器</h1>
            <p>加载中...</p>
          </div>
        </main>
      );
    }

    return (
      <main className="legacy-page">
        <BpBoard
          champions={championData.champions}
          onBack={session.reset}
          session={session}
          tags={championData.tags}
          version={championData.version}
        />
      </main>
    );
  }

  if (currentGlobalSessionId) {
    return (
      <main className="legacy-page">
        <div id="game-selection">
          <h1>选择对局</h1>
          {globalError ? <div className="error-banner">{globalError}</div> : null}
          {!globalSession && isGlobalSelectionLoading ? (
            <div className="empty-message">加载全局会话中...</div>
          ) : null}
          <div className="game-buttons">
            {gameNumbers.map((gameNumber) => (
              <button key={gameNumber} onClick={() => void openGlobalGame(gameNumber)} type="button">
                Game {gameNumber}
              </button>
            ))}
          </div>
          <div className="back-button">
            <button
              onClick={() => {
                setGlobalSession(null);
                router.push("/");
              }}
              type="button"
            >
              返回
            </button>
          </div>
          <div className="global-session-info" id="global-session-info">
            <h4>全局BP会话信息</h4>
            <div>
              <strong>全局会话ID:</strong> <span className="session-id">{currentGlobalSessionId}</span>
            </div>
            <button
              className="copy-button"
              onClick={() => void navigator.clipboard.writeText(currentGlobalSessionId)}
              type="button"
            >
              复制全局会话ID
            </button>
            <h5>对局ID</h5>
            <div className="game-session-list">
              {gameNumbers.map((gameNumber) => {
                const gameSessionId = globalSession ? getGlobalGameSessionId(globalSession, gameNumber) : null;
                return (
                  <div className="game-session-item" key={gameNumber}>
                    <strong>Game {gameNumber}</strong>
                    {gameSessionId ? (
                      <span className="session-id">{gameSessionId}</span>
                    ) : (
                      <span className="no-session">未生成</span>
                    )}
                    <button
                      className="copy-button"
                      disabled={!gameSessionId}
                      onClick={() => {
                        if (gameSessionId) {
                          void navigator.clipboard.writeText(gameSessionId);
                        }
                      }}
                      type="button"
                    >
                      复制对局ID
                    </button>
                    <button
                      className="open-button"
                      onClick={() => void joinGlobalObserver(gameNumber)}
                      type="button"
                    >
                      观战
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="legacy-page">
      {globalError ? <div className="floating-error">{globalError}</div> : null}
      <ModeSelection
        isBusy={isCreatingGlobal}
        onJoinObserver={joinObserver}
        onStartCompetitive={() => void startCompetitive()}
        onStartGlobal={() => void startGlobal()}
      />
    </main>
  );
}

function getGlobalGameSessionId(record: GlobalSessionRecord, gameNumber: number) {
  const key = `session_id${gameNumber}` as keyof GlobalSessionRecord;
  const value = record[key];
  return typeof value === "string" && value ? value : null;
}

function setGlobalGameSessionId(
  record: GlobalSessionRecord,
  gameNumber: number,
  sessionId: string,
): GlobalSessionRecord {
  return {
    ...record,
    [`session_id${gameNumber}`]: sessionId,
  };
}

function globalSelectionUrl(globalSessionId: string) {
  return `/?mode=global&global_session=${encodeURIComponent(globalSessionId)}`;
}

function globalDistributeUrl(globalSessionId: string, gameNumber: number) {
  return `/?mode=distribute&game=${gameNumber}&global_session=${encodeURIComponent(globalSessionId)}`;
}

function globalObserverUrl(globalSessionId: string, gameNumber: number, sessionId: string) {
  return `/?session=${encodeURIComponent(sessionId)}&role=observer&game=${gameNumber}&global_session=${encodeURIComponent(
    globalSessionId,
  )}`;
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
