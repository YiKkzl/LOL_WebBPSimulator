"use client";

import { useState } from "react";

import { buildRoleLinks } from "@/src/hooks/useBpSession";

interface ShareLinksProps {
  sessionId: string | null;
  globalSessionId?: string | null;
  gameNumber?: number | null;
}

const labels = {
  blue: "蓝方队长链接",
  red: "红方队长链接",
  referee: "裁判链接",
  observer: "观战链接",
};

export function ShareLinks({ sessionId, globalSessionId, gameNumber }: ShareLinksProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const currentBaseUrl =
    baseUrl || (typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}`);

  if (!sessionId || !currentBaseUrl) {
    return null;
  }

  const links = buildRoleLinks(currentBaseUrl, sessionId, { globalSessionId, gameNumber });

  async function copyLink(key: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div className="share-links-container" id="share-links">
      <h3>分享链接</h3>
      {Object.entries(links).map(([key, url]) => (
        <div className="share-link" key={key}>
          <strong>{labels[key as keyof typeof labels]}: </strong>
          <input
            onFocus={() => {
              if (!baseUrl && typeof window !== "undefined") {
                setBaseUrl(`${window.location.origin}${window.location.pathname}`);
              }
            }}
            readOnly
            type="text"
            value={url}
          />
          <button onClick={() => void copyLink(key, url)} type="button">
            {copied === key ? "已复制!" : "复制"}
          </button>
        </div>
      ))}
    </div>
  );
}
