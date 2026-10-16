---
name: Calendai
description: Trợ lý AI tiếng Việt đặt lịch phong cách Cartoon Atelier cổ điển và độc đáo
colors:
  primary: "#c25e2e"
  primary-dark: "#e07a3f"
  primary-hover: "#a6491e"
  primary-dark-hover: "#f59e0b"
  surface-light: "#fffaf2"
  surface-dark: "#211a14"
  surface-dark-elevated: "#2a221b"
  surface-dark-highest: "#362c23"
  bg-light: "#f5eee1"
  bg-dark: "#14110f"
  text-light: "#2b1f17"
  text-dark: "#f5ebd9"
  text-muted-light: "#786455"
  text-muted-dark: "#ba9f88"
  border-light: "#2d2015"
  border-light-subtle: "#e3d3be"
  border-dark: "#453427"
  border-dark-subtle: "#2d231b"
  accent-meet: "#1f7560"
  accent-meet-dark: "#2dd4bf"
  accent-gold: "#d49439"
  accent-gold-dark: "#fbbf24"
  accent-cyan-dark: "#38bdf8"
  accent-purple-dark: "#c084fc"
  accent-mint-dark: "#34d399"
  status-success: "#2d8a57"
  status-error: "#cf3e32"
  white: "#ffffff"
  drafting-grid: "#d4c5ae"
  parchment-deep: "#ede4d5"
  brass-thumb: "#b59273"
  iron-thumb: "#5a4230"
typography:
  display:
    fontFamily: '"Plus Jakarta Sans", "Google Sans", "Courier New", monospace'
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"Plus Jakarta Sans", "Google Sans", sans-serif'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"Plus Jakarta Sans", "Google Sans", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  label:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace'
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
  caption:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace'
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Design System: Calendai (Cartoon Atelier)

## Overview

**Creative North Star: "Chrono-Clockwork Atelier"**

Một thế giới giao diện độc bản hòa quyện giữa phim hoạt hình vẽ tay thập niên 1930 (Golden Age rubber-hose cartoon, Cuphead) và xưởng máy hơi nước Victorian (bánh răng đồng, vạch chỉ thị cơ khí, giấy da cổ ố vàng, bóng đèn dây tóc vonfram và viền mực đậm nét).

**Key Visual Identifiers:**
- **Inked Cartoon Outlines (Nét viền mực đậm đà)**: Mọi thẻ, nút bấm và khung chat đều được bao quanh bởi viền mực đậm `border-2 border-[#2d2015]` (dark: `border-[#453427]`), mang lại cảm giác hoạt hình vẽ tay hoạt họa sống động.
- **Antique Parchment & Brass (Giấy da ngả màu & Đồng thau cổ)**: Tông nền giấy ngà ấm `#f5eee1` (ban ngày) kết hợp hòm sắt lò đúc `#14110f` (ban đêm) điểm xuyết tia lửa than hồng `#e07a3f` và ánh đồng thau `#d49439`.
- **Mechanical Stamp Affordances (Con dấu và vé hành trình cổ)**: Thẻ xem trước cuộc họp được thiết kế như một chiếc vé tàu hơi nước cổ điển (Chrono-Ticket) với vạch răng cưa, dấu mộc tròn "CHỜ DUYỆT / ĐÃ ĐÓNG DẤU", bánh răng đồng xoay nhẹ khi trợ lý suy nghĩ.
- **Retro-Gauge Typographic Accents**: Số liệu, thời gian và nhãn múi giờ mang phong cách máy đo áp suất cơ khí, vừa hoài niệm vừa cực kỳ dễ đọc.
