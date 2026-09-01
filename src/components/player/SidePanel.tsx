import {
  Check,
  Download,
  HardDrive,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { LANGUAGES, LOCAL_MODELS } from "@/lib/ai/catalog";
import { loadLocalModel } from "@/lib/ai/local-engine";
import { snapshotOpts, transcribeFull } from "@/lib/ai/pipeline";
import { formatBytes } from "@/lib/format";
import { t, type CopyKey } from "@/lib/i18n";
import { toSrt } from "@/lib/srt";
import { pcmStore, usePlayer, type MediaItem } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function useT() {
  const lang = usePlayer((s) => s.uiLang);
  return (k: CopyKey) => t(lang, k);
}

export function SidePanel() {
  const panel = usePlayer((s) => s.panel);
  const setPanel = usePlayer((s) => s.setPanel);
  const tt = useT();
  if (panel === "none") return null;
  const title: Record<Exclude<typeof panel, "none">, CopyKey> = {
    playlist: "playlist",
    models: "models",
    translate: "translate",
    install: "install",
    help: "shortcuts",
  };
  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-40 bg-bg/50 md:hidden"
        aria-label={tt("close")}
        onClick={() => setPanel("none")}
      />
      <aside className="absolute inset-x-0 bottom-0 z-50 flex max-h-[78dvh] flex-col rounded-t-xl bg-surface shadow-[0_0_0_1px_rgb(255_255_255/0.08)] md:static md:z-10 md:h-full md:max-h-none md:w-[360px] md:shrink-0 md:rounded-none md:border-l md:border-border md:shadow-none">
        <header className="flex h-14 shrink-0 items-center justify-between px-4">
          <h2 className="text-sm font-medium tracking-wide">{tt(title[panel])}</h2>
          <Button size="icon-sm" onClick={() => setPanel("none")} aria-label={tt("close")}>
            <X />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {panel === "playlist" && <PlaylistBody />}
          {panel === "models" && <ModelsBody />}
          {panel === "translate" && <TranslateBody />}
          {panel === "install" && <InstallBody />}
          {panel === "help" && <HelpBody />}
        </div>
      </aside>
    </>
  );
}

