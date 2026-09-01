import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

export function isVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|webm|mkv|mov|m4v|avi|ogv)$/i.test(file.name);
}

export function isAudioFile(file: File) {
  if (file.type.startsWith("audio/")) return true;
  return /\.(mp3|wav|flac|ogg|m4a|aac|opus|wma)$/i.test(file.name);
}

export function isSubtitleFile(file: File) {
  if (file.type === "text/vtt" || file.type === "application/x-subrip") return true;
  return /\.(srt|vtt)$/i.test(file.name);
}

export function isMediaFile(file: File) {
  return isVideoFile(file) || isAudioFile(file);
}
