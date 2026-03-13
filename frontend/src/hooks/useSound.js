import { useCallback } from 'react';
import useGameStore from '../store/gameStore';

const SOUND_URLS = {
  VOTE: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  REVEAL: 'https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3',
  SUCCESS: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  TIMER_END: 'https://assets.mixkit.co/active_storage/sfx/1075/1075-preview.mp3',
};

const SOUND_KEYS = Object.keys(SOUND_URLS).reduce((acc, key) => ({ ...acc, [key]: key }), {});

// Preload sounds
const audioCache = {};
if (typeof window !== 'undefined') {
  Object.entries(SOUND_URLS).forEach(([key, url]) => {
    audioCache[key] = new Audio(url);
    audioCache[key].load();
  });
}

const useSound = () => {
  // We still observe the state to trigger re-renders if a component needs it, 
  // but playSound will read the store directly to avoid stale closures.
  const isMuted = useGameStore((state) => state.isMuted);

  const playSound = useCallback((soundKey) => {
    // Get the absolute latest state from the store at call time
    const currentMute = useGameStore.getState().isMuted;
    
    if (currentMute) return;

    const audio = audioCache[soundKey];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => {
        // Only log if it's not a common "user didn't interact yet" error
        if (e.name !== 'NotAllowedError') {
          console.warn('Audio play failed:', e);
        }
      });
    }
  }, []); // Stable identity! Fixes stale closures in socket listeners and useEffects.

  return { playSound, SOUNDS: SOUND_KEYS, isMuted };
};

export default useSound;