function PlaylistBody() {
  const playlist = usePlayer((s) => s.playlist);
  const currentId = usePlayer((s) => s.currentId);
  const select = usePlayer((s) => s.select);
  const removeItem = usePlayer((s) => s.removeItem);
  const addFiles = usePlayer((s) => s.addFiles);
  const autoplayNext = usePlayer((s) => s.autoplayNext);
  const setAutoplayNext = usePlayer((s) => s.setAutoplayNext);
  const tt = useT();
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-3 text-sm text-muted">
        <span>{tt("autoplay")}</span>
        <Switch checked={autoplayNext} onCheckedChange={setAutoplayNext} />
      </label>
      <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-fg text-sm font-medium text-accent-fg">
        {tt("openFiles")}
        <input
          type="file"
          accept="video/*,audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </label>
      {playlist.length === 0 ? (
        <p className="text-sm text-muted">{tt("noTrack")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {playlist.map((item, i) => (
            <PlaylistRow
              key={item.id}
              item={item}
              index={i}
              active={item.id === currentId}
              onSelect={() => select(item.id)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PlaylistRow({
  item,
  index,
  active,
  onSelect,
  onRemove,
}: {
  item: MediaItem;
  index: number;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-2 transition-[background-color] duration-150",
        active ? "bg-white/8" : "hover:bg-white/4",
      )}
    >
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
        <p className="truncate text-sm text-fg">{item.name}</p>
        <p className="text-[11px] uppercase tracking-wider text-subtle">
          {String(index + 1).padStart(2, "0")} · {item.kind} · {formatBytes(item.size)}
        </p>
      </button>
      <Button size="icon-sm" onClick={onRemove} aria-label="remove">
        <Trash2 className="size-4 text-muted" />
      </Button>
    </li>
  );
}

function ModelsBody() {
  const tt = useT();
  const uiLang = usePlayer((s) => s.uiLang);
  const ready = usePlayer((s) => s.readyModels);
  const progress = usePlayer((s) => s.downloadProgress);
  const sttModelId = usePlayer((s) => s.sttModelId);
  const mtModelId = usePlayer((s) => s.mtModelId);
  const setStt = usePlayer((s) => s.setSttModel);
  const setMt = usePlayer((s) => s.setMtModel);
  const markReady = usePlayer((s) => s.markModelReady);
  const setProgress = usePlayer((s) => s.setDownloadProgress);
  const busy = usePlayer((s) => s.busy);

  const download = async (id: string) => {
    try {
      usePlayer.getState().setBusy(id);
      await loadLocalModel(id, (p) => {
        if (typeof p.progress === "number") setProgress(id, p.progress);
      });
      markReady(id);
      toast.success(tt("downloaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt("failed"));
    } finally {
      usePlayer.getState().setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-muted">{tt("modelHubLead")}</p>

      <section>
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-subtle">
          <HardDrive className="size-3.5" />
          {tt("stt")}
        </div>
        <div className="flex flex-col gap-2">
          {LOCAL_MODELS.filter((m) => m.task === "stt").map((m) => (
            <ModelCard
              key={m.id}
              title={uiLang === "zh" ? m.nameZh : m.name}
              meta={`${m.sizeLabel} · ${uiLang === "zh" ? m.langsZh : m.langs}`}
              ready={ready.includes(m.id)}
              active={sttModelId === m.id}
              progress={progress[m.id] ?? 0}
              downloading={busy === m.id}
              onDownload={() => download(m.id)}
              onUse={() => setStt(m.id)}
              useLabel={tt("useModel")}
              downloadLabel={tt("download")}
              readyLabel={tt("downloaded")}
              activeLabel={tt("active")}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-subtle">
          {tt("mt")}
        </div>
        <div className="flex flex-col gap-2">
          {LOCAL_MODELS.filter((m) => m.task === "mt").map((m) => (
            <ModelCard
              key={m.id}
              title={uiLang === "zh" ? m.nameZh : m.name}
              meta={`${m.sizeLabel} · ${uiLang === "zh" ? m.langsZh : m.langs}`}
              ready={ready.includes(m.id)}
              active={mtModelId === m.id}
              progress={progress[m.id] ?? 0}
              downloading={busy === m.id}
              onDownload={() => download(m.id)}
              onUse={() => setMt(m.id)}
              useLabel={tt("useModel")}
              downloadLabel={tt("download")}
              readyLabel={tt("downloaded")}
              activeLabel={tt("active")}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ModelCard({
  title,
  meta,
  ready,
  active,
  progress,
  downloading,
  onDownload,
  onUse,
  useLabel,
  downloadLabel,
  readyLabel,
  activeLabel,
}: {
  title: string;
  meta: string;
  ready: boolean;
  active: boolean;
  progress: number;
  downloading: boolean;
  onDownload: () => void;
  onUse: () => void;
  useLabel: string;
  downloadLabel: string;
  readyLabel: string;
  activeLabel: string;
}) {
  return (
    <div className="rounded-md bg-surface-2 p-3 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-fg">{title}</p>
          <p className="text-xs text-muted">{meta}</p>
        </div>
        {active && ready ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-ok">
            <Check className="size-3" /> {activeLabel}
          </span>
        ) : ready ? (
          <span className="text-[11px] text-muted">{readyLabel}</span>
        ) : null}
      </div>
      {downloading ? <Progress value={progress} className="mt-3" /> : null}
      <div className="mt-3 flex gap-2">
        {!ready ? (
          <Button size="sm" variant="primary" onClick={onDownload} disabled={downloading}>
            <Download className="size-3.5" />
            {downloadLabel}
          </Button>
        ) : (
          <Button size="sm" variant={active ? "subtle" : "outline"} onClick={onUse}>
            {useLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function TranslateBody() {
  const tt = useT();
  const sourceLang = usePlayer((s) => s.sourceLang);
  const targetLang = usePlayer((s) => s.targetLang);
  const live = usePlayer((s) => s.live);
  const busy = usePlayer((s) => s.busy);
  const progress = usePlayer((s) => s.progress);
  const subtitleSize = usePlayer((s) => s.subtitleSize);
  const showOriginal = usePlayer((s) => s.showOriginal);
  const bilingual = usePlayer((s) => s.bilingual);
  const cues = usePlayer((s) => s.cues);
  const currentId = usePlayer((s) => s.currentId);
  const pcmReady = usePlayer((s) => s.pcmReady);
  const setSourceLang = usePlayer((s) => s.setSourceLang);
  const setTargetLang = usePlayer((s) => s.setTargetLang);
  const setLive = usePlayer((s) => s.setLive);
  const setSubtitleSize = usePlayer((s) => s.setSubtitleSize);
  const setShowOriginal = usePlayer((s) => s.setShowOriginal);
  const setBilingual = usePlayer((s) => s.setBilingual);
  const setCues = usePlayer((s) => s.setCues);
  const readyModels = usePlayer((s) => s.readyModels);
  const sttModelId = usePlayer((s) => s.sttModelId);

  const runFull = async () => {
    if (!currentId) return;
    const clip = pcmStore.get(currentId);
    if (!clip) {
      toast.error(tt("waitDecode"));
      return;
    }
    try {
      usePlayer.getState().setBusy("full");
      const cuesOut = await transcribeFull(
        { clip, ...snapshotOpts() },
        (ratio, label) => {
          usePlayer.getState().setProgress(ratio * 100);
          usePlayer.getState().setBusy(label);
        },
      );
      setCues(cuesOut);
      toast.success(`${tt("fullDone")} · ${cuesOut.length} ${tt("cues")}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : tt("failed");
      toast.error(msg === "local-stt-missing" ? tt("localNeed") : msg);
    } finally {
      usePlayer.getState().setBusy(null);
      usePlayer.getState().setProgress(0);
    }
  };

  const exportSrt = () => {
    if (cues.length === 0) return;
    const blob = new Blob([toSrt(cues, bilingual)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nox-subtitles.srt";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(tt("exported"));
  };

  return (
    <div className="flex flex-col gap-5">
      <Field label={tt("sourceLang")}>
        <LangSelect value={sourceLang} onChange={setSourceLang} includeAuto />
      </Field>
      <Field label={tt("targetLang")}>
        <LangSelect value={targetLang} onChange={setTargetLang} />
      </Field>
      <div className="rounded-md bg-accent/10 px-3 py-2 text-sm text-accent">
        {tt("engineLocal")}
      </div>
      {!readyModels.includes(sttModelId) ? (
        <p className="text-xs text-muted">{tt("localNeed")}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          variant={live ? "danger" : "primary"}
          onClick={() => {
            if (!currentId || !pcmStore.get(currentId)) {
              toast.error(tt("waitDecode"));
              return;
            }
            setLive(!live);
            toast.message(live ? tt("liveOff") : tt("liveOn"));
          }}
        >
          {live ? tt("stopLive") : tt("startLive")}
        </Button>
        <Button variant="outline" onClick={runFull} disabled={Boolean(busy) && busy !== "full"}>
          {tt("runFull")}
        </Button>
      </div>

      {busy ? (
        <div>
          <p className="mb-2 text-xs text-muted">
            {tt("transcribing")} · {busy}
          </p>
          <Progress value={progress} />
        </div>
      ) : null}

      <p className="text-xs text-subtle">
        {pcmReady[currentId ?? ""] ? tt("ready") : tt("waitDecode")}
        {cues.length > 0 ? ` · ${cues.length} ${tt("cues")}` : ""}
      </p>

      <Field label={tt("subSize")}>
        <Slider
          min={16}
          max={48}
          step={1}
          value={[subtitleSize]}
          onValueChange={([v]) => setSubtitleSize(v ?? 28)}
        />
      </Field>
      <label className="flex items-center justify-between text-sm text-muted">
        <span>{tt("showOriginal")}</span>
        <Switch checked={showOriginal} onCheckedChange={setShowOriginal} />
      </label>
      <label className="flex items-center justify-between text-sm text-muted">
        <span>{tt("bilingual")}</span>
        <Switch checked={bilingual} onCheckedChange={setBilingual} />
      </label>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={exportSrt} disabled={cues.length === 0}>
          {tt("exportSrt")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setCues([])} disabled={cues.length === 0}>
          {tt("clearSubs")}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-[0.14em] text-subtle">{label}</span>
      {children}
    </label>
  );
}

function LangSelect({
  value,
  onChange,
  includeAuto = false,
}: {
  value: string;
  onChange: (v: string) => void;
  includeAuto?: boolean;
}) {
  const list = includeAuto ? LANGUAGES : LANGUAGES.filter((l) => l.id !== "auto");
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.08)]"
    >
      {list.map((l) => (
        <option key={l.id} value={l.id}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

function InstallBody() {
  const tt = useT();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex size-12 items-center justify-center rounded-lg bg-surface-2">
        <Smartphone className="size-6 text-accent" />
      </div>
      <h3 className="font-display text-2xl text-fg">{tt("installTitle")}</h3>
      <p className="text-sm leading-relaxed text-muted">{tt("installBody")}</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-fg">
        <li>Android Chrome → 右上選單</li>
        <li>加到主畫面 / Add to Home screen</li>
        <li>開啟圖示即可全螢幕播放</li>
      </ol>
      <p className="text-xs leading-relaxed text-subtle">{tt("installNote")}</p>
      <p className="text-xs text-muted">{tt("installIos")}</p>
    </div>
  );
}

function HelpBody() {
  const tt = useT();
  const rows: [string, CopyKey][] = [
    ["Space", "helpSpace"],
    ["← / →", "helpSeek"],
    ["↑ / ↓", "helpVol"],
    ["F", "helpF"],
    ["M", "helpM"],
    ["N / P", "helpN"],
    ["?", "shortcuts"],
  ];
  return (
    <ul className="flex flex-col gap-2">
      {rows.map(([k, label]) => (
        <li key={k} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
          <span className="font-mono text-xs text-accent">{k}</span>
          <span className="text-sm text-muted">{tt(label)}</span>
        </li>
      ))}
    </ul>
  );
}
