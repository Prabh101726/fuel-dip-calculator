import { ImageResponse } from "next/og";
import {
  APP_NAME,
  APP_TAGLINE,
  MONTHLY_PRICE_LABEL,
  OPERATOR_NAME,
  TRIAL_DAYS,
} from "@/lib/app-copy";

export const alt = APP_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#12141a",
          color: "#f4f5f7",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#8b93a3",
          }}
        >
          {OPERATOR_NAME}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            marginTop: 16,
          }}
        >
          {APP_NAME}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            marginTop: 24,
            color: "#c2c8d4",
            maxWidth: 900,
          }}
        >
          {APP_TAGLINE}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            marginTop: 48,
            color: "#7fd99a",
          }}
        >
          {`${TRIAL_DAYS}-day free trial · ${MONTHLY_PRICE_LABEL}`}
        </div>
      </div>
    ),
    size,
  );
}
