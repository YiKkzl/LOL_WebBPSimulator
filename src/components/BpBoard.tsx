"use client";

import { useEffect, useState } from "react";

import { ChampionPool } from "@/src/components/ChampionPool";
import { ObserverDraftDisplay } from "@/src/components/ObserverDraftDisplay";
import { RefereePanel } from "@/src/components/RefereePanel";
import { ShareLinks } from "@/src/components/ShareLinks";
import { TeamPanel } from "@/src/components/TeamPanel";
import type { PreviousGamesPicks } from "@/src/domain/types";
import type { ChampionData } from "@/src/hooks/useChampionData";
import type { useBpSession } from "@/src/hooks/useBpSession";

interface BpBoardProps {
  session: ReturnType<typeof useBpSession>;
  champions: ChampionData[];
  tags: string[];
  version: string;
  onBack: () => void;
}

export function BpBoard({ session, champions, tags, version, onBack }: BpBoardProps) {
  const pendingChampion = champions.find((champion) => champion.id === session.pendingChampionId);
  const elapsedSeconds = useStepTimer(session.state.currentStep, session.state.currentPhase);
  const modeTitle =
    session.state.mode === "global"
      ? `全局BP模式 - Game ${session.gameNumber || 1}`
      : session.state.mode === "ranked"
        ? "排位模式 BP"
        : "竞技征召 BP";
  const actionText = getActionText(session);
  const resetButtonAction =
    session.role === "blue" || session.role === "red" ? () => void session.loadSession() : onBack;

  return (
    <div id="bp-interface">
      {session.role === "host" ? (
        <ShareLinks
          gameNumber={session.gameNumber}
          globalSessionId={session.globalSessionId}
          sessionId={session.sessionId}
        />
      ) : null}
      <div className="top-bar">
        <h2 id="mode-title">{modeTitle}</h2>
        {session.state.mode === "global" ? (
          <div id="game-indicator">
            当前对局: <span id="current-game">Game {session.gameNumber || 1}</span>
          </div>
        ) : null}
        <div id="action-indicator">
          轮到：
          <span
            className={session.state.whosTurn === "blue" ? "blue-turn" : "red-turn"}
            id="current-action"
          >
            {actionText}
          </span>
        </div>
        <div id="pending-area">
          待选：
          <span id="pending-champion">
            {pendingChampion && version ? (
              <>
                <img
                  alt={pendingChampion.name}
                  src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${pendingChampion.id}.png`}
                  title={`${pendingChampion.name} (${pendingChampion.title})`}
                />{" "}
                {pendingChampion.name} ({pendingChampion.title})
              </>
            ) : (
              "无"
            )}
          </span>
        </div>
        {session.role !== "observer" ? (
          <button
            disabled={!session.pendingChampionId || !session.canAct}
            id="confirm-button"
            onClick={() => void session.confirmSelection()}
            type="button"
          >
            确认选择
          </button>
        ) : null}
        {session.role !== "observer" && session.state.actionType === "ban" && session.canAct ? (
          <button id="empty-ban-button" onClick={() => void session.emptyBan()} type="button">
            空 Ban
          </button>
        ) : null}
        <div id="timer">
          计时: <span id="timer-value">{elapsedSeconds}</span>s
        </div>
        <button id="reset-button" onClick={resetButtonAction} type="button">
          {getResetButtonText(session.role)}
        </button>
        {session.role === "observer" ? <div id="observer-notice">观战模式 - 仅可观看</div> : null}
        {session.role === "referee" ? <div id="referee-notice">裁判模式 - 点击英雄可禁用/解禁</div> : null}
      </div>

      {session.error ? <div className="error-banner">{session.error}</div> : null}
      {session.notice ? (
        <div className="notice-banner">
          {session.notice}
          <button onClick={() => session.setNotice(null)} type="button">
            关闭
          </button>
        </div>
      ) : null}

      {session.state.mode === "global" && session.gameNumber > 1 ? (
        <PreviousGamesInfo
          champions={champions}
          gameNumber={session.gameNumber}
          previousGamesPicks={session.previousGamesPicks}
          version={version}
        />
      ) : null}

      <div className="main-content">
        <TeamPanel
          bans={session.state.blueBans}
          champions={champions}
          picks={session.state.bluePicks}
          side="blue"
          version={version}
        />
        {session.role === "observer" ? (
          <ObserverDraftDisplay
            blueBans={session.state.blueBans}
            bluePicks={session.state.bluePicks}
            champions={champions}
            pendingChampionId={session.pendingChampionId}
            redBans={session.state.redBans}
            redPicks={session.state.redPicks}
            version={version}
          />
        ) : (
          <ChampionPool
            champions={champions}
            onSelectChampion={(championId) => void session.selectChampion(championId)}
            pendingChampionId={session.pendingChampionId}
            role={session.role}
            state={session.state}
            tags={tags}
            version={version}
          />
        )}
        <TeamPanel
          bans={session.state.redBans}
          champions={champions}
          picks={session.state.redPicks}
          side="red"
          version={version}
        />
      </div>

      <RefereePanel
        canUnban={session.role === "referee"}
        championIds={session.state.systemBannedChampions}
        champions={champions}
        onToggleChampion={(championId) => void session.toggleSystemBan(championId)}
        version={version}
      />
    </div>
  );
}

function useStepTimer(currentStep: number, currentPhase: string) {
  const [timerState, setTimerState] = useState({
    currentPhase,
    currentStep,
    elapsedSeconds: 0,
  });

  useEffect(() => {
    const startedAt = Date.now();

    const interval = window.setInterval(() => {
      setTimerState({
        currentPhase,
        currentStep,
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentPhase, currentStep]);

  if (timerState.currentPhase !== currentPhase || timerState.currentStep !== currentStep) {
    return 0;
  }

  return timerState.elapsedSeconds;
}

function PreviousGamesInfo({
  champions,
  gameNumber,
  previousGamesPicks,
  version,
}: {
  champions: ChampionData[];
  gameNumber: number;
  previousGamesPicks: PreviousGamesPicks;
  version: string;
}) {
  const previous = [];

  for (let index = 1; index < gameNumber; index += 1) {
    const game = previousGamesPicks[index];
    if (!game || Array.isArray(game)) {
      continue;
    }

    previous.push(
      ...(game.blue ?? []).map((championId) => ({ championId, gameNumber: index, side: "blue" as const })),
      ...(game.red ?? []).map((championId) => ({ championId, gameNumber: index, side: "red" as const })),
    );
  }

  if (previous.length === 0) {
    return null;
  }

  return (
    <div className="previous-games-info" id="previous-games-info">
      <h4>前面对局已选英雄（自动禁用）</h4>
      <div className="previous-games-champions">
        {previous.map((item) => {
          const champion = champions.find((entry) => entry.id === item.championId);
          return (
            <div
              className="previous-games-champion"
              key={`${item.gameNumber}-${item.side}-${item.championId}`}
              title={`Game ${item.gameNumber} ${item.side === "blue" ? "蓝方" : "红方"}: ${
                champion?.name ?? item.championId
              }`}
            >
              {version ? (
                <img
                  alt={champion?.name ?? item.championId}
                  src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${item.championId}.png`}
                />
              ) : null}
              <span
                className="game-label"
                style={{ backgroundColor: item.side === "blue" ? "#1E88E5" : "#E53935" }}
              >
                {item.gameNumber}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getActionText(session: ReturnType<typeof useBpSession>) {
  if (session.state.currentPhase === "finished") {
    return "BP 完成!";
  }

  if (!session.state.whosTurn || !session.state.actionType) {
    return "---";
  }

  const sideText = session.state.whosTurn === "blue" ? "蓝方" : "红方";
  const actionText = session.state.actionType === "ban" ? "禁用" : "选用";
  const values =
    session.state.actionType === "ban"
      ? session.state.whosTurn === "blue"
        ? session.state.blueBans
        : session.state.redBans
      : session.state.whosTurn === "blue"
        ? session.state.bluePicks
        : session.state.redPicks;
  const marker = session.state.actionType === "ban" ? "B" : "P";

  return `${sideText} ${actionText} ${marker}${values.length + 1}`;
}

function getResetButtonText(role: string) {
  if (role === "blue") {
    return "你是蓝方队长";
  }
  if (role === "red") {
    return "你是红方队长";
  }
  return "返回模式选择";
}
