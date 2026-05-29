"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { buildRoleLinks, ensureGlobalGameSession } from "@/src/hooks/useBpSession";

export default function DistributePage() {
  return (
    <Suspense fallback={<InitialLoading />}>
      <DistributeView />
    </Suspense>
  );
}

export function DistributeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const globalSessionId = searchParams.get("global_session");
  const gameNumber = Number(searchParams.get("game") ?? 0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const baseUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${window.location.pathname.replace(/\/distribute$/, "") || "/"}`;
  const invalidParams = !globalSessionId || !Number.isInteger(gameNumber) || gameNumber < 1 || gameNumber > 5;
  const returnUrl = globalSessionId
    ? `/?mode=global&global_session=${encodeURIComponent(globalSessionId)}`
    : "/";

  useEffect(() => {
    if (invalidParams) {
      return;
    }

    let cancelled = false;

    async function loadSessionId() {
      try {
        const nextSessionId = await ensureGlobalGameSession(globalSessionId as string, gameNumber);
        if (!cancelled) {
          setSessionId(nextSessionId);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      }
    }

    void loadSessionId();

    return () => {
      cancelled = true;
    };
  }, [gameNumber, globalSessionId, invalidParams]);

  const links = useMemo(() => {
    if (!baseUrl || !sessionId) {
      return null;
    }

    return buildRoleLinks(baseUrl, sessionId, { globalSessionId, gameNumber });
  }, [baseUrl, gameNumber, globalSessionId, sessionId]);

  async function copyLink(key: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  }

  if (invalidParams || error) {
    return (
      <main className="legacy-page">
        <div className="distribute-page">
          <div className="error-message">
            <h3>加载游戏会话ID失败</h3>
            <p>{error ?? "全局会话ID或游戏编号无效"}</p>
            <button className="secondary-button" onClick={() => router.push(returnUrl)} type="button">
              返回
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="legacy-page">
      <div className="distribute-page">
        <div className="distribute-header">
          <h2>游戏链接分发</h2>
          <p>
            游戏ID: <span className="session-id">Game {gameNumber || "-"}</span>
          </p>
          <p>
            全局会话ID: <span className="session-id">{globalSessionId ?? "-"}</span>
          </p>
        </div>
        {!links ? (
          <div className="empty-message">加载中...</div>
        ) : (
          <div className="distribute-links">
            <h3>角色链接</h3>
            <div className="role-links">
              <RoleLinkBox
                color="#1E88E5"
                copied={copied === "blue"}
                label="蓝方链接"
                onCopy={() => void copyLink("blue", links.blue)}
                url={links.blue}
              />
              <RoleLinkBox
                color="#E53935"
                copied={copied === "red"}
                label="红方链接"
                onCopy={() => void copyLink("red", links.red)}
                url={links.red}
              />
              <RoleLinkBox
                color="#9932CC"
                copied={copied === "referee"}
                label="裁判链接"
                onCopy={() => void copyLink("referee", links.referee)}
                url={links.referee}
              />
              <RoleLinkBox
                color="#2E8B57"
                copied={copied === "observer"}
                label="观战链接"
                onCopy={() => void copyLink("observer", links.observer)}
                url={links.observer}
              />
            </div>
            <div className="distribute-buttons">
              <button className="secondary-button" onClick={() => router.push(returnUrl)} type="button">
                返回
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function InitialLoading() {
  return (
    <main className="legacy-page">
      <div className="distribute-page">
        <div className="empty-message">加载中...</div>
      </div>
    </main>
  );
}

function RoleLinkBox({
  color,
  copied,
  label,
  onCopy,
  url,
}: {
  color: string;
  copied: boolean;
  label: string;
  onCopy: () => void;
  url: string;
}) {
  return (
    <div className="role-link-box">
      <div className="role-header" style={{ backgroundColor: color }}>
        <h4>{label}</h4>
      </div>
      <div className="role-link">
        <input readOnly type="text" value={url} />
      </div>
      <div className="role-actions">
        <a className="open-button" href={url} rel="noreferrer" target="_blank">
          打开
        </a>
        <button className="copy-button" onClick={onCopy} type="button">
          {copied ? "已复制!" : "复制"}
        </button>
      </div>
    </div>
  );
}
