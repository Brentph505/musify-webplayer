import { writable, get } from 'svelte/store';

// ---------------------------
// Constants & Initial Values
// ---------------------------

export const initialEqBands = [
    { frequency: 60, type: 'lowshelf', q: 0.7, gain: 0 },
    { frequency: 170, type: 'peaking', q: 1.0, gain: 0 },
    { frequency: 350, type: 'peaking', q: 1.0, gain: 0 },
    { frequency: 1000, type: 'peaking', q: 1.0, gain: 0 },
    { frequency: 3000, type: 'peaking', q: 1.0, gain: 0 },
    { frequency: 8000, type: 'highshelf', q: 0.7, gain: 0 }
] as const;

export const defaultGenericReverbCustomSettings = {
    decay: 0.6,
    damping: 6000,
    preDelay: 0.02,
    mix: 0.2,
    modulationRate: 2.5,
    modulationDepth: 0.001
};

const AUDIO_SETTINGS_LOCAL_STORAGE_KEY = 'musify-audio-settings';

// ---------------------------
// Types
// ---------------------------

export type AudioEffectsState = {
    eqGains: number[];
    convolverEnabled: boolean;
    convolverMix: number;
    impulseResponseBuffer: AudioBuffer | null;
    availableIrs: string[];
    selectedIrUrl: string | null;
    genericReverbEnabled: boolean;
    genericReverbMix: number;
    genericReverbDecay: number;
    genericReverbDamping: number;
    genericReverbPreDelay: number;
    genericReverbType: string;
    genericReverbCustomSettings: typeof defaultGenericReverbCustomSettings;
    genericReverbModulationRate: number;
    genericReverbModulationDepth: number;
    compressorEnabled: boolean;
    compressorThreshold: number;
    compressorKnee: number;
    compressorRatio: number;
    compressorAttack: number;
    compressorRelease: number;

    pannerPosition: { x: number; y: number; z: number };
    pannerAutomationEnabled: boolean;
    pannerAutomationRate: number;
    spatialAudioEnabled: boolean;
    loudnessNormalizationEnabled: boolean;
    loudnessTarget: number; // In LUFS
    momentaryLoudness: number; // For UI display

    // Web Audio Nodes
    audioContext: AudioContext | null;
    sourceNode: MediaElementAudioSourceNode | null;
    masterGainNode: GainNode | null;
    filterNodes: BiquadFilterNode[];
    convolverNode: ConvolverNode | null;
    convolverDryGainNode: GainNode | null;
    convolverWetGainNode: GainNode | null;
    convolverBoostGainNode: GainNode | null;
    genericReverbPreDelayNode: DelayNode | null;
    genericReverbOutputGain: GainNode | null;
    combFilters: { delay: DelayNode; feedback: GainNode; filter: BiquadFilterNode }[];
    allPassFilters: BiquadFilterNode[];
    reverbLFOs: OscillatorNode[];
    reverbModGains: GainNode[];
    combMergerNode: GainNode | null;
    analyserNode: AnalyserNode | null;
    compressorNode: DynamicsCompressorNode | null;
    // NEW: Cross-fader nodes for compressor
    compressorInputGainNode: GainNode | null;
    compressorBypassGainNode: GainNode | null;
    pannerNode: PannerNode | null;
    // NEW: Cross-fader nodes for spatial audio
    spatialWetGainNode: GainNode | null;
    spatialBypassGainNode: GainNode | null;
    // NEW: Loudness nodes
    loudnessNormalizationGainNode: GainNode | null;
    loudnessMeterNode: AudioWorkletNode | null;
    masterLimiterNode: DynamicsCompressorNode | null;

    // NEW: Handlers for cleanup
    _visibilityChangeHandler?: (this: Document, ev: Event) => any;
    _pageHideHandler?: (this: Window, ev: Event) => any;
};

// ---------------------------
// Initial State
// ---------------------------

const initialAudioEffectsState: AudioEffectsState = {
    eqGains: initialEqBands.map(b => b.gain),
    convolverEnabled: false,
    convolverMix: 0.3,
    impulseResponseBuffer: null,
    availableIrs: [],
    selectedIrUrl: null,
    genericReverbEnabled: false,
    genericReverbMix: 0.2,
    genericReverbDecay: 0.6,
    genericReverbDamping: 6000,
    genericReverbPreDelay: 0.02,
    genericReverbType: 'hall',
    genericReverbCustomSettings: { ...defaultGenericReverbCustomSettings },
    genericReverbModulationRate: 2.5,
    genericReverbModulationDepth: 0.001,
    compressorEnabled: false,
    compressorThreshold: -24,
    compressorKnee: 30,
    compressorRatio: 12,
    compressorAttack: 0.003,
    compressorRelease: 0.25,

    pannerPosition: { x: 0, y: 0, z: 0 },
    pannerAutomationEnabled: false,
    pannerAutomationRate: 0.1,
    spatialAudioEnabled: true,
    loudnessNormalizationEnabled: false,
    loudnessTarget: -14, // Spotify's target
    momentaryLoudness: -70,

    audioContext: null,
    sourceNode: null,
    masterGainNode: null,
    filterNodes: [],
    convolverNode: null,
    convolverDryGainNode: null,
    convolverWetGainNode: null,
    convolverBoostGainNode: null,
    genericReverbPreDelayNode: null,
    genericReverbOutputGain: null,
    combFilters: [],
    allPassFilters: [],
    reverbLFOs: [],
    reverbModGains: [],
    combMergerNode: null,
    analyserNode: null,
    compressorNode: null,
    // NEW: Cross-fader nodes for compressor
    compressorInputGainNode: null,
    compressorBypassGainNode: null,
    pannerNode: null,
    // NEW: Cross-fader nodes for spatial audio
    spatialWetGainNode: null,
    spatialBypassGainNode: null,
    // NEW: Loudness nodes
    loudnessNormalizationGainNode: null,
    loudnessMeterNode: null,
    masterLimiterNode: null,
    // NEW: Handlers for cleanup
    _visibilityChangeHandler: undefined,
    _pageHideHandler: undefined
};

const store = writable<AudioEffectsState>(initialAudioEffectsState);
// REMOVED: pannerAutomationIntervalId as it's replaced by pannerAutomationFrameId
// let pannerAutomationIntervalId: number | null = null;
// NEW: Global state for requestAnimationFrame
let pannerAutomationFrameId: number | null = null;
let pannerAutomationStartTime: number | null = null; // To keep track of relative time for automation

// ---------------------------
// Helper Functions
// ---------------------------

