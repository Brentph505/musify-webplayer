import { writable } from 'svelte/store';

export type SongForPlayer = {
    id: string;
    name: string;
    artistName: string;
    primaryArtistId?: string; // NEW: Add primary artist ID for navigation
    albumName: string;
    albumImageUrl: string;
    audioUrl: string;
    duration: number; // in seconds
};

export type PlayerState = {
    currentSong: SongForPlayer | null;
    isPlaying: boolean;
    progress: number; // current playback position in seconds
    volume: number; // 0-1
    recommendations: SongForPlayer[]; // List of all loaded recommendations
    isShuffling: boolean; // Is shuffle mode active?
    shuffledQueue: SongForPlayer[]; // The currently shuffled list of songs
    shuffledQueueIndex: number; // Current index in the shuffled queue
    loopMode: 'none' | 'all' | 'one'; // NEW: loop mode state
    // `lastSongId` removed as `currentSong` is persisted
};

const PLAYER_LOCAL_STORAGE_KEY = 'musify-player-state';

// Function to load player state from localStorage
function loadPlayerStateFromLocalStorage(): Partial<PlayerState> {
    if (typeof window === 'undefined') return {}; // Server-side rendering guard
    const stored = localStorage.getItem(PLAYER_LOCAL_STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            const loadedState: Partial<PlayerState> = {};
            if (typeof parsed.isShuffling === 'boolean') loadedState.isShuffling = parsed.isShuffling;
            if (parsed.loopMode && ['none', 'all', 'one'].includes(parsed.loopMode)) loadedState.loopMode = parsed.loopMode;
            if (typeof parsed.volume === 'number') loadedState.volume = parsed.volume;

            // Load currentSong if a valid object was stored
            if (parsed.currentSong && typeof parsed.currentSong === 'object' && parsed.currentSong.id && parsed.currentSong.audioUrl) {
                loadedState.currentSong = parsed.currentSong;
            }
            return loadedState;
        } catch (e) {
            console.error("Failed to parse player state from localStorage", e);
            return {};
        }
    }
    return {};
}

// Merge initial defaults with any loaded state from localStorage
const persistedPlayerState = loadPlayerStateFromLocalStorage();

const initialPlayerState: PlayerState = {
    currentSong: persistedPlayerState.currentSong || null,
    isPlaying: false, // Always start as paused to prevent autoplay issues
    progress: 0, // Always start progress at 0 on load
    volume: persistedPlayerState.volume ?? 1, // Use persisted volume, default to 1
    recommendations: [], // Recommendations are dynamic, not persisted here
    isShuffling: persistedPlayerState.isShuffling ?? false,
    shuffledQueue: [], // Shuffled queue is dynamic, rebuilt when recommendations are set or shuffle toggled
    shuffledQueueIndex: -1,
    loopMode: persistedPlayerState.loopMode ?? 'none',
};

const player = writable<PlayerState>(initialPlayerState);

// Function to save player state to localStorage
function savePlayerStateToLocalStorage(state: PlayerState) {
    if (typeof window === 'undefined') return;
    const stateToPersist = {
        isShuffling: state.isShuffling,
        loopMode: state.loopMode,
        currentSong: state.currentSong,
        volume: state.volume
    };
    localStorage.setItem(PLAYER_LOCAL_STORAGE_KEY, JSON.stringify(stateToPersist));
}

// Subscribe to the player store to automatically save state on changes
player.subscribe(state => {
    savePlayerStateToLocalStorage(state);
});

