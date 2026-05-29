import Link from "next/link";

export default function LegacyPage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Legacy fallback</p>
        <h1>旧版入口保留</h1>
        <p className="status">
          默认入口已由 Next.js 接管。旧版静态页面保留在 public/legacy，
          仍通过兼容的 /api.php 接口读写本地测试库。
        </p>
        <p className="status">
          <a href="/legacy/index.html">打开旧版静态入口</a>
        </p>
        <p className="status">
          <Link href="/">返回 Next.js 入口</Link>
        </p>
      </section>
    </main>
  );
}