/**
 * Creates a debounced function that delays invoking `func` until after `waitFor` milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeout: number | null = null;

    return (...args: Parameters<F>): void => {
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func(...args), waitFor) as unknown as number;
    };
};

const getCurrentState = () => get(store);

const saveToLocalStorage = (state: AudioEffectsState) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const settingsToSave = {
        eqGains: state.eqGains,
        convolverEnabled: state.convolverEnabled,
        convolverMix: state.convolverMix,
        selectedIrUrl: state.selectedIrUrl,
        genericReverbEnabled: state.genericReverbEnabled,
        genericReverbMix: state.genericReverbMix,
        genericReverbDecay: state.genericReverbDecay,
        genericReverbDamping: state.genericReverbDamping,
        genericReverbPreDelay: state.genericReverbPreDelay,
        genericReverbType: state.genericReverbType,
        genericReverbCustomSettings: state.genericReverbCustomSettings,
        genericReverbModulationRate: state.genericReverbModulationRate,
        genericReverbModulationDepth: state.genericReverbModulationDepth,
        compressorEnabled: state.compressorEnabled,
        compressorThreshold: state.compressorThreshold,
        compressorKnee: state.compressorKnee,
        compressorRatio: state.compressorRatio,
        compressorAttack: state.compressorAttack,
        compressorRelease: state.compressorRelease,
        pannerPosition: state.pannerPosition,
        pannerAutomationEnabled: state.pannerAutomationEnabled,
        pannerAutomationRate: state.pannerAutomationRate,
        spatialAudioEnabled: state.spatialAudioEnabled,
        loudnessNormalizationEnabled: state.loudnessNormalizationEnabled,
        loudnessTarget: state.loudnessTarget
    };
    localStorage.setItem(AUDIO_SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(settingsToSave));
    console.log('AudioEffectsStore: Saved audio settings to localStorage.');
};

// Create a debounced version of the save function to avoid excessive writes.
const debouncedSaveToLocalStorage = debounce(saveToLocalStorage, 1000);

// CHANGED: Increased gain compensation for spatial audio and updated comment
// WARNING: A value of 10.0 (+20dB) is a significant boost. Monitor for potential internal clipping
// before the master limiter, especially with complex mixes or high input levels.
const SPATIAL_AUDIO_WET_GAIN_COMPENSATION = 10.0;

const updateSpatialAudioFade = (state: AudioEffectsState) => {
    if (!state.spatialWetGainNode || !state.spatialBypassGainNode || !state.audioContext) return;

    const now = state.audioContext.currentTime;
    const rampTime = now + 0.05; // 50ms cross-fade

    const wetTargetGain = state.spatialAudioEnabled ? SPATIAL_AUDIO_WET_GAIN_COMPENSATION : 0.0;
    const bypassTargetGain = state.spatialAudioEnabled ? 0.0 : 1.0;

    state.spatialWetGainNode.gain.linearRampToValueAtTime(wetTargetGain, rampTime);
    state.spatialBypassGainNode.gain.linearRampToValueAtTime(bypassTargetGain, rampTime);
};

const applyEq = (state: AudioEffectsState) => {
    if (!state.filterNodes.length) return;
    state.filterNodes.forEach((filter, i) => {
        filter.gain.value = state.eqGains[i];
    });
};

const updateConvolver = (state: AudioEffectsState) => {
    const { convolverEnabled, impulseResponseBuffer, convolverNode, convolverDryGainNode, convolverWetGainNode, convolverBoostGainNode, convolverMix } = state;
    if (!convolverNode || !convolverDryGainNode || !convolverWetGainNode || !convolverBoostGainNode) {
        console.warn('AudioEffectsStore: Convolver nodes not ready for update.');
        return;
    }

    const MAX_CONVOLVER_BOOST_DB = 9;
    const MIN_MIX_FOR_BOOST = 0.2;

    if (convolverEnabled && impulseResponseBuffer && convolverNode.buffer) {
        convolverWetGainNode.gain.value = convolverMix;
        convolverDryGainNode.gain.value = 1 - convolverMix;

        if (convolverMix >= MIN_MIX_FOR_BOOST) {
            const normalizedMix = (convolverMix - MIN_MIX_FOR_BOOST) / (1.0 - MIN_MIX_FOR_BOOST);
            const boostDb = normalizedMix * MAX_CONVOLVER_BOOST_DB;
            convolverBoostGainNode.gain.value = Math.pow(10, boostDb / 20);
        } else {
            convolverBoostGainNode.gain.value = 1;
        }
    } else {
        convolverWetGainNode.gain.value = 0;
        convolverDryGainNode.gain.value = 1;
        convolverBoostGainNode.gain.value = 1;
    }
};

const updateGenericReverb = (state: AudioEffectsState) => {
    const { audioContext, genericReverbEnabled, genericReverbPreDelayNode, genericReverbOutputGain, combFilters, reverbLFOs, reverbModGains } = state;
    if (!audioContext || !genericReverbPreDelayNode || !genericReverbOutputGain || !combFilters.length || !reverbLFOs.length || !reverbModGains.length) {
        console.warn('AudioEffectsStore: Generic reverb nodes not ready for update.');
        return;
    }

    const now = audioContext.currentTime;
    const rampTime = now + 0.05; // 50ms ramp to prevent clicks

    if (genericReverbEnabled) {
        genericReverbPreDelayNode.delayTime.linearRampToValueAtTime(state.genericReverbPreDelay, rampTime);
        genericReverbOutputGain.gain.linearRampToValueAtTime(state.genericReverbMix, rampTime);

        const lfoBaseFrequencies = [2.1, 2.3, 1.9, 2.5]; // Must match LFOs created in init
        combFilters.forEach((comb, i) => {
            comb.feedback.gain.linearRampToValueAtTime(state.genericReverbDecay, rampTime);
            comb.filter.frequency.linearRampToValueAtTime(state.genericReverbDamping, rampTime);
            // Update modulation from state
            reverbLFOs[i].frequency.linearRampToValueAtTime(lfoBaseFrequencies[i] * (state.genericReverbModulationRate / 2.5), rampTime);
            reverbModGains[i].gain.linearRampToValueAtTime(state.genericReverbModulationDepth, rampTime);
        });
    } else {
        genericReverbOutputGain.gain.linearRampToValueAtTime(0, rampTime); // Disable generic reverb output
        // Kill the feedback loops immediately to stop reverb tail
        combFilters.forEach(comb => {
            comb.feedback.gain.linearRampToValueAtTime(0, rampTime);
            // Kill modulation when reverb is off to save resources
            reverbModGains.forEach(g => g.gain.linearRampToValueAtTime(0, rampTime));
        });
    }
};

const updateCompressor = (state: AudioEffectsState) => {
    const { compressorNode, compressorEnabled, compressorThreshold, compressorKnee, compressorRatio, compressorAttack, compressorRelease, audioContext, compressorInputGainNode, compressorBypassGainNode } = state;
    if (!compressorNode || !audioContext || !compressorInputGainNode || !compressorBypassGainNode) {
        console.warn('AudioEffectsStore: Compressor nodes not ready for update.');
        return;
    }

    const now = audioContext.currentTime;
    const rampTime = now + 0.05; // 50ms cross-fade for smooth enabling/disabling

    if (compressorEnabled) {
        // Apply settings to the compressor node itself
        compressorNode.threshold.linearRampToValueAtTime(compressorThreshold, rampTime);
        compressorNode.knee.linearRampToValueAtTime(compressorKnee, rampTime);
        compressorNode.ratio.linearRampToValueAtTime(compressorRatio, rampTime);
        compressorNode.attack.linearRampToValueAtTime(compressorAttack, rampTime);
        compressorNode.release.linearRampToValueAtTime(compressorRelease, rampTime);
        
        // Cross-fade to the compressed signal path
        compressorInputGainNode.gain.linearRampToValueAtTime(1.0, rampTime);
        compressorBypassGainNode.gain.linearRampToValueAtTime(0.0, rampTime);
    } else {
        // Cross-fade to the bypass signal path
        compressorInputGainNode.gain.linearRampToValueAtTime(0.0, rampTime);
        compressorBypassGainNode.gain.linearRampToValueAtTime(1.0, rampTime);
        
        // While not strictly necessary due to the bypass, it's good practice to reset
        // the compressor to a neutral state when disabled.
        compressorNode.threshold.linearRampToValueAtTime(0, rampTime);
        compressorNode.ratio.linearRampToValueAtTime(1, rampTime);
    }
};

const updatePanner = (state: AudioEffectsState) => {
    if (!state.pannerNode || !state.audioContext) return;
    // If automation is running, it controls the panner position.
    if (state.pannerAutomationEnabled) return;

    // To prevent clicks and ensure smooth manual updates when updateAllEffects is called
    // (e.g., due to other effect changes), apply a small ramp.
    const now = state.audioContext.currentTime;
    const rampDuration = 0.01; // 10ms ramp for stability
    const rampTargetTime = now + rampDuration;

    state.pannerNode.positionX.linearRampToValueAtTime(state.pannerPosition.x, rampTargetTime);
    state.pannerNode.positionY.linearRampToValueAtTime(state.pannerPosition.y, rampTargetTime);
    state.pannerNode.positionZ.linearRampToValueAtTime(state.pannerPosition.z, rampTargetTime);
};

// NEW: Loudness Normalization Helper
const updateLoudnessNormalization = (state: AudioEffectsState) => {
    if (!state.loudnessNormalizationGainNode || !state.audioContext) return;

    if (!state.loudnessNormalizationEnabled) {
        // If normalization is turned off, smoothly ramp the gain back to 1 (no change)
        state.loudnessNormalizationGainNode.gain.linearRampToValueAtTime(1.0, state.audioContext.currentTime + 0.5);
    }
    // If it's enabled, the onmessage handler from the worklet will control the gain, so no 'else' is needed here.
};

const pannerAutomationLoop = (timestamp: DOMHighResTimeStamp) => { // timestamp provided by requestAnimationFrame
    const state = getCurrentState();
    // Stop automation if disabled, nodes not ready, or AudioContext is not running
    if (!state.pannerAutomationEnabled || !state.pannerNode || !state.audioContext || state.audioContext.state !== 'running') {
        if (pannerAutomationFrameId) cancelAnimationFrame(pannerAutomationFrameId);
        pannerAutomationFrameId = null;
        pannerAutomationStartTime = null;
        return;
    }

    // Initialize pannerAutomationStartTime on first run or after a pause
    if (pannerAutomationStartTime === null) {
        pannerAutomationStartTime = state.audioContext.currentTime;
    }

    const speed = state.pannerAutomationRate;
    const radius = 8; // The "distance" of the sound source
    // Use audioContext.currentTime for synchronization with the audio graph
    const relativeTime = state.audioContext.currentTime - pannerAutomationStartTime;

    const newX = Math.sin(relativeTime * speed) * radius;
    const newZ = Math.cos(relativeTime * speed) * radius;
    // NEW: Calculate Y position for vertical oscillation
    const newY = Math.sin(relativeTime * speed * 0.75) * (radius / 2); // Slower vertical motion, half amplitude

    const now = state.audioContext.currentTime;
    // Schedule a smooth ramp to the new position over a very short duration.
    // This provides smoother movement and is more resilient to timing variations.
    const rampDuration = 0.05; // 50ms ramp for visual smoothness and to avoid hard jumps
    const rampTargetTime = now + rampDuration;

    state.pannerNode.positionX.linearRampToValueAtTime(newX, rampTargetTime);
    state.pannerNode.positionZ.linearRampToValueAtTime(newZ, rampTargetTime);
    state.pannerNode.positionY.linearRampToValueAtTime(newY, rampTargetTime); // NEW: Automate Y position

    // Update the store value so the UI reflects the change.
    store.update((s) => ({
        ...s,
        pannerPosition: { ...s.pannerPosition, x: newX, z: newZ, y: newY } // NEW: Update Y in store
    }));

    // Schedule the next frame
    pannerAutomationFrameId = requestAnimationFrame(pannerAutomationLoop);
};

const startPannerAutomation = () => {
    if (pannerAutomationFrameId === null) {
        console.log('AudioEffectsStore: Starting panner automation (requestAnimationFrame).');
        const state = getCurrentState();
        // Before starting, cancel any previous manual settings to avoid conflicts
        if (state.pannerNode && state.audioContext) {
            const now = state.audioContext.currentTime;
            state.pannerNode.positionX.cancelScheduledValues(now);
            state.pannerNode.positionZ.cancelScheduledValues(now);
            state.pannerNode.positionY.cancelScheduledValues(now); // NEW: Cancel Y values
            // Re-initialize start time for the new automation cycle
            pannerAutomationStartTime = null;
        }
        // Start the requestAnimationFrame loop
        pannerAutomationFrameId = requestAnimationFrame(pannerAutomationLoop);
    }
};

const stopPannerAutomation = () => {
    if (pannerAutomationFrameId !== null) {
        console.log('AudioEffectsStore: Stopping panner automation.');
        cancelAnimationFrame(pannerAutomationFrameId);
        pannerAutomationFrameId = null;
        pannerAutomationStartTime = null; // Reset start time for next activation

        const state = getCurrentState();
        // When stopping, cancel any pending ramps and set the panner to its last known position.
        if (state.pannerNode && state.audioContext) {
            const now = state.audioContext.currentTime;
            state.pannerNode.positionX.cancelScheduledValues(now);
            state.pannerNode.positionZ.cancelScheduledValues(now);
            state.pannerNode.positionY.cancelScheduledValues(now); // NEW: Cancel Y values
            state.pannerNode.positionX.setValueAtTime(state.pannerPosition.x, now);
            state.pannerNode.positionZ.setValueAtTime(state.pannerPosition.z, now);
            state.pannerNode.positionY.setValueAtTime(state.pannerPosition.y, now); // NEW: Set Y value
        }
    }
};

// NEW: Helper functions for AudioContext resume/suspend
const resumeAudioContext = async (audioContext: AudioContext) => {
    if (audioContext.state === 'suspended') {
        console.log('AudioEffectsStore: Resuming AudioContext.');
        await audioContext.resume();
        // Re-evaluate all effects to ensure parameters are correct after resume
        audioEffectsStore.updateAllEffects();
        const state = getCurrentState();
        if (state.pannerAutomationEnabled) {
            startPannerAutomation(); // Restart RAF loop if it was active
        }
    }
};

const suspendAudioContext = async (audioContext: AudioContext) => {
    if (audioContext.state === 'running') {
        console.log('AudioEffectsStore: Suspending AudioContext.');
        await audioContext.suspend();
        stopPannerAutomation(); // Stop automation when context is suspended
    }
};

// ---------------------------
// Public API for the audio effects store
// ---------------------------
export const audioEffectsStore = {
    subscribe: store.subscribe,
    initialEqBands, // Expose initial bands for rendering in Eq.svelte

    /**
     * Initializes the Web Audio API context, nodes, and establishes the audio graph.
     * Must be called once when the Player component mounts.
     * @param audioElement The HTMLAudioElement to connect to the audio graph.
     * @param initialVolume The initial volume from playerStore.
     */
    init: async (audioElement: HTMLAudioElement, initialVolume: number) => {
        const state = getCurrentState();
        if (state.audioContext) {
            console.warn('AudioEffectsStore: AudioContext already initialized.');
            return;
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            await audioContext.resume(); // Initial resume on user gesture
        }
        console.log('AudioEffectsStore: AudioContext initialized. State:', audioContext.state);

        // NEW: Add visibilitychange listener for AudioContext management
        const handleVisibilityChange = async () => {
            const currentState = getCurrentState();
            if (!currentState.audioContext) return;

            if (document.visibilityState === 'visible') {
                await resumeAudioContext(currentState.audioContext);
            } else if (document.visibilityState === 'hidden') {
                await suspendAudioContext(currentState.audioContext);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // NEW: Add pagehide listener to save settings and explicitly suspend
        const handlePageHide = () => {
            console.log('AudioEffectsStore: Saving settings and suspending AudioContext on page hide.');
            audioEffectsStore.saveSettings(); // Ensure latest settings are saved
            const currentState = getCurrentState();
            if (currentState.audioContext) {
                // Suspend explicitly to ensure consistency, though browsers often do this anyway.
                // We don't await here as the page is being hidden/unloaded.
                currentState.audioContext.suspend().catch(e => console.error('AudioEffectsStore: Error suspending context on pagehide:', e));
            }
            stopPannerAutomation(); // Ensure automation is stopped
        };
        window.addEventListener('pagehide', handlePageHide);

        // Store these handlers to be able to remove them in `destroy`
        store.update(s => ({
            ...s,
            _visibilityChangeHandler: handleVisibilityChange, // Store reference
            _pageHideHandler: handlePageHide // Store reference
        }));

        const sourceNode = audioContext.createMediaElementSource(audioElement);
        const masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = initialVolume;
        const analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        console.log('AudioEffectsStore: Core nodes (source, masterGain, analyser) created.');

        const filterNodes = initialEqBands.map((band, i) => {
            const f = audioContext.createBiquadFilter();
            f.type = band.type as BiquadFilterType;
            f.frequency.value = band.frequency;
            f.Q.value = band.q;
            f.gain.value = state.eqGains[i];
            return f;
        });
        console.log('AudioEffectsStore: EQ filter nodes created.');

        const convolverNode = audioContext.createConvolver();
        const convolverDryGainNode = audioContext.createGain();
        const convolverWetGainNode = audioContext.createGain();
        const convolverBoostGainNode = audioContext.createGain();
        convolverBoostGainNode.gain.value = 1;
        console.log('AudioEffectsStore: Convolver and its Dry/Wet GainNodes created.');

        const genericReverbPreDelayNode = audioContext.createDelay(0.5);
        const genericReverbOutputGain = audioContext.createGain();
        const combMergerNode = audioContext.createGain();
        combMergerNode.gain.value = 1 / 4;

        const combFilters: typeof state.combFilters = [0.0297, 0.0371, 0.0411, 0.0437].map(time => {
            const delay = audioContext.createDelay(1.0);
            delay.delayTime.value = time;
            const feedback = audioContext.createGain();
            const filter = audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.value = 0.7;
            return { delay, feedback, filter };
        });

        const reverbLFOs: OscillatorNode[] = [];
        const reverbModGains: GainNode[] = [];
        const lfoFrequencies = [2.1, 2.3, 1.9, 2.5];
        for (let i = 0; i < combFilters.length; i++) {
            const lfo = audioContext.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = lfoFrequencies[i];
            lfo.start();

            const modGain = audioContext.createGain();
            modGain.gain.value = state.genericReverbModulationDepth;

            lfo.connect(modGain);
            // Connect LFO -> ModGain -> DelayTime AudioParam for modulation
            modGain.connect(combFilters[i].delay.delayTime);

            reverbLFOs.push(lfo);
            reverbModGains.push(modGain);
        }

        const allPassFilters: BiquadFilterNode[] = [225, 556, 441, 341].map(freq => {
            const ap = audioContext.createBiquadFilter();
            ap.type = 'allpass';
            ap.frequency.value = freq;
            return ap;
        });
        console.log('AudioEffectsStore: Generic Reverb (Freeverb-style with modulation) nodes created.');

        const compressorNode = audioContext.createDynamicsCompressor();
        compressorNode.threshold.value = state.compressorThreshold;
        compressorNode.knee.value = state.compressorKnee;
        compressorNode.ratio.value = state.compressorRatio;
        compressorNode.attack.value = state.compressorAttack;
        compressorNode.release.value = state.compressorRelease;
        // NEW: Create bypass nodes for the compressor for smooth cross-fading
        const compressorInputGainNode = audioContext.createGain();
        const compressorBypassGainNode = audioContext.createGain();
        console.log('AudioEffectsStore: DynamicsCompressorNode and bypass nodes created.');

        const pannerNode = audioContext.createPanner();
        // Use the HRTF model for high-quality binaural spatialization (best with headphones)
        pannerNode.panningModel = 'HRTF';
        pannerNode.distanceModel = 'inverse'; // More realistic distance falloff
        pannerNode.positionX.value = state.pannerPosition.x;
        pannerNode.positionY.value = state.pannerPosition.y;
        pannerNode.positionZ.value = state.pannerPosition.z;
        pannerNode.orientationX.value = 0;
        pannerNode.orientationY.value = 0;
        pannerNode.orientationZ.value = -1; // Face the listener
        console.log('AudioEffectsStore: PannerNode for spatial audio created.');

        // NEW: Create cross-fader nodes for spatial audio bypass
        const spatialWetGainNode = audioContext.createGain();
        const spatialBypassGainNode = audioContext.createGain();

        // NEW: Add a master limiter at the end of the chain to prevent clipping
        const masterLimiterNode = audioContext.createDynamicsCompressor();
        masterLimiterNode.threshold.value = -0.5; // Catch peaks just before 0dB
        masterLimiterNode.knee.value = 0; // Hard knee for true limiting
        masterLimiterNode.ratio.value = 20; // High ratio
        masterLimiterNode.attack.value = 0.001; // Fast attack
        masterLimiterNode.release.value = 0.1; // Relatively fast release
        console.log('AudioEffectsStore: Master limiter created.');

        // NEW: Loudness Normalization setup
        let loudnessNormalizationGainNode: GainNode | null = null;
        let loudnessMeterNode: AudioWorkletNode | null = null;
        try {
            // Load the processor, create the gain node for applying adjustments,
            // and the worklet node for measuring loudness.
            await audioContext.audioWorklet.addModule('/lufs-meter-processor.js');
            loudnessNormalizationGainNode = audioContext.createGain();
            loudnessMeterNode = new AudioWorkletNode(audioContext, 'lufs-meter-processor');

            // Set up the listener for messages from the worklet
            loudnessMeterNode.port.onmessage = (event) => {
                if (event.data.type === 'momentaryLoudness') {
                    const momentaryLoudness = event.data.value;
                    const currentState = getCurrentState();

                    // Update the store for UI feedback
                    store.update(s => ({ ...s, momentaryLoudness }));

                    // If normalization is enabled, calculate and apply the gain adjustment
                    if (currentState.loudnessNormalizationEnabled && currentState.loudnessNormalizationGainNode && currentState.audioContext) {
                        const targetLufs = currentState.loudnessTarget;
                        const errorDb = targetLufs - momentaryLoudness;

                        // Apply a simple limiter to prevent extreme gain changes
                        // Cap positive gain at +6dB to prevent distortion, but allow larger cuts.
                        const limitedErrorDb = Math.max(-12, Math.min(6, errorDb));

                        const targetGain = Math.pow(10, limitedErrorDb / 20);

                        // Smoothly ramp to the new target gain to avoid artifacts
                        currentState.loudnessNormalizationGainNode.gain.linearRampToValueAtTime(
                            targetGain,
                            currentState.audioContext.currentTime + 0.3 // Ramp over 300ms
                        );
                    }
                }
            };
            console.log('AudioEffectsStore: Loudness meter and normalization nodes created.');
        } catch (e) {
            console.error('AudioEffectsStore: Failed to load or create loudness meter AudioWorklet.', e);
        }

        store.set({
            ...state,
            audioContext, sourceNode, masterGainNode, analyserNode, filterNodes,
            convolverNode, convolverDryGainNode, convolverWetGainNode, convolverBoostGainNode,
            genericReverbPreDelayNode, genericReverbOutputGain, combMergerNode,
            combFilters, allPassFilters, reverbLFOs, reverbModGains, compressorNode,
            compressorInputGainNode, compressorBypassGainNode, // Add new compressor nodes to store
            pannerNode,
            spatialWetGainNode, spatialBypassGainNode,
            // NEW: Add loudness nodes to store
            loudnessNormalizationGainNode, loudnessMeterNode,
            // NEW: Add limiter node to store
            masterLimiterNode
        });
        console.log('AudioEffectsStore: Store updated with new audio nodes.');

        audioEffectsStore.setupAudioGraph();
        console.log('AudioEffectsStore: Audio graph connections established.');

        // If automation was enabled from localStorage, start it now.
        if (getCurrentState().pannerAutomationEnabled) {
            startPannerAutomation();
        }

        await audioEffectsStore.fetchAvailableIrs();
        await audioEffectsStore.loadImpulseResponse(getCurrentState().selectedIrUrl);
        audioEffectsStore.configureGenericReverb(getCurrentState().genericReverbType);
        audioEffectsStore.updateAllEffects(); // Final update to set all gains/states based on loaded settings
        console.log('AudioEffectsStore: Initialization complete.');
    },

    /**
     * Cleans up the AudioContext and resets the store state.
     */
    destroy: () => {
        const state = getCurrentState();
        if (state.audioContext) {
            state.audioContext.close().then(() => {
                console.log('AudioEffectsStore: AudioContext closed.');
            }).catch(e => console.error('AudioEffectsStore: Error closing AudioContext:', e));
        }
        // NEW: Remove event listeners
        if (state._visibilityChangeHandler) {
            document.removeEventListener('visibilitychange', state._visibilityChangeHandler as EventListener);
        }
        if (state._pageHideHandler) {
            window.removeEventListener('pagehide', state._pageHideHandler as EventListener);
        }

        // LFOs are stopped when AudioContext is closed, no need for manual stop or error handling
        // state.reverbLFOs.forEach(lfo => {
        //     try {
        //         lfo.stop();
        //     } catch (e) {
        //         console.warn('AudioEffectsStore: Error stopping LFO, might already be stopped:', e);
        //     }
        // });
        stopPannerAutomation(); // Ensure automation loop is stopped on destroy
        store.set(initialAudioEffectsState); // Reset to initial state
        console.log('AudioEffectsStore: Store reset.');
    },

    /**
     * Establishes the permanent connections for the Web Audio API graph.
     * This method is only called once during initialization.
     */
    setupAudioGraph: () => {
        const s = getCurrentState();

        if (!s.audioContext || !s.sourceNode || !s.masterGainNode || !s.analyserNode ||
            !s.convolverNode || !s.genericReverbPreDelayNode || !s.convolverDryGainNode ||
            !s.convolverWetGainNode || !s.genericReverbOutputGain || !s.combMergerNode ||
            !s.combFilters.length || !s.allPassFilters.length || !s.convolverBoostGainNode ||
            !s.reverbLFOs.length || !s.reverbModGains.length || !s.compressorNode ||
            !s.compressorInputGainNode || !s.compressorBypassGainNode || // Check for new compressor nodes
            !s.pannerNode || !s.spatialWetGainNode || !s.spatialBypassGainNode || // Check for new spatial nodes
            !s.loudnessNormalizationGainNode || !s.loudnessMeterNode || // NEW: Check loudness nodes
            !s.masterLimiterNode) { // NEW: Check limiter node
            console.error('AudioEffectsStore: Cannot setup audio graph, some required nodes are null/missing.');
            return;
        }

        // --- Audio Graph Signal Flow ---

        // 1. Source -> EQ Chain
        let eqOutput: AudioNode = s.sourceNode;
        if (s.filterNodes.length > 0) {
            s.sourceNode.connect(s.filterNodes[0]);
            for (let i = 0; i < s.filterNodes.length - 1; i++) {
                s.filterNodes[i].connect(s.filterNodes[i + 1]);
            }
            eqOutput = s.filterNodes[s.filterNodes.length - 1];
        }

        // 2. EQ Output -> Parallel Effects (Convolution Reverb, Generic Reverb)
        // The main dry signal path for the convolver
        eqOutput.connect(s.convolverDryGainNode);
        // The wet signal path for the convolver
        eqOutput.connect(s.convolverNode);
        s.convolverNode.connect(s.convolverWetGainNode);
        s.convolverWetGainNode.connect(s.convolverBoostGainNode);
        // The input for the generic reverb
        eqOutput.connect(s.genericReverbPreDelayNode);

        // 3. Generic Reverb internal routing
        s.genericReverbPreDelayNode.connect(s.combMergerNode);
        for (const comb of s.combFilters) {
            s.genericReverbPreDelayNode.connect(comb.delay);
            comb.delay.connect(comb.feedback).connect(comb.filter).connect(comb.delay);
            comb.delay.connect(s.combMergerNode);
        }
        s.combMergerNode.connect(s.allPassFilters[0]);
        for (let i = 0; i < s.allPassFilters.length - 1; i++) {
            s.allPassFilters[i].connect(s.allPassFilters[i + 1]);
        }
        s.allPassFilters[s.allPassFilters.length - 1].connect(s.genericReverbOutputGain);

        // 4. Sum all parallel paths into a single bus before the compressor stage.
        const effectsSummingBus = s.audioContext.createGain();
        s.convolverDryGainNode.connect(effectsSummingBus);
        s.convolverBoostGainNode.connect(effectsSummingBus); // Convolver wet (boosted)
        s.genericReverbOutputGain.connect(effectsSummingBus); // Generic reverb wet

        // 5. Compressor Stage (with cross-fade bypass)
        // The signal splits to go through the compressor or bypass it.
        effectsSummingBus.connect(s.compressorNode);
        s.compressorNode.connect(s.compressorInputGainNode); // Wet path (compressed)
        effectsSummingBus.connect(s.compressorBypassGainNode); // Dry path (bypass)

        // 6. Merge compressor and bypass paths into a new bus.
        const postCompressorBus = s.audioContext.createGain();
        s.compressorInputGainNode.connect(postCompressorBus);
        s.compressorBypassGainNode.connect(postCompressorBus);

        // 7. Post-Compressor Chain: Spatial Audio -> Loudness -> Analyser -> Master Limiter -> Destination
        // The loudness meter is connected in parallel to measure the output of this stage.
        postCompressorBus.connect(s.loudnessMeterNode);

        // --- Spatial Audio Cross-fader setup ---
        // The post-compressor output splits into two parallel paths.
        // Path 1: The "wet" signal with spatialization
        postCompressorBus.connect(s.pannerNode);
        s.pannerNode.connect(s.spatialWetGainNode);
        s.spatialWetGainNode.connect(s.loudnessNormalizationGainNode);

        // Path 2: The "dry" (bypass) signal
        postCompressorBus.connect(s.spatialBypassGainNode);
        s.spatialBypassGainNode.connect(s.loudnessNormalizationGainNode);
        // --- End Cross-fader ---

        // The two spatial paths merge at the loudnessNormalizationGainNode, which continues the chain.
        s.loudnessNormalizationGainNode.connect(s.analyserNode);
        s.analyserNode.connect(s.masterGainNode);
        s.masterGainNode.connect(s.masterLimiterNode);
        s.masterLimiterNode.connect(s.audioContext.destination);
    },

    /**
     * Updates all effect connections (dry/wet mixes, enable states) based on current store state.
     * This is called whenever an enable/disable or mix parameter changes.
     */
    updateAllEffects: () => {
        const state = getCurrentState();
        applyEq(state);
        updateConvolver(state);
        updateGenericReverb(state);
        updateCompressor(state);
        updatePanner(state);
        updateSpatialAudioFade(state);
        updateLoudnessNormalization(state); // NEW: Update loudness normalization state
        debouncedSaveToLocalStorage(state); // Save settings after all effects are updated
    },

    /**
     * Loads audio effects settings from localStorage.
     */
    loadSettings: () => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const s = localStorage.getItem(AUDIO_SETTINGS_LOCAL_STORAGE_KEY);
        if (!s) return;
        try {
            const settings = JSON.parse(s);
            store.update(state => ({
                ...state,
                ...settings,
                // Ensure genericReverbCustomSettings is merged properly to maintain defaults
                genericReverbCustomSettings: settings.genericReverbCustomSettings
                    ? { ...defaultGenericReverbCustomSettings, ...settings.genericReverbCustomSettings }
                    : state.genericReverbCustomSettings,
            }));
            console.log('AudioEffectsStore: Loaded audio settings from localStorage.');
        } catch (e) {
            console.error('AudioEffectsStore: Failed to parse audio settings from localStorage:', e);
        }
    },

    /**
     * Saves current audio effects settings to localStorage.
     */
    saveSettings: () => {
        saveToLocalStorage(getCurrentState());
    },

    // --- EQ Management ---
    updateEqGain: (index: number, value: number) => {
        store.update(s => {
            s.eqGains[index] = value;
            return { ...s, eqGains: [...s.eqGains] }; // Trigger reactivity
        });
        audioEffectsStore.updateAllEffects();
    },
    applyEqPreset: (gains: number[]) => {
        store.update(s => {
            // Ensure the gains array matches the number of EQ bands
            s.eqGains = gains.slice(0, initialEqBands.length);
            return { ...s, eqGains: [...s.eqGains] };
        });
        audioEffectsStore.updateAllEffects();
    },

    // --- Convolver (IR Reverb) Management ---
    toggleConvolver: (enabled: boolean) => {
        store.update(s => ({ ...s, convolverEnabled: enabled }));
        audioEffectsStore.updateAllEffects();
    },
    setConvolverMix: (mix: number) => {
        store.update(s => ({ ...s, convolverMix: mix }));
        audioEffectsStore.updateAllEffects();
    },
    selectIr: async (irUrl: string | null) => {
        store.update(s => ({ ...s, selectedIrUrl: irUrl }));
        await audioEffectsStore.loadImpulseResponse(irUrl); // This will update impulseResponseBuffer and then call updateAllEffects
    },

    // --- Generic Reverb Management ---
    toggleGenericReverb: (enabled: boolean) => {
        store.update(s => ({ ...s, genericReverbEnabled: enabled }));
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbMix: (mix: number) => {
        store.update(s => {
            if (s.genericReverbType !== 'custom') s.genericReverbType = 'custom';
            s.genericReverbCustomSettings.mix = mix;
            return { ...s, genericReverbMix: mix };
        });
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbDecay: (decay: number) => {
        store.update(s => {
            if (s.genericReverbType !== 'custom') s.genericReverbType = 'custom';
            s.genericReverbCustomSettings.decay = decay;
            return { ...s, genericReverbDecay: decay };
        });
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbDamping: (damping: number) => {
        store.update(s => {
            if (s.genericReverbType !== 'custom') s.genericReverbType = 'custom';
            s.genericReverbCustomSettings.damping = damping;
            return { ...s, genericReverbDamping: damping };
        });
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbPreDelay: (preDelay: number) => {
        store.update(s => {
            if (s.genericReverbType !== 'custom') s.genericReverbType = 'custom';
            s.genericReverbCustomSettings.preDelay = preDelay;
            return { ...s, genericReverbPreDelay: preDelay };
        });
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbModulationRate: (rate: number) => {
        store.update(s => {
            if (s.genericReverbType !== 'custom') s.genericReverbType = 'custom';
            s.genericReverbCustomSettings.modulationRate = rate;
            return { ...s, genericReverbModulationRate: rate };
        });
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbModulationDepth: (depth: number) => {
        store.update(s => {
            if (s.genericReverbType !== 'custom') s.genericReverbType = 'custom';
            s.genericReverbCustomSettings.modulationDepth = depth;
            return { ...s, genericReverbModulationDepth: depth };
        });
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbType: (type: string) => {
        store.update(s => ({ ...s, genericReverbType: type }));
        audioEffectsStore.configureGenericReverb(type); // configureGenericReverb already calls updateAllEffects
    },

    /**
     * Configures generic reverb parameters based on a preset type.
     * Applies the selected preset's values to the generic reverb nodes and store state.
     * If type is 'custom', it applies the values from genericReverbCustomSettings.
     * @param type The preset type ('room', 'hall', 'plate', 'custom', etc.).
     */
    configureGenericReverb: (type: string) => {
        store.update(s => {
            // Define reverb presets
            const presets: { [key: string]: typeof defaultGenericReverbCustomSettings } = {
                room: { decay: 0.42, damping: 9000, mix: 0.16, preDelay: 0.008, modulationRate: 0.4, modulationDepth: 0.00008 },
                hall: { decay: 0.62, damping: 6000, mix: 0.26, preDelay: 0.018, modulationRate: 0.5, modulationDepth: 0.0001 },
                plate: { decay: 0.72, damping: 11500, mix: 0.20, preDelay: 0.008, modulationRate: 0.6, modulationDepth: 0.00009 },
                space: { decay: 0.85, damping: 3800, mix: 0.32, preDelay: 0.045, modulationRate: 0.7, modulationDepth: 0.00012 },
                studio: { decay: 0.52, damping: 7500, mix: 0.14, preDelay: 0.012, modulationRate: 0.3, modulationDepth: 0.00006 },
                custom: s.genericReverbCustomSettings // Use current custom settings
            };

            // Get preset, or fallback to 'hall' if type is unrecognized
            const p = presets[type] || presets.hall;
            if (!presets[type]) {
                console.warn(`AudioEffectsStore: Unrecognized generic reverb type "${type}", falling back to "hall".`);
                type = 'hall';
            }

            console.log(`AudioEffectsStore: Generic reverb preset set to "${type}".`);
            return {
                ...s,
                genericReverbDecay: p.decay,
                genericReverbDamping: p.damping,
                genericReverbMix: p.mix,
                genericReverbPreDelay: p.preDelay,
                genericReverbType: type,
                genericReverbModulationRate: p.modulationRate,
                genericReverbModulationDepth: p.modulationDepth
                // Note: We no longer overwrite `genericReverbCustomSettings` here.
                // This preserves the user's custom tweaks when they try out other presets.
            };
        });
        audioEffectsStore.updateAllEffects(); // Ensure overall state and node parameters are updated
    },

    // --- Dynamics Compressor Management ---
    toggleCompressor: (enabled: boolean) => {
        store.update(s => ({ ...s, compressorEnabled: enabled }));
        audioEffectsStore.updateAllEffects();
    },
    setCompressorThreshold: (threshold: number) => {
        store.update(s => ({ ...s, compressorThreshold: threshold }));
        audioEffectsStore.updateAllEffects();
    },
    setCompressorKnee: (knee: number) => {
        store.update(s => ({ ...s, compressorKnee: knee }));
        audioEffectsStore.updateAllEffects();
    },
    setCompressorRatio: (ratio: number) => {
        store.update(s => ({ ...s, compressorRatio: ratio }));
        audioEffectsStore.updateAllEffects();
    },
    setCompressorAttack: (attack: number) => {
        store.update(s => ({ ...s, compressorAttack: attack }));
        audioEffectsStore.updateAllEffects();
    },
    setCompressorRelease: (release: number) => {
        store.update(s => ({ ...s, compressorRelease: release }));
        audioEffectsStore.updateAllEffects();
    },

    // --- Spatial Audio (Panner) Management ---
    setPannerPosition: (position: { x?: number; y?: number; z?: number }) => {
        store.update(s => {
            // Do not allow manual control if automation is enabled
            if (s.pannerAutomationEnabled) return s;
            const newPos = { ...s.pannerPosition, ...position };
            // NEW: Use linearRampToValueAtTime for smoother manual updates
            if (s.pannerNode && s.audioContext) {
                const now = s.audioContext.currentTime;
                const rampDuration = 0.02; // 20ms ramp for smoothness
                const rampTargetTime = now + rampDuration;
                s.pannerNode.positionX.linearRampToValueAtTime(newPos.x, rampTargetTime);
                s.pannerNode.positionY.linearRampToValueAtTime(newPos.y, rampTargetTime);
                s.pannerNode.positionZ.linearRampToValueAtTime(newPos.z, rampTargetTime);
            }
            return { ...s, pannerPosition: newPos };
        });
        audioEffectsStore.updateAllEffects();
    },
    togglePannerAutomation: (enabled: boolean) => {
        store.update(s => ({ ...s, pannerAutomationEnabled: enabled }));
        if (enabled) {
            startPannerAutomation();
        } else {
            stopPannerAutomation();
            // Reset position to center for a predictable state when turning off automation.
            audioEffectsStore.setPannerPosition({ x: 0, y: 0, z: 0 }); // This will call updateAllEffects and saveSettings
        }
        // Removed direct saveSettings call here, as setPannerPosition already calls updateAllEffects,
        // which then triggers the debounced save. A direct save also happens on pagehide.
        // audioEffectsStore.saveSettings();
    },
    setPannerAutomationRate: (rate: number) => {
        store.update(s => ({ ...s, pannerAutomationRate: rate }));
        audioEffectsStore.saveSettings();
    },

    toggleSpatialAudio: (enabled: boolean) => {
        store.update(s => ({ ...s, spatialAudioEnabled: enabled }));
        audioEffectsStore.updateAllEffects(); // This handles the cross-fade logic
    },

    // --- Loudness Normalization Management ---
    toggleLoudnessNormalization: (enabled: boolean) => {
        store.update(s => ({ ...s, loudnessNormalizationEnabled: enabled }));
        audioEffectsStore.updateAllEffects();
    },
    setLoudnessTarget: (target: number) => {
        store.update(s => ({ ...s, loudnessTarget: target }));
        audioEffectsStore.saveSettings(); // No need to call updateAllEffects, the worklet will pick it up
    },

    /**
     * Sets the master volume of the entire audio graph.
     * This is called by Player.svelte when the playerStore's volume changes.
     * @param volume The new master volume (0-1).
     * @param fadeDurationSec The duration over which to fade the volume in seconds. Defaults to 0.1s.
     */
    setMasterVolume: (volume: number, fadeDurationSec: number = 0.1) => { // Default to 100ms fade
        const s = getCurrentState();
        if (s.masterGainNode && s.audioContext) {
            const now = s.audioContext.currentTime;
            // Cancel any actively scheduled automations for gain to prevent conflicts
            s.masterGainNode.gain.cancelScheduledValues(now);
            // Apply a linear ramp to the new volume
            // Ensure a minimum duration to avoid instant setValueAtTime clicks
            const actualFadeDuration = Math.max(0.01, fadeDurationSec); // Minimum 10ms for smooth ramps
            s.masterGainNode.gain.linearRampToValueAtTime(volume, now + actualFadeDuration);
        }
    },

    /**
     * Fetches the list of available Impulse Response files from the server.
     */
    fetchAvailableIrs: async () => {
        if (typeof window === 'undefined') return;
        try {
            const response = await fetch('/api/irs'); // Ensure this API endpoint exists and works
            if (!response.ok) throw new Error('Failed to fetch IR list');
            const newIrs: string[] = await response.json();
            store.update(s => {
                // If a selected IR was loaded from localStorage, check if it's still available.
                // If not, clear the selection. If no IR selected and available, default to first.
                if (s.selectedIrUrl && !newIrs.includes(s.selectedIrUrl)) {
                     console.warn(`AudioEffectsStore: Stored IR URL (${s.selectedIrUrl}) not found in available IRs. Clearing selection.`);
                     s.selectedIrUrl = null;
                } else if (!s.selectedIrUrl && newIrs.length > 0) {
                    s.selectedIrUrl = newIrs[0];
                }
                return { ...s, availableIrs: newIrs };
            });
            console.log('AudioEffectsStore: Fetched available IRs.');
        } catch (error) {
            console.error('AudioEffectsStore: Error fetching available IRs:', error);
            store.update(s => ({ ...s, availableIrs: [], selectedIrUrl: null }));
        }
    },

    /**
     * Loads an Impulse Response audio file into the ConvolverNode.
     * @param irUrl The URL of the IR file to load, or null to clear.
     */
    loadImpulseResponse: async (irUrl: string | null) => {
        const state = getCurrentState();
        if (!irUrl || !state.audioContext || !state.convolverNode) {
            store.update(s => ({ ...s, impulseResponseBuffer: null }));
            if (state.convolverNode) state.convolverNode.buffer = null; // Clear existing buffer
            audioEffectsStore.updateAllEffects(); // Update connections to reflect no convolver
            console.log('AudioEffectsStore: No IR URL provided or audioContext/convolver not ready. Clearing convolver buffer.');
            return;
        }

        try {
            console.log(`AudioEffectsStore: Loading impulse response from ${irUrl}...`);
            const response = await fetch(irUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = await state.audioContext.decodeAudioData(arrayBuffer);
            store.update(s => ({ ...s, impulseResponseBuffer: buffer }));
            state.convolverNode.buffer = buffer; // Set buffer on the actual node
            audioEffectsStore.updateAllEffects(); // Re-evaluate connections after buffer loads
            console.log(`AudioEffectsStore: Impulse response for ${irUrl} loaded and set.`);
        } catch (error) {
            console.error(`AudioEffectsStore: Error loading impulse response from ${irUrl}:`, error);
            store.update(s => ({ ...s, impulseResponseBuffer: null }));
            if (state.convolverNode) state.convolverNode.buffer = null;
            audioEffectsStore.updateAllEffects(); // Update connections to reflect error
        }
    },
};

audioEffectsStore.loadSettings(); // Load settings on store initialization