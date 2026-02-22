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
const symBtn = document.querySelector<HTMLButtonElement>("#sym")!;

const ctx = canvas.getContext("2d", { alpha: false })!;
const dpr = window.devicePixelRatio || 1;

let img: HTMLImageElement | null = null;
let points: Pt[] = [];
let draggingIndex: number | null = null;

let spaceDown = false;
let panning = false;
let panStart: { x: number; y: number; tx: number; ty: number } | null = null;

const view = {
    scale: 1,
    tx: 0, // canvas px
    ty: 0, // canvas px
    minScale: 0.05,
    maxScale: 40,
};

function clamp(v: number, a: number, b: number) {
    return Math.max(a, Math.min(b, v));
}

function exportBlock(opts: WatermarkOptions) {
    return `export type WatermarkOptions = { x: number; y: number; width: number; height: number };

export const watermark: WatermarkOptions = { x: ${opts.x}, y: ${opts.y}, width: ${opts.width}, height: ${opts.height} };`;
}

function setOutput(opts: WatermarkOptions) {
    out.textContent = exportBlock(opts);
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

function rectFromPointsSymmetric(pts: Pt[]): WatermarkOptions {
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

    let halfW = 0;
    let halfH = 0;
    for (const p of pts) {
        halfW = Math.max(halfW, Math.abs(p.x - cx));
        halfH = Math.max(halfH, Math.abs(p.y - cy));
    }

    halfW = Math.ceil(halfW);
    halfH = Math.ceil(halfH);

    const x = Math.floor(cx - halfW);
    const y = Math.floor(cy - halfH);
    const width = Math.ceil(2 * halfW);
    const height = Math.ceil(2 * halfH);

    return { x, y, width, height };
}

function setPointsFromRect(r: WatermarkOptions) {
    points = [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
    ];
}

function isTypingTarget(t: EventTarget | null) {
    const el = t as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || el.isContentEditable;
}

function resizeCanvasToCSSSize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
}

function eventToCanvasPx(e: MouseEvent | WheelEvent | PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
}

function screenToImage(p: Pt): Pt {
    return { x: (p.x - view.tx) / view.scale, y: (p.y - view.ty) / view.scale };
}

function imageToScreen(p: Pt): Pt {
    return { x: p.x * view.scale + view.tx, y: p.y * view.scale + view.ty };
}

function fitImageToView() {
    if (!img) return;
    const cw = canvas.width;
    const ch = canvas.height;

    const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    view.scale = clamp(s, view.minScale, view.maxScale);
    view.tx = (cw - img.naturalWidth * view.scale) / 2;
    view.ty = (ch - img.naturalHeight * view.scale) / 2;
}

function hitPointIndex(screenPos: Pt, radius = 10): number | null {
    const rr = radius * radius;
    for (let i = 0; i < points.length; i++) {
        const sp = imageToScreen(points[i]);
        const dx = sp.x - screenPos.x;
        const dy = sp.y - screenPos.y;
        if (dx * dx + dy * dy <= rr) return i;
    }
    return null;
}

function draw() {
    // Background in screen space
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!img) {
        setOutput({ x: 0, y: 0, width: 0, height: 0 });
        return;
    }

    // Image + overlays in image space (camera transform)
    ctx.setTransform(view.scale, 0, 0, view.scale, view.tx, view.ty);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0);

    // Polygon
    if (points.length > 0) {
        ctx.lineWidth = 2 / view.scale;
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
        ctx.arc(p.x, p.y, 6 / view.scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.font = `${12 / view.scale}px system-ui`;
        ctx.fillText(String(i + 1), p.x - 3 / view.scale, p.y + 4 / view.scale);
    }

    if (points.length === 4) {
        const b = bboxFromPoints(points);

        ctx.strokeStyle = "rgba(255,0,0,0.85)";
        ctx.lineWidth = 2 / view.scale;
        ctx.strokeRect(b.x, b.y, b.width, b.height);

        setOutput(b);
    } else {
        setOutput({ x: 0, y: 0, width: 0, height: 0 });
    }
}

function resetPointsOnly() {
    points = [];
    draggingIndex = null;
    panning = false;
    panStart = null;
    draw();
}

resetBtn.addEventListener("click", () => resetPointsOnly());

symBtn.addEventListener("click", () => {
    if (points.length !== 4) return;
    const r = rectFromPointsSymmetric(points);
    setPointsFromRect(r);
    draw();
});

copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(out.textContent || "");
});

// Space = hand tool
window.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.code === "Space") {
        e.preventDefault();
        spaceDown = true;
        canvas.classList.add("hand");
    }
});

window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
        spaceDown = false;
        canvas.classList.remove("hand");
    }
});

// Pointer interactions (points drag + pan)
canvas.addEventListener("pointerdown", (e) => {
    if (!img) return;

    canvas.setPointerCapture(e.pointerId);

    const p = eventToCanvasPx(e);

    if (spaceDown) {
        panning = true;
        panStart = { x: p.x, y: p.y, tx: view.tx, ty: view.ty };
        return;
    }

    const idx = hitPointIndex(p);
    if (idx !== null) {
        draggingIndex = idx;
        return;
    }

    if (points.length < 4) {
        points.push(screenToImage(p));
        draw();
    }
});

canvas.addEventListener("pointermove", (e) => {
    if (!img) return;
    const p = eventToCanvasPx(e);

    if (panning && panStart) {
        view.tx = panStart.tx + (p.x - panStart.x);
        view.ty = panStart.ty + (p.y - panStart.y);
        draw();
        return;
    }

    if (draggingIndex !== null) {
        points[draggingIndex] = screenToImage(p);
        draw();
    }
});

function stopPointer(e: PointerEvent) {
    panning = false;
    panStart = null;
    draggingIndex = null;
    try {
        canvas.releasePointerCapture(e.pointerId);
    } catch {}
}

canvas.addEventListener("pointerup", stopPointer);
canvas.addEventListener("pointercancel", stopPointer);

// Zoom on wheel (zoom to cursor)
canvas.addEventListener(
    "wheel",
    (e) => {
        if (!img) return;
        e.preventDefault();

        const mouse = eventToCanvasPx(e);
        const before = screenToImage(mouse);

        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 16;
        if (e.deltaMode === 2) delta *= canvas.getBoundingClientRect().height;

        const zoomFactor = Math.exp(-delta * 0.001);
        const nextScale = clamp(view.scale * zoomFactor, view.minScale, view.maxScale);

        view.scale = nextScale;
        view.tx = mouse.x - before.x * view.scale;
        view.ty = mouse.y - before.y * view.scale;

        draw();
    },
    { passive: false }
);

// Paste image from clipboard
document.addEventListener("paste", (event: ClipboardEvent) => {
    const dt = event.clipboardData;
    if (!dt) return;

    for (const item of dt.items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (!file) continue;

            const url = URL.createObjectURL(file);
            const im = new Image();
            im.onload = () => {
                img = im;

                resizeCanvasToCSSSize();
                fitImageToView();
                resetPointsOnly();

                URL.revokeObjectURL(url);
            };
            im.src = url;
            break;
        }
    }
});

// Initial sizing
resizeCanvasToCSSSize();
window.addEventListener("resize", () => {
    resizeCanvasToCSSSize();
    fitImageToView();
    draw();
});

draw();
