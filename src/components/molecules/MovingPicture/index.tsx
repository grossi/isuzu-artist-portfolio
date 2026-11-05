import * as React from "react";
import { makeStyles } from "tss-react/mui";

// A picture with gently moving parts (swaying grass, hanging grapes, drifting
// light), drawn with WebGL from a scene made from the artwork's layers. The
// still picture shows first, and stays when motion is off, when WebGL is
// missing, or until every piece has loaded. The motion runs only while
// `active` and on screen.
//
// A scene folder holds scene.json, still.webp (the picture at rest),
// base.webp (what never moves) and the sheets of pieces (atlas*.webp). Each
// part is drawn in order from its place on a sheet; a moving part is
// displaced pixel by pixel in the fragment shader:
//   sway  rooted at its bottom (grass), the tips move most
//   hang  hanging from its top (grapes, leaves)
//   bow   held at both ends, sways in the middle
//   float moves whole on its own small loop and fades in and out (light)

type Part = {
  type: "static" | "mover";
  x: number;
  y: number;
  w: number;
  h: number;
  sheet: number;
  sx: number;
  sy: number;
  kind?: "sway" | "hang" | "bow" | "float";
  amp?: number;
  period?: number;
  phase?: number;
};

type Scene = {
  width: number;
  height: number;
  loop: number;
  speed: number;
  base: string;
  atlases: { file: string; width: number; height: number }[];
  parts: Part[];
};

const KIND = { sway: 1, hang: 2, bow: 3, float: 4 } as const;

const VERTEX = `
attribute vec2 aCorner;
uniform vec4 uRect;
uniform float uMargin;
uniform vec2 uScene;
varying vec2 vP;
void main() {
  vec2 p = uRect.xy - uMargin + aCorner * (uRect.zw + 2.0 * uMargin);
  vP = p;
  vec2 clip = p / uScene * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
uniform sampler2D uTex;
uniform vec4 uRect;
uniform vec2 uSrc;
uniform vec2 uSheet;
uniform int uKind;
uniform float uAmp, uPeriod, uPhase, uTime;
varying vec2 vP;
const float TAU = 6.2831853;
void main() {
  vec2 p = vP;
  vec2 s = p;
  float alpha = 1.0;
  float w = TAU * uTime / uPeriod + uPhase;
  float gust = 0.8 + 0.2 * sin(TAU * uTime / 12.0 + uPhase);
  if (uKind == 1) {
    float k = pow(clamp((uRect.y + uRect.w - p.y) / uRect.w, 0.0, 1.0), 1.6);
    float dx = uAmp * gust * k * (sin(w - p.x * 0.006) + 0.35 * sin(2.0 * w + p.x * 0.013 + 1.3));
    s = p - vec2(dx, abs(dx) * 0.12);
  } else if (uKind == 2 || uKind == 3) {
    float r = clamp((p.y - uRect.y) / uRect.w, 0.0, 1.0);
    float k = uKind == 2 ? pow(r, 1.3) : sin(3.14159 * r);
    float dx = uAmp * gust * k * (sin(w + p.x * 0.004) + 0.25 * sin(3.0 * w + p.x * 0.01));
    s = p - vec2(dx, 0.0);
  } else if (uKind == 4) {
    vec2 c = uRect.xy + uRect.zw * 0.5;
    float t0 = TAU * uTime / uPeriod;
    vec2 d = uAmp * vec2(
      sin(t0 + uPhase + c.y * 0.004) * 0.7 + sin(2.0 * t0 + uPhase * 1.7) * 0.3,
      cos(t0 + uPhase * 1.3 + c.x * 0.004) * 0.7 + cos(3.0 * t0 + uPhase * 2.3) * 0.3);
    s = p - d;
    alpha = 0.2 + 0.8 * (0.5 + 0.5 * sin(2.0 * t0 + uPhase * 3.1));
  }
  vec2 local = s - uRect.xy;
  if (local.x < 0.0 || local.y < 0.0 || local.x > uRect.z || local.y > uRect.w) discard;
  gl_FragColor = texture2D(uTex, (uSrc + local) / uSheet) * alpha;
}`;

const useStyles = makeStyles()({
  root: {
    position: "relative",
    overflow: "hidden",
  },
  layer: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
  },
  canvas: {
    opacity: 0,
    transition: "opacity 0.4s",
  },
  ready: {
    opacity: 1,
  },
});

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    // onload rather than decode(): decode() can stall in a background tab.
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`can't load ${src}`));
    img.src = src;
  });

type Renderer = { draw: (time: number) => void; dispose: () => void };