// The `playerStore` object will now expose all the actions.
export const playerStore = {
    subscribe: player.subscribe,

    startPlaying: (song: SongForPlayer) => {
        player.update(state => {
            // Rebuild shuffled queue if shuffling and current song changes
            if (state.isShuffling && state.recommendations.length > 0) {
                const otherSongs = state.recommendations.filter(s => s.id !== song.id);
                const newShuffledQueue = [song, ...shuffleArray(otherSongs)];
                return {
                    ...state,
                    currentSong: song,
                    isPlaying: true,
                    progress: 0,
                    shuffledQueue: newShuffledQueue,
                    shuffledQueueIndex: 0
                };
            }
            return {
                ...state,
                currentSong: song,
                isPlaying: true,
                progress: 0,
            };
        });
    },

    pausePlaying: () => {
        player.update(state => ({ ...state, isPlaying: false }));
    },

    resumePlaying: () => {
        player.update(state => ({ ...state, isPlaying: true }));
    },

    updateProgress: (progress: number) => {
        player.update(state => ({ ...state, progress }));
    },

    setVolume: (volume: number) => {
        player.update(state => ({ ...state, volume }));
    },

    setRecommendations: (songs: SongForPlayer[]) => {
        player.update(state => {
            console.log(`playerStore: Received ${songs.length} new recommendations.`);
            const newState = { ...state, recommendations: songs };
            if (state.isShuffling && songs.length > 0) {
                let tempRecommendations = [...songs];
                const current = state.currentSong;

                if (current && songs.some(s => s.id === current.id)) {
                    tempRecommendations = tempRecommendations.filter(s => s.id !== current.id);
                    newState.shuffledQueue = [current, ...shuffleArray(tempRecommendations)];
                    newState.shuffledQueueIndex = 0;
                } else {
                    newState.shuffledQueue = shuffleArray(tempRecommendations);
                    newState.shuffledQueueIndex = -1; // No current song in new queue, so reset
                }
            } else {
                 newState.shuffledQueue = []; // Clear shuffled queue if shuffle is off
                 newState.shuffledQueueIndex = -1;
            }
            return newState;
        });
    },

    toggleShuffle: () => {
        player.update(state => {
            const newIsShuffling = !state.isShuffling;
            let newShuffledQueue: SongForPlayer[] = [];
            let newShuffledQueueIndex: number = -1;

            if (newIsShuffling && state.recommendations.length > 0) {
                let tempRecommendations = [...state.recommendations];
                const current = state.currentSong;
                if (current) {
                    tempRecommendations = tempRecommendations.filter(s => s.id !== current.id);
                    newShuffledQueue = [current, ...shuffleArray(tempRecommendations)];
                } else {
                    newShuffledQueue = shuffleArray(tempRecommendations);
                }
                newShuffledQueueIndex = 0;
                console.log('playerStore: Shuffle enabled. Shuffled queue created.');
            } else {
                console.log('playerStore: Shuffle disabled.');
                // When shuffle is disabled, clear the shuffled queue
                newShuffledQueue = [];
                newShuffledQueueIndex = -1;
            }

            return {
                ...state,
                isShuffling: newIsShuffling,
                shuffledQueue: newShuffledQueue,
                shuffledQueueIndex: newShuffledQueueIndex
            };
        });
    },

    toggleLoopMode: () => {
        player.update(state => {
            let newLoopMode: 'none' | 'all' | 'one' = 'all';
            if (state.loopMode === 'all') newLoopMode = 'one';
            if (state.loopMode === 'one') newLoopMode = 'none';
            console.log(`playerStore: Loop mode set to ${newLoopMode}`);
            return { ...state, loopMode: newLoopMode };
        });
    },

    restartCurrentSong: () => { // NEW method for single track looping
        player.update(state => {
            if (state.currentSong) {
                console.log(`playerStore: Restarting current song: ${state.currentSong.name}`);
                // Only reset progress and set isPlaying to true.
                // The actual audio playback will be handled by the reactive block in Player.svelte.
                return {
                    ...state,
                    progress: 0,
                    isPlaying: true,
                };
            }
            return state; // No song to restart
        });
    },

    playNextSong: () => {
        player.update(state => {
            if (!state.currentSong) return { ...state, isPlaying: false };

            // Handle shuffle mode
            if (state.isShuffling) {
                if (state.shuffledQueue.length === 0) {
                    // If shuffled queue is empty but recommendations exist, generate one
                    if (state.recommendations.length > 0) {
                         const current = state.currentSong;
                         let tempRecommendations = state.recommendations.filter(s => s.id !== current.id);
                         const newQueue = [current, ...shuffleArray(tempRecommendations)];
                         return { ...state, shuffledQueue: newQueue, shuffledQueueIndex: 0 };
                    }
                    return { ...state, isPlaying: false };
                }
                
                let nextIndex = state.shuffledQueueIndex + 1;
                if (nextIndex >= state.shuffledQueue.length) {
                    if (state.loopMode === 'all') {
                        console.log('playerStore: End of shuffled queue, reshuffling for loop.');
                        // Reshuffle the entire recommendations list if looping all
                        const newQueue = shuffleArray(state.recommendations);
                        const nextSong = newQueue[0];
                        if (!nextSong) return { ...state, isPlaying: false };
                        return { ...state, currentSong: nextSong, progress: 0, isPlaying: true, shuffledQueue: newQueue, shuffledQueueIndex: 0 };
                    }
                    return { ...state, isPlaying: false }; // Stop if not looping
                }
                const nextSong = state.shuffledQueue[nextIndex];
                return { ...state, currentSong: nextSong, progress: 0, isPlaying: true, shuffledQueueIndex: nextIndex };
            }

            // Handle sequential mode
            const currentIndex = state.recommendations.findIndex(song => song.id === state.currentSong?.id);
            if (currentIndex === -1) return { ...state, isPlaying: false }; // Current song not in recommendations

            let nextIndex = currentIndex + 1;
            if (nextIndex >= state.recommendations.length) {
                if (state.loopMode === 'all') {
                    nextIndex = 0; // Loop back to the start
                } else {
                    return { ...state, isPlaying: false }; // Stop at the end of the list
                }
            }
            const nextSong = state.recommendations[nextIndex];
            return { ...state, currentSong: nextSong, progress: 0, isPlaying: true };
        });
    },

    playPreviousSong: () => {
        player.update(state => {
            if (!state.currentSong) return state;

            // Handle shuffle mode
            if (state.isShuffling) {
                if (state.shuffledQueue.length === 0) return state;
                let prevIndex = state.shuffledQueueIndex - 1;
                if (prevIndex < 0) {
                    prevIndex = state.shuffledQueue.length - 1; // Wrap around to the end
                }
                const prevSong = state.shuffledQueue[prevIndex];
                return { ...state, currentSong: prevSong, progress: 0, isPlaying: true, shuffledQueueIndex: prevIndex };
            }

            // Handle sequential mode
            const currentIndex = state.recommendations.findIndex(song => song.id === state.currentSong?.id);
            if (currentIndex === -1) return state; // Current song not in recommendations

            let prevIndex = currentIndex - 1;
            if (prevIndex < 0) {
                prevIndex = state.recommendations.length - 1; // Wrap around to the end
            }
            const prevSong = state.recommendations[prevIndex];
            return { ...state, currentSong: prevSong, progress: 0, isPlaying: true };
        });
    }
};

// Helper function for Fisher-Yates (Knuth) shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array]; // Create a copy to avoid mutating original
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}