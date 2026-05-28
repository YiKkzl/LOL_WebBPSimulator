#!/usr/bin/env node

const legacyBase = process.env.LEGACY_API_BASE ?? "http://127.0.0.1:8080/api.php";
const nextBase = process.env.NEXT_API_BASE ?? "http://127.0.0.1:3000/api.php";

const checks = [
  {
    name: "missing session",
    path: "?action=getSession&session_id=__compare_missing__",
  },
  {
    name: "missing global session",
    path: "?action=getGlobalSession&global_session_id=__compare_missing__",
  },
  {
    name: "invalid action",
    path: "?action=__compare_invalid__",
  },
];

let failures = 0;

for (const check of checks) {
  const [legacyResponse, nextResponse] = await Promise.all([
    readJson(`${legacyBase}${check.path}`),
    readJson(`${nextBase}${check.path}`),
  ]);

  if (JSON.stringify(legacyResponse) !== JSON.stringify(nextResponse)) {
    failures += 1;
    console.error(`Mismatch: ${check.name}`);
    console.error("Legacy:", JSON.stringify(legacyResponse));
    console.error("Next:  ", JSON.stringify(nextResponse));
  } else {
    console.log(`OK: ${check.name}`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}

async function readJson(url) {
  const response = await fetch(url);
  return response.json();
}
