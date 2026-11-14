"use client";
/**
 * ComicScroll（页面层）和 MomForeground（场景层）之间的小通道，不经过共享 context：
 * - enter 0–1：节拍 5 锅铲妈妈从右下滑入到 MOM_SPATULA 摆放位置的进度（scrub）
 * - cross 0–1：节拍 7 锅铲妈妈交叉淡化为端碗妈妈的进度（scrub）
 * 两者都只由 ComicScroll 写。
 */
import { useSyncExternalStore } from "react";

export type MomState = { enter: number; cross: number };

let state: MomState = { enter: 0, cross: 0 };
const SERVER_STATE: MomState = { enter: 0, cross: 0 };
const subs = new Set<() => void>();

export function setMomState(patch: Partial<MomState>) {
  const next = { ...state, ...patch };
  if (next.enter === state.enter && next.cross === state.cross) return;
  state = next;
  subs.forEach((cb) => cb());
}

export function useMomState(): MomState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
    () => SERVER_STATE,
  );
}
