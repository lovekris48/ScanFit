import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Camera, Upload, Dumbbell, Flame,
  Droplet, Footprints, Moon, Check, UtensilsCrossed, LineChart,
  User, Sparkles, Home, Loader2, Users, ImagePlus, RefreshCw, Send,
  Globe, Heart, Trash2, Filter, RotateCcw, Pill, ClipboardList, ArrowLeft
} from "lucide-react";

/* ---------------------------------------------------------------------
   DESIGN TOKENS
--------------------------------------------------------------------- */
const T = {
  bg: "#0F1113", surface: "#1A1D21", surface2: "#20242A", border: "#2A2E33",
  text: "#F5F3EF", textMuted: "#9A9FA7", textFaint: "#5B5F66",
  accent: "#C9A227", accent2: "#5B8CFF", positive: "#7FA88B", warn: "#D98E4A",
};
const display = { fontFamily: "'Space Grotesk', sans-serif" };
const body = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };

const FEED_KEY = "waypoint-global-feed-v2";
const PROFILE_KEY = "waypoint-profile-v1";
const MY_CHECKS_KEY = "waypoint-my-checks-v1";
const MY_POSTS_KEY = "waypoint-my-post-ids-v1";
const MY_LIKES_KEY = "waypoint-my-likes-v1";

const MUSCLE_TAGS = ["shoulders", "chest", "upper_chest", "back", "lats", "arms", "forearms", "abs", "waist", "glutes", "hamstrings", "quads", "calves", "hips", "leanness", "mass", "strength", "conditioning", "core", "endurance", "symmetry", "definition", "explosiveness", "grip"];

/* ------------------------------ helpers ------------------------------ */

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

function resizeDataUrl(dataUrl, maxWidth = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => reject(new Error("Could not process image"));
    img.src = dataUrl;
  });
}

function stripFences(text) {
  return text.replace(/```json|```/g, "").trim();
}

// Canonical stored units are always cm / kg — these only convert for display/input.
function kgToLbs(kg) { return kg * 2.20462; }
function lbsToKg(lbs) { return lbs / 2.20462; }
function cmToFtIn(cm) {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return { ft, inch };
}
function ftInToCm(ft, inch) { return (ft || 0) * 30.48 + (inch || 0) * 2.54; }

async function callClaudeVisionJSON(images, promptText) {
  const content = [
    ...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } })),
    { type: "text", text: promptText },
  ];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 700, messages: [{ role: "user", content }] }),
  });
  const data = await res.json();
  const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  return JSON.parse(stripFences(text));
}

// Deterministic match: overlap between the AI's returned priority tags and each
// build's predefined emphasis tags. The model never picks the build directly —
// it only describes what it sees, in a fixed vocabulary; this function ranks builds.
function scoreBuild(build, priorities) {
  if (!priorities || !priorities.length) return null;
  const overlap = build.emphasis.filter((e) => priorities.includes(e)).length;
  const denom = Math.max(build.emphasis.length, priorities.length);
  return Math.round((overlap / denom) * 100);
}

async function loadPersonal(key, fallback) {
  try {
    const r = await window.storage.get(key, false);
    return r ? JSON.parse(r.value) : fallback;
  } catch {
    return fallback;
  }
}
async function savePersonal(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), false); } catch { /* best effort */ }
}

/* ------------------------------ atoms ------------------------------ */

function UnitToggle({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 3, background: T.surface2, borderRadius: 8, padding: 2 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={{
          padding: "3px 9px", borderRadius: 6, border: "none", cursor: "pointer",
          background: value === o ? T.accent : "transparent", color: value === o ? "#14110A" : T.textFaint,
          ...mono, fontSize: 10, fontWeight: 600, textTransform: "uppercase",
        }}>{o}</button>
      ))}
    </div>
  );
}

function TickRule({ total, active }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", maxWidth: 160 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: i === active ? 20 : 6, height: 3, borderRadius: 2, background: i <= active ? T.accent : T.border, transition: "all 0.3s ease" }} />
      ))}
    </div>
  );
}

function Ring({ pct, size = 74, stroke = 7, color, label, value, unit }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(pct, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.border} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c - clamped * c} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        <text x="50%" y="47%" textAnchor="middle" fill={T.text} style={{ ...mono, fontSize: 13, fontWeight: 600 }}>{value}</text>
        <text x="50%" y="62%" textAnchor="middle" fill={T.textFaint} style={{ ...mono, fontSize: 8 }}>{unit}</text>
      </svg>
      <div style={{ ...body, fontSize: 11, color: T.textMuted, letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "15px 20px", borderRadius: 12, border: "none",
      background: disabled ? T.border : T.accent, color: disabled ? T.textFaint : "#14110A",
      ...display, fontSize: 15, fontWeight: 600, letterSpacing: 0.2,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: disabled ? "default" : "pointer",
    }}>{children}</button>
  );
}

function GhostButton({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: T.textMuted, ...body, fontSize: 13, cursor: "pointer", padding: 6 }}>
      {children}
    </button>
  );
}

function Card({ children, style }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, ...style }}>{children}</div>;
}

