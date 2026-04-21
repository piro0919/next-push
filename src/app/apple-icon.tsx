import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
        borderRadius: 38,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <svg
        fill="none"
        height="120"
        viewBox="-150 -150 300 300"
        width="120"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>next-push bell icon</title>
        <path
          d="M -108,60 C -108,-40 -60,-100 0,-100 C 60,-100 108,-40 108,60 L 130,100 L -130,100 Z"
          fill="white"
          fillOpacity="0.1"
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="32"
        />
        <circle cx="0" cy="-118" fill="white" r="16" />
        <circle cx="0" cy="140" fill="white" r="22" />
        <path
          d="M -170,-40 C -190,-10 -190,40 -170,70"
          opacity="0.55"
          stroke="white"
          strokeLinecap="round"
          strokeWidth="24"
        />
        <path
          d="M 170,-40 C 190,-10 190,40 170,70"
          opacity="0.55"
          stroke="white"
          strokeLinecap="round"
          strokeWidth="24"
        />
      </svg>
    </div>,
    { ...size },
  );
}
