import { createContext, useContext, type RefObject } from "react";

export type AudioGraph = {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode;
};

type Ctx = {
  mediaRef: RefObject<HTMLVideoElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  graphRef: RefObject<AudioGraph | null>;
};

export const PlayerContext = createContext<Ctx | null>(null);

export function usePlayerContext() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("PlayerContext missing");
  return ctx;
}