function Header({ eyebrow, title, sub }) {
  return (
    <div>
      <div style={{ ...mono, fontSize: 10.5, color: T.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{eyebrow}</div>
      <div style={{ ...display, fontSize: 20, color: T.text, fontWeight: 600, letterSpacing: -0.3 }}>{title}</div>
      {sub && <div style={{ ...body, fontSize: 12.5, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

/* --------------------------- ONBOARDING STEPS --------------------------- */

function StepWelcome() {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flex: 1, textAlign: "center", padding: "0 8px" }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M4 20 L4 8 M4 8 L4 4 M8 20 L8 12 M8 12 L8 4 M12 20 L12 6 M12 6 L12 4 M16 20 L16 10 M16 10 L16 4 M20 20 L20 14 M20 14 L20 4" stroke={T.accent} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ ...display, fontSize: 28, fontWeight: 600, color: T.text, marginBottom: 10, letterSpacing: -0.5 }}>Waypoint</div>
      <div style={{ ...body, fontSize: 14.5, color: T.textMuted, lineHeight: 1.6, maxWidth: 260 }}>
        See where you are. Choose what you want to become. Get a plan that learns from your real results.
      </div>
    </div>
  );
}

function PhotoSlot({ label, image, onPick }) {
  const inputRef = useRef(null);
  return (
    <button onClick={() => inputRef.current?.click()} style={{
      flex: 1, aspectRatio: "3/4", borderRadius: 14, cursor: "pointer", overflow: "hidden", position: "relative",
      background: image ? "#000" : T.surface, border: `1px solid ${image ? T.accent : T.border}`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 0,
    }}>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
      {image ? (
        <>
          <img src={image} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
          <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 6, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={12} color="#14110A" />
          </div>
          <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, textAlign: "center", ...body, fontSize: 10.5, color: T.text, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{label}</div>
        </>
      ) : (
        <>
          <Camera size={18} color={T.textMuted} />
          <div style={{ ...body, fontSize: 12, color: T.textMuted }}>{label}</div>
        </>
      )}
    </button>
  );
}

function StepScan({ photos, setPhotos, gender, aiAnalysis, setAiAnalysis }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const anyPhoto = photos.front || photos.side || photos.back;

  const pick = (angle) => async (file) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      setPhotos((p) => ({ ...p, [angle]: { dataUrl, mediaType: file.type || "image/jpeg" } }));
      setAiAnalysis(null);
    } catch {
      setError("Couldn't read that photo — try a different file.");
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError("");
    try {
      const images = ["front", "side", "back"].map((a) => photos[a]).filter(Boolean)
        .map((p) => ({ data: p.dataUrl.split(",")[1], mediaType: p.mediaType }));

      const prompt = `You are a fitness coaching assistant reviewing standardized physique-check photos the user submitted themselves inside a fitness app, for training/nutrition personalization.

Context: stated gender = "${gender || "not specified"}". The user has not chosen a target build yet — your "priorities" tags are what will help match them to one next.

Respond with ONLY valid JSON, no markdown fences, no extra commentary, in exactly this shape:
{
  "summary": "3-4 sentence encouraging, non-judgmental, non-clinical read of general observable proportions and structure, in relative/comparative terms only (e.g. shoulder-to-waist ratio, upper/lower balance). Never precise measurements, never a diagnosis, never a comment on attractiveness.",
  "bodyfat_range": "a wide estimated visual range like '15-20%', explicitly a rough visual estimate",
  "priorities": [2 to 4 tags chosen ONLY from this exact list, representing what could use more relative training emphasis: ${MUSCLE_TAGS.join(", ")}]
}`;

      const parsed = await callClaudeVisionJSON(images, prompt);
      setAiAnalysis(parsed);
    } catch (e) {
      setError("Analysis failed — you can still continue without it.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div>
      <Header eyebrow="01 — Starting point" title="Let's see where you're starting" sub="Private by default. Photos are used only to build your baseline." />
      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <PhotoSlot label="Front" image={photos.front?.dataUrl} onPick={pick("front")} />
        <PhotoSlot label="Side" image={photos.side?.dataUrl} onPick={pick("side")} />
        <PhotoSlot label="Back" image={photos.back?.dataUrl} onPick={pick("back")} />
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, color: T.textFaint, ...body, fontSize: 11.5 }}>
        <Upload size={12} /> Tap a slot to take a photo or choose one from your library
      </div>

      {anyPhoto && !aiAnalysis && (
        <button onClick={runAnalysis} disabled={analyzing} style={{
          marginTop: 16, width: "100%", padding: "13px 16px", borderRadius: 12,
          background: "rgba(201,162,39,0.08)", border: `1px solid ${T.accent}`, cursor: analyzing ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: T.accent, ...display, fontSize: 13.5, fontWeight: 500,
        }}>
          {analyzing ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
          {analyzing ? "Analyzing your photos…" : "Analyze with AI"}
        </button>
      )}

      {error && <div style={{ marginTop: 12, ...body, fontSize: 12, color: T.warn }}>{error}</div>}

      {aiAnalysis && (
        <Card style={{ marginTop: 16, background: T.surface2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <Sparkles size={13} color={T.accent} />
            <div style={{ ...display, fontSize: 12.5, color: T.accent, fontWeight: 600, letterSpacing: 0.3 }}>AI READ</div>
          </div>
          <div style={{ ...body, fontSize: 12.5, color: T.text, lineHeight: 1.6 }}>{aiAnalysis.summary}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <div>
              <div style={{ ...mono, fontSize: 9.5, color: T.textFaint, textTransform: "uppercase" }}>Est. visual range</div>
              <div style={{ ...mono, fontSize: 14, color: T.text, marginTop: 2 }}>{aiAnalysis.bodyfat_range}</div>
            </div>
          </div>
          {aiAnalysis.priorities?.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {aiAnalysis.priorities.map((p) => (
                <div key={p} style={{ ...mono, fontSize: 10, color: T.accent2, background: "rgba(91,140,255,0.1)", padding: "4px 9px", borderRadius: 7, textTransform: "capitalize" }}>{p}</div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card style={{ marginTop: 16 }}>
        <div style={{ ...body, fontSize: 11.5, color: T.textMuted, lineHeight: 1.6 }}>
          Estimates from photos are always ranges, never exact. You can skip this step and still get a plan from your basic stats.
        </div>
      </Card>
    </div>
  );
}

function StepProfile({ profile, setProfile }) {
  const heightUnit = profile.heightUnit || "cm";
  const weightUnit = profile.weightUnit || "kg";
  const heightCm = parseFloat(profile.height) || 0;
  const weightKg = parseFloat(profile.weight) || 0;
  const { ft, inch } = cmToFtIn(heightCm);

  const setHeightCm = (cm) => setProfile((p) => ({ ...p, height: String(Math.round(cm)) }));
  const setWeightKg = (kg) => setProfile((p) => ({ ...p, weight: String(Math.round(kg * 10) / 10) }));

  const numInput = (value, onChange, width = 52) => (
    <input value={value} onChange={onChange} inputMode="decimal"
      style={{ width, background: "transparent", border: "none", textAlign: "right", color: T.text, ...mono, fontSize: 16, outline: "none" }} />
  );

  const row = (label, unitToggle, content) => (
    <div style={{ padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ ...body, fontSize: 14, color: T.textMuted }}>{label}</div>
        {unitToggle || null}
      </div>
      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>{content}</div>
    </div>
  );

  const levels = ["Beginner", "Intermediate", "Advanced"];

  return (
    <div>
      <Header eyebrow="02 — Basics" title="A few numbers to work from" sub="Used for your calorie and training math — nothing here is shared." />
      <div style={{ marginTop: 18 }}>
        {row(
          "Height",
          <UnitToggle options={["cm", "ft"]} value={heightUnit} onChange={(u) => setProfile((p) => ({ ...p, heightUnit: u }))} />,
          heightUnit === "cm" ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              {numInput(profile.height, (e) => setProfile((p) => ({ ...p, height: e.target.value })))}
              <span style={{ ...mono, fontSize: 12, color: T.textFaint }}>cm</span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                {numInput(ft, (e) => setHeightCm(ftInToCm(parseFloat(e.target.value) || 0, inch)), 30)}
                <span style={{ ...mono, fontSize: 12, color: T.textFaint }}>ft</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                {numInput(inch, (e) => setHeightCm(ftInToCm(ft, parseFloat(e.target.value) || 0)), 30)}
                <span style={{ ...mono, fontSize: 12, color: T.textFaint }}>in</span>
              </div>
            </div>
          )
        )}
        {row(
          "Weight",
          <UnitToggle options={["kg", "lbs"]} value={weightUnit} onChange={(u) => setProfile((p) => ({ ...p, weightUnit: u }))} />,
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            {numInput(
              weightUnit === "kg" ? profile.weight : (Math.round(kgToLbs(weightKg) * 10) / 10 || ""),
              (e) => {
                const v = parseFloat(e.target.value) || 0;
                weightUnit === "kg" ? setWeightKg(v) : setWeightKg(lbsToKg(v));
              }
            )}
            <span style={{ ...mono, fontSize: 12, color: T.textFaint }}>{weightUnit}</span>
          </div>
        )}
        {row(
          "Age",
          null,
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            {numInput(profile.age, (e) => setProfile((p) => ({ ...p, age: e.target.value })))}
            <span style={{ ...mono, fontSize: 12, color: T.textFaint }}>yrs</span>
          </div>
        )}
      </div>
      <div style={{ ...body, fontSize: 12, color: T.textFaint, marginTop: 18, marginBottom: 8, letterSpacing: 0.4, textTransform: "uppercase" }}>Training experience</div>
      <div style={{ display: "flex", gap: 8 }}>
        {levels.map((l) => (
          <button key={l} onClick={() => setProfile((p) => ({ ...p, level: l }))} style={{
            flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer",
            background: profile.level === l ? T.accent : T.surface, border: `1px solid ${profile.level === l ? T.accent : T.border}`,
            color: profile.level === l ? "#14110A" : T.textMuted, ...body, fontSize: 12.5, fontWeight: 500,
          }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function StepGender({ gender, setGender }) {
  const options = [{ key: "female", label: "Female" }, { key: "male", label: "Male" }, { key: "unspecified", label: "Prefer not to say" }];
  return (
    <div>
      <Header eyebrow="03 — Personalize" title="What's your gender?" sub="Shapes which builds we surface first — every build stays available either way." />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {options.map((o) => {
          const active = gender === o.key;
          return (
            <button key={o.key} onClick={() => setGender(o.key)} style={{
              padding: "16px 16px", borderRadius: 14, cursor: "pointer", textAlign: "left",
              background: active ? "rgba(201,162,39,0.08)" : T.surface, border: `1px solid ${active ? T.accent : T.border}`,
              color: active ? T.accent : T.text, ...display, fontSize: 14.5, fontWeight: 500,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>{o.label}{active && <Check size={16} color={T.accent} />}</button>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// BUILD LIBRARY — every build carries a real underlying profile, not just
// a label: which muscles/qualities it prioritizes (emphasis, used for
// deterministic AI-read matching), training style, volume distribution,
// strength/cardio emphasis, body-composition direction, nutrition
// strategy, and what "progress" looks like for that build.
// `category` is 'universal' | 'male' | 'female' — used ONLY to decide
// which builds are suggested first. Nothing is ever gender-locked; every
// build is selectable from "Explore All Builds" regardless of gender.
// --------------------------------------------------------------------

function mk(key, label, category, emphasis, trainingStyle, volumeDistribution, strengthCardioEmphasis, bodyCompDirection, nutritionStrategy, progressCriteria, description) {
  return { key, label, category, emphasis, description, profile: { trainingStyle, volumeDistribution, strengthCardioEmphasis, bodyCompDirection, nutritionStrategy, progressCriteria } };
}

const BUILD_LIBRARY = [
  // ---------------- Universal ----------------
  mk("recomp", "Recomp", "universal", ["mass", "leanness", "strength"], "Full-body, moderate volume", "Even across all major groups", "Balanced, light cardio", "Build muscle and lose fat at once", "Small deficit-to-maintenance, high protein", "Strength up, waist down, scale flat", "Build muscle and lose fat at the same time"),
  mk("lean_toned", "Lean & Toned", "universal", ["leanness", "definition", "core"], "Moderate volume, higher rep ranges", "Full-body with a core/glute lean", "Light-moderate cardio", "Lean, defined, not bulky", "Slight deficit, high protein", "Visible definition, measurements trending down", "Visible tone without significant added bulk"),
  mk("lean_muscular", "Lean Muscular", "universal", ["mass", "leanness", "symmetry"], "Hypertrophy split, moderate-high volume", "Even, slight upper-body lean", "Moderate cardio", "Muscle gain at low-moderate body-fat", "Maintenance-to-slight surplus, high protein", "Size and definition both trending up", "Visible muscle carried at a lean body-fat"),
  mk("athletic", "Athletic", "universal", ["conditioning", "strength", "symmetry"], "Strength + conditioning hybrid", "Full-body, functional emphasis", "Balanced strength and cardio", "Performance-first, lean but not shredded", "Maintenance, performance-fueled", "Strength, conditioning, and body-comp all improving", "A capable, performance-first look — function over show"),
  mk("shredded", "Shredded", "universal", ["leanness", "definition", "abs"], "Maintain muscle through a cut", "Full-body, high frequency", "Higher cardio volume", "Very low visible body-fat", "Sustained deficit, very high protein", "Visible striation/separation, strength holding steady", "Maximum visible muscle definition, low body-fat"),
  mk("beach", "Beach Body", "universal", ["leanness", "shoulders", "abs"], "Moderate volume, upper-body lean", "Shoulders/abs priority, rest maintained", "Light-moderate cardio", "Lean and proportionate, minimal bulk", "Slight deficit", "Waist/shoulder ratio improving", "Lean and proportionate for warm-weather confidence"),
  mk("model", "Model", "universal", ["leanness", "symmetry", "core"], "Moderate volume, posture-focused", "Even, postural muscles prioritized", "Light cardio, mobility work", "Lean, elongated, proportionate", "Slight deficit, steady", "Posture, symmetry, and skin-fold trend", "Lean, proportionate, camera- and posture-ready"),
  mk("sleeper", "Sleeper Build", "universal", ["mass", "strength"], "Strength-biased hypertrophy", "Even, function over show", "Strength-leaning", "Understated size, real strength underneath", "Maintenance-to-surplus", "Strength numbers climbing more than the mirror", "Deceptively strong and built — understated, not flashy"),
  mk("functional", "Functional", "universal", ["core", "strength", "conditioning"], "Compound-movement, functional patterns", "Full-body, core-anchored", "Balanced strength and conditioning", "Capable and durable, not aesthetics-first", "Maintenance, nutrient-dense", "Daily-life strength and mobility improving", "Strength and mobility built for real-world capability"),
  mk("longevity", "Longevity / Fit", "universal", ["conditioning", "core", "endurance"], "Moderate strength + steady cardio", "Full-body, joint-friendly", "Cardio and mobility-forward", "Sustainable, healthy body composition", "Maintenance, whole-food focused", "Consistency, resting heart rate, mobility", "Sustainable fitness built for the long run"),
  mk("lean_bulk", "Lean Bulk", "universal", ["mass", "strength"], "Progressive-overload hypertrophy", "Even, priority on lagging groups", "Strength-leaning", "Gradual size gain, fat gain minimized", "Small consistent surplus, high protein", "Weight and strength climbing slowly, waist stable", "Steady muscle gain while keeping fat gain minimal"),
  mk("mass_gain", "Mass Gain", "universal", ["mass", "strength"], "High-volume hypertrophy", "Even, heavy compound base", "Strength-leaning", "Maximum size, fat gain accepted", "Larger surplus, high overall calories", "Weight and lifts climbing steadily", "Prioritizes total size — some fat gain is expected"),
  mk("natural_bb", "Natural Bodybuilder", "universal", ["mass", "symmetry", "definition"], "Classic hypertrophy split", "Even development across all groups", "Minimal cardio except pre-event", "Maximum natural muscle at low body-fat", "Cycled surplus/deficit phases", "Symmetry and muscle maturity over time", "Balanced, proportionate muscle built without shortcuts"),
  mk("powerbuilder", "Powerbuilder", "universal", ["strength", "mass"], "Heavy compounds + hypertrophy accessories", "Big-lift priority, accessory volume after", "Strength-leaning, minimal cardio", "Size and strength together", "Slight surplus, high protein", "1RM and muscle size both climbing", "Serious strength with real muscle size to match"),
  mk("powerlifter", "Powerlifter", "universal", ["strength"], "Squat/bench/deadlift specialization", "Concentrated on the big three + support work", "Strength-only, cardio minimal", "Whatever body-fat supports max strength", "Surplus geared to performance, not looks", "Total across the big three lifts", "Built entirely around maximal strength in the big lifts"),
  mk("hybrid", "Hybrid Athlete", "universal", ["strength", "conditioning"], "Strength days + conditioning days", "Split evenly between the two", "True balance of strength and cardio", "Performance across both domains", "Higher calories to fuel both", "Strength numbers and conditioning times both improving", "Strong and conditioned — competitive in both worlds"),
  mk("hyrox", "HYROX", "universal", ["conditioning", "endurance", "strength"], "Race-simulation + strength conditioning", "Legs and conditioning-station priority", "Cardio-leaning with strength support", "Lean and highly conditioned", "Higher carb, performance-fueled", "Race splits and station times", "Trained specifically for HYROX-style functional racing"),
  mk("crossfit", "CrossFit", "universal", ["conditioning", "strength", "explosiveness"], "Varied high-intensity functional work", "Broad, skill and strength mixed", "High-intensity conditioning + strength", "Lean, powerful, capable", "Higher calories, performance-fueled", "WOD times, lift PRs, skill progressions", "Broad, varied fitness across strength, skill, and conditioning"),
  mk("calisthenics", "Calisthenics", "universal", ["core", "strength", "symmetry"], "Bodyweight skill + strength progressions", "Pull/push/core balanced", "Strength and control-focused", "Lean, controlled, skill-capable", "Maintenance-to-slight deficit", "New skills unlocked, control under load", "Bodyweight mastery — strength, control, and skill"),
  mk("gymnast", "Gymnast", "universal", ["core", "strength", "symmetry", "explosiveness"], "Strength, control, and explosive power", "Core and shoulder-girdle heavy", "Explosive strength, high control", "Very lean, highly proportionate", "Precise, performance-timed", "Skill mastery and strength-to-weight ratio", "Extreme control, strength-to-weight ratio, and explosive power"),
  mk("sprinter", "Sprinter", "universal", ["explosiveness", "quads", "hamstrings"], "Explosive power + sprint mechanics", "Posterior-chain and hip priority", "Power and short-burst conditioning", "Lean, powerful lower body", "Performance-fueled, carb-timed", "Sprint times and power output", "Built for maximal short-burst speed and power"),
  mk("runner", "Runner", "universal", ["endurance", "calves", "conditioning"], "Aerobic base + strength support", "Lower-body endurance priority", "Endurance-dominant", "Lean, efficient", "Higher carb, endurance-fueled", "Pace, distance, and recovery trends", "Built around sustained aerobic endurance and efficiency"),
  mk("swimmer", "Swimmer", "universal", ["shoulders", "lats", "conditioning"], "Upper-body endurance + full-body conditioning", "Shoulders/lats priority", "Endurance with upper-body strength", "Lean, broad upper body", "Higher calories, endurance-fueled", "Pace and stroke-endurance trends", "Broad, upper-body-dominant conditioning built for the water"),
  mk("combat", "Combat Athlete", "universal", ["core", "explosiveness", "conditioning"], "Explosive strength + high-output conditioning", "Core and hip-rotation priority", "Power and conditioning combined", "Lean, powerful, weight-class aware", "Precise, often weight-managed", "Power output and conditioning under fatigue", "Explosive power and conditioning for combat sports"),
  mk("climber", "Climber", "universal", ["forearms", "back", "core", "grip"], "Grip, pulling strength, and core control", "Back/forearm/core priority", "Strength-to-weight focused, light cardio", "Lean, low excess mass", "Maintenance-to-slight deficit", "Grip endurance and strength-to-weight ratio", "Grip and pulling strength built for climbing"),
  mk("balanced", "Balanced / Symmetrical", "universal", ["symmetry", "mass"], "Even hypertrophy across every group", "Deliberately even, no lagging group", "Balanced strength and cardio", "Proportionate muscle gain", "Maintenance-to-slight surplus", "No group left behind relative to the rest", "Proportionate development with no single dominant area"),
  mk("upper_focus", "Upper-Body Focused", "universal", ["chest", "back", "shoulders", "arms"], "Upper-body priority split", "Heavier upper volume, lower maintained", "Strength-leaning upper body", "Upper-body size and definition", "Maintenance-to-slight surplus", "Upper-body measurements and lifts climbing", "Extra volume and priority on the upper body"),
  mk("lower_focus", "Lower-Body Focused", "universal", ["glutes", "quads", "hamstrings"], "Lower-body priority split", "Heavier lower volume, upper maintained", "Strength-leaning lower body", "Lower-body size and definition", "Maintenance-to-slight surplus", "Lower-body measurements and lifts climbing", "Extra volume and priority on the lower body"),

  // ---------------- Male-Popular ----------------
  mk("vtaper", "V-Taper", "male", ["shoulders", "lats", "waist"], "Shoulder/back hypertrophy, waist-conscious", "Heavy shoulders and lats, controlled waist", "Moderate cardio", "Wide upper, tapered waist", "Maintenance-to-slight deficit", "Shoulder-to-waist ratio trending wider", "Wide shoulders and back tapering to a narrow waist"),
  mk("classic_physique", "Classic Physique", "male", ["symmetry", "mass", "definition"], "Golden-era hypertrophy split", "Balanced with a shoulder/waist emphasis", "Light cardio", "Muscular but proportionate, defined", "Cycled surplus/deficit", "Symmetry and aesthetic lines", "Proportionate, defined muscle in the golden-era style"),
  mk("mens_physique", "Men's Physique", "male", ["shoulders", "leanness", "abs"], "Upper-body hypertrophy, lean maintenance", "Shoulders/chest/arms priority", "Light-moderate cardio", "Lean, beach-and-stage-ready upper body", "Slight deficit, high protein", "Upper-body size and leanness", "Lean, aesthetic upper body built for the stage or beach"),
  mk("bodybuilder", "Bodybuilder", "male", ["mass", "definition", "symmetry"], "High-volume hypertrophy split", "Even, maximal across all groups", "Minimal cardio except pre-event", "Maximum size at competition leanness", "Structured bulk/cut phases", "Total muscle mass and stage conditioning", "Maximum muscle size and stage-level conditioning"),
  mk("mass_monster", "Mass Monster", "male", ["mass", "strength"], "Maximum-volume hypertrophy", "Even, size over all else", "Minimal cardio", "Maximum total size", "Large sustained surplus", "Weight and circumference climbing steadily", "Prioritizes the largest possible total muscle mass"),
  mk("greek_classical", "Greek / Classical", "male", ["symmetry", "shoulders", "waist"], "Proportion-focused hypertrophy", "Even with a shoulder/waist emphasis", "Light cardio", "Sculptural proportion over raw size", "Maintenance, steady", "Proportion and symmetry over absolute size", "Classical, sculptural proportion over maximal size"),
  mk("superhero", "Superhero", "male", ["shoulders", "chest", "abs"], "Upper-body hypertrophy, lean maintenance", "Shoulders/chest/abs priority", "Moderate cardio", "Broad, lean, powerful-looking", "Slight deficit, high protein", "Upper-body size and visible abs", "Broad, powerful upper-body look with visible definition — general characteristics, not a claim of any specific likeness"),
  mk("toji_inspired", "Toji-Inspired", "male", ["shoulders", "back", "leanness"], "Dense strength-hypertrophy", "Back/shoulder priority, lean overall", "Strength-leaning", "Dense, athletic, not bulky", "Maintenance, high protein", "Strength-to-size ratio and leanness", "Dense, athletic build emphasizing lean strength over bulk — a physique direction, not a claim of any specific likeness"),
  mk("baki_inspired", "Baki-Inspired", "male", ["mass", "strength", "definition"], "Extreme-density hypertrophy", "Even, maximal density everywhere", "Strength-leaning, minimal cardio", "Very dense, highly defined muscle", "Structured surplus/deficit phases", "Muscle density and definition over time", "Extremely dense, highly defined muscle — a physique direction, not a claim of any specific likeness"),
  mk("stocky_muscular", "Stocky / Muscular", "male", ["mass", "strength", "waist"], "Heavy compound hypertrophy", "Even, thick overall build", "Strength-leaning", "Thick, dense, powerful build", "Surplus, high overall calories", "Total mass and lift numbers", "A thick, powerful, densely-built frame"),
  mk("strongman", "Strongman", "male", ["strength", "mass", "grip"], "Max-strength + odd-object training", "Full-body, grip and posterior-chain heavy", "Strength and power-dominant", "Large, maximally strong", "High-calorie, performance-fueled", "Event/lift totals over time", "Built around maximal strength across odd-object events"),
  mk("dad_strength", "Dad Strength", "male", ["strength", "core", "conditioning"], "Practical full-body strength", "Full-body, low time-commitment", "Balanced strength and light cardio", "Sturdy, capable, not aesthetics-first", "Maintenance, sustainable", "Everyday strength and energy levels", "Practical, sustainable strength for everyday life"),

  // ---------------- Female-Popular ----------------
  mk("hourglass", "Hourglass", "female", ["waist", "glutes", "shoulders"], "Glute/shoulder hypertrophy, waist-conscious", "Glutes and shoulders prioritized, waist controlled", "Moderate cardio", "Curved, waist-defined silhouette", "Maintenance-to-slight deficit", "Waist-to-hip ratio and shoulder shape", "A curved silhouette with a defined waist"),
  mk("xframe", "X-Frame", "female", ["shoulders", "quads", "waist"], "Shoulder/leg hypertrophy, waist-conscious", "Shoulders and quads prioritized", "Moderate cardio", "Broader shoulders and legs, narrow waist", "Maintenance-to-slight deficit", "Shoulder/leg development vs. waist", "Broader shoulders and legs framing a narrow waist"),
  mk("slim_thick", "Slim-Thick", "female", ["glutes", "waist", "hamstrings"], "Glute/hamstring hypertrophy, upper maintained", "Lower-body heavy, upper maintained", "Light cardio", "Fuller lower body, defined waist", "Maintenance-to-slight surplus", "Glute/hamstring size vs. waist measurement", "A fuller lower body paired with a defined waist"),
  mk("glute_focused", "Glute-Focused", "female", ["glutes", "hamstrings"], "Glute-specialization hypertrophy", "Glutes/hamstrings dominant, rest maintained", "Light cardio", "Maximum lower-body development", "Maintenance-to-slight surplus", "Glute/hamstring size and strength", "Maximum development concentrated in the glutes and hamstrings"),
  mk("bikini", "Bikini", "female", ["leanness", "glutes", "shoulders"], "Glute/shoulder hypertrophy, lean maintenance", "Glutes and shoulders prioritized", "Moderate cardio", "Lean, toned, stage-polished", "Slight deficit, high protein", "Leanness and glute/shoulder shape", "Lean, toned, competition-polished physique"),
  mk("wellness", "Wellness", "female", ["glutes", "hamstrings", "quads"], "High-volume lower-body hypertrophy", "Lower-body dominant, athletic upper", "Light cardio", "Fuller, athletic lower body", "Maintenance-to-slight surplus", "Lower-body size relative to upper", "A fuller, athletic lower body with a toned upper"),
  mk("figure", "Figure", "female", ["shoulders", "waist", "glutes"], "Balanced upper/lower hypertrophy", "Shoulders and glutes prioritized, waist controlled", "Moderate cardio", "Athletic muscularity with curves", "Slight deficit, high protein", "Muscularity and waist definition together", "Athletic, muscular curves with a defined waist"),
  mk("womens_physique", "Women's Physique", "female", ["mass", "definition", "shoulders"], "Higher-volume hypertrophy split", "Even, muscular development", "Minimal cardio except pre-event", "Muscular, athletic competition look", "Structured surplus/deficit phases", "Total muscularity and stage conditioning", "A muscular, athletic competition physique"),
  mk("womens_bb", "Women's Bodybuilding", "female", ["mass", "strength", "definition"], "Maximal hypertrophy split", "Even, maximal across all groups", "Minimal cardio except pre-event", "Maximum muscle size at competition leanness", "Structured bulk/cut phases", "Total mass and stage conditioning", "Maximum muscular development at competition conditioning"),
  mk("pilates_physique", "Pilates Physique", "female", ["core", "leanness"], "Control-based, high-rep bodyweight/light-load work", "Core and postural priority", "Light, control-focused", "Long, lean, low bulk", "Maintenance-to-slight deficit", "Control, posture, and endurance under light load", "A long, lean, control-focused physique"),
  mk("pilates_strength", "Pilates + Strength", "female", ["core", "glutes", "strength"], "Pilates control work + added resistance training", "Core/glute priority with real load", "Moderate strength, light cardio", "Lean with visible muscle tone", "Maintenance, high protein", "Strength gains alongside control and posture", "Pilates-style control combined with real strength training"),
  mk("athletic_feminine", "Athletic Feminine", "female", ["conditioning", "leanness", "symmetry"], "Strength + conditioning hybrid", "Full-body, functional emphasis", "Balanced strength and cardio", "Lean, capable, performance-first", "Maintenance, performance-fueled", "Strength and conditioning trends together", "A lean, capable, performance-first athletic look"),
  mk("muscle_mommy", "Muscle Mommy", "female", ["mass", "glutes", "arms"], "Heavier hypertrophy split", "Arms/glutes prioritized, even overall", "Strength-leaning", "Visible muscle mass, unapologetically built", "Surplus-to-maintenance, high protein", "Muscle size and strength climbing", "Visible, unapologetic muscle mass and strength"),
  mk("strongwoman", "Strongwoman", "female", ["strength", "mass", "grip"], "Max-strength + odd-object training", "Full-body, grip and posterior-chain heavy", "Strength and power-dominant", "Strong, powerfully built", "High-calorie, performance-fueled", "Event/lift totals over time", "Built around maximal strength across odd-object events"),
];

// "Create My Own" priorities → underlying tags used for the same deterministic
// scoring/matching the AI-read builds use. Combining these produces a real
// (if generic) profile rather than just a label — see getSelectedBuild below.
const CUSTOM_PRIORITIES = [
  { label: "Bigger Chest", tags: ["chest"] },
  { label: "Upper Chest", tags: ["chest", "upper_chest"] },
  { label: "Wider Shoulders", tags: ["shoulders"] },
  { label: "Bigger Arms", tags: ["arms"] },
  { label: "Wider Back", tags: ["back"] },
  { label: "Thicker Back", tags: ["back", "lats"] },
  { label: "Smaller-Waist Appearance", tags: ["waist"] },
  { label: "Bigger Glutes", tags: ["glutes"] },
  { label: "Bigger Quads", tags: ["quads"] },
  { label: "Bigger Hamstrings", tags: ["hamstrings"] },
  { label: "Bigger Calves", tags: ["calves"] },
  { label: "Defined Abs", tags: ["abs", "definition"] },
  { label: "Stronger Core", tags: ["core"] },
  { label: "More Definition", tags: ["definition", "leanness"] },
  { label: "More Size", tags: ["mass"] },
  { label: "More Strength", tags: ["strength"] },
  { label: "Better Endurance", tags: ["endurance", "conditioning"] },
];

function getSelectedBuild(buildKey, customPriorities) {
  if (!buildKey) return null;
  if (buildKey === "custom") {
    const tags = Array.from(new Set((customPriorities || []).flatMap((label) => CUSTOM_PRIORITIES.find((p) => p.label === label)?.tags || [])));
    const leaning = tags.includes("strength") ? "Strength-leaning" : (tags.includes("endurance") || tags.includes("conditioning")) ? "Conditioning-leaning" : "Balanced";
    const direction = tags.includes("mass") ? "Muscle gain" : (tags.includes("leanness") || tags.includes("definition")) ? "Fat loss / definition" : "Recomposition";
    return {
      key: "custom", label: "Custom Build", category: "custom", emphasis: tags,
      description: customPriorities?.length ? `Combines: ${customPriorities.join(", ")}` : "No priorities chosen yet",
      profile: {
        trainingStyle: "Extra volume weighted toward your chosen priorities",
        volumeDistribution: customPriorities?.length ? customPriorities.join(", ") : "Not yet set",
        strengthCardioEmphasis: leaning,
        bodyCompDirection: direction,
        nutritionStrategy: "Calculated from your stats, adjusted toward your composition direction",
        progressCriteria: "Strength and measurement trends on your selected priority areas",
      },
    };
  }
  return BUILD_LIBRARY.find((b) => b.key === buildKey) || null;
}

function getRecommendedBuilds(gender, aiAnalysis) {
  const pool = [
    ...(gender && gender !== "unspecified" ? BUILD_LIBRARY.filter((b) => b.category === gender) : []),
    ...BUILD_LIBRARY.filter((b) => b.category === "universal"),
  ];
  const scored = pool.map((b) => ({ ...b, match: scoreBuild(b, aiAnalysis?.priorities) }));
  scored.sort((a, b) => (b.match ?? -1) - (a.match ?? -1));
  return scored.slice(0, 6);
}

const CATEGORY_LABEL = { universal: "Universal", male: "Male-Popular", female: "Female-Popular" };

function BuildCard({ b, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
      padding: "14px 16px", borderRadius: 14, cursor: "pointer", textAlign: "left",
      background: active ? "rgba(201,162,39,0.08)" : T.surface, border: `1px solid ${active ? T.accent : T.border}`,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ ...display, fontSize: 14, color: active ? T.accent : T.text, fontWeight: 500 }}>{b.label}</div>
          {b.isTop && <div style={{ ...mono, fontSize: 8.5, color: T.accent, background: "rgba(201,162,39,0.12)", padding: "2px 6px", borderRadius: 5 }}>BEST MATCH</div>}
        </div>
        <div style={{ ...body, fontSize: 11.5, color: T.textMuted, marginTop: 3 }}>{b.description}</div>
        {b.match !== null && b.match !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
            <div style={{ flex: 1, height: 3, background: T.border, borderRadius: 2, maxWidth: 80 }}>
              <div style={{ width: `${b.match}%`, height: "100%", background: T.accent2, borderRadius: 2 }} />
            </div>
            <div style={{ ...mono, fontSize: 9, color: T.accent2 }}>{b.match}% match</div>
          </div>
        )}
      </div>
      {active && <Check size={16} color={T.accent} style={{ flexShrink: 0, marginLeft: 8 }} />}
    </button>
  );
}

function CustomBuildEditor({ selected, setSelected, onCancel, onSave }) {
  const toggle = (label) => setSelected((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]));
  return (
    <div>
      <Header eyebrow="Create My Own" title="Combine what matters to you" sub="Pick as many priorities as you want — training volume gets weighted toward these." />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
        {CUSTOM_PRIORITIES.map((p) => {
          const active = selected.includes(p.label);
          return (
            <button key={p.label} onClick={() => toggle(p.label)} style={{
              padding: "8px 13px", borderRadius: 20, cursor: "pointer",
              background: active ? T.accent : T.surface, border: `1px solid ${active ? T.accent : T.border}`,
              color: active ? "#14110A" : T.textMuted, ...body, fontSize: 12, fontWeight: 500,
            }}>{p.label}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 24, alignItems: "center" }}>
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
        <div style={{ flex: 1 }}><PrimaryButton onClick={onSave} disabled={selected.length === 0}>Save Custom Build</PrimaryButton></div>
      </div>
    </div>
  );
}

function StepBuild({ gender, build, setBuild, customPriorities, setCustomPriorities, aiAnalysis }) {
  const [mode, setMode] = useState("recommended"); // recommended | all | custom

  if (mode === "custom") {
    return (
      <CustomBuildEditor
        selected={customPriorities} setSelected={setCustomPriorities}
        onCancel={() => setMode("recommended")}
        onSave={() => { setBuild("custom"); setMode("recommended"); }}
      />
    );
  }

  const recommended = getRecommendedBuilds(gender, aiAnalysis).map((b, i) => ({ ...b, isTop: i === 0 && !!aiAnalysis?.priorities?.length }));
  const selectedBuild = getSelectedBuild(build, customPriorities);

  return (
    <div>
      <Header
        eyebrow="04 — Specifics" title="Pick a target build"
        sub={mode === "all" ? "The full library — every build is open to everyone." : aiAnalysis?.priorities?.length ? "Ranked against what your scan showed." : "A short list to start — explore the full library any time."}
      />

      {selectedBuild && (
        <Card style={{ marginTop: 16, background: T.surface2, borderColor: T.accent }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ ...mono, fontSize: 9.5, color: T.accent, letterSpacing: 0.5, textTransform: "uppercase" }}>Selected</div>
              <div style={{ ...display, fontSize: 15, color: T.text, fontWeight: 600, marginTop: 3 }}>{selectedBuild.label}</div>
              <div style={{ ...body, fontSize: 11.5, color: T.textMuted, marginTop: 3 }}>{selectedBuild.description}</div>
            </div>
            {build === "custom" && <GhostButton onClick={() => setMode("custom")}>Edit</GhostButton>}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {mode === "recommended" && recommended.map((b) => <BuildCard key={b.key} b={b} active={build === b.key} onClick={() => setBuild(b.key)} />)}
        {mode === "all" && ["universal", "male", "female"].map((cat) => {
          const list = BUILD_LIBRARY.filter((b) => b.category === cat).map((b) => ({ ...b, match: scoreBuild(b, aiAnalysis?.priorities) }));
          return (
            <div key={cat}>
              <div style={{ ...mono, fontSize: 10, color: T.textFaint, letterSpacing: 0.6, textTransform: "uppercase", margin: "10px 0 8px" }}>{CATEGORY_LABEL[cat]}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {list.map((b) => <BuildCard key={b.key} b={b} active={build === b.key} onClick={() => setBuild(b.key)} />)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <GhostButton onClick={() => setMode(mode === "all" ? "recommended" : "all")}>{mode === "all" ? "Show recommended only" : "Explore All Builds"}</GhostButton>
        <GhostButton onClick={() => setMode("custom")}>Create My Own</GhostButton>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Deterministic plan math — the LLM never touches these numbers. Calorie/
// macro targets use Mifflin-St Jeor + an activity multiplier from
// experience level, then are adjusted by the *build's own emphasis tags*
// (not a free-text guess) so different builds genuinely produce different
// targets. A minimum-fat floor is enforced so no build can generate an
// unsafely low fat target.
// --------------------------------------------------------------------

const ABSTRACT_TAGS = ["leanness", "mass", "strength", "conditioning", "endurance", "symmetry", "definition", "explosiveness"];

function computePlan(profile, gender, selectedBuild) {
  const weightKg = parseFloat(profile.weight) || 75;
  const heightCm = parseFloat(profile.height) || 175;
  const age = parseFloat(profile.age) || 27;

  const bmrMale = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const bmrFemale = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const bmr = gender === "male" ? bmrMale : gender === "female" ? bmrFemale : (bmrMale + bmrFemale) / 2;

  const activityMult = profile.level === "Beginner" ? 1.4 : profile.level === "Advanced" ? 1.7 : 1.55;
  const tdee = bmr * activityMult;

  const emphasis = selectedBuild?.emphasis || [];
  const hasMass = emphasis.includes("mass");
  const hasLean = emphasis.includes("leanness") || emphasis.includes("definition");
  const compClass = hasMass && hasLean ? "recomp" : hasMass ? "surplus" : hasLean ? "deficit" : "maintenance";

  const calMult = { surplus: 1.10, deficit: 0.80, recomp: 0.95, maintenance: 1.0 }[compClass];
  const calories = Math.round(tdee * calMult);

  const proteinFactor = { surplus: 1.8, deficit: 2.2, recomp: 2.0, maintenance: 1.8 }[compClass];
  const protein = Math.round(weightKg * proteinFactor);

  const enduranceLeaning = emphasis.includes("endurance") || emphasis.includes("conditioning");
  const carbFactor = enduranceLeaning ? 4.2 : compClass === "deficit" ? 2.4 : compClass === "surplus" ? 3.8 : 3.2;
  let carbs = Math.round(weightKg * carbFactor);
  let fat = Math.round((calories - protein * 4 - carbs * 4) / 9);

  // Safety floor: never let fat fall below 0.6g/kg — pull the difference from carbs instead.
  const minFat = Math.round(weightKg * 0.6);
  if (fat < minFat) {
    const shortfallCals = (minFat - fat) * 9;
    carbs = Math.max(Math.round(weightKg * 1.5), carbs - Math.round(shortfallCals / 4));
    fat = minFat;
  }

  const days = profile.level === "Beginner" ? 3 : profile.level === "Advanced" ? 5 : 4;
  const split = emphasis.includes("strength") && !hasMass ? "Full-Body Strength"
    : enduranceLeaning ? (days >= 5 ? "Hybrid Strength + Conditioning" : "Full-Body + Conditioning")
    : days >= 5 ? "Push / Pull / Legs" : days === 4 ? "Upper / Lower" : "Full-Body";

  const priorityMuscles = emphasis.filter((t) => !ABSTRACT_TAGS.includes(t));

  return { calories, protein, carbs, fat, days, split, compClass, priorityMuscles };
}

const COMP_CLASS_LABEL = {
  surplus: "Calorie surplus — muscle gain priority",
  deficit: "Calorie deficit — fat loss priority",
  recomp: "Small deficit-to-maintenance — recomposition",
  maintenance: "Maintenance calories — performance-fueled",
};

function StepPlan({ profile, gender, build, customPriorities }) {
  const selectedBuild = getSelectedBuild(build, customPriorities);
  const plan = computePlan(profile, gender, selectedBuild);

  return (
    <div>
      <Header eyebrow="Your plan" title={selectedBuild ? `Built around ${selectedBuild.label}` : "Here's where to start"} sub="Ranges will narrow as your logs and photos come in." />
      <Card style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ ...body, fontSize: 12, color: T.textMuted }}>Daily calories</div>
          <div style={{ ...mono, fontSize: 22, color: T.accent, fontWeight: 600 }}>{plan.calories}</div>
        </div>
        <div style={{ ...body, fontSize: 11, color: T.textMuted, marginTop: 4 }}>{COMP_CLASS_LABEL[plan.compClass]}</div>
        <div style={{ height: 1, background: T.border, margin: "14px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {[["Protein", plan.protein, "g"], ["Carbs", plan.carbs, "g"], ["Fat", plan.fat, "g"]].map(([l, v, u]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ ...mono, fontSize: 16, color: T.text, fontWeight: 600 }}>{v}<span style={{ fontSize: 10, color: T.textFaint }}>{u}</span></div>
              <div style={{ ...body, fontSize: 11, color: T.textMuted, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        {selectedBuild && <div style={{ ...body, fontSize: 11, color: T.textFaint, marginTop: 12, lineHeight: 1.5 }}>{selectedBuild.profile.nutritionStrategy}</div>}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Dumbbell size={15} color={T.accent2} />
          <div style={{ ...display, fontSize: 13.5, color: T.text, fontWeight: 500 }}>{plan.split} — {plan.days} days</div>
        </div>
        <div style={{ ...body, fontSize: 12.5, color: T.textMuted, lineHeight: 1.6 }}>
          {selectedBuild ? selectedBuild.profile.trainingStyle : "Matched to your experience and available days."}
        </div>
        {plan.priorityMuscles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {plan.priorityMuscles.map((m) => (
              <div key={m} style={{ ...mono, fontSize: 9.5, color: T.accent2, background: "rgba(91,140,255,0.1)", padding: "3px 8px", borderRadius: 6, textTransform: "capitalize" }}>{m.replace("_", " ")}</div>
            ))}
          </div>
        )}
      </Card>

      {selectedBuild && (
        <Card style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <LineChart size={14} color={T.positive} />
            <div style={{ ...display, fontSize: 13, color: T.text, fontWeight: 500 }}>What progress looks like</div>
          </div>
          <div style={{ ...body, fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>{selectedBuild.profile.progressCriteria}</div>
        </Card>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14, padding: "0 2px" }}>
        <Sparkles size={13} color={T.textFaint} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ ...body, fontSize: 11.5, color: T.textFaint, lineHeight: 1.6 }}>This is a starting estimate, not a guarantee — it adjusts weekly based on how your body actually responds.</div>
      </div>
    </div>
  );
}

/* ------------------------------ MY PLAN / RECOMMENDATIONS ------------------------------
   Everything here is deterministic — driven by the selected build's emphasis tags, the
   computed plan (calories/macros/compClass), gender, and experience level. Nothing is
   free-generated by an LLM; this is the same "AI never owns the numbers" principle as
   the rest of the app. The three sections (split / diet / supplements) all read from the
   same `plan` + `selectedBuild`, which is what keeps them consistent with each other.
------------------------------------------------------------------------------------- */

const EXERCISE_DB = {
  chest: ["Barbell Bench Press", "Incline Dumbbell Press", "Cable Fly"],
  upper_chest: ["Incline Barbell Press", "Low-to-High Cable Fly"],
  back: ["Barbell Row", "Seated Cable Row", "Chest-Supported Row"],
  lats: ["Pull-Up", "Lat Pulldown", "Straight-Arm Pulldown"],
  shoulders: ["Overhead Press", "Lateral Raise", "Rear Delt Fly"],
  arms: ["Barbell Curl", "Tricep Pushdown", "Hammer Curl"],
  forearms: ["Farmer's Carry", "Wrist Curl"],
  grip: ["Farmer's Carry", "Dead Hang"],
  quads: ["Back Squat", "Leg Press", "Walking Lunge"],
  hamstrings: ["Romanian Deadlift", "Leg Curl", "Good Morning"],
  glutes: ["Hip Thrust", "Bulgarian Split Squat", "Cable Kickback"],
  calves: ["Standing Calf Raise", "Seated Calf Raise"],
  abs: ["Cable Crunch", "Hanging Leg Raise"],
  core: ["Plank", "Pallof Press", "Hanging Leg Raise"],
  waist: ["Cable Crunch", "Pallof Press"],
  conditioning: ["Rowing Intervals", "Assault Bike Intervals", "Kettlebell Circuit"],
};

const SPLIT_LIBRARY = [
  { key: "full_body", label: "Full Body", days: 3, tags: ["strength", "conditioning"], template: [
    { label: "Full Body A", tags: ["quads", "chest", "back", "core"] },
    { label: "Full Body B", tags: ["hamstrings", "shoulders", "lats", "abs"] },
    { label: "Full Body C", tags: ["glutes", "arms", "chest", "back"] },
  ]},
  { key: "upper_lower", label: "Upper / Lower", days: 4, tags: ["mass", "strength"], template: [
    { label: "Upper A", tags: ["chest", "back", "shoulders", "arms"] },
    { label: "Lower A", tags: ["quads", "hamstrings", "glutes", "calves"] },
    { label: "Upper B", tags: ["back", "chest", "shoulders", "arms"] },
    { label: "Lower B", tags: ["glutes", "hamstrings", "quads", "calves"] },
  ]},
  { key: "ppl", label: "Push / Pull / Legs", days: 5, tags: ["mass", "symmetry"], template: [
    { label: "Push", tags: ["chest", "shoulders", "arms"] },
    { label: "Pull", tags: ["back", "lats", "arms"] },
    { label: "Legs", tags: ["quads", "hamstrings", "glutes", "calves"] },
    { label: "Push", tags: ["chest", "shoulders", "arms"] },
    { label: "Pull", tags: ["back", "lats", "arms"] },
  ]},
  { key: "ppl_x2", label: "PPL x2", days: 6, tags: ["mass"], template: [
    { label: "Push A", tags: ["chest", "shoulders", "arms"] }, { label: "Pull A", tags: ["back", "lats", "arms"] }, { label: "Legs A", tags: ["quads", "hamstrings", "glutes", "calves"] },
    { label: "Push B", tags: ["chest", "shoulders", "arms"] }, { label: "Pull B", tags: ["back", "lats", "arms"] }, { label: "Legs B", tags: ["quads", "hamstrings", "glutes", "calves"] },
  ]},
  { key: "arnold", label: "Arnold Split", days: 6, tags: ["mass", "symmetry"], template: [
    { label: "Chest / Back", tags: ["chest", "back", "lats"] }, { label: "Shoulders / Arms", tags: ["shoulders", "arms"] }, { label: "Legs", tags: ["quads", "hamstrings", "glutes", "calves"] },
    { label: "Chest / Back", tags: ["chest", "back", "lats"] }, { label: "Shoulders / Arms", tags: ["shoulders", "arms"] }, { label: "Legs", tags: ["quads", "hamstrings", "glutes", "calves"] },
  ]},
  { key: "bro_split", label: "Bro Split", days: 5, tags: ["mass"], template: [
    { label: "Chest", tags: ["chest", "upper_chest"] }, { label: "Back", tags: ["back", "lats"] }, { label: "Shoulders", tags: ["shoulders"] }, { label: "Legs", tags: ["quads", "hamstrings", "glutes", "calves"] }, { label: "Arms", tags: ["arms", "forearms"] },
  ]},
  { key: "powerbuilding", label: "Powerbuilding", days: 4, tags: ["strength", "mass"], template: [
    { label: "Squat Focus", tags: ["quads", "hamstrings", "core"] }, { label: "Bench Focus", tags: ["chest", "shoulders", "arms"] }, { label: "Deadlift Focus", tags: ["back", "hamstrings", "glutes"] }, { label: "Accessory Hypertrophy", tags: ["arms", "shoulders", "calves"] },
  ]},
  { key: "hybrid", label: "Hybrid (Strength + Conditioning)", days: 5, tags: ["conditioning", "strength", "endurance"], template: [
    { label: "Strength Upper", tags: ["chest", "back", "shoulders"] }, { label: "Conditioning", tags: ["conditioning", "core"] }, { label: "Strength Lower", tags: ["quads", "hamstrings", "glutes"] }, { label: "Conditioning", tags: ["conditioning", "core"] }, { label: "Full-Body Strength", tags: ["back", "quads", "shoulders"] },
  ]},
  { key: "calisthenics", label: "Calisthenics", days: 4, tags: ["core", "strength", "symmetry"], template: [
    { label: "Push Skills", tags: ["chest", "shoulders", "arms", "core"] }, { label: "Pull Skills", tags: ["back", "lats", "arms", "grip"] }, { label: "Legs & Core", tags: ["quads", "hamstrings", "glutes", "core"] }, { label: "Skill Practice", tags: ["core", "shoulders"] },
  ]},
  { key: "glute_focused", label: "Glute-Focused Upper/Lower", days: 4, tags: ["glutes", "hamstrings"], template: [
    { label: "Glutes & Hamstrings A", tags: ["glutes", "hamstrings"] }, { label: "Upper Body", tags: ["back", "shoulders", "chest"] }, { label: "Glutes & Quads B", tags: ["glutes", "quads"] }, { label: "Core & Calves", tags: ["core", "calves"] },
  ]},
];

function impliedDaysFor(level) { return level === "Beginner" ? 3 : level === "Advanced" ? 5 : 4; }

function scoreSplit(split, emphasis, impliedDays) {
  const overlap = split.tags.filter((t) => emphasis.includes(t)).length;
  const dayScore = Math.max(0, 3 - Math.abs(split.days - impliedDays));
  return overlap * 2 + dayScore;
}

function splitReason(split, emphasis, impliedDays) {
  const matched = split.tags.filter((t) => emphasis.includes(t));
  const dayNote = split.days === impliedDays ? `matches your ${impliedDays}-day-a-week schedule exactly`
    : split.days < impliedDays ? `leaves room in your ${impliedDays} available days for extra priority work`
    : `asks for ${split.days} days — more than your usual ${impliedDays}, workable if you can add a day`;
  const matchNote = matched.length ? `plays directly to your build's emphasis on ${matched.slice(0, 2).join(" and ")}` : "gives even, general development across the board";
  return `${matchNote}, and ${dayNote}.`;
}

function getRankedSplits(selectedBuild, profile) {
  const emphasis = selectedBuild?.emphasis || [];
  const impliedDays = impliedDaysFor(profile.level);
  return SPLIT_LIBRARY
    .map((s) => ({ ...s, score: scoreSplit(s, emphasis, impliedDays), reason: splitReason(s, emphasis, impliedDays) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function generateSchedule(split, selectedBuild, plan, level) {
  const emphasis = selectedBuild?.emphasis || [];
  const priority = emphasis.filter((t) => !ABSTRACT_TAGS.includes(t));
  const isStrengthFocus = emphasis.includes("strength");
  const hyperScheme = { sets: plan.compClass === "surplus" ? 4 : 3, reps: plan.compClass === "deficit" ? "10-15" : plan.compClass === "surplus" ? "6-10" : "8-12", rest: plan.compClass === "surplus" ? "90s" : "60-75s" };
  const strengthScheme = { sets: 5, reps: "3-6", rest: "2-3 min" };

  const days = split.template.map((day, i) => {
    if (day.tags.includes("conditioning") && day.label.toLowerCase().includes("conditioning")) {
      const name = EXERCISE_DB.conditioning[i % EXERCISE_DB.conditioning.length];
      return { label: day.label, isConditioning: true, exercises: [{ name, scheme: null, note: "20-30 min, moderate-to-hard effort" }] };
    }
    const orderedTags = [...day.tags].sort((a, b) => (priority.includes(b) ? 1 : 0) - (priority.includes(a) ? 1 : 0));
    const used = new Set();
    const exercises = [];
    orderedTags.forEach((tag) => {
      const pool = EXERCISE_DB[tag];
      if (!pool) return;
      const name = pool[i % pool.length];
      if (used.has(name)) return;
      used.add(name);
      const scheme = (exercises.length === 0 && isStrengthFocus) ? strengthScheme : hyperScheme;
      exercises.push({ name, tag, scheme });
    });
    return { label: day.label, isConditioning: false, exercises: exercises.slice(0, 5) };
  });

  const cardioNote = plan.compClass === "deficit"
    ? "2-3 sessions/week of 20-30 min moderate cardio to support the deficit without eating into recovery."
    : (emphasis.includes("endurance") || emphasis.includes("conditioning"))
    ? "Cardio is built into the conditioning days above — no separate sessions required unless you want them."
    : "1-2 short cardio sessions/week for cardiovascular health; keep it light so it doesn't compete with your lifts.";

  const progressionByLevel = {
    Beginner: "Add weight or a rep every session where form holds — straightforward linear progression works well this early.",
    Intermediate: "Double progression: work up to the top of your rep range on every set, then add load and drop back to the bottom of the range.",
    Advanced: "Periodize in blocks — accumulate volume for 3-4 weeks, then take a lighter deload week before pushing the next block.",
  };

  const recoveryNote = `${Math.max(7 - split.days, 1)} full rest day${7 - split.days === 1 ? "" : "s"} a week — prioritize sleep and protein on these days, not just training days.`;

  return { days, cardioNote, recoveryNote, progressionNote: progressionByLevel[level] || progressionByLevel.Intermediate };
}

function getDietStrategy(plan, selectedBuild, profile) {
  const emphasis = selectedBuild?.emphasis || [];
  const performanceLeaning = emphasis.includes("endurance") || emphasis.includes("conditioning");
  const name = { surplus: "Lean Bulk", deficit: "Moderate Cut", recomp: "Body Recomposition", maintenance: performanceLeaning ? "Performance Diet" : "Maintenance / Recomp" }[plan.compClass];

  const weightKg = parseFloat(profile.weight) || 75;
  const fiber = Math.round((plan.calories / 1000) * 14);
  const waterL = Math.round(weightKg * 0.033 * 10) / 10;
  const rate = { surplus: "+0.25–0.5% bodyweight per week", deficit: "-0.5–1% bodyweight per week", recomp: "Scale roughly flat — progress shows up in measurements and strength, not the scale", maintenance: "Scale stable — this is about performance, not scale movement" }[plan.compClass];

  const prioritize = ["Lean proteins (chicken, fish, egg whites, Greek yogurt, tofu)", "Vegetables and fruit for fiber and micronutrients", "Whole grains and starches around training"];
  const moderate = plan.compClass === "deficit"
    ? ["Fried foods and heavy sauces", "Added sugars and sweetened drinks", "Alcohol — it displaces both calories and recovery"]
    : ["Ultra-processed snacks — fine occasionally, shouldn't crowd out protein", "Alcohol — still worth keeping light for recovery's sake"];

  const meals = [
    `Breakfast: Greek yogurt with berries and a scoop of protein (~${Math.round(plan.protein * 0.25)}g protein)`,
    `Lunch: grilled chicken or tofu, rice, mixed vegetables (~${Math.round(plan.protein * 0.3)}g protein)`,
    `Dinner: lean beef or fish, potatoes, salad (~${Math.round(plan.protein * 0.3)}g protein)`,
  ];

  const restaurantTips = [
    "Grilled or baked over fried where it's offered",
    "Ask for sauces and dressings on the side",
    "Add a protein side (extra chicken, egg, beans) rather than a starch side if protein's short for the day",
    "Split fries/dessert if the rest of the day was on plan — no single meal derails a week",
  ];

  return { name, fiber, waterL, rate, prioritize, moderate, meals, restaurantTips };
}

function getSupplements(plan, selectedBuild) {
  const emphasis = selectedBuild?.emphasis || [];
  const weightKg = plan.protein ? Math.round(plan.protein / 2) : 75; // rough, just for display context
  const highProteinTarget = plan.protein / weightKg >= 2.0;
  const enduranceHeavy = emphasis.includes("endurance") || emphasis.includes("conditioning");

  return [
    { name: "Creatine Monohydrate", category: "Recommended",
      why: "One of the most well-studied supplements for strength and muscle gain, across virtually every training style.",
      evidence: "Strong", use: "3-5g daily, any time of day — no loading phase needed.",
      necessary: "Not required, but the evidence-to-cost ratio is hard to beat.",
      caution: "Generally very safe; mild water retention is common and expected, not a concern." },
    { name: "Protein Powder", category: highProteinTarget ? "Recommended" : "Potentially Useful",
      why: `Your target is ${plan.protein}g protein/day — powder is just a convenient way to hit that from food gaps.`,
      evidence: "Strong (as a food substitute, not magic on its own)", use: "1-2 scoops/day to fill gaps between meals.",
      necessary: "No — whole food works identically if you can hit the number without it.",
      caution: "Check for a third-party-tested product if you're in any tested sport." },
    { name: "Omega-3 (Fish Oil)", category: "Potentially Useful",
      why: "Supports general cardiovascular and joint health, especially useful if you don't eat fatty fish regularly.",
      evidence: "Moderate", use: "1-2g combined EPA/DHA daily, with food.",
      necessary: "No — mainly relevant if fish intake is low.",
      caution: "Can mildly thin blood at high doses; mention it if you're on blood thinners." },
    { name: "Electrolytes", category: enduranceHeavy && plan.compClass === "deficit" ? "Recommended" : "Situational",
      why: "Useful when you're sweating heavily and eating in a deficit, since both increase electrolyte turnover.",
      evidence: "Moderate-strong for heavy-sweat situations", use: "During or after longer/harder sessions, especially in heat.",
      necessary: "No for most moderate training; more relevant with heavy cardio or a hot climate.",
      caution: "Watch total sodium if you're also managing blood pressure." },
    { name: "Caffeine / Pre-Workout", category: "Situational",
      why: "Can modestly improve focus and output for a training session.",
      evidence: "Strong for performance, individual tolerance varies a lot", use: "100-200mg, 30-45 min pre-training; avoid within ~6 hours of bed.",
      necessary: "No — entirely optional.",
      caution: "Avoid stacking multiple caffeinated products; skip or lower the dose if it affects your sleep or you're sensitive to stimulants." },
    { name: "Vitamin D", category: "Situational",
      why: "Common to run low, especially with limited sun exposure — relevant to bone health and general function.",
      evidence: "Moderate, and dependent on your actual levels", use: "Only meaningfully useful if you're actually low — a blood test is the real way to know.",
      necessary: "Only if testing shows you're deficient.",
      caution: "Fat-soluble — don't megadose without knowing your levels." },
    { name: "Multivitamin", category: "Not Necessary",
      why: "A cheap insurance policy, but adds little if your diet already covers a variety of whole foods.",
      evidence: "Weak as a performance or physique aid", use: "Not required if the diet above is being followed reasonably.",
      necessary: "No.",
      caution: "Skip megadose versions — some fat-soluble vitamins can build up to unsafe levels." },
  ];
}

function ScheduleView({ split, selectedBuild, plan, profile }) {
  const schedule = generateSchedule(split, selectedBuild, plan, profile.level);
  return (
    <div style={{ marginTop: 14 }}>
      {schedule.days.map((day, i) => (
        <Card key={i} style={{ marginBottom: 10 }}>
          <div style={{ ...display, fontSize: 13.5, color: T.text, fontWeight: 600, marginBottom: 8 }}>{day.label}</div>
          {day.exercises.map((ex, j) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: j < day.exercises.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ ...body, fontSize: 12, color: T.text }}>{ex.name}</div>
              <div style={{ ...mono, fontSize: 10.5, color: T.textMuted, textAlign: "right" }}>
                {ex.note ? ex.note : `${ex.scheme.sets} × ${ex.scheme.reps} · rest ${ex.scheme.rest}`}
              </div>
            </div>
          ))}
        </Card>
      ))}
      <Card style={{ background: T.surface2 }}>
        <div style={{ ...body, fontSize: 11.5, color: T.textMuted, lineHeight: 1.6 }}><strong style={{ color: T.text }}>Progression: </strong>{schedule.progressionNote}</div>
        <div style={{ ...body, fontSize: 11.5, color: T.textMuted, lineHeight: 1.6, marginTop: 8 }}><strong style={{ color: T.text }}>Cardio: </strong>{schedule.cardioNote}</div>
        <div style={{ ...body, fontSize: 11.5, color: T.textMuted, lineHeight: 1.6, marginTop: 8 }}><strong style={{ color: T.text }}>Recovery: </strong>{schedule.recoveryNote}</div>
      </Card>
    </div>
  );
}

function SplitSection({ selectedBuild, profile, plan }) {
  const ranked = getRankedSplits(selectedBuild, profile);
  const [expanded, setExpanded] = useState(ranked[0]?.key);
  return (
    <div>
      <div style={{ ...body, fontSize: 12, color: T.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
        Ranked for {selectedBuild ? selectedBuild.label : "your profile"} against your {impliedDaysFor(profile.level)}-day-a-week experience level.
      </div>
      {ranked.map((s, i) => {
        const isOpen = expanded === s.key;
        return (
          <Card key={s.key} style={{ marginBottom: 10, borderColor: i === 0 ? T.accent : T.border }}>
            <button onClick={() => setExpanded(isOpen ? null : s.key)} style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ ...display, fontSize: 14.5, color: i === 0 ? T.accent : T.text, fontWeight: 600 }}>{s.label}</div>
                  {i === 0 && <div style={{ ...mono, fontSize: 8.5, color: T.accent, background: "rgba(201,162,39,0.12)", padding: "2px 6px", borderRadius: 5 }}>#1 PICK</div>}
                </div>
                <div style={{ ...mono, fontSize: 10, color: T.textFaint }}>{s.days}d/wk</div>
              </div>
              <div style={{ ...body, fontSize: 12, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>{s.reason}</div>
            </button>
            {isOpen && i === 0 && <ScheduleView split={s} selectedBuild={selectedBuild} plan={plan} profile={profile} />}
          </Card>
        );
      })}
    </div>
  );
}

function DietSection({ plan, selectedBuild, profile }) {
  const d = getDietStrategy(plan, selectedBuild, profile);
  return (
    <div>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ ...mono, fontSize: 9.5, color: T.accent, letterSpacing: 0.5, textTransform: "uppercase" }}>Strategy</div>
        <div style={{ ...display, fontSize: 16, color: T.text, fontWeight: 600, marginTop: 4 }}>{d.name}</div>
        <div style={{ height: 1, background: T.border, margin: "12px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          {[["Calories", `${plan.calories - 75}-${plan.calories + 75}`, ""], ["Protein", plan.protein, "g"], ["Carbs", plan.carbs, "g"], ["Fat", plan.fat, "g"], ["Fiber", d.fiber, "g"], ["Water", d.waterL, "L"]].map(([l, v, u]) => (
            <div key={l} style={{ textAlign: "center", minWidth: 52 }}>
              <div style={{ ...mono, fontSize: 13.5, color: T.text, fontWeight: 600 }}>{v}<span style={{ fontSize: 9, color: T.textFaint }}>{u}</span></div>
              <div style={{ ...body, fontSize: 10, color: T.textMuted, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ ...body, fontSize: 11.5, color: T.textFaint, marginTop: 12 }}><strong style={{ color: T.textMuted }}>Suggested rate of change: </strong>{d.rate}</div>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ ...display, fontSize: 13, color: T.text, fontWeight: 500, marginBottom: 8 }}>Foods to prioritize</div>
        {d.prioritize.map((f, i) => <div key={i} style={{ ...body, fontSize: 12, color: T.textMuted, lineHeight: 1.7 }}>• {f}</div>)}
        <div style={{ ...display, fontSize: 13, color: T.text, fontWeight: 500, marginTop: 14, marginBottom: 8 }}>Foods to moderate</div>
        {d.moderate.map((f, i) => <div key={i} style={{ ...body, fontSize: 12, color: T.textMuted, lineHeight: 1.7 }}>• {f}</div>)}
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ ...display, fontSize: 13, color: T.text, fontWeight: 500, marginBottom: 8 }}>Example meals</div>
        {d.meals.map((m, i) => <div key={i} style={{ ...body, fontSize: 12, color: T.textMuted, lineHeight: 1.7 }}>• {m}</div>)}
      </Card>

      <Card>
        <div style={{ ...display, fontSize: 13, color: T.text, fontWeight: 500, marginBottom: 8 }}>Eating out</div>
        {d.restaurantTips.map((t, i) => <div key={i} style={{ ...body, fontSize: 12, color: T.textMuted, lineHeight: 1.7 }}>• {t}</div>)}
      </Card>
    </div>
  );
}

const SUPP_CATEGORY_COLOR = { "Recommended": T.positive, "Potentially Useful": T.accent2, "Situational": T.warn, "Not Necessary": T.textFaint };

function SupplementsSection({ plan, selectedBuild }) {
  const supps = getSupplements(plan, selectedBuild);
  return (
    <div>
      <div style={{ ...body, fontSize: 11.5, color: T.textFaint, lineHeight: 1.6, marginBottom: 14 }}>
        None of these are required for progress — they're ranked by how much they're likely to actually help, given your plan.
      </div>
      {supps.map((s) => (
        <Card key={s.name} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ ...display, fontSize: 14, color: T.text, fontWeight: 600 }}>{s.name}</div>
            <div style={{ ...mono, fontSize: 8.5, color: SUPP_CATEGORY_COLOR[s.category], background: `${SUPP_CATEGORY_COLOR[s.category]}22`, padding: "3px 7px", borderRadius: 5, whiteSpace: "nowrap", marginLeft: 8 }}>{s.category.toUpperCase()}</div>
          </div>
          <div style={{ ...body, fontSize: 12, color: T.textMuted, marginTop: 6, lineHeight: 1.55 }}>{s.why}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            <div><div style={{ ...mono, fontSize: 8.5, color: T.textFaint, textTransform: "uppercase" }}>Evidence</div><div style={{ ...body, fontSize: 11, color: T.text, marginTop: 2 }}>{s.evidence}</div></div>
            <div><div style={{ ...mono, fontSize: 8.5, color: T.textFaint, textTransform: "uppercase" }}>Suggested use</div><div style={{ ...body, fontSize: 11, color: T.text, marginTop: 2 }}>{s.use}</div></div>
          </div>
          <div style={{ marginTop: 8 }}><div style={{ ...mono, fontSize: 8.5, color: T.textFaint, textTransform: "uppercase" }}>Actually necessary?</div><div style={{ ...body, fontSize: 11, color: T.text, marginTop: 2 }}>{s.necessary}</div></div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}><div style={{ ...mono, fontSize: 8.5, color: T.warn, textTransform: "uppercase" }}>Caution</div><div style={{ ...body, fontSize: 11, color: T.textMuted, marginTop: 2, lineHeight: 1.5 }}>{s.caution}</div></div>
        </Card>
      ))}
    </div>
  );
}

function MyPlanView({ profile, gender, build, customPriorities, onClose }) {
  const [section, setSection] = useState("split");
  const selectedBuild = getSelectedBuild(build, customPriorities);
  const plan = computePlan(profile, gender, selectedBuild);
  const sections = [["split", "Split", Dumbbell], ["diet", "Diet", UtensilsCrossed], ["supplements", "Supplements", Pill]];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "22px 20px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", display: "flex" }}><ArrowLeft size={18} /></button>
        <div>
          <div style={{ ...mono, fontSize: 10, color: T.accent, letterSpacing: 1, textTransform: "uppercase" }}>My Plan</div>
          <div style={{ ...display, fontSize: 17, color: T.text, fontWeight: 600, marginTop: 1 }}>{selectedBuild ? selectedBuild.label : "Recommendations"}</div>
        </div>
      </div>

      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 14, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, padding: 3 }}>
          {sections.map(([key, label, Icon]) => (
            <button key={key} onClick={() => setSection(key)} style={{
              flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
              background: section === key ? T.surface2 : "transparent", color: section === key ? T.text : T.textFaint,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...body, fontSize: 12,
            }}><Icon size={12} /> {label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
        {section === "split" && <SplitSection selectedBuild={selectedBuild} profile={profile} plan={plan} />}
        {section === "diet" && <DietSection plan={plan} selectedBuild={selectedBuild} profile={profile} />}
        {section === "supplements" && <SupplementsSection plan={plan} selectedBuild={selectedBuild} />}
      </div>
    </div>
  );
}

/* ------------------------------ GLOBAL FEED ------------------------------ */

function GlobalFeed({ buildLabel }) {
  const [posts, setPosts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [posting, setPosting] = useState(false);
  const [myPostIds, setMyPostIds] = useState([]);
  const [myLikes, setMyLikes] = useState([]);
  const [filterBuild, setFilterBuild] = useState("all");
  const inputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await window.storage.get(FEED_KEY, true);
      setPosts(result ? JSON.parse(result.value) : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadPersonal(MY_POSTS_KEY, []).then(setMyPostIds);
    loadPersonal(MY_LIKES_KEY, []).then(setMyLikes);
  }, []);

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const raw = await fileToDataUrl(f);
      setPhoto(await resizeDataUrl(raw, 320));
    } catch {
      setError("Couldn't process that photo.");
    }
  };

  const submitPost = async () => {
    if (!note.trim() && !photo) return;
    setPosting(true);
    setError("");
    try {
      const current = await window.storage.get(FEED_KEY, true).catch(() => null);
      const list = current ? JSON.parse(current.value) : [];
      const newPost = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim() || "Anonymous", build: buildLabel || null,
        note: note.trim(), photo, likes: 0, ts: Date.now(),
      };
      const updated = [newPost, ...list].slice(0, 60);
      const result = await window.storage.set(FEED_KEY, JSON.stringify(updated), true);
      if (!result) throw new Error("save failed");
      setPosts(updated);
      const newMyIds = [...myPostIds, newPost.id];
      setMyPostIds(newMyIds);
      await savePersonal(MY_POSTS_KEY, newMyIds);
      setNote(""); setPhoto(null);
    } catch {
      setError("Couldn't post — try again.");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (postId) => {
    const liked = myLikes.includes(postId);
    const nextLikes = liked ? myLikes.filter((id) => id !== postId) : [...myLikes, postId];
    setMyLikes(nextLikes);
    await savePersonal(MY_LIKES_KEY, nextLikes);
    try {
      const current = await window.storage.get(FEED_KEY, true);
      const list = current ? JSON.parse(current.value) : [];
      const updated = list.map((p) => p.id === postId ? { ...p, likes: Math.max(0, (p.likes || 0) + (liked ? -1 : 1)) } : p);
      await window.storage.set(FEED_KEY, JSON.stringify(updated), true);
      setPosts(updated);
    } catch { /* best effort */ }
  };

  const deletePost = async (postId) => {
    try {
      const current = await window.storage.get(FEED_KEY, true);
      const list = current ? JSON.parse(current.value) : [];
      const updated = list.filter((p) => p.id !== postId);
      await window.storage.set(FEED_KEY, JSON.stringify(updated), true);
      setPosts(updated);
      const nextMy = myPostIds.filter((id) => id !== postId);
      setMyPostIds(nextMy);
      await savePersonal(MY_POSTS_KEY, nextMy);
    } catch {
      setError("Couldn't delete — try again.");
    }
  };

  const buildOptions = ["all", ...new Set((posts || []).map((p) => p.build).filter(Boolean))];
  const visible = (posts || []).filter((p) => filterBuild === "all" || p.build === filterBuild);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <Globe size={13} color={T.accent2} />
        <div style={{ ...body, fontSize: 11.5, color: T.accent2 }}>Public — visible to everyone using Waypoint</div>
      </div>

      <Card style={{ marginTop: 12 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)"
          style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${T.border}`, color: T.text, ...body, fontSize: 12.5, padding: "0 0 8px", outline: "none", marginBottom: 10 }} />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Share a progress update…" rows={2}
          style={{ width: "100%", background: "transparent", border: "none", color: T.text, ...body, fontSize: 13, resize: "none", outline: "none" }} />
        {photo && <img src={photo} alt="attached" style={{ width: "100%", borderRadius: 10, marginTop: 10, maxHeight: 160, objectFit: "cover" }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <button onClick={() => inputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", ...body, fontSize: 12 }}>
            <ImagePlus size={14} /> Photo
          </button>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickPhoto} />
          <button onClick={submitPost} disabled={posting || (!note.trim() && !photo)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none",
            background: (posting || (!note.trim() && !photo)) ? T.border : T.accent,
            color: (posting || (!note.trim() && !photo)) ? T.textFaint : "#14110A",
            ...display, fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{posting ? <Loader2 size={13} className="spin" /> : <Send size={13} />} Post</button>
        </div>
      </Card>

      {error && <div style={{ marginTop: 10, ...body, fontSize: 12, color: T.warn }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 10 }}>
        <div style={{ ...body, fontSize: 11, color: T.textFaint, letterSpacing: 0.4, textTransform: "uppercase" }}>Community</div>
        <button onClick={load} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", display: "flex", alignItems: "center" }}><RefreshCw size={13} /></button>
      </div>

      {buildOptions.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, overflowX: "auto" }}>
          <Filter size={12} color={T.textFaint} style={{ flexShrink: 0 }} />
          {buildOptions.map((b) => (
            <button key={b} onClick={() => setFilterBuild(b)} style={{
              flexShrink: 0, padding: "5px 11px", borderRadius: 8, border: `1px solid ${filterBuild === b ? T.accent : T.border}`,
              background: filterBuild === b ? "rgba(201,162,39,0.1)" : "transparent",
              color: filterBuild === b ? T.accent : T.textMuted, ...body, fontSize: 11, cursor: "pointer",
            }}>{b === "all" ? "All" : b}</button>
          ))}
        </div>
      )}

      {loading && <div style={{ ...body, fontSize: 12.5, color: T.textMuted, textAlign: "center", padding: 20 }}>Loading feed…</div>}
      {!loading && visible.length === 0 && <div style={{ ...body, fontSize: 12.5, color: T.textFaint, textAlign: "center", padding: 20 }}>No posts yet — be the first to share progress.</div>}
      {!loading && visible.map((p) => {
        const liked = myLikes.includes(p.id);
        const mine = myPostIds.includes(p.id);
        return (
          <Card key={p.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center" }}><User size={11} color={T.textMuted} /></div>
                <div style={{ ...display, fontSize: 12.5, color: T.text, fontWeight: 500 }}>{p.name}</div>
                {p.build && <div style={{ ...mono, fontSize: 9.5, color: T.accent, background: "rgba(201,162,39,0.1)", padding: "2px 7px", borderRadius: 6 }}>{p.build}</div>}
              </div>
              {mine && (
                <button onClick={() => deletePost(p.id)} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer" }}><Trash2 size={13} /></button>
              )}
            </div>
            {p.note && <div style={{ ...body, fontSize: 12.5, color: T.textMuted, lineHeight: 1.5 }}>{p.note}</div>}
            {p.photo && <img src={p.photo} alt="progress" style={{ width: "100%", borderRadius: 10, marginTop: 8, maxHeight: 200, objectFit: "cover" }} />}
            <button onClick={() => toggleLike(p.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", marginTop: 10, padding: 0 }}>
              <Heart size={14} color={liked ? T.warn : T.textFaint} fill={liked ? T.warn : "none"} />
              <div style={{ ...mono, fontSize: 11, color: liked ? T.warn : T.textFaint }}>{p.likes || 0}</div>
            </button>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------ MY CHECKS (private, persisted) ------------------------------ */

function MyChecks() {
  const [checks, setChecks] = useState(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { loadPersonal(MY_CHECKS_KEY, []).then(setChecks); }, []);

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const raw = await fileToDataUrl(f);
    setPhoto(await resizeDataUrl(raw, 320));
  };

  const addCheck = async () => {
    if (!note.trim() && !photo) return;
    setSaving(true);
    const entry = { id: `${Date.now()}`, note: note.trim(), photo, ts: Date.now() };
    const updated = [entry, ...(checks || [])].slice(0, 60);
    await savePersonal(MY_CHECKS_KEY, updated);
    setChecks(updated);
    setNote(""); setPhoto(null);
    setSaving(false);
  };

  const removeCheck = async (id) => {
    const updated = (checks || []).filter((c) => c.id !== id);
    await savePersonal(MY_CHECKS_KEY, updated);
    setChecks(updated);
  };

  return (
    <div>
      <Card>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log a private check-in…" rows={2}
          style={{ width: "100%", background: "transparent", border: "none", color: T.text, ...body, fontSize: 13, resize: "none", outline: "none" }} />
        {photo && <img src={photo} alt="attached" style={{ width: "100%", borderRadius: 10, marginTop: 10, maxHeight: 160, objectFit: "cover" }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <button onClick={() => inputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", ...body, fontSize: 12 }}>
            <ImagePlus size={14} /> Photo
          </button>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickPhoto} />
          <button onClick={addCheck} disabled={saving || (!note.trim() && !photo)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none",
            background: (saving || (!note.trim() && !photo)) ? T.border : T.accent, color: (saving || (!note.trim() && !photo)) ? T.textFaint : "#14110A",
            ...display, fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{saving ? <Loader2 size={13} className="spin" /> : <Send size={13} />} Save</button>
        </div>
      </Card>

      <div style={{ ...body, fontSize: 11, color: T.textFaint, letterSpacing: 0.4, textTransform: "uppercase", margin: "18px 0 10px" }}>Your timeline — private</div>

      {checks === null && <div style={{ ...body, fontSize: 12.5, color: T.textMuted, textAlign: "center", padding: 20 }}>Loading…</div>}
      {checks && checks.length === 0 && <div style={{ ...body, fontSize: 12.5, color: T.textFaint, textAlign: "center", padding: 20 }}>No check-ins yet.</div>}
      {checks && checks.map((c) => (
        <Card key={c.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ ...mono, fontSize: 10, color: T.textFaint }}>{new Date(c.ts).toLocaleDateString()}</div>
            <button onClick={() => removeCheck(c.id)} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer" }}><Trash2 size={13} /></button>
          </div>
          {c.note && <div style={{ ...body, fontSize: 12.5, color: T.text, lineHeight: 1.5, marginTop: 6 }}>{c.note}</div>}
          {c.photo && <img src={c.photo} alt="check" style={{ width: "100%", borderRadius: 10, marginTop: 8, maxHeight: 200, objectFit: "cover" }} />}
        </Card>
      ))}
    </div>
  );
}

function ProgressTab({ buildLabel }) {
  const [view, setView] = useState("mine");
  return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, padding: 3 }}>
        {[["mine", "My Checks", User], ["feed", "Global Feed", Users]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setView(key)} style={{
            flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
            background: view === key ? T.surface2 : "transparent", color: view === key ? T.text : T.textFaint,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...body, fontSize: 12,
          }}><Icon size={12} /> {label}</button>
        ))}
      </div>
      {view === "mine" ? <MyChecks /> : <GlobalFeed buildLabel={buildLabel} />}
    </div>
  );
}

/* ------------------------------ YOU TAB ------------------------------ */

function YouTab({ profile, gender, buildLabel, buildCategory, onReset }) {
  const row = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ ...body, fontSize: 12.5, color: T.textMuted }}>{label}</div>
      <div style={{ ...mono, fontSize: 12.5, color: T.text }}>{value || "—"}</div>
    </div>
  );
  return (
    <div style={{ padding: "0 20px 20px" }}>
      <div style={{ ...mono, fontSize: 10.5, color: T.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Your case</div>
      <Card>
        {row("Build", buildLabel)}
        {row("Build type", buildCategory ? CATEGORY_LABEL[buildCategory] || "Custom" : null)}
        {row("Gender", gender)}
        {row("Height / Weight", `${profile.height}cm / ${profile.weight}kg`)}
        {row("Experience", profile.level)}
      </Card>
      <div style={{ ...body, fontSize: 11, color: T.textFaint, lineHeight: 1.6, marginTop: 14 }}>
        This stays saved to your device between visits — separate from anything you choose to post to the Global Feed.
      </div>
      <button onClick={onReset} style={{
        marginTop: 18, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "12px 0", borderRadius: 11, border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, ...body, fontSize: 12.5, cursor: "pointer",
      }}><RotateCcw size={13} /> Start over</button>
    </div>
  );
}

/* ------------------------------ DASHBOARD ------------------------------ */

function Dashboard({ profile, gender, build, customPriorities, buildLabel, buildCategory, onReset }) {
  const [tab, setTab] = useState("today");
  const [showMyPlan, setShowMyPlan] = useState(false);
  const tabs = [
    { key: "today", icon: Home, label: "Today" }, { key: "train", icon: Dumbbell, label: "Train" },
    { key: "eat", icon: UtensilsCrossed, label: "Eat" }, { key: "progress", icon: LineChart, label: "Progress" },
    { key: "you", icon: User, label: "You" },
  ];
  const titles = { today: "Today", progress: "Progress", you: "You", train: "Train", eat: "Eat" };

  if (showMyPlan) {
    return <MyPlanView profile={profile} gender={gender} build={build} customPriorities={customPriorities} onClose={() => setShowMyPlan(false)} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "22px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ ...mono, fontSize: 10.5, color: T.textFaint, letterSpacing: 1, textTransform: "uppercase" }}>Friday, Aug 14</div>
          <div style={{ ...display, fontSize: 20, color: T.text, fontWeight: 600, marginTop: 2 }}>{titles[tab]}</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><User size={15} color={T.textMuted} /></div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "today" && (
          <div style={{ padding: "4px 20px 20px" }}>
            <Card style={{ background: T.surface2, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <Sparkles size={15} color={T.accent} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ ...body, fontSize: 13, color: T.text, lineHeight: 1.55 }}>Protein's on track but fat's already high today. Make dinner lean — grilled, not fried — and you'll close the day clean.</div>
              </div>
            </Card>
            <button onClick={() => setShowMyPlan(true)} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer", marginBottom: 14 }}>
              <Card style={{ borderColor: T.accent, background: "rgba(201,162,39,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(201,162,39,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardList size={15} color={T.accent} /></div>
                    <div>
                      <div style={{ ...display, fontSize: 14, color: T.text, fontWeight: 500 }}>My Plan</div>
                      <div style={{ ...body, fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>{buildLabel ? `Split, diet & supplements for ${buildLabel}` : "Your split, diet & supplements"}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color={T.accent} />
                </div>
              </Card>
            </button>
            <Card style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-around" }}>
                <Ring pct={0.71} color={T.accent} value="1840" unit="/ 2600" label="Calories" />
                <Ring pct={0.68} color={T.accent2} value="112" unit="/ 165g" label="Protein" />
                <Ring pct={0.6} color={T.positive} value="18" unit="/ 30g" label="Fiber" />
              </div>
            </Card>
            <Card style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(91,140,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><Dumbbell size={15} color={T.accent2} /></div>
                  <div>
                    <div style={{ ...display, fontSize: 14, color: T.text, fontWeight: 500 }}>Back + Shoulders</div>
                    <div style={{ ...body, fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>6 exercises · ~50 min</div>
                  </div>
                </div>
                <ChevronRight size={16} color={T.textFaint} />
              </div>
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <Card><div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Droplet size={13} color={T.accent2} /><div style={{ ...body, fontSize: 11.5, color: T.textMuted }}>Water</div></div><div style={{ ...mono, fontSize: 16, color: T.text, fontWeight: 600 }}>78<span style={{ fontSize: 11, color: T.textFaint }}>/110oz</span></div></Card>
              <Card><div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Footprints size={13} color={T.positive} /><div style={{ ...body, fontSize: 11.5, color: T.textMuted }}>Steps</div></div><div style={{ ...mono, fontSize: 16, color: T.text, fontWeight: 600 }}>6,420<span style={{ fontSize: 11, color: T.textFaint }}>/9k</span></div></Card>
              <Card><div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Moon size={13} color={T.warn} /><div style={{ ...body, fontSize: 11.5, color: T.textMuted }}>Sleep</div></div><div style={{ ...mono, fontSize: 16, color: T.warn, fontWeight: 600 }}>6h 42m</div></Card>
              <Card><div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Check size={13} color={T.positive} /><div style={{ ...body, fontSize: 11.5, color: T.textMuted }}>Creatine</div></div><div style={{ ...body, fontSize: 13, color: T.positive, fontWeight: 500 }}>Logged</div></Card>
            </div>
            <Card style={{ borderStyle: "dashed" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ ...display, fontSize: 13.5, color: T.text, fontWeight: 500 }}>Standard Check due</div>
                  <div style={{ ...body, fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>Same conditions as last time, for an accurate comparison</div>
                </div>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(201,162,39,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Camera size={14} color={T.accent} /></div>
              </div>
            </Card>
          </div>
        )}
        {tab === "progress" && <ProgressTab buildLabel={buildLabel} />}
        {tab === "you" && <YouTab profile={profile} gender={gender} buildLabel={buildLabel} buildCategory={buildCategory} onReset={onReset} />}
        {(tab === "train" || tab === "eat") && (
          <div style={{ padding: "60px 20px", textAlign: "center", ...body, fontSize: 13, color: T.textFaint }}>
            {tab === "train" && "Workout log and program detail go here."}
            {tab === "eat" && "Food log and restaurant coach go here."}
          </div>
        )}
      </div>

      <div style={{ display: "flex", borderTop: `1px solid ${T.border}`, padding: "10px 8px 18px", background: T.bg }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
              <Icon size={18} color={active ? T.accent : T.textFaint} />
              <div style={{ ...body, fontSize: 9.5, color: active ? T.accent : T.textFaint }}>{t.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- ROOT --------------------------------- */

export default function App() {
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState({ front: null, side: null, back: null });
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [profile, setProfile] = useState({ height: "178", weight: "76", age: "27", level: "Intermediate", heightUnit: "cm", weightUnit: "kg" });
  const [gender, setGender] = useState(null);
  const [build, setBuild] = useState(null);
  const [customPriorities, setCustomPriorities] = useState([]);

  const steps = ["welcome", "scan", "profile", "gender", "build", "plan"];
  const isLast = step === steps.length - 1;
  const next = () => setStep((s) => Math.min(steps.length, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const inDashboard = step === steps.length;

  // Load any previously saved case for this user on first mount.
  useEffect(() => {
    (async () => {
      const saved = await loadPersonal(PROFILE_KEY, null);
      if (saved) {
        setProfile(saved.profile || profile);
        setGender(saved.gender ?? null);
        setBuild(saved.build || null);
        setCustomPriorities(saved.customPriorities || []);
        setAiAnalysis(saved.aiAnalysis || null);
        setStep(steps.length); // returning user goes straight to dashboard
      }
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the case whenever the user finishes onboarding.
  useEffect(() => {
    if (inDashboard) savePersonal(PROFILE_KEY, { profile, gender, build, customPriorities, aiAnalysis });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inDashboard]);

  const selectedBuild = getSelectedBuild(build, customPriorities);
  const buildLabel = selectedBuild?.label || null;
  const buildCategory = selectedBuild?.category || null;

  const canContinue = () => {
    if (steps[step] === "gender") return !!gender;
    if (steps[step] === "build") return !!build;
    return true;
  };

  const handleReset = async () => {
    await savePersonal(PROFILE_KEY, null);
    setProfile({ height: "178", weight: "76", age: "27", level: "Intermediate", heightUnit: "cm", weightUnit: "kg" });
    setGender(null); setBuild(null); setCustomPriorities([]); setAiAnalysis(null);
    setPhotos({ front: null, side: null, back: null });
    setStep(0);
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100%", padding: "24px 12px", background: "#080909" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        input:focus, textarea:focus { outline: none; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ width: 380, height: 720, background: T.bg, borderRadius: 34, border: `8px solid #1C1E21`, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 30px 60px rgba(0,0,0,0.5)", position: "relative" }}>
        {checking ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={22} color={T.accent} className="spin" />
          </div>
        ) : inDashboard ? (
          <Dashboard profile={profile} gender={gender} build={build} customPriorities={customPriorities} buildLabel={buildLabel} buildCategory={buildCategory} onReset={handleReset} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 20px 0" }}>
              <GhostButton onClick={back}>{step > 0 && <><ChevronLeft size={14} /> Back</>}</GhostButton>
              <TickRule total={steps.length} active={step} />
              <div style={{ width: 44 }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px 10px" }}>
              {steps[step] === "welcome" && <StepWelcome />}
              {steps[step] === "scan" && <StepScan photos={photos} setPhotos={setPhotos} gender={gender} aiAnalysis={aiAnalysis} setAiAnalysis={setAiAnalysis} />}
              {steps[step] === "profile" && <StepProfile profile={profile} setProfile={setProfile} />}
              {steps[step] === "gender" && <StepGender gender={gender} setGender={setGender} />}
              {steps[step] === "build" && <StepBuild gender={gender} build={build} setBuild={setBuild} customPriorities={customPriorities} setCustomPriorities={setCustomPriorities} aiAnalysis={aiAnalysis} />}
              {steps[step] === "plan" && <StepPlan profile={profile} gender={gender} build={build} customPriorities={customPriorities} />}
            </div>
            <div style={{ padding: "14px 24px 26px" }}>
              <PrimaryButton onClick={next} disabled={!canContinue()}>{step === 0 ? "Get started" : isLast ? "Enter Waypoint" : "Continue"}<ChevronRight size={16} /></PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
