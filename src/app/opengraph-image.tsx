import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "next-push";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

const TITLE = "next-push";
const DESCRIPTION = "Web Push notifications for Next.js App Router.";

export default async function Image() {
  /* 見出しの書体はサイトと同じ Space Grotesk。使う文字だけに絞ったものを
     同梱している。文言を変えたら assets/README.md の手順で作り直す */
  const font = await readFile(join(process.cwd(), "assets/SpaceGrotesk-700-subset.ttf"));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        padding: "0 80px",
        background: "#0b0b0f",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: 600,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          {TITLE}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            marginTop: 28,
            lineHeight: 1.4,
            color: "#a1a1aa",
          }}
        >
          {DESCRIPTION}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            marginTop: 48,
            color: "#71717a",
          }}
        >
          kkweb.io
        </div>
      </div>

      {/* 何をするパッケージなのかを右に置く。名前と説明だけだと、
          9件が同じ絵になってタイムラインで見分けが付かない */}
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flex: 1,
          justifyContent: "center",
        }}
      >
        {/* 届いた通知そのもの */}
        <div
          style={{
            background: "#15151c",
            border: "1px solid #26262f",
            borderRadius: 18,
            display: "flex",
            gap: 18,
            padding: 24,
            width: 360,
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "#818cf8",
              borderRadius: 14,
              display: "flex",
              height: 62,
              justifyContent: "center",
              width: 62,
            }}
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="34"
              viewBox="0 0 24 24"
              width="34"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6Zm0 18a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 21Z"
                fill="#0b0b0f"
              />
            </svg>
          </div>
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              gap: 12,
              paddingTop: 6,
            }}
          >
            <div style={{ background: "#3f3f46", borderRadius: 4, height: 12, width: 190 }} />
            <div style={{ background: "#27272e", borderRadius: 4, height: 10, width: 140 }} />
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ data: font, name: "Space Grotesk", style: "normal", weight: 700 }],
    },
  );
}
