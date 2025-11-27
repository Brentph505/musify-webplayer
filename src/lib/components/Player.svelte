<script lang="ts">
    import Play from 'lucide-svelte/icons/play';
    import Pause from 'lucide-svelte/icons/pause';
    import SkipBack from 'lucide-svelte/icons/skip-back';
    import SkipForward from 'lucide-svelte/icons/skip-forward';
    import Mic2 from 'lucide-svelte/icons/mic-2';
    import ListMusic from 'lucide-svelte/icons/list-music';
    import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal'; // Used to toggle EQ
    import Volume2 from 'lucide-svelte/icons/volume-2';
    import VolumeX from 'lucide-svelte/icons/volume-x'; // For muted state
    import Shuffle from 'lucide-svelte/icons/shuffle'; // Import Shuffle icon
    import Repeat from 'lucide-svelte/icons/repeat'; // Import Repeat icon for loop all
    import Repeat1 from 'lucide-svelte/icons/repeat-1'; // Import Repeat1 icon for loop one

    import { onMount, onDestroy } from 'svelte';
    import Eq from './Eq.svelte'; // Import the Eq component

    import { playerStore, type PlayerState, type SongForPlayer } from '$lib/stores/playerStore.js';
    // NEW: Import the audioEffectsStore and its types
    import { audioEffectsStore, initialEqBands, type AudioEffectsState } from '$lib/stores/audioEffectsStore.js';

    let audioElement: HTMLAudioElement; // Reference to the HTMLAudioElement
    
    // PlayerStore state (playback-related)
    let currentSong: SongForPlayer | null;
    let isPlaying: boolean;
    let progress: number;
    let volume: number;
    let duration: number = 0; // Duration of the current song
    let isShuffling: boolean;
    let loopMode: 'none' | 'all' | 'one';

    // AudioEffectsStore state (UI/effects-related)
    // We subscribe to the entire store and then derive individual variables for reactivity and passing to Eq.svelte
    let audioEffectsState: AudioEffectsState;
    // Derive individual properties from audioEffectsState for binding to Eq.svelte and UI
    // These will automatically update when audioEffectsStore changes
    $: eqGains = audioEffectsState?.eqGains;
    $: convolverEnabled = audioEffectsState?.convolverEnabled;
    $: convolverMix = audioEffectsState?.convolverMix;
    $: impulseResponseBuffer = audioEffectsState?.impulseResponseBuffer;
    $: availableIrs = audioEffectsState?.availableIrs || []; // Default to empty array if not loaded yet
    $: selectedIrUrl = audioEffectsState?.selectedIrUrl;
    $: genericReverbEnabled = audioEffectsState?.genericReverbEnabled;
    $: genericReverbMix = audioEffectsState?.genericReverbMix;
    $: genericReverbDecay = audioEffectsState?.genericReverbDecay;
    $: genericReverbDamping = audioEffectsState?.genericReverbDamping;
    $: genericReverbPreDelay = audioEffectsState?.genericReverbPreDelay;
    $: genericReverbType = audioEffectsState?.genericReverbType;

    // Local UI state for Eq visibility, saved separately
    const PLAYER_UI_LOCAL_STORAGE_KEY = 'musify-player-ui-settings';
    let showEq: boolean = false; // Internal state for EQ UI visibility

    // Function to load player UI-specific settings (like EQ visibility)
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

    // Function to save player UI-specific settings
    function savePlayerUiSettings() {
        if (typeof window !== 'undefined' && window.localStorage) {
            const uiSettingsToSave = { showEq };
            localStorage.setItem(PLAYER_UI_LOCAL_STORAGE_KEY, JSON.stringify(uiSettingsToSave));
            console.log('Player.svelte: UI settings saved:', uiSettingsToSave);
        }
    }

    onMount(async () => {
        // 1. Load player UI settings (e.g., showEq)
        loadPlayerUiSettings();

        // 2. Subscribe to playerStore for playback state
        const unsubscribePlayer = playerStore.subscribe((state: PlayerState) => {
            currentSong = state.currentSong;
            isPlaying = state.isPlaying;
            progress = state.progress;
            volume = state.volume;
            isShuffling = state.isShuffling;
            loopMode = state.loopMode;

            // Inform audioEffectsStore about master volume changes
            audioEffectsStore.setMasterVolume(volume);

            // If currentSong changes and is not null, load its audioUrl into the HTMLAudioElement
            if (audioElement && currentSong && audioElement.src !== currentSong.audioUrl) {
                audioElement.src = currentSong.audioUrl;
                audioElement.load();
                console.log('Player.svelte subscribe: New song src loaded for:', currentSong.name);
            }
        });

        // 3. Subscribe to audioEffectsStore for effect state updates
        const unsubscribeAudioEffects = audioEffectsStore.subscribe(state => {
            audioEffectsState = state; // Update local reactive variable
        });

        // 4. Initialize the audio effects system
        // Pass the HTMLAudioElement and initial volume for setup
        // Ensure audioElement is available before calling init
        if (audioElement) {
             await audioEffectsStore.init(audioElement, volume);
        } else {
            console.error("Player.svelte: audioElement is not available on mount!");
        }
        
        // Ensure the audio element's own volume is always maxed, so Web Audio API controls it
        if (audioElement) {
            audioElement.volume = 1;
            console.log('Player.svelte onMount: audioElement.volume set to 1 (controlled by Web Audio API).');
        }

        // 5. Add event listeners to resume AudioContext (browser policy)
        const resumeAudioContext = () => {
            if (audioEffectsState?.audioContext?.state === 'suspended') {
                audioEffectsState.audioContext.resume().then(() => {
                    console.log('Player.svelte: AudioContext resumed by user interaction.');
                }).catch(e => console.error('Player.svelte: Error resuming AudioContext:', e));
            }
        };
        document.addEventListener('click', resumeAudioContext);
        document.addEventListener('keydown', resumeAudioContext);

        // 6. Cleanup on component destroy
        onDestroy(() => {
            document.removeEventListener('click', resumeAudioContext);
            document.removeEventListener('keydown', resumeAudioContext);
            unsubscribePlayer();
            unsubscribeAudioEffects();
            audioEffectsStore.destroy(); // Clean up AudioContext and effects state
        });
    });

    // Reactive statement to handle song changes and play/pause
    $: {
        if (audioElement && currentSong && audioEffectsState?.audioContext) {
            if (isPlaying) {
                // Check and resume AudioContext if suspended, then play
                if (audioEffectsState.audioContext.state === 'suspended') {
                    console.log('Player.svelte reactive: Attempting to resume AudioContext before playing.');
                    audioEffectsState.audioContext.resume().then(() => {
                        audioElement.play().catch((e: Error) => console.error("Player.svelte reactive: Error playing audio (resume then play):", e));
                    });
                } else {
                    audioElement.play().catch((e: Error) => console.error("Player.svelte reactive: Error playing audio:", e));
                }
            } else {
                audioElement.pause();
                console.log('Player.svelte reactive: Audio paused.');
            }
        } else if (audioElement && !currentSong && isPlaying) {
             // If no current song but isPlaying somehow, stop playback
             playerStore.pausePlaying();
        }
    }

    // Reactive statement to save `showEq` state when it changes
    $: showEq, savePlayerUiSettings();

    // Function to format duration (seconds to MM:SS)
    function formatTime(seconds: number | null): string {
        if (seconds === null || isNaN(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    // Event handlers for the audio element
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

    // Modified handleEnded logic for loop functionality
    function handleEnded() {
        if (loopMode === 'one') {
            audioElement.currentTime = 0;
            audioElement.play().catch(e => console.error("Player.svelte handleEnded: Error looping single track:", e));
            playerStore.resumePlaying(); // Ensure store state reflects playing
        } else {
            // The playerStore.playNextSong() handles both shuffle and loop 'all' logic
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
        playerStore.setVolume(newVolume); // playerStore handles its own saving
    }

    function handleProgressBarChange(event: Event) {
        if (audioElement && currentSong && duration > 0) {
            const newProgress = ((event.currentTarget as HTMLInputElement).valueAsNumber / 100) * duration;
            audioElement.currentTime = newProgress;
            playerStore.updateProgress(newProgress); // playerStore handles its own saving
        }
    }

    function toggleEqVisibility() {
        showEq = !showEq; // This reactive statement will trigger savePlayerUiSettings()
        console.log('Player.svelte toggleEqVisibility: EQ UI visibility toggled to', showEq);
    }
</script>

<footer
    class="bg-black border-t border-background-elevated-base px-4 h-[90px] grid grid-cols-[1fr_auto] md:grid-cols-[1fr_2fr_1fr] items-center gap-8"
>
    <!-- Hidden Audio Element -->
    <audio
        bind:this={audioElement}
        on:timeupdate={handleTimeUpdate}
        on:loadedmetadata={handleLoadedMetadata}
        on:ended={handleEnded}
        on:error={handleError}
        preload="metadata"
        crossorigin="anonymous"
    ></audio>

    <!-- Track Info -->
    <div class="flex items-center gap-3">
        {#if currentSong}
            <img src={currentSong.albumImageUrl} alt={currentSong.name} class="w-14 h-14 object-cover" />
            <div>
                <div class="font-semibold text-sm">{currentSong.name}</div>
                <div class="text-xs text-text-subdued">{currentSong.artistName}</div>
            </div>
        {:else}
            <div class="w-14 h-14 bg-background-elevated-base"></div>
            <div>
                <div class="font-semibold text-sm">No song playing</div>
                <div class="text-xs text-text-subdued"></div>
            </div>
        {/if}
    </div>

    <!-- Player Controls -->
    <div class="flex flex-col items-center gap-2 md:w-full">
        <div class="flex items-center gap-4">
            <button class="text-text-subdued hover:text-text-base" on:click={playerStore.playPreviousSong} disabled={!currentSong}><SkipBack size={20} /></button>
            <button
                class="bg-text-base text-black rounded-full p-2 hover:scale-105"
                on:click={togglePlayPause}
                disabled={!currentSong}
            >
                {#if isPlaying}
                    <Pause size={20} />
                {:else}
                    <Play size={20} />
                {/if}
            </button>
            <button class="text-text-subdued hover:text-text-base" on:click={playerStore.playNextSong} disabled={!currentSong}><SkipForward size={20} /></button>
        </div>
        <div class="hidden md:flex items-center gap-2 w-full max-w-2xl text-xs text-text-subdued">
            <span>{formatTime(progress)}</span>
            <div class="w-full h-1 bg-background-elevated-highlight rounded-full relative">
                <input
                    type="range"
                    id="progress-slider"
                    min="0"
                    max="100"
                    value={duration > 0 ? (progress / duration) * 100 : 0}
                    on:input={handleProgressBarChange}
                    class="absolute w-full h-full appearance-none cursor-pointer range-slider"
                    style="--progress: {duration > 0 ? (progress / duration) * 100 : 0}%;"
                    disabled={!currentSong}
                />
                <div class="h-full bg-text-base rounded-full" style="width: {duration > 0 ? (progress / duration) * 100 : 0}%"></div>
            </div>
            <span>{formatTime(duration || currentSong?.duration || 0)}</span>
        </div>
    </div>

    <!-- Extra Controls -->
    <div class="hidden md:flex justify-end items-center gap-4">
        <button class="text-text-subdued hover:text-text-base"><Mic2 size={18} /></button>
        <button class="text-text-subdued hover:text-text-base"><ListMusic size={18} /></button>
        <!-- Button to toggle EQ visibility -->
        <button class="text-text-subdued hover:text-text-base" on:click={toggleEqVisibility} aria-label="Toggle Equalizer">
            <SlidersHorizontal size={18} />
        </button>
        <!-- Shuffle Button -->
        <button
            class="text-text-subdued hover:text-text-base shuffle-button"
            class:active={isShuffling}
            on:click={playerStore.toggleShuffle}
            aria-label="Toggle Shuffle"
            disabled={!currentSong}
        >
            <Shuffle size={18} />
        </button>
        <!-- Loop Button -->
        <button
            class="text-text-subdued hover:text-text-base repeat-button"
            class:active={loopMode !== 'none'}
            on:click={playerStore.toggleLoopMode}
            aria-label="Toggle Loop Mode"
            disabled={!currentSong}
        >
            {#if loopMode === 'one'}
                <Repeat1 size={18} />
            {:else}
                <Repeat size={18} />
            {/if}
        </button>
        <button class="text-text-subdued hover:text-text-base" on:click={() => playerStore.setVolume(volume > 0 ? 0 : 1)} aria-label="Toggle Mute">
            {#if volume > 0}
                <Volume2 size={18} />
            {:else}
                <VolumeX size={18} />
            {/if}
        </button>
        <div class="w-24 h-1 bg-background-elevated-highlight rounded-full relative">
             <input
                type="range"
                id="volume-slider"
                min="0"
                max="100"
                value={volume * 100}
                on:input={handleVolumeChange}
                class="absolute w-full h-full appearance-none cursor-pointer volume-slider"
                style="--volume: {volume * 100}%;"
            />
            <div class="h-full bg-text-base rounded-full" style="width: {volume * 100}%"></div>
        </div>
    </div>
</footer>

<!-- EQ Component Overlay -->
{#if showEq && audioEffectsState?.audioContext && audioEffectsState?.masterGainNode && audioEffectsState?.convolverNode}
    <div class="eq-overlay">
        <Eq
            audioContext={audioEffectsState.audioContext}
            filterNodes={audioEffectsState.filterNodes}
            bands={initialEqBands}
            bind:eqGains={eqGains}
            convolverNode={audioEffectsState.convolverNode}
            bind:convolverEnabled={convolverEnabled}
            bind:convolverMix={convolverMix}
            impulseResponseBuffer={impulseResponseBuffer}
            bind:availableIrs={availableIrs}
            bind:selectedIrUrl={selectedIrUrl}
            bind:reverbEnabled={genericReverbEnabled}
            bind:reverbMix={genericReverbMix}
            bind:reverbDecay={genericReverbDecay}
            bind:reverbDamping={genericReverbDamping}
            bind:reverbPreDelay={genericReverbPreDelay}
            bind:reverbType={genericReverbType}
            

            on:updateEqGain={(e) => audioEffectsStore.updateEqGain(e.detail.index, e.detail.value)}
            on:applyEqPreset={(e) => audioEffectsStore.applyEqPreset(e.detail.gains)}
            on:selectIr={(e) => audioEffectsStore.selectIr(e.detail.url)}
            on:selectReverbType={(e) => audioEffectsStore.setGenericReverbType(e.detail.type)}
            on:toggleConvolver={(e) => audioEffectsStore.toggleConvolver(e.detail.enabled)}
            on:setConvolverMix={(e) => audioEffectsStore.setConvolverMix(e.detail.mix)}
            on:toggleReverb={(e) => audioEffectsStore.toggleGenericReverb(e.detail.enabled)}
            on:setReverbMix={(e) => audioEffectsStore.setGenericReverbMix(e.detail.mix)}
            on:setReverbDecay={(e) => audioEffectsStore.setGenericReverbDecay(e.detail.decay)}
            on:setReverbDamping={(e) => audioEffectsStore.setGenericReverbDamping(e.detail.damping)}
            on:setReverbPreDelay={(e) => audioEffectsStore.setGenericReverbPreDelay(e.detail.preDelay)}
        />
    </div>
{/if}

<style>
    footer {
        grid-area: player;
        background-color: #000;
        border-top: 1px solid var(--background-elevated-base);
        padding: 0 16px;
        height: 90px;
        display: grid;
        grid-template-columns: 1fr 2fr 1fr;
        align-items: center;
        gap: 2rem;
    }
    .flex {
        display: flex;
    }
    .items-center {
        align-items: center;
    }
    .gap-3 {
        gap: 12px;
    }
    .w-14 {
        width: 56px;
    }
    .h-14 {
        height: 56px;
    }
    .font-semibold {
        font-weight: 600;
    }
    .text-sm {
        font-size: 0.9rem;
    }
    .text-xs {
        font-size: 0.75rem;
    }
    .text-text-subdued {
        color: var(--text-subdued);
    }
    .hover\:text-text-base:hover {
        color: var(--text-base);
    }
    .bg-text-base {
        background-color: var(--text-base);
    }
    .text-black {
        color: #000;
    }
    .rounded-full {
        border-radius: 50%;
    }
    .p-2 {
        padding: 8px;
    }
    .hover\:scale-105:hover {
        transform: scale(1.05);
    }
    .hidden {
        display: none;
    }
    .md\:flex {
        display: flex;
    }
    .gap-4 {
        gap: 16px;
    }
    .w-24 {
        width: 100px;
    }
    .h-1 {
        height: 2px; /* Made the slider track thinner */
    }
    .bg-background-elevated-base {
        background-color: var(--background-elevated-base);
    }
    .bg-background-elevated-highlight {
        background-color: var(--background-elevated-highlight);
    }

    @media (max-width: 768px) {
        footer {
            grid-template-columns: 1fr;
            height: auto;
            padding: 12px;
        }
    }

    /* Custom styles for range input to match design */
    .range-slider::-webkit-slider-thumb,
    .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff; /* White thumb */
        cursor: pointer;
        margin-top: -5px; /* Re-centered thumb for 2px track */
        box-shadow: 0 0 0 2px rgba(0,0,0,0.2);
        display: none; /* Hide by default */
    }

    .range-slider:hover::-webkit-slider-thumb,
    .range-slider:focus::-webkit-slider-thumb,
    .volume-slider:hover::-webkit-slider-thumb,
    .volume-slider:focus::-webkit-slider-thumb {
        display: block; /* Show on hover/focus */
    }

    .range-slider::-webkit-slider-runnable-track,
    .volume-slider::-webkit-slider-runnable-track {
        width: 100%;
        height: 2px; /* Match the new track height */
        background: transparent; /* Track is handled by the div below */
        border-radius: 2px;
    }

    /* Firefox compatibility */
    .range-slider::-moz-range-thumb,
    .volume-slider::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
        border: none;
        display: none;
    }
    .range-slider:hover::-moz-range-thumb,
    .range-slider:focus::-moz-range-thumb,
    .volume-slider:hover::-moz-range-thumb,
    .volume-slider:focus::-moz-range-thumb {
        display: block;
    }
    .range-slider::-moz-range-track,
    .volume-slider::-moz-range-track {
        width: 100%;
        height: 2px; /* Match the new track height */
        background: transparent;
        border-radius: 2px;
    }

    /* Microsoft Edge compatibility */
    .range-slider::-ms-thumb,
    .volume-slider::-ms-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
        margin-top: 0;
        box-shadow: 0 0 0 2px rgba(0,0,0,0.2);
        display: none;
    }
    .range-slider:hover::-ms-thumb,
    .range-slider:focus::-ms-thumb,
    .volume-slider:hover::-ms-thumb,
    .volume-slider:focus::-ms-thumb {
        display: block;
    }
    .range-slider::-ms-track,
    .volume-slider::-ms-track {
        width: 100%;
        height: 2px; /* Match the new track height */
        background: transparent;
        border-radius: 2px;
        color: transparent; /* Hide default track */
    }
    .range-slider::-ms-fill-lower,
    .volume-slider::-ms-fill-lower {
        background: transparent; /* Fill controlled by custom div */
    }
    .range-slider::-ms-fill-upper,
    .volume-slider::-ms-fill-upper {
        background: transparent; /* Fill controlled by custom div */
    }

    /* Position the range input over the progress div */
    .range-slider, .volume-slider {
        position: absolute;
        top: 0;
        left: 0;
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        z-index: 1; /* Place above the visible track */
    }

    .range-slider:focus-visible, .volume-slider:focus-visible {
        outline: none; /* Remove default focus outline */
    }

    /* Hide default track for some browsers */
    .range-slider, .volume-slider {
        /* Firefox */
        -moz-appearance: none;
        /* Chrome, Safari, Edge */
        -webkit-appearance: none;
        appearance: none;
    }

    .range-slider::-webkit-slider-runnable-track,
    .volume-slider::-webkit-slider-runnable-track {
        background: transparent;
    }
    .range-slider::-moz-range-track,
    .volume-slider::-moz-range-track {
        background: transparent;
    }
    .range-slider::-ms-track,
    .volume-slider::-ms-track {
        background: transparent;
    }

    /* Styles for EQ Overlay */
    .eq-overlay {
        position: fixed;
        bottom: 90px; /* Adjust based on player height */
        right: 0;
        z-index: 1000;
        background-color: transparent; /* Make it transparent to only show Eq component */
        padding: 10px; /* Optional: if you want some space around the EQ component */
        display: flex; /* Adjust display if you need to position Eq component specifically */
        justify-content: flex-end; /* Align EQ to the right */
    }

    /* Added styling for active shuffle button */
    .text-text-base {
        color: var(--text-base); /* Assuming --text-base is your primary text color, e.g. white or a light grey */
    }
    .text-text-subdued {
        color: var(--text-subdued); /* Assuming --text-subdued is a less prominent color */
    }

    button.active {
        color: var(--text-base); /* This will make the icon white when active */
    }
</style>