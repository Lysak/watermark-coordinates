import "./style.css";

export interface WatermarkOptions {
    x: number;
    y: number;
    width: number;
    height: number;
}

type Pt = { x: number; y: number };

const canvas = document.querySelector<HTMLCanvasElement>("#c")!;
const out = document.querySelector<HTMLPreElement>("#out")!;
const resetBtn = document.querySelector<HTMLButtonElement>("#reset")!;
const copyBtn = document.querySelector<HTMLButtonElement>("#copy")!;

const ctx = canvas.getContext("2d", { alpha: false })!;

let img: HTMLImageElement | null = null;
let points: Pt[] = [];
let draggingIndex: number | null = null;

function setOutput(opts: WatermarkOptions) {
    out.textContent = `export interface WatermarkOptions {
  x: ${opts.x};
  y: ${opts.y};
  width: ${opts.width};
  height: ${opts.height};
}`;
}

function bboxFromPoints(pts: Pt[]): WatermarkOptions {
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.floor(Math.min(...xs));
    const minY = Math.floor(Math.min(...ys));
    const maxX = Math.ceil(Math.max(...xs));
    const maxY = Math.ceil(Math.max(...ys));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function getCanvasPos(e: MouseEvent): Pt {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
    };
}

function draw() {
    // Clear
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (img) {
        ctx.drawImage(img, 0, 0);
    }

    // Polygon
    if (points.length > 0) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,255,255,0.9)";
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        if (points.length === 4) ctx.closePath();
        ctx.stroke();
    }

    // Points
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        ctx.fillStyle = "rgba(255,255,0,0.95)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.font = "12px system-ui";
        ctx.fillText(String(i + 1), p.x - 3, p.y + 4);
    }

    // BBox preview
    if (points.length === 4) {
        const b = bboxFromPoints(points);
        ctx.strokeStyle = "rgba(255,0,0,0.85)";
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, b.y, b.width, b.height);
        setOutput(b);
    } else {
        setOutput({ x: 0, y: 0, width: 0, height: 0 });
    }
}

function reset() {
    points = [];
    draggingIndex = null;
    draw();
}

function findPointIndex(pos: Pt, r = 10): number | null {
    const rr = r * r;
    for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - pos.x;
        const dy = points[i].y - pos.y;
        if (dx * dx + dy * dy <= rr) return i;
    }
    return null;
}

canvas.addEventListener("mousedown", (e) => {
    const pos = getCanvasPos(e);
    const idx = findPointIndex(pos);
    if (idx !== null) {
        draggingIndex = idx;
        return;
    }
    if (points.length < 4) {
        points.push(pos);
        draw();
    }
});

window.addEventListener("mousemove", (e) => {
    if (draggingIndex === null) return;
    const pos = getCanvasPos(e);
    points[draggingIndex] = pos;
    draw();
});

window.addEventListener("mouseup", () => {
    draggingIndex = null;
});

resetBtn.addEventListener("click", reset);

copyBtn.addEventListener("click", async () => {
    if (points.length !== 4) return;
    const b = bboxFromPoints(points);
    const text = `const wm: WatermarkOptions = { x: ${b.x}, y: ${b.y}, width: ${b.width}, height: ${b.height} };`;
    await navigator.clipboard.writeText(text);
});

// Paste image from clipboard (classic paste event)
document.addEventListener("paste", (event: ClipboardEvent) => {
    const dt = event.clipboardData;
    if (!dt) return;

    // Find first image item
    const items = dt.items;
    for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
            const file = item.getAsFile(); // DataTransferItem.getAsFile() [web:20]
            if (!file) continue;

            const url = URL.createObjectURL(file);
            const im = new Image();
            im.onload = () => {
                img = im;

                // Keep 1:1 pixel coordinates; CSS will scale visually.
                canvas.width = im.naturalWidth;
                canvas.height = im.naturalHeight;

                reset();
                draw();
                URL.revokeObjectURL(url);
            };
            im.src = url;
            break;
        }
    }
});

draw();