// Sets up WebGL for a loaded scene, or returns null when it can't.
function createRenderer(canvas: HTMLCanvasElement, scene: Scene, sheets: HTMLImageElement[], base: HTMLImageElement): Renderer | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: false, antialias: false });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const u = (name: string) => gl.getUniformLocation(program, name);
  const U = {
    rect: u("uRect"),
    margin: u("uMargin"),
    scene: u("uScene"),
    src: u("uSrc"),
    sheet: u("uSheet"),
    kind: u("uKind"),
    amp: u("uAmp"),
    period: u("uPeriod"),
    phase: u("uPhase"),
    time: u("uTime"),
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, "aCorner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const texture = (img: HTMLImageElement) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };
  const baseTex = texture(base);
  const sheetTex = sheets.map(texture);
  gl.viewport(0, 0, scene.width, scene.height);
  gl.uniform2f(U.scene, scene.width, scene.height);

  const drawPart = (tex: WebGLTexture | null, part: Pick<Part, "x" | "y" | "w" | "h" | "sx" | "sy">, sheetW: number, sheetH: number, kind: number, amp: number, period: number, phase: number) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform4f(U.rect, part.x, part.y, part.w, part.h);
    gl.uniform2f(U.src, part.sx, part.sy);
    gl.uniform2f(U.sheet, sheetW, sheetH);
    gl.uniform1f(U.margin, kind ? Math.ceil(amp * 1.6 + 4) : 0);
    gl.uniform1i(U.kind, kind);
    gl.uniform1f(U.amp, amp);
    gl.uniform1f(U.period, period);
    gl.uniform1f(U.phase, phase);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  return {
    draw: (time) => {
      gl.uniform1f(U.time, time);
      drawPart(baseTex, { x: 0, y: 0, w: scene.width, h: scene.height, sx: 0, sy: 0 }, scene.width, scene.height, 0, 0, 1, 0);
      for (const part of scene.parts) {
        const sheet = scene.atlases[part.sheet];
        const kind = part.type === "mover" && part.kind ? KIND[part.kind] : 0;
        drawPart(sheetTex[part.sheet], part, sheet.width, sheet.height, kind, part.amp ?? 0, part.period ?? 1, part.phase ?? 0);
      }
    },
    dispose: () => gl.getExtension("WEBGL_lose_context")?.loseContext(),
  };
}

type Props = {
  // The scene folder, ending in "/". The box's size (and so the picture's
  // aspect) is the caller's.
  scene: string;
  active: boolean;
  className?: string;
};

export default function MovingPicture({ scene: folder, active, className }: Props) {
  const { classes, cx } = useStyles();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rendererRef = React.useRef<{ renderer: Renderer; scene: Scene } | null>(null);
  const [scene, setScene] = React.useState<Scene | null>(null);
  const [ready, setReady] = React.useState(false);
  const [onScreen, setOnScreen] = React.useState(true);
  const [reducedMotion] = React.useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`${folder}scene.json`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: Scene) => !cancelled && setScene(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [folder]);

  // The pieces and WebGL: not for visitors who asked for less motion, nor for
  // a copy of the slide made by the carousel (it never shows long).
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!scene || !canvas || reducedMotion || rootRef.current?.closest(".slick-cloned")) return;
    let cancelled = false;
    Promise.all([loadImage(`${folder}${scene.base}`), ...scene.atlases.map((sheet) => loadImage(`${folder}${sheet.file}`))])
      .then(([base, ...sheets]) => {
        if (cancelled) return;
        const renderer = createRenderer(canvas, scene, sheets, base);
        if (!renderer) return;
        rendererRef.current = { renderer, scene };
        renderer.draw(0);
        setReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      rendererRef.current?.renderer.dispose();
      rendererRef.current = null;
      setReady(false);
    };
  }, [folder, scene, reducedMotion]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // The motion: only while the slide shows and is on screen. (A hidden tab
  // gets no animation frames.)
  React.useEffect(() => {
    const current = rendererRef.current;
    if (!ready || !active || !onScreen || !current) return;
    const { renderer, scene: s } = current;
    let frame = 0;
    const tick = (now: number) => {
      renderer.draw(((now / 1000) * s.speed) % s.loop);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, active, onScreen]);

  return (
    <div ref={rootRef} className={cx(classes.root, className)}>
      {/* The still picture, at once: every scene has one by this name. */}
      <img className={classes.layer} src={`${folder}still.webp`} alt="" fetchPriority="high" />

      <canvas
        ref={canvasRef}
        className={cx(classes.layer, classes.canvas, ready && classes.ready)}
        width={scene?.width ?? 1}
        height={scene?.height ?? 1}
        aria-hidden="true"
      />
    </div>
  );
}
