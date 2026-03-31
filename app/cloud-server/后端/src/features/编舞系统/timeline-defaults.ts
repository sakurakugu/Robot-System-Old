import type { TimelineData } from './types';

export function 创建默认时间轴(): TimelineData {
  return {
    tracks: [],
    config: {
      duration: 60,
      pixelsPerSecond: 100,
      currentTime: 0,
      snapToGrid: true,
      gridSize: 0.5,
    },
  };
}
