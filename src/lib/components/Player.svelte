<script lang="ts">
    import Play from 'lucide-svelte/icons/play';
    import Pause from 'lucide-svelte/icons/pause';
    import SkipBack from 'lucide-svelte/icons/skip-back';
    import SkipForward from 'lucide-svelte/icons/skip-forward';
    import Mic2 from 'lucide-svelte/icons/mic-2';
    import ListMusic from 'lucide-svelte/icons/list-music';
    import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';
    import Volume2 from 'lucide-svelte/icons/volume-2';
    import VolumeX from 'lucide-svelte/icons/volume-x';
    import Shuffle from 'lucide-svelte/icons/shuffle';
    import Repeat from 'lucide-svelte/icons/repeat';
    import Repeat1 from 'lucide-svelte/icons/repeat-1';

    import { onMount, onDestroy } from 'svelte';
    import { goto } from '$app/navigation';
    import Eq from './Eq.svelte';

    import { playerStore, type PlayerState, type SongForPlayer } from '$lib/stores/playerStore.js';
    import { audioEffectsStore, initialEqBands, type AudioEffectsState } from '$lib/stores/audioEffectsStore.js';

    let audioElement: HTMLAudioElement;
    
    // PlayerStore state
    let currentSong: SongForPlayer | null;
    let isPlaying: boolean;
    let progress: number;
    let volume: number;
    let duration: number = 0;
    let isShuffling: boolean;
    let loopMode: 'none' | 'all' | 'one';

    // AudioEffectsStore state
    let audioEffectsState: AudioEffectsState | null = null;
    $: eqGains = audioEffectsState?.eqGains ?? [];
    $: convolverEnabled = audioEffectsState?.convolverEnabled ?? false;
    $: convolverMix = audioEffectsState?.convolverMix ?? 0.3;
    $: impulseResponseBuffer = audioEffectsState?.impulseResponseBuffer ?? null;
    $: availableIrs = audioEffectsState?.availableIrs || [];
    $: selectedIrUrl = audioEffectsState?.selectedIrUrl ?? null;
    $: genericReverbEnabled = audioEffectsState?.genericReverbEnabled ?? false;
    $: genericReverbMix = audioEffectsState?.genericReverbMix ?? 0.2;
    $: genericReverbDecay = audioEffectsState?.genericReverbDecay ?? 0.6;
    $: genericReverbDamping = audioEffectsState?.genericReverbDamping ?? 6000;
    $: genericReverbPreDelay = audioEffectsState?.genericReverbPreDelay ?? 0.02;
    $: genericReverbType = audioEffectsState?.genericReverbType ?? 'hall';
    // NEW: Bind modulation parameters from the store
    $: genericReverbModulationRate = audioEffectsState?.genericReverbModulationRate ?? 2.5;
    $: genericReverbModulationDepth = audioEffectsState?.genericReverbModulationDepth ?? 0.001;
    // NEW: Bind compressor parameters from the store
    $: compressorEnabled = audioEffectsState?.compressorEnabled ?? false;
    $: compressorThreshold = audioEffectsState?.compressorThreshold ?? -24;
    $: compressorKnee = audioEffectsState?.compressorKnee ?? 30;
    $: compressorRatio = audioEffectsState?.compressorRatio ?? 12;
    $: compressorAttack = audioEffectsState?.compressorAttack ?? 0.003;
    $: compressorRelease = audioEffectsState?.compressorRelease ?? 0.25;
    $: pannerPosition = audioEffectsState?.pannerPosition ?? { x: 0, y: 0, z: 0 };
    $: pannerAutomationEnabled = audioEffectsState?.pannerAutomationEnabled ?? false;
    $: pannerAutomationRate = audioEffectsState?.pannerAutomationRate ?? 0.1;
    $: spatialAudioEnabled = audioEffectsState?.spatialAudioEnabled ?? true;
    // NEW: Bind loudness state from the store
    $: loudnessNormalizationEnabled = audioEffectsState?.loudnessNormalizationEnabled ?? false;
    $: loudnessTarget = audioEffectsState?.loudnessTarget ?? -14;
    $: momentaryLoudness = audioEffectsState?.momentaryLoudness ?? -70;

    const PLAYER_UI_LOCAL_STORAGE_KEY = 'musify-player-ui-settings';
    let showEq: boolean = false;
    let audioEffectsInitialized: boolean = false; // NEW: Track if audio effects are initialized

    // FADE EFFECT CONSTANT
    const FADE_DURATION_SECONDS = 0.5; // Duration of the fade effect in seconds

    // Keep track of the previously playing song to detect changes
    let previousSongId: string | null = null;
    let isFadingOut: boolean = false; // Flag to prevent multiple fade operations

    // Visualizer state
    let bassIntensity = 0; // Normalized 0-1
    let animationFrameId: number;
    let frequencyData: Uint8Array;

    // Configuration for bass detection (adjust these values as needed)
    const BASS_LOW_FREQ = 60; // Hz
    const BASS_HIGH_FREQ = 250; // Hz
    const BASS_BOOST = 2.0; // Increased boost for more impact
    const BASS_SMOOTHING_FACTOR = 0.2; // Lowered for faster, "blinking" response
    const GLOW_COLOR = 'rgba(74, 222, 128, 0.7)'; // Tailwind green-500 equivalent with alpha

    // NEW: Wake Lock API
    let wakeLock: WakeLockSentinel | null = null;

    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                // Ensure a previous lock is released before requesting a new one
                if (wakeLock) {
                    await wakeLock.release().catch(err => console.warn('Error releasing prior wake lock:', err));
                    wakeLock = null;
                }
                
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock requested!');

                wakeLock.addEventListener('release', () => {
                    console.log('Wake Lock was released by the system.');
                    // Attempt to re-acquire wake lock if still playing
                    if (isPlaying) { // Assuming `isPlaying` is correctly reflecting player state
                        console.log('Attempting to re-acquire Wake Lock...');
                        requestWakeLock(); // Recursive call, but safe as it's triggered by an event
                    }
                });
            } catch (err: any) {
                console.error(`Wake Lock Error: ${err.name}, ${err.message}`);
            }
        } else {
            console.warn('Wake Lock API not supported in this browser.');
        }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            wakeLock.release()
                .then(() => {
                    wakeLock = null;
                    console.log('Wake Lock released!');
                })
                .catch((err: any) => {
                    console.error('Error releasing Wake Lock:', err);
                });
        }
    }

    function loadPlayerUiSettings() {
        if (typeof window !== 'undefined' && window.localStorage) {
            const storedUiSettings = localStorage.getItem(PLAYER_UI_LOCAL_STORAGE_KEY);
            if (storedUiSettings) {
                try {
                    const settings = JSON.parse(storedUiSettings);
                    if (typeof settings.showEq === 'boolean') {
                        showEq = settings.showEq;
                    }
                } catch (e) {
                    console.error('Player.svelte: Failed to parse player UI settings from localStorage:', e);
                }
            }
        }
    }

    function savePlayerUiSettings() {
        if (typeof window !== 'undefined' && window.localStorage) {
            const uiSettingsToSave = { showEq };
            localStorage.setItem(PLAYER_UI_LOCAL_STORAGE_KEY, JSON.stringify(uiSettingsToSave));
            console.log('Player.svelte: UI settings saved:', uiSettingsToSave);
        }
    }

    function startVisualizerAnimation() {
        if (!audioEffectsState?.analyserNode || !audioEffectsState?.audioContext) {
            console.warn('AnalyserNode or AudioContext not available for visualizer.');
            return;
        }

        frequencyData = new Uint8Array(audioEffectsState.analyserNode.frequencyBinCount);
        updateVisualizer();
    }

    function updateVisualizer() {
        if (!audioEffectsState?.analyserNode || !audioEffectsState?.audioContext) {
            cancelAnimationFrame(animationFrameId);
            return;
        }

        audioEffectsState.analyserNode.getByteFrequencyData(frequencyData as any);

        const bufferLength = audioEffectsState.analyserNode.frequencyBinCount;
        const sampleRate = audioEffectsState.audioContext.sampleRate;

        // Calculate frequency bin indices for bass range
        const bassLowIndex = Math.floor(BASS_LOW_FREQ / (sampleRate / 2) * bufferLength);
        const bassHighIndex = Math.floor(BASS_HIGH_FREQ / (sampleRate / 2) * bufferLength);

        let sumBass = 0;
        for (let i = bassLowIndex; i <= bassHighIndex; i++) {
            sumBass += frequencyData[i];
        }

        const averageBass = sumBass / (bassHighIndex - bassLowIndex + 1);
        
        // Normalize the averageBass value (0-255) and apply boost
        let normalizedBass = (averageBass / 255) * BASS_BOOST;
        normalizedBass = Math.max(0, Math.min(1, normalizedBass)); // Clamp between 0 and 1

        // Smooth the bass intensity
        bassIntensity = bassIntensity * BASS_SMOOTHING_FACTOR + normalizedBass * (1 - BASS_SMOOTHING_FACTOR);

        animationFrameId = requestAnimationFrame(updateVisualizer);
    }


    onMount(async () => {
        loadPlayerUiSettings();

        const unsubscribePlayer = playerStore.subscribe((state: PlayerState) => {
            currentSong = state.currentSong;
            isPlaying = state.isPlaying;
            progress = state.progress;
            volume = state.volume;
            isShuffling = state.isShuffling;
            loopMode = state.loopMode;

            // NEW: Handle wake lock based on isPlaying
            if (isPlaying) {
                requestWakeLock();
            } else {
                releaseWakeLock();
            }

            // Handle song changes and audio loading with fade effects
            if (audioEffectsState && audioEffectsState.audioContext) {
                // If a new song is being set (currentSong is not null and its ID is different from the previous)
                if (currentSong && currentSong.id !== previousSongId) {
                    const songToLoad = currentSong; // Capture song to prevent race condition with timeout
                    // Only fade out if something was playing before and it's not the initial load or clearing
                    if (previousSongId !== null && !audioElement.paused && !isFadingOut) {
                        isFadingOut = true;
                        // Fade out current audio, explicitly using FADE_DURATION_SECONDS
                         
                        
                        setTimeout(() => {
                            // After fade out, change song source
                            audioElement.src = songToLoad.audioUrl;
                            audioElement.load();
                            console.log('Player.svelte subscribe: New song src loaded for:', songToLoad.name);
                            isFadingOut = false;
                            
                            // Ensure volume is set for the new song, fading in if should be playing
                            // Explicitly use FADE_DURATION_SECONDS for fade-in
                             
                            // The reactive block `$: { if (isPlaying) ... }` will handle audioElement.play()
                        }, FADE_DURATION_SECONDS * 1000); // Wait for fade out duration
                    } else if (!isFadingOut) { // First song, or player was paused when song changed
                        audioElement.src = songToLoad.audioUrl;
                        audioElement.load();
                        console.log('Player.svelte subscribe: First song or paused when song changed, src loaded for:', songToLoad.name);
                        // Set volume without fade-in if paused, or with fade-in if playing (handled by reactive block)
                        audioEffectsStore.setMasterVolume(volume);
                    }
                } else if (!currentSong && previousSongId !== null) {
                    // If currentSong becomes null (e.g., player cleared from external action)
                    if (!isFadingOut) { // Ensure not already fading from a song change
                         isFadingOut = true;
                         setTimeout(() => {
                             audioElement.src = '';
                             audioElement.load();
                             isFadingOut = false;
                             audioEffectsStore.setMasterVolume(volume); // Reset volume to current store volume
                             console.log('Player.svelte subscribe: Audio source cleared with fade-out.');
                         }, FADE_DURATION_SECONDS * 1000);
                    } else {
                        // If already fading due to a song change, just clear source
                        audioElement.src = '';
                        audioElement.load();
                        console.log('Player.svelte subscribe: Audio source cleared during another fade.');
                    }
                } else if (!isFadingOut) {
                    // If current song is the same (or initially no song) AND not in the middle of a fade-out.
                    // This covers manual volume changes for the *same* song.
                    audioEffectsStore.setMasterVolume(volume);
                }
            } else {
                // Fallback if audioEffectsState/audioContext not ready for fading
                if (currentSong && audioElement.src !== currentSong.audioUrl) {
                    audioElement.src = currentSong.audioUrl;
                    audioElement.load();
                    console.log('Player.svelte subscribe: New song src loaded (no effects/fade):', currentSong.name);
                } else if (!currentSong && audioElement.src) {
                    audioElement.src = '';
                    audioElement.load();
                    console.log('Player.svelte subscribe: Audio source cleared (no effects/fade).');
                }
            }

            previousSongId = currentSong?.id || null;
        });

        const unsubscribeAudioEffects = audioEffectsStore.subscribe(state => {
            audioEffectsState = state;
            // When audioEffectsState is initialized or changed, ensure master volume reflects current player store volume
            if (audioEffectsState && audioEffectsState.audioContext && audioEffectsState.masterGainNode && !isFadingOut) {
                audioEffectsStore.setMasterVolume(volume);
            }
            // Start visualizer once audioEffectsStore is initialized and has analyserNode
            if (audioEffectsState?.analyserNode && !animationFrameId) {
                startVisualizerAnimation();
            }
        });

        // The audioEffectsStore.init() call is now handled by the reactive block below
        // to ensure it only runs after a user gesture (i.e., the first play).
        
        if (audioElement) {
            audioElement.volume = 1; // Always keep HTML5 audio volume at 1, control via Web Audio API
            console.log('Player.svelte onMount: audioElement.volume set to 1 (controlled by Web Audio API).');
        }

        const resumeAudioContext = () => {
            if (audioEffectsState?.audioContext?.state === 'suspended') {
                audioEffectsState.audioContext.resume().then(() => {
                    console.log('Player.svelte: AudioContext resumed by user interaction.');
                }).catch(e => console.error('Player.svelte: Error resuming AudioContext:', e));
            }
        };
        document.addEventListener('click', resumeAudioContext, { passive: true });
        document.addEventListener('keydown', resumeAudioContext, { passive: true });

        onDestroy(() => {
            document.removeEventListener('click', resumeAudioContext);
            document.removeEventListener('keydown', resumeAudioContext);
            unsubscribePlayer();
            unsubscribeAudioEffects();
            audioEffectsStore.destroy();
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            // NEW: Release wake lock on destroy
            releaseWakeLock();
            // Clear Media Session on component destroy
            if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
                navigator.mediaSession.metadata = null;
                navigator.mediaSession.setActionHandler('play', null);
                navigator.mediaSession.setActionHandler('pause', null);
                navigator.mediaSession.setActionHandler('nexttrack', null);
                navigator.mediaSession.setActionHandler('previoustrack', null);
                // navigator.mediaSession.setActionHandler('stop', null); // Uncomment if 'stop' handler was set
            }
        });
    });

    // Reactive block for play/pause logic
    // This block now handles initializing the AudioContext on the first play attempt.
    $: {
        if (isPlaying && currentSong && !audioEffectsInitialized && audioElement) {
            // First play attempt: initialize the audio effects store. This requires a user gesture.
            const initializeAndPlay = async () => {
                console.log("Player.svelte reactive: First play detected, initializing AudioContext...");
                try {
                    await audioEffectsStore.init(audioElement, volume);
                    audioEffectsInitialized = true;
                    // The reactive block will re-run after this, and the next condition will handle the play.
                } catch (e) {
                    console.error("Player.svelte: Failed to initialize audio effects:", e);
                }
            };
            initializeAndPlay();
        } else if (audioEffectsInitialized && audioElement && audioEffectsState?.audioContext && !isFadingOut) {
            // Audio effects are initialized, handle play/pause.
            if (isPlaying) {
                if (currentSong) { // Only attempt to play if there's a current song
                    if (audioEffectsState.audioContext.state === 'suspended') {
                        console.log('Player.svelte reactive: Attempting to resume AudioContext before playing.');
                        audioEffectsState.audioContext.resume().then(() => {
                            audioElement.play().catch((e: Error) => console.error("Player.svelte reactive: Error playing audio (resume then play):", e));
                        });
                    } else {
                        audioElement.play().catch((e: Error) => console.error("Player.svelte reactive: Error playing audio:", e));
                    }
                } else {
                    // If isPlaying is true but no currentSong, pause playerStore
                    playerStore.pausePlaying();
                }
            } else {
                audioElement.pause();
                console.log('Player.svelte reactive: Audio paused.');
            }
        } else if (audioElement && !currentSong && isPlaying) {
             // This covers cases where `isPlaying` is true but `currentSong` is null.
             // It should result in pausing.
             playerStore.pausePlaying();
        }
    }

    // NEW: Media Session API integration for browser notifications and background control
    $: {
        if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
            if (currentSong) {
                // Set Media Session Metadata
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: currentSong.name,
                    artist: currentSong.artistName,
                    album: currentSong.albumName,
                    artwork: [
                        // Provide multiple sizes for better compatibility and display.
                        // Ensure albumImageUrl is an absolute URL or data URI.
                        { src: currentSong.albumImageUrl, sizes: '96x96', type: 'image/jpeg' },
                        { src: currentSong.albumImageUrl, sizes: '128x128', type: 'image/jpeg' },
                        { src: currentSong.albumImageUrl, sizes: '192x192', type: 'image/jpeg' },
                        { src: currentSong.albumImageUrl, sizes: '256x256', type: 'image/jpeg' },
                        { src: currentSong.albumImageUrl, sizes: '384x384', type: 'image/jpeg' },
                        { src: currentSong.albumImageUrl, sizes: '512x512', type: 'image/jpeg' },
                    ],
                });

                // Set Action Handlers for playback control from system notifications
                navigator.mediaSession.setActionHandler('play', () => {
                    console.log('Media Session: Play action received.');
                    playerStore.resumePlaying();
                });
                navigator.mediaSession.setActionHandler('pause', () => {
                    console.log('Media Session: Pause action received.');
                    playerStore.pausePlaying();
                });
                navigator.mediaSession.setActionHandler('nexttrack', () => {
                    console.log('Media Session: Next track action received.');
                    playerStore.playNextSong();
                });
                navigator.mediaSession.setActionHandler('previoustrack', () => {
                    console.log('Media Session: Previous track action received.');
                    playerStore.playPreviousSong();
                });

                // Optional: You can add more handlers for seeking if desired
                // navigator.mediaSession.setActionHandler('seekto', (details) => { /* handle seek */ });
                // navigator.mediaSession.setActionHandler('seekforward', (details) => { /* handle seek forward */ });
                // navigator.mediaSession.setActionHandler('seekbackward', (details) => { /* handle seek backward */ });
                // For a 'stop' action, pausing is often sufficient:
                // navigator.mediaSession.setActionHandler('stop', () => playerStore.pausePlaying());

            } else {
                // Clear Media Session if no song is playing to remove the notification
                navigator.mediaSession.metadata = null;
                navigator.mediaSession.setActionHandler('play', null);
                navigator.mediaSession.setActionHandler('pause', null);
                navigator.mediaSession.setActionHandler('nexttrack', null);
                navigator.mediaSession.setActionHandler('previoustrack', null);
                // navigator.mediaSession.setActionHandler('stop', null); // Clear if 'stop' handler was set
            }

            // Update playback state to inform the browser whether media is actively playing or paused
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }
    }

    $: showEq, savePlayerUiSettings();

    function formatTime(seconds: number | null): string {
        if (seconds === null || isNaN(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    function handleTimeUpdate() {
        if (audioElement && currentSong) {
            playerStore.updateProgress(audioElement.currentTime);
            progress = audioElement.currentTime;
        }
    }

    function handleLoadedMetadata() {
        if (audioElement) {
            duration = audioElement.duration;
            console.log('Player.svelte handleLoadedMetadata: Audio duration set to:', duration);
        }
    }

    function handleEnded() {
        if (loopMode === 'one') {
            audioElement.currentTime = 0;
            audioElement.play().catch(e => console.error("Player.svelte handleEnded: Error looping single track:", e));
            playerStore.resumePlaying();
        } else {
            playerStore.playNextSong();
        }
        console.log(`Player.svelte handleEnded: Song ended. LoopMode: ${loopMode}, Shuffling: ${isShuffling}`);
    }

    function handleError(e: Event) {
        console.error("Player.svelte handleError: Audio error:", e);
    }

    function togglePlayPause() {
        if (currentSong) {
            if (isPlaying) {
                playerStore.pausePlaying();
            } else {
                playerStore.resumePlaying();
            }
            console.log('Player.svelte togglePlayPause: isPlaying toggled to', !isPlaying);
        }
    }

    function handleVolumeChange(event: Event) {
        const newVolume = (event.currentTarget as HTMLInputElement).valueAsNumber / 100;
        playerStore.setVolume(newVolume);
    }

    function handleProgressBarChange(event: Event) {
        if (audioElement && currentSong && duration > 0) {
            const newProgress = ((event.currentTarget as HTMLInputElement).valueAsNumber / 100) * duration;
            audioElement.currentTime = newProgress;
            playerStore.updateProgress(newProgress);
        }
    }

    function toggleEqVisibility() {
        showEq = !showEq;
        console.log('Player.svelte toggleEqVisibility: EQ UI visibility toggled to', showEq);
    }

    function navigateToSong() {
        if (currentSong?.id) {
            goto(`/song/${currentSong.id}`);
        }
    }

    function navigateToArtist(event: Event) {
        event.stopPropagation();
        console.log('Attempting to navigate to artist:', currentSong?.artistName, 'with ID:', currentSong?.primaryArtistId);
        if (currentSong?.primaryArtistId) {
            goto(`/artist/${currentSong.primaryArtistId}`);
        } else {
            console.warn('Cannot navigate to artist: primaryArtistId is missing for the current song.');
        }
    }

    function toggleShuffleLoopMode() {
        if (!currentSong) return; // Disable if no song is playing

        // This function cycles through three states:
        // 1. Normal Playback (shuffle OFF, loop 'none')
        // 2. Shuffle Mode (shuffle ON, loop 'none')
        // 3. Loop One Mode (shuffle OFF, loop 'one')
        // It uses playerStore.toggleShuffle() and playerStore.toggleLoopMode()
        // assuming toggleLoopMode cycles 'none' -> 'all' -> 'one' -> 'none'.

        if (isShuffling) {
            // Currently in Shuffle Mode -> Switch to Loop One Mode
            playerStore.toggleShuffle(); // Sets isShuffling to false
            // Cycle loopMode to 'one'. If current loopMode is 'none', it takes two toggles.
            playerStore.toggleLoopMode(); // 'none' -> 'all'
            playerStore.toggleLoopMode(); // 'all' -> 'one'
            console.log('Player.svelte: Switched from Shuffle to Loop One');
        } else if (loopMode === 'one') {
            // Currently in Loop One Mode -> Switch to Normal Playback
            playerStore.toggleLoopMode(); // Sets loopMode to 'none'
            // Shuffle should already be off, no need to toggleShuffle here.
            console.log('Player.svelte: Switched from Loop One to Normal');
        } else { // (loopMode === 'none' && !isShuffling), i.e., Normal Playback
            // Currently in Normal Playback -> Switch to Shuffle Mode
            playerStore.toggleShuffle(); // Sets isShuffling to true
            // Loop mode should already be 'none', no action needed for loopMode.
            console.log('Player.svelte: Switched from Normal to Shuffle');
        }
    }
</script>

<!-- Hidden Audio Element -->
<audio
    bind:this={audioElement}
    on:timeupdate={handleTimeUpdate}
    on:loadedmetadata={handleLoadedMetadata}
    on:ended={handleEnded}
    on:error={handleError}
    on:play={() => { if (!isPlaying) playerStore.resumePlaying(); }} 
    on:pause={() => { if (isPlaying) playerStore.pausePlaying(); }} 
    preload="metadata"
    crossorigin="anonymous"
></audio>

<!-- Mobile Player -->
<footer class="bg-black border-t border-gray-800 h-16 md:h-[90px] fixed bottom-0 left-0 right-0 z-50">
    <!-- Mobile Layout -->
    <div class="md:hidden h-full flex flex-col">
        <!-- Progress Bar (thin, at the very top) -->
        <div class="w-full h-1 bg-gray-800 relative">
            <input
                type="range"
                min="0"
                max="100"
                value={duration > 0 ? (progress / duration) * 100 : 0}
                on:input={handleProgressBarChange}
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={!currentSong}
            />
            <!-- Removed transition-all class, added inline transition for width only -->
            <div class="h-full bg-green-500" style="width: {duration > 0 ? (progress / duration) * 100 : 0}%; box-shadow: 0 0 {bassIntensity * 8}px {GLOW_COLOR}; transition: width 100ms linear;"></div>
        </div>

        <!-- Main Mobile Content -->
        <div class="flex-1 flex items-center justify-between px-3">
            <!-- Track Info -->
            <div class="flex items-center gap-3 flex-1 min-w-0">
                {#if currentSong}
                    <img
                        src={currentSong.albumImageUrl}
                        alt={currentSong.name}
                        class="w-12 h-12 rounded object-cover shrink-0"
                    />
                    <div class="min-w-0 flex-1 max-w-20">
                        <button
                            class="font-semibold text-sm text-white truncate text-left w-full hover:underline"
                            on:click={navigateToSong}
                            aria-label="View current song details"
                        >
                            {currentSong.name}
                        </button>
                        <button
                            class="text-xs text-gray-400 truncate hover:underline text-left w-full"
                            on:click={navigateToArtist}
                            aria-label="View artist page for {currentSong.artistName}"
                        >
                            {currentSong.artistName}
                        </button>
                    </div>
                {:else}
                    <div class="w-12 h-12 bg-gray-800 rounded shrink-0"></div>
                    <div class="min-w-0 flex-1 max-w-20">
                        <div class="font-semibold text-sm text-white">No song playing</div>
                    </div>
                {/if}
            </div>

            <!-- Mobile Controls -->
            <div class="flex items-center gap-2 shrink-0">
                <button
                    class="text-gray-400 hover:text-white transition-colors {isShuffling ? 'text-green-500' : ''}"
                    on:click={playerStore.toggleShuffle}
                    disabled={!currentSong}
                    aria-label="Toggle Shuffle"
                >
                    <Shuffle size={20} />
                </button>
                <button
                    class="text-gray-400 hover:text-white transition-colors"
                    on:click={playerStore.playPreviousSong}
                    disabled={!currentSong}
                    aria-label="Play Previous Song"
                >
                    <SkipBack size={24} />
                </button>
                <button
                    class="text-gray-400 hover:text-white transition-colors"
                    on:click={playerStore.playNextSong}
                    disabled={!currentSong}
                    aria-label="Play Next Song"
                >
                    <SkipForward size={24} />
                </button>
                <button
                    class="text-gray-400 hover:text-white transition-colors {loopMode !== 'none' ? 'text-green-500' : ''}"
                    on:click={playerStore.toggleLoopMode}
                    disabled={!currentSong}
                    aria-label="Toggle Loop Mode"
                >
                    {#if loopMode === 'one'}
                        <Repeat1 size={20} />
                    {:else}
                        <Repeat size={20} />
                    {/if}
                </button>
                <button
                    class="text-gray-400 hover:text-white transition-colors {showEq ? 'text-green-500' : ''}"
                    on:click={toggleEqVisibility}
                    aria-label="Toggle Equalizer"
                >
                    <SlidersHorizontal size={20} />
                </button>
                <button
                    class="text-gray-400 hover:text-white transition-colors"
                    on:click={togglePlayPause}
                    disabled={!currentSong}
                    aria-label="Play or Pause Song"
                >
                    {#if isPlaying}
                        <Pause size={28} fill="white" />
                    {:else}
                        <Play size={28} fill="white" class="ml-0.5" />
                    {/if}
                </button>
            </div>
        </div>
    </div>

    <!-- Desktop Layout -->
    <div class="hidden md:grid md:grid-cols-[1fr_2fr_1fr] items-center gap-8 px-4 h-full">
        <!-- Track Info -->
        <div class="flex items-center gap-3 hover:bg-gray-900/30 p-2 rounded transition-colors text-left">
            {#if currentSong}
                <img
                    src={currentSong.albumImageUrl}
                    alt={currentSong.name}
                    class="w-14 h-14 rounded object-cover"
                />
                <div class="min-w-0">
                    <button
                        class="font-semibold text-sm text-white truncate hover:underline text-left w-full"
                        on:click={navigateToSong}
                        aria-label="View current song details"
                    >
                        {currentSong.name}
                    </button>
                    <button
                        class="text-xs text-gray-400 truncate hover:underline text-left w-full"
                        on:click={navigateToArtist}
                        aria-label="View artist page for {currentSong.artistName}"
                    >
                        {currentSong.artistName}
                    </button>
                </div>
            {:else}
                <div class="w-14 h-14 bg-gray-800 rounded"></div>
                <div>
                    <div class="font-semibold text-sm text-white">No song playing</div>
                    <div class="text-xs text-gray-400"></div>
                </div>
            {/if}
        </div>

        <!-- Player Controls -->
        <div class="flex flex-col items-center gap-2 w-full">
            <div class="flex items-center gap-4">
                <button
                    class="text-gray-400 hover:text-white transition-colors {isShuffling ? 'text-green-500' : ''}"
                    on:click={playerStore.toggleShuffle}
                    disabled={!currentSong}
                    aria-label="Toggle Shuffle"
                >
                    <Shuffle size={16} />
                </button>
                <button
                    class="text-gray-400 hover:text-white transition-colors"
                    on:click={playerStore.playPreviousSong}
                    disabled={!currentSong}
                >
                    <SkipBack size={20} />
                </button>
                <button
                    class="bg-white text-black rounded-full w-8 h-8 flex items-center justify-center hover:scale-105 transition-transform"
                    on:click={togglePlayPause}
                    disabled={!currentSong}
                >
                    {#if isPlaying}
                        <Pause size={18} fill="black" />
                    {:else}
                        <Play size={18} fill="black" class="ml-0.5" />
                    {/if}
                </button>
                <button
                    class="text-gray-400 hover:text-white transition-colors"
                    on:click={playerStore.playNextSong}
                    disabled={!currentSong}
                >
                    <SkipForward size={20} />
                </button>
                <button
                    class="text-gray-400 hover:text-white transition-colors {loopMode !== 'none' ? 'text-green-500' : ''}"
                    on:click={playerStore.toggleLoopMode}
                    disabled={!currentSong}
                    aria-label="Toggle Loop Mode"
                >
                    {#if loopMode === 'one'}
                        <Repeat1 size={16} />
                    {:else}
                        <Repeat size={16} />
                    {/if}
                </button>
            </div>
            <div class="flex items-center gap-2 w-full max-w-2xl text-xs text-gray-400">
                <span class="w-10 text-right">{formatTime(progress)}</span>
                <div class="flex-1 h-1 bg-gray-700 rounded-full relative group">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={duration > 0 ? (progress / duration) * 100 : 0}
                        on:input={handleProgressBarChange}
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={!currentSong}
                    />
                    <!-- Removed transition-all class, added inline transition for width only -->
                    <div class="h-full bg-white rounded-full relative" style="width: {duration > 0 ? (progress / duration) * 100 : 0}%; box-shadow: 0 0 {bassIntensity * 8}px {GLOW_COLOR}; transition: width 100ms linear;">
                        <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                </div>
                <span class="w-10">{formatTime(duration || currentSong?.duration || 0)}</span>
            </div>
        </div>

        <!-- Extra Controls -->
        <div class="flex justify-end items-center gap-4">
            <button class="text-gray-400 hover:text-white transition-colors">
                <Mic2 size={18} />
            </button>
            <button class="text-gray-400 hover:text-white transition-colors">
                <ListMusic size={18} />
            </button>
            <button
                class="text-gray-400 hover:text-white transition-colors {showEq ? 'text-green-500' : ''}"
                on:click={toggleEqVisibility}
                aria-label="Toggle Equalizer"
            >
                <SlidersHorizontal size={18} />
            </button>
            <button
                class="text-gray-400 hover:text-white transition-colors"
                on:click={() => playerStore.setVolume(volume > 0 ? 0 : 1)}
                aria-label="Toggle Mute"
            >
                {#if volume > 0}
                    <Volume2 size={18} />
                {:else}
                    <VolumeX size={18} />
                {/if}
            </button>
            <div class="w-24 h-1 bg-gray-700 rounded-full relative group">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume * 100}
                    on:input={handleVolumeChange}
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div class="h-full bg-white rounded-full relative transition-all" style="width: {volume * 100}%">
                    <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
            </div>
        </div>
    </div>
</footer>

<!-- EQ Component Overlay -->
{#if showEq && audioEffectsState?.audioContext && audioEffectsState?.filterNodes && audioEffectsState?.convolverNode && audioEffectsState?.compressorNode}
    <div class="fixed bottom-16 md:bottom-[90px] right-0 z-1000 p-2.5 flex justify-end md:w-[550px]">
        <Eq
            audioContext={audioEffectsState.audioContext}
            bands={initialEqBands}
            filterNodes={audioEffectsState.filterNodes}
            convolverNode={audioEffectsState.convolverNode}
            impulseResponseBuffer={impulseResponseBuffer}
            availableIrs={availableIrs}
            bind:eqGains={eqGains}
            bind:convolverEnabled={convolverEnabled}
            bind:convolverMix={convolverMix}
            bind:selectedIrUrl={selectedIrUrl}
            bind:reverbEnabled={genericReverbEnabled}
            bind:reverbMix={genericReverbMix}
            bind:reverbDecay={genericReverbDecay}
            bind:reverbDamping={genericReverbDamping}
            bind:reverbPreDelay={genericReverbPreDelay}
            bind:reverbType={genericReverbType}
            bind:reverbModulationRate={genericReverbModulationRate}
            bind:reverbModulationDepth={genericReverbModulationDepth}
            bind:compressorEnabled={compressorEnabled}
            bind:compressorThreshold={compressorThreshold}
            bind:compressorKnee={compressorKnee}
            bind:compressorRatio={compressorRatio}
            bind:compressorAttack={compressorAttack}
            bind:compressorRelease={compressorRelease}
            bind:pannerPosition={pannerPosition}
            bind:pannerAutomationEnabled={pannerAutomationEnabled}
            bind:pannerAutomationRate={pannerAutomationRate}
            bind:spatialAudioEnabled={spatialAudioEnabled}
            
            bind:loudnessNormalizationEnabled={loudnessNormalizationEnabled}
            bind:loudnessTarget={loudnessTarget}
            momentaryLoudness={momentaryLoudness}

            on:updateEqGain={(e) => audioEffectsStore.updateEqGain(e.detail.index, e.detail.value)}
            on:applyEqPreset={(e) => audioEffectsStore.applyEqPreset(e.detail.gains)}
            on:selectIr={(e) => audioEffectsStore.selectIr(e.detail.url)}
            on:toggleConvolver={(e) => audioEffectsStore.toggleConvolver(e.detail.enabled)}
            on:setConvolverMix={(e) => audioEffectsStore.setConvolverMix(e.detail.mix)}
            on:toggleGenericReverb={(e) => audioEffectsStore.toggleGenericReverb(e.detail.enabled)}
            on:setGenericReverbMix={(e) => audioEffectsStore.setGenericReverbMix(e.detail.mix)}
            on:setGenericReverbDecay={(e) => audioEffectsStore.setGenericReverbDecay(e.detail.decay)}
            on:setGenericReverbDamping={(e) => audioEffectsStore.setGenericReverbDamping(e.detail.damping)}
            on:setGenericReverbPreDelay={(e) => audioEffectsStore.setGenericReverbPreDelay(e.detail.preDelay)}
            on:setGenericReverbType={(e) => audioEffectsStore.setGenericReverbType(e.detail.type)}
            on:setGenericReverbModulationRate={(e) => audioEffectsStore.setGenericReverbModulationRate(e.detail.rate)}
            on:setGenericReverbModulationDepth={(e) => audioEffectsStore.setGenericReverbModulationDepth(e.detail.depth)}
            on:toggleCompressor={(e) => audioEffectsStore.toggleCompressor(e.detail.enabled)}
            on:setCompressorThreshold={(e) => audioEffectsStore.setCompressorThreshold(e.detail.threshold)}
            on:setCompressorKnee={(e) => audioEffectsStore.setCompressorKnee(e.detail.knee)}
            on:setCompressorRatio={(e) => audioEffectsStore.setCompressorRatio(e.detail.ratio)}
            on:setCompressorAttack={(e) => audioEffectsStore.setCompressorAttack(e.detail.attack)}
            on:setCompressorRelease={(e) => audioEffectsStore.setCompressorRelease(e.detail.release)}
            on:setPannerPosition={(e) => audioEffectsStore.setPannerPosition(e.detail.position)}
            on:togglePannerAutomation={(e) => audioEffectsStore.togglePannerAutomation(e.detail.enabled)}
            on:setPannerAutomationRate={(e) => audioEffectsStore.setPannerAutomationRate(e.detail.rate)}
            on:toggleSpatialAudio={(e) => audioEffectsStore.toggleSpatialAudio(e.detail.enabled)}
            on:toggleLoudnessNormalization={(e) => audioEffectsStore.toggleLoudnessNormalization(e.detail.enabled)}
            on:setLoudnessTarget={(e) => audioEffectsStore.setLoudnessTarget(e.detail.target)}
        />
    </div>
{/if}