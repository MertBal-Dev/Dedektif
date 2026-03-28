'use client';

import { useGameContext } from './GameContext';

export function useGame() {
  return useGameContext();
}