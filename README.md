# watermark-coordinates

A tiny web tool to paste an image, pick a watermark area, and copy rectangle coordinates.

## Features
- Paste image from clipboard (Ctrl+V).
- Pick 4 points around the watermark.
- Drag points to adjust.
- Symmetrize: converts your 4 points into a clean, axis-aligned rectangle (helps when clicks are not perfectly aligned).
- Zoom with mouse wheel.
- Pan like Photoshop: hold Space and drag.
- Copy result as:
  `export const watermark: WatermarkOptions = { x: ..., y: ..., width: ..., height: ... };`

## Output format
```ts
export interface WatermarkOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const watermark: WatermarkOptions = { x: 0, y: 0, width: 0, height: 0 };
```

## How to create a project template
```
pnpm create vite@latest watermark-coordinates --template vanilla-ts
cd watermark-coordinates
pnpm i
pnpm dev
```
