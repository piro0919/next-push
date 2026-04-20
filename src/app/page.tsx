import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>next-push</h1>
      <p>Web Push notifications for Next.js.</p>
      <ul>
        <li>
          <Link href="/push-demo">Push demo</Link>
        </li>
      </ul>
    </main>
  );
}
