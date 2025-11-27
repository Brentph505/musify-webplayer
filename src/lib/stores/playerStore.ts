import { writable } from 'svelte/store';

export type SongForPlayer = {
    id: string;
    name: string;
    artistName: string;
    albumName: string; // Added albumName to SongForPlayer
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
};

const initialPlayerState: PlayerState = {
    currentSong: null,
    isPlaying: false,
    progress: 0,
    volume: 1, // default to full volume
    recommendations: [],
    isShuffling: false,
    shuffledQueue: [],
    shuffledQueueIndex: -1,
    loopMode: 'none', // NEW: default to no loop
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

const player = writable<PlayerState>(initialPlayerState);

// The `playerStore` object will now expose all the actions.
export const playerStore = {
    subscribe: player.subscribe,

    startPlaying: (song: SongForPlayer) => {
        player.update(state => {
            // When a new song is started manually, shuffle mode is maintained,
            // and the queue is rebuilt around the selected song.
            if (state.isShuffling) {
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

            // Default behavior if not shuffling
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

    // New: Set a list of recommendations (e.g., from a song detail page)
    setRecommendations: (songs: SongForPlayer[]) => {
        player.update(state => {
            console.log(`playerStore: Received ${songs.length} new recommendations.`);
            const newState = { ...state, recommendations: songs };
            // If shuffle is active, re-shuffle the new recommendations
            if (state.isShuffling) {
                let tempRecommendations = [...songs];
                const current = state.currentSong;

                if (current && songs.some(s => s.id === current.id)) {
                    // If current song is in the new list, keep it at the front of the shuffle
                    tempRecommendations = tempRecommendations.filter(s => s.id !== current.id);
                    newState.shuffledQueue = [current, ...shuffleArray(tempRecommendations)];
                    newState.shuffledQueueIndex = 0;
                } else {
                    newState.shuffledQueue = shuffleArray(tempRecommendations);
                    // If there's no current song, or it's not in the new list, start from the top
                    newState.shuffledQueueIndex = -1;
                }
            }
            return newState;
        });
    },

    // New: Toggle shuffle mode
    toggleShuffle: () => {
        player.update(state => {
            const newIsShuffling = !state.isShuffling;
            let newShuffledQueue: SongForPlayer[] = [];
            let newShuffledQueueIndex: number = -1;

            if (newIsShuffling && state.recommendations.length > 0) {
                let tempRecommendations = [...state.recommendations];
                const current = state.currentSong;
                // If a song is playing, make it the first song in the new shuffled queue
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
            }

            return {
                ...state,
                isShuffling: newIsShuffling,
                shuffledQueue: newShuffledQueue,
                shuffledQueueIndex: newShuffledQueueIndex
            };
        });
    },

    // NEW: Toggle loop mode
    toggleLoopMode: () => {
        player.update(state => {
            let newLoopMode: 'none' | 'all' | 'one' = 'all';
            if (state.loopMode === 'all') newLoopMode = 'one';
            if (state.loopMode === 'one') newLoopMode = 'none';
            console.log(`playerStore: Loop mode set to ${newLoopMode}`);
            return { ...state, loopMode: newLoopMode };
        });
    },

    // NEW: Generic function to play the next song, respecting shuffle and loop modes
    playNextSong: () => {
        player.update(state => {
            if (!state.currentSong) return { ...state, isPlaying: false };

            // Handle shuffle mode
            if (state.isShuffling) {
                if (state.shuffledQueue.length === 0) return { ...state, isPlaying: false };
                let nextIndex = state.shuffledQueueIndex + 1;

                if (nextIndex >= state.shuffledQueue.length) {
                    if (state.loopMode === 'all') {
                        console.log('playerStore: End of shuffled queue, reshuffling for loop.');
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
            if (currentIndex === -1) return { ...state, isPlaying: false };
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

    // NEW: Function to play the previous song
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
            if (currentIndex === -1) return state;
            let prevIndex = currentIndex - 1;
            if (prevIndex < 0) {
                prevIndex = state.recommendations.length - 1; // Wrap around to the end
            }
            const prevSong = state.recommendations[prevIndex];
            return { ...state, currentSong: prevSong, progress: 0, isPlaying: true };
        });
    }
};