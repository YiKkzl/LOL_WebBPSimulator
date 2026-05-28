"use client";

import { useState } from "react";

interface ModeSelectionProps {
  onStartCompetitive: () => void;
  onStartGlobal: () => void;
  onJoinObserver: (sessionId: string) => void | Promise<void>;
  isBusy?: boolean;
}

export function ModeSelection({
  onStartCompetitive,
  onStartGlobal,
  onJoinObserver,
  isBusy = false,
}: ModeSelectionProps) {
  const [observerSessionId, setObserverSessionId] = useState("");

  return (
    <div id="initial-screen-container">
      <h1 id="main-title">YiKkBP模拟器</h1>
      <div id="mode-selection">
        <h2>选择模式</h2>
        <button disabled={isBusy} onClick={onStartGlobal} type="button">
          全局 BP 模式
        </button>
        <button disabled={isBusy} onClick={onStartCompetitive} type="button">
          竞技征召 BP
        </button>
        <div className="observer-join-section">
          <h3>通过ID进入观战</h3>
          <div className="observer-join-controls">
            <input
              id="observer-session-id-input"
              onChange={(event) => setObserverSessionId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && observerSessionId.trim()) {
                  void onJoinObserver(observerSessionId.trim());
                }
              }}
              placeholder="输入对局ID..."
              type="text"
              value={observerSessionId}
            />
            <button
              disabled={isBusy || !observerSessionId.trim()}
              onClick={() => void onJoinObserver(observerSessionId.trim())}
              type="button"
            >
              观战
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
