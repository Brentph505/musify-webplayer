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
    mix: 0.2,
    preDelay: 0.02,
    modulationRate: 2.5,
    modulationDepth: 0.001
};

const AUDIO_SETTINGS_LOCAL_STORAGE_KEY = 'musify-audio-settings';

// Removed aggressive latency hints to improve performance on mobile devices.
// const DESIRED_BUFFER_SIZE_SAMPLES = 256; 
// const DEFAULT_SAMPLE_RATE = 44100;

// ---------------------------
// Types
// ---------------------------

export type AudioEffectsState = {
    performanceMode: 'low' | 'balanced' | 'high';
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
    stereoWideningEnabled: boolean; // NEW: Stereo Widening
    stereoWideningAmount: number; // 0.0 to 1.0

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
    pannerNode: PannerNode | null;
    // Cross-fader nodes for spatial audio
    spatialWetGainNode: GainNode | null;
    spatialBypassGainNode: GainNode | null;
    // NEW: Stereo Widening Nodes
    stereoWidenerBypassGainNode: GainNode | null;
    stereoWidenerWetGainNode: GainNode | null;
    stereoWidenerSplitterNode: ChannelSplitterNode | null;
    stereoWidenerDelayLNode: DelayNode | null;
    stereoWidenerDelayRNode: DelayNode | null;
    stereoWidenerMergerNode: ChannelMergerNode | null;
    // Loudness nodes
    loudnessNormalizationGainNode: GainNode | null;
    loudnessMeterNode: AudioWorkletNode | null;
    masterLimiterNode: DynamicsCompressorNode | null;

    // Temporary storage for user's preferred settings when in 'balanced' or 'low' mode
    _priorGenericReverbType: string | null;
    _priorGenericReverbEnabled: boolean | null;
    _priorCompressorSettings: {
        enabled: boolean;
        threshold: number;
        knee: number;
        ratio: number;
        attack: number;
        release: number;
    } | null;
    _priorConvolverEnabled: boolean | null;
    _priorSpatialAudioEnabled: boolean | null;
    _priorLoudnessNormalizationEnabled: boolean | null;
    _priorPannerAutomationEnabled: boolean | null;
    _priorStereoWideningEnabled: boolean | null; // NEW: Initialize stereo widening prior state
    _audioElement: HTMLAudioElement | null; // Added for internal tracking of the audio element
    _wasPlayingBeforeSuspend: boolean; // Added for tracking playback state during suspend/resume
};

// ---------------------------
// Initial State
// ---------------------------

const initialAudioEffectsState: AudioEffectsState = {
    performanceMode: 'high',
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
    // NEW: Initialize Stereo Widening state
    stereoWideningEnabled: false,
    stereoWideningAmount: 0.0,

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
    pannerNode: null,
    // Cross-fader nodes for spatial audio
    spatialWetGainNode: null,
    spatialBypassGainNode: null,
    // NEW: Initialize Stereo Widening Nodes
    stereoWidenerBypassGainNode: null,
    stereoWidenerWetGainNode: null,
    stereoWidenerSplitterNode: null,
    stereoWidenerDelayLNode: null,
    stereoWidenerDelayRNode: null,
    stereoWidenerMergerNode: null,
    // Loudness nodes
    loudnessNormalizationGainNode: null,
    loudnessMeterNode: null,
    masterLimiterNode: null,

    // Initialize temporary storage to null
    _priorGenericReverbType: null,
    _priorGenericReverbEnabled: null,
    _priorCompressorSettings: null,
    _priorConvolverEnabled: null,
    _priorSpatialAudioEnabled: null,
    _priorLoudnessNormalizationEnabled: null,
    _priorPannerAutomationEnabled: null,
    _priorStereoWideningEnabled: null, // NEW: Initialize stereo widening prior state

    // Initialize audio element reference
    _audioElement: null,
    _wasPlayingBeforeSuspend: false, // Default to false
};

const store = writable<AudioEffectsState>(initialAudioEffectsState);
let pannerAutomationIntervalId: number | null = null;
let pannerUiUpdateCounter = 0;
const PANNER_UI_UPDATE_INTERVAL = 4; // Update UI every 4 audio ticks (200ms) for performance.
let saveSettingsDebounceTimer: number | null = null;

// NEW: track whether reverb LFOs were started (OscillatorNode.start() is one-time)
let reverbLFOsStarted = false;

// ---------------------------
// Helper Functions
// ---------------------------

const getCurrentState = () => get(store);

const saveToLocalStorage = (state: AudioEffectsState) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const settingsToSave = {
        performanceMode: state.performanceMode,
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
        // NEW: Save Stereo Widening settings
        stereoWideningEnabled: state.stereoWideningEnabled,
        stereoWideningAmount: state.stereoWideningAmount,
        loudnessNormalizationEnabled: state.loudnessNormalizationEnabled,
        loudnessTarget: state.loudnessTarget
        // Note: _prior... settings are not saved to localStorage as they are temporary
    };
    localStorage.setItem(AUDIO_SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(settingsToSave));
    console.log('AudioEffectsStore: Saved audio settings to localStorage.');
};

// NEW: Helper function for Stereo Widening
const updateStereoWidener = (state: AudioEffectsState) => {
    const {
        audioContext,
        stereoWideningEnabled,
        stereoWideningAmount,
        stereoWidenerBypassGainNode,
        stereoWidenerWetGainNode,
        stereoWidenerDelayLNode,
        stereoWidenerDelayRNode
    } = state;

    if (!audioContext || !stereoWidenerBypassGainNode || !stereoWidenerWetGainNode || !stereoWidenerDelayLNode || !stereoWidenerDelayRNode) {
        console.warn('AudioEffectsStore: Stereo Widener nodes not ready for update.');
        return;
    }

    const now = audioContext.currentTime;
    const rampTime = now + 0.05; // 50ms ramp

    if (stereoWideningEnabled) {
        // Cross-fade between dry (bypass) and wet (widened) signal
        stereoWidenerBypassGainNode.gain.linearRampToValueAtTime(1.0 - stereoWideningAmount, rampTime);
        // A slight boost on the wet signal can enhance the perception of widening
        const wetGainBoost = 1.0 + (stereoWideningAmount * 0.5); // Max 1.5x boost at full amount
        stereoWidenerWetGainNode.gain.linearRampToValueAtTime(stereoWideningAmount * wetGainBoost, rampTime);
        
        // Ensure delays are set (these are fixed, but good to ensure they are active)
        stereoWidenerDelayLNode.delayTime.setValueAtTime(0.010, now); // 10ms
        stereoWidenerDelayRNode.delayTime.setValueAtTime(0.020, now); // 20ms
    } else {
        // Bypass the widener: full dry, no wet
        stereoWidenerBypassGainNode.gain.linearRampToValueAtTime(1.0, rampTime);
        stereoWidenerWetGainNode.gain.linearRampToValueAtTime(0.0, rampTime);
    }
};

const SPATIAL_AUDIO_WET_GAIN_COMPENSATION = 10.5; // ~+3dB boost. Compensates for perceived volume loss from HRTF without over-emphasizing bass/mids.

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
    const { convolverEnabled, impulseResponseBuffer, convolverNode, convolverDryGainNode, convolverWetGainNode, convolverMix } = state;
    if (!convolverNode || !convolverDryGainNode || !convolverWetGainNode) {
        console.warn('AudioEffectsStore: Convolver nodes not ready for update.');
        return;
    }

    const now = state.audioContext?.currentTime;
    const rampTime = now ? now + 0.05 : 0.05; // 50ms ramp, but immediate if time is 0 (suspended context)

    if (convolverEnabled) {
        convolverDryGainNode.gain.linearRampToValueAtTime(1 - convolverMix, rampTime);
        convolverWetGainNode.gain.linearRampToValueAtTime(convolverMix, rampTime);
        // convolverBoostGainNode is now always 1, controlled by the new wet/dry mix
    } else {
        // Bypass convolver: set dry to full, wet to none
        convolverDryGainNode.gain.linearRampToValueAtTime(1, rampTime);
        convolverWetGainNode.gain.linearRampToValueAtTime(0, rampTime);
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
        });
        // Kill modulation when reverb is off to save resources
        reverbModGains.forEach(g => g.gain.linearRampToValueAtTime(0, rampTime));
    }
};

const updateCompressor = (state: AudioEffectsState) => {
    const { compressorNode, compressorEnabled, compressorThreshold, compressorKnee, compressorRatio, compressorAttack, compressorRelease, audioContext } = state;
    if (!compressorNode || !audioContext) {
        console.warn('AudioEffectsStore: Compressor node or audio context not ready for update.');
        return;
    }

    const now = audioContext.currentTime;
    const rampTime = now + 0.02; // Short ramp for compressor parameters

    if (compressorEnabled) {
        compressorNode.threshold.linearRampToValueAtTime(compressorThreshold, rampTime);
        compressorNode.knee.linearRampToValueAtTime(compressorKnee, rampTime);
        compressorNode.ratio.linearRampToValueAtTime(compressorRatio, rampTime);
        compressorNode.attack.linearRampToValueAtTime(compressorAttack, rampTime);
        compressorNode.release.linearRampToValueAtTime(compressorRelease, rampTime);
    } else {
        // Effectively bypass the compressor
        compressorNode.threshold.linearRampToValueAtTime(0, rampTime);
        compressorNode.ratio.linearRampToValueAtTime(1, rampTime);
        compressorNode.attack.linearRampToValueAtTime(0, rampTime);
        compressorNode.release.linearRampToValueAtTime(0, rampTime);
        compressorNode.knee.linearRampToValueAtTime(0, rampTime);
    }
};

const updatePanner = (state: AudioEffectsState) => {
    if (!state.pannerNode || !state.audioContext) return;
    // If automation is running, it controls the panner position.
    // If pannerAutomationEnabled is false, then manual values apply.
    if (state.pannerAutomationEnabled) {
        // Automation handles setting positions. We do nothing here.
    } else {
        // Manual control: set values only if automation is off.
        state.pannerNode.positionX.setValueAtTime(state.pannerPosition.x, state.audioContext.currentTime);
        state.pannerNode.positionY.setValueAtTime(state.pannerPosition.y, state.audioContext.currentTime);
        state.pannerNode.positionZ.setValueAtTime(state.pannerPosition.z, state.audioContext.currentTime);
    }
};

const updateLoudnessNormalization = (state: AudioEffectsState) => {
    if (!state.loudnessNormalizationGainNode || !state.audioContext) return;

    if (!state.loudnessNormalizationEnabled) {
        // If normalization is turned off, smoothly ramp the gain back to 1 (no change)
        state.loudnessNormalizationGainNode.gain.linearRampToValueAtTime(1.0, state.audioContext.currentTime + 0.5);
    }
    // If it's enabled, the onmessage handler from the worklet will control the gain, so no 'else' is needed here.
};

const PANNER_AUTOMATION_INTERVAL_MS = 50; // 20 updates per second

// Refactored pannerAutomationLoop: Only updates positions, does not manage interval lifecycle
const pannerAutomationLoop = () => {
    const state = getCurrentState();
    // This function should only be called if automation is enabled and context is running.
    // If conditions are no longer met, the interval should have been stopped by `updateAllEffects`.
    if (!state.pannerNode || !state.audioContext || state.audioContext.state !== 'running' || !state.pannerAutomationEnabled) {
        return; // Defensive check, but external logic should prevent this from running if not needed.
    }

    const speed = state.pannerAutomationRate;
    const radius = 8; // The "distance" of the sound source
    const time = Date.now() / 1000;

    const newX = Math.sin(time * speed) * radius;
    // Add Y-axis automation for vertical movement
    const newY = Math.sin(time * speed * 0.5) * (radius / 2); // Slower movement, smaller amplitude for Y
    const newZ = Math.cos(time * speed) * radius;

    const now = state.audioContext.currentTime;
    // Schedule a smooth ramp to the new position over the next interval period.
    const rampTime = now + PANNER_AUTOMATION_INTERVAL_MS / 1000;

    state.pannerNode.positionX.linearRampToValueAtTime(newX, rampTime);
    state.pannerNode.positionY.linearRampToValueAtTime(newY, rampTime); // Apply Y-axis automation
    state.pannerNode.positionZ.linearRampToValueAtTime(newZ, rampTime);

    // Throttled store update for performance. The audio parameters above are updated smoothly regardless.
    pannerUiUpdateCounter++;
    if (pannerUiUpdateCounter >= PANNER_UI_UPDATE_INTERVAL) {
        pannerUiUpdateCounter = 0;
        // Update the store value so the UI reflects the change.
        store.update((s) => ({
            ...s,
            pannerPosition: { ...s.pannerPosition, x: newX, y: newY, z: newZ } // Update Y in store
        }));
    }
};

const startPannerAutomation = () => {
    const state = getCurrentState();
    // Only start if AudioContext is running AND automation is enabled
    if (!state.pannerAutomationEnabled || !state.audioContext || state.audioContext.state !== 'running') {
        // console.log('AudioEffectsStore: Not starting panner automation, conditions not met.');
        return;
    }

    if (pannerAutomationIntervalId === null) {
        console.log('AudioEffectsStore: Starting panner automation.');
        // Before starting, cancel any previous manual settings to avoid conflicts
        if (state.pannerNode && state.audioContext) {
            const now = state.audioContext.currentTime;
            state.pannerNode.positionX.cancelScheduledValues(now);
            state.pannerNode.positionY.cancelScheduledValues(now); // Cancel Y as well
            state.pannerNode.positionZ.cancelScheduledValues(now);
        }
        pannerUiUpdateCounter = PANNER_UI_UPDATE_INTERVAL - 1; // Prime counter for immediate UI update on first run.
        pannerAutomationLoop(); // Run once immediately to set the initial position
        pannerAutomationIntervalId = setInterval(pannerAutomationLoop, PANNER_AUTOMATION_INTERVAL_MS) as unknown as number;
    }
};

const stopPannerAutomation = () => {
    if (pannerAutomationIntervalId !== null) {
        console.log('AudioEffectsStore: Stopping panner automation.');
        clearInterval(pannerAutomationIntervalId);
        pannerAutomationIntervalId = null;

        const state = getCurrentState();
        // When stopping, cancel any pending ramps and set the panner to its last known position.
        // Only do this if context is not yet closed (during destroy) and pannerNode exists.
        if (state.pannerNode && state.audioContext && state.audioContext.state !== 'closed') {
            const now = state.audioContext.currentTime;
            state.pannerNode.positionX.cancelScheduledValues(now);
            state.pannerNode.positionY.cancelScheduledValues(now); // Cancel Y as well
            state.pannerNode.positionZ.cancelScheduledValues(now);
            state.pannerNode.positionX.setValueAtTime(state.pannerPosition.x, now);
            state.pannerNode.positionY.setValueAtTime(state.pannerPosition.y, now); // Set Y to its last known position
            state.pannerNode.positionZ.setValueAtTime(state.pannerPosition.z, now);
        }
    }
};

// Helper to start reverb LFOs once (OscillatorNode.start() can only be called once)
const ensureStartReverbLFOs = () => {
    if (reverbLFOsStarted) return;
    const s = getCurrentState();
    if (!s.audioContext) return;
    s.reverbLFOs.forEach(lfo => {
        try {
            lfo.start();
        } catch (e) {
            // start() may throw if already started; ignore
        }
    });
    reverbLFOsStarted = true;
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

        // Use 'playback' latency hint to optimize for power consumption on mobile/laptops.
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
            latencyHint: 'playback'
        });
        // Initial resume if suspended (e.g., due to autoplay policy)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        console.log(`AudioEffectsStore: AudioContext initialized. State: ${audioContext.state}, ` +
                    `Sample Rate: ${audioContext.sampleRate} Hz, ` +
                    `Base Latency: ${audioContext.baseLatency * 1000} ms.`);


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
            feedback.gain.value = 0; // SAFETY: start feedback at 0 to avoid initial feedback burst
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
            // NOTE: do NOT start() LFOs here to avoid unnecessary CPU at init.
            // They will be started lazily when the generic reverb is first enabled.

            const modGain = audioContext.createGain();
            modGain.gain.value = 0; // SAFETY: start modulation gain at 0 until reverb is enabled

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
        console.log('AudioEffectsStore: DynamicsCompressorNode created.');

        const pannerNode = audioContext.createPanner();
        // Use the HRTF model for high-quality binaural spatialization (best with headphones).
        pannerNode.panningModel = 'HRTF';
        pannerNode.distanceModel = 'inverse'; // More realistic distance falloff
        pannerNode.positionX.value = state.pannerPosition.x;
        pannerNode.positionY.value = state.pannerPosition.y;
        pannerNode.positionZ.value = state.pannerPosition.z;
        pannerNode.orientationX.value = 0;
        pannerNode.orientationY.value = 0;
        pannerNode.orientationZ.value = -1; // Face the listener
        console.log('AudioEffectsStore: PannerNode for spatial audio created.');

        // Create cross-fader nodes for spatial audio bypass
        const spatialWetGainNode = audioContext.createGain();
        const spatialBypassGainNode = audioContext.createGain();

        // NEW: Stereo Widening Nodes
        const stereoWidenerBypassGainNode = audioContext.createGain();
        const stereoWidenerWetGainNode = audioContext.createGain();
        const stereoWidenerSplitterNode = audioContext.createChannelSplitter(2); // Split into 2 channels
        const stereoWidenerDelayLNode = audioContext.createDelay(0.020); // Max 20ms delay
        const stereoWidenerDelayRNode = audioContext.createDelay(0.020); // Max 20ms delay
        stereoWidenerDelayLNode.delayTime.value = 0.010; // 10ms default delay for left
        stereoWidenerDelayRNode.delayTime.value = 0.020; // 20ms default delay for right
        const stereoWidenerMergerNode = audioContext.createChannelMerger(2); // Merge back to 2 channels
        console.log('AudioEffectsStore: Stereo Widening nodes created.');

        // Add a master limiter at the end of the chain to prevent clipping
        const masterLimiterNode = audioContext.createDynamicsCompressor();
        masterLimiterNode.threshold.value = -0.5; // Catch peaks just before 0dB
        masterLimiterNode.knee.value = 0; // Hard knee for true limiting
        masterLimiterNode.ratio.value = 20; // High ratio
        masterLimiterNode.attack.value = 0.001; // Fast attack
        masterLimiterNode.release.value = 0.1; // Relatively fast release
        console.log('AudioEffectsStore: Master limiter created.');

        // Loudness Normalization setup
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

                    // If normalization is enabled and audioContext is running, calculate and apply the gain adjustment
                    if (currentState.loudnessNormalizationEnabled && currentState.loudnessNormalizationGainNode && currentState.audioContext && currentState.audioContext.state === 'running') {
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
            pannerNode,
            spatialWetGainNode, spatialBypassGainNode,
            // Add Stereo Widening nodes to store
            stereoWidenerBypassGainNode, stereoWidenerWetGainNode,
            stereoWidenerSplitterNode, stereoWidenerDelayLNode, stereoWidenerDelayRNode, stereoWidenerMergerNode,
            // Add loudness nodes to store
            loudnessNormalizationGainNode, loudnessMeterNode,
            // Add limiter node to store
            masterLimiterNode,
        });
        console.log('AudioEffectsStore: Store updated with new audio nodes.');

        audioEffectsStore.setupAudioGraph();
        console.log('AudioEffectsStore: Audio graph connections established.');

        await audioEffectsStore.fetchAvailableIrs();
        await audioEffectsStore.loadImpulseResponse(getCurrentState().selectedIrUrl);
        audioEffectsStore.configureGenericReverb(getCurrentState().genericReverbType);
        audioEffectsStore.updateAllEffects(); // Final update to set all gains/states based on loaded settings
        console.log('AudioEffectsStore: Initialization complete.');
    },

    /**
     * Sets the performance profile, enabling or disabling heavy effects and adjusting their algorithms.
     * @param mode The performance mode to set.
     */
    setPerformanceMode: (mode: 'low' | 'balanced' | 'high') => {
        store.update(s => {
            const oldMode = s.performanceMode;
            const newState: AudioEffectsState = { ...s, performanceMode: mode };

            // Backup user settings ONLY IF transitioning from 'high' to a lower mode
            if (oldMode === 'high' && (mode === 'low' || mode === 'balanced')) {
                newState._priorGenericReverbType = s.genericReverbType;
                newState._priorGenericReverbEnabled = s.genericReverbEnabled;
                newState._priorCompressorSettings = {
                    enabled: s.compressorEnabled,
                    threshold: s.compressorThreshold,
                    knee: s.compressorKnee,
                    ratio: s.compressorRatio,
                    attack: s.compressorAttack,
                    release: s.compressorRelease,
                };
                newState._priorConvolverEnabled = s.convolverEnabled;
                newState._priorSpatialAudioEnabled = s.spatialAudioEnabled;
                newState._priorLoudnessNormalizationEnabled = s.loudnessNormalizationEnabled;
                newState._priorPannerAutomationEnabled = s.pannerAutomationEnabled;
                newState._priorStereoWideningEnabled = s.stereoWideningEnabled; // NEW: Save stereo widening state
            }

            // Define specific algorithmic settings for 'low' and 'balanced' modes
            const lowGenericReverbAlgorithm = { // Effectively off
                decay: 0.0, damping: 22000, mix: 0.0, preDelay: 0.0,
                modulationRate: 0.0, modulationDepth: 0.0
            };
            const balancedGenericReverbAlgorithm = { // Lighter reverb
                decay: 0.3, damping: 10000, mix: 0.1, preDelay: 0.01,
                modulationRate: 0.1, modulationDepth: 0.00001
            };
            const lowCompressorAlgorithm = { // Effectively off (bypass)
                threshold: 0, knee: 0, ratio: 1, attack: 0, release: 0
            };
            const balancedCompressorAlgorithm = { // Milder compression
                threshold: -18, knee: 10, ratio: 4, attack: 0.01, release: 0.5
            };


            switch (mode) {
                case 'low':
                    // Force disable all heavy effects (algorithmic change: minimal processing)
                    newState.convolverEnabled = false;
                    newState.genericReverbEnabled = false; // Forced off
                    newState.compressorEnabled = false; // Forced off
                    newState.spatialAudioEnabled = false;
                    newState.loudnessNormalizationEnabled = false;
                    newState.pannerAutomationEnabled = false;
                    newState.stereoWideningEnabled = false; // NEW: Disable stereo widening in low mode

                    // Apply minimal/off generic reverb algorithm
                    newState.genericReverbDecay = lowGenericReverbAlgorithm.decay;
                    newState.genericReverbDamping = lowGenericReverbAlgorithm.damping;
                    newState.genericReverbMix = lowGenericReverbAlgorithm.mix;
                    newState.genericReverbPreDelay = lowGenericReverbAlgorithm.preDelay;
                    newState.genericReverbModulationRate = lowGenericReverbAlgorithm.modulationRate;
                    newState.genericReverbModulationDepth = lowGenericReverbAlgorithm.modulationDepth;
                    newState.genericReverbType = 'custom'; // Mark as custom because parameters are forced
                    newState.genericReverbCustomSettings = { ...lowGenericReverbAlgorithm }; // Update custom settings to reflect current low algorithm

                    // Apply minimal/off compressor algorithm
                    newState.compressorThreshold = lowCompressorAlgorithm.threshold;
                    newState.compressorKnee = lowCompressorAlgorithm.knee;
                    newState.compressorRatio = lowCompressorAlgorithm.ratio;
                    newState.compressorAttack = lowCompressorAlgorithm.attack;
                    newState.compressorRelease = lowCompressorAlgorithm.release;
                    break;

                case 'balanced':
                    // Disable the heaviest effects: IR reverb, spatial audio, loudness meter, stereo widening
                    newState.convolverEnabled = false;
                    newState.spatialAudioEnabled = false;
                    newState.loudnessNormalizationEnabled = false;
                    newState.pannerAutomationEnabled = false;
                    newState.stereoWideningEnabled = false; // NEW: Disable stereo widening in balanced mode

                    // Ensure generic reverb and compressor are enabled in balanced mode
                    newState.genericReverbEnabled = true; // Forced on
                    newState.compressorEnabled = true; // Forced on

                    // Apply simplified, lighter algorithmic parameters for generic reverb
                    newState.genericReverbDecay = balancedGenericReverbAlgorithm.decay;
                    newState.genericReverbDamping = balancedGenericReverbAlgorithm.damping;
                    newState.genericReverbMix = balancedGenericReverbAlgorithm.mix;
                    newState.genericReverbPreDelay = balancedGenericReverbAlgorithm.preDelay;
                    newState.genericReverbModulationRate = balancedGenericReverbAlgorithm.modulationRate;
                    newState.genericReverbModulationDepth = balancedGenericReverbAlgorithm.modulationDepth;
                    newState.genericReverbType = 'custom'; // Mark as custom because parameters are forced
                    newState.genericReverbCustomSettings = { ...balancedGenericReverbAlgorithm }; // Update custom settings to reflect current balanced algorithm

                    // Apply milder algorithmic parameters for compressor
                    newState.compressorThreshold = balancedCompressorAlgorithm.threshold;
                    newState.compressorKnee = balancedCompressorAlgorithm.knee;
                    newState.compressorRatio = balancedCompressorAlgorithm.ratio;
                    newState.compressorAttack = balancedCompressorAlgorithm.attack;
                    newState.compressorRelease = balancedCompressorAlgorithm.release;
                    break;

                case 'high':
                    // In 'high' mode, we revert to the user's previously set preferences.
                    // If no prior settings were backed up (e.g., first run in 'high'), use current state.
                    if (oldMode !== 'high' && newState._priorGenericReverbType !== null) {
                        newState.genericReverbEnabled = newState._priorGenericReverbEnabled ?? initialAudioEffectsState.genericReverbEnabled;
                        newState.genericReverbType = newState._priorGenericReverbType;
                        // Call configureGenericReverb to apply the correct parameters from user's original type/custom settings
                        audioEffectsStore.configureGenericReverb(newState.genericReverbType);
                        // The configureGenericReverb call would update genericReverb* properties.
                        // We also need to restore custom settings directly if that was the type.
                        if (newState.genericReverbType === 'custom') {
                            // This relies on `genericReverbCustomSettings` being correctly persisted by user actions
                            // and `loadSettings`. If it was only changed by `balanced` mode, it would be the balanced value.
                            // A more robust solution would store `_priorGenericReverbCustomSettings` too.
                            // For now, `configureGenericReverb` when type is 'custom' will correctly use `s.genericReverbCustomSettings`.
                        }
                    } else if (oldMode === 'high') {
                        // If already in 'high' mode (no actual change in mode), do nothing.
                        // The user's settings are already active.
                    }
                    
                    if (oldMode !== 'high' && newState._priorCompressorSettings !== null) {
                        newState.compressorEnabled = newState._priorCompressorSettings.enabled;
                        newState.compressorThreshold = newState._priorCompressorSettings.threshold;
                        newState.compressorKnee = newState._priorCompressorSettings.knee;
                        newState.compressorRatio = newState._priorCompressorSettings.ratio;
                        newState.compressorAttack = newState._priorCompressorSettings.attack;
                        newState.compressorRelease = newState._priorCompressorSettings.release;
                    }

                    // Restore other enabled states
                    if (oldMode !== 'high' && newState._priorConvolverEnabled !== null) {
                        newState.convolverEnabled = newState._priorConvolverEnabled;
                    }
                    if (oldMode !== 'high' && newState._priorSpatialAudioEnabled !== null) {
                        newState.spatialAudioEnabled = newState._priorSpatialAudioEnabled;
                    }
                    if (oldMode !== 'high' && newState._priorLoudnessNormalizationEnabled !== null) {
                        newState.loudnessNormalizationEnabled = newState._priorLoudnessNormalizationEnabled;
                    }
                    if (oldMode !== 'high' && newState._priorPannerAutomationEnabled !== null) {
                        newState.pannerAutomationEnabled = newState._priorPannerAutomationEnabled;
                    }
                    if (oldMode !== 'high' && newState._priorStereoWideningEnabled !== null) { // NEW: Restore stereo widening state
                        newState.stereoWideningEnabled = newState._priorStereoWideningEnabled;
                    }

                    // Clear prior settings after restoration
                    newState._priorGenericReverbType = null;
                    newState._priorGenericReverbEnabled = null;
                    newState._priorCompressorSettings = null;
                    newState._priorConvolverEnabled = null;
                    newState._priorSpatialAudioEnabled = null;
                    newState._priorLoudnessNormalizationEnabled = null;
                    newState._priorPannerAutomationEnabled = null;
                    newState._priorStereoWideningEnabled = null; // NEW: Clear stereo widening prior state

                    // Important: `configureGenericReverb` needs the updated state.
                    // This call might need to be outside `store.update` if it uses `dispatch` or relies on
                    // the store's current state to be fully updated *before* calling it.
                    // For now, let's keep it here, but add a call to configureGenericReverb outside the update as well
                    // if _priorGenericReverbType was restored to ensure parameters are reapplied.
                    break;
            }
            return newState;
        });
        audioEffectsStore.updateAllEffects(); // Apply changes immediately after state update
        // If coming from low/balanced to high, re-configure generic reverb based on restored type
        const stateAfterUpdate = getCurrentState();
        if (stateAfterUpdate.performanceMode === 'high' && stateAfterUpdate._priorGenericReverbType === null) {
            // This condition ensures configureGenericReverb is called *once* after the store has updated,
            // which allows it to correctly load preset parameters if genericReverbType was restored.
            // But we already call it inside the update block. Let's rely on that for now.
            // The audioEffectsStore.updateAllEffects() will trigger relevant node updates.
        }
    },

    /**
     * Cleans up the AudioContext and resets the store state.
     */
    destroy: () => {
        const state = getCurrentState();
        // Close AudioContext first
        if (state.audioContext) {
            state.audioContext.close().then(() => {
                console.log('AudioEffectsStore: AudioContext closed.' );
            }).catch(e => console.error('AudioEffectsStore: Error closing AudioContext:', e));
        }

        // Stop all LFOs explicitly on destroy to free up resources
        // Only stop if they were actually started
        if (reverbLFOsStarted) {
            state.reverbLFOs.forEach(lfo => {
                try {
                    lfo.stop();
                } catch (e) {
                    console.warn('AudioEffectsStore: Error stopping LFO, might already be stopped:', e);
                }
            });
            reverbLFOsStarted = false;
        }
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
            !s.reverbLFOs.length || !s.reverbModGains.length || !s.compressorNode || !s.pannerNode ||
            !s.spatialWetGainNode || !s.spatialBypassGainNode || // Check for new spatial nodes
            !s.stereoWidenerBypassGainNode || !s.stereoWidenerWetGainNode || !s.stereoWidenerSplitterNode ||
            !s.stereoWidenerDelayLNode || !s.stereoWidenerDelayRNode || !s.stereoWidenerMergerNode || // Check for stereo widening nodes
            !s.loudnessNormalizationGainNode || !s.loudnessMeterNode || // Check loudness nodes
            !s.masterLimiterNode) { // Check limiter node
            console.error('AudioEffectsStore: Cannot setup audio graph, some required nodes are null/missing.');
            return;
        }

        // 1. Source -> EQ Chain
        let eqOutput: AudioNode = s.sourceNode;
        if (s.filterNodes.length > 0) {
            s.sourceNode.connect(s.filterNodes[0]);
            for (let i = 0; i < s.filterNodes.length - 1; i++) {
                s.filterNodes[i].connect(s.filterNodes[i + 1]);
            }
            eqOutput = s.filterNodes[s.filterNodes.length - 1]; // Output of EQ chain
        }

        // 2. EQ Chain Output -> Split into parallel effect paths
        eqOutput.connect(s.convolverDryGainNode);   // Dry path for convolver mix
        eqOutput.connect(s.convolverNode);          // Wet path for convolver
        eqOutput.connect(s.genericReverbPreDelayNode); // Input for generic reverb starts with pre-delay

        // 3. Set up Generic Reverb Routing (this part is internal to the reverb and doesn't change)
        s.genericReverbPreDelayNode.connect(s.combMergerNode); // Connect to comb merger directly for early reflections
        for (let i = 0; i < s.combFilters.length; i++) {
            const comb = s.combFilters[i];
            s.genericReverbPreDelayNode.connect(comb.delay);
            comb.delay.connect(comb.feedback);
            comb.feedback.connect(comb.filter);
            comb.filter.connect(comb.delay);
            comb.delay.connect(s.combMergerNode);
        }
        s.combMergerNode.connect(s.allPassFilters[0]);
        for (let i = 0; i < s.allPassFilters.length - 1; i++) {
            s.allPassFilters[i].connect(s.allPassFilters[i + 1]);
        }
        s.allPassFilters[s.allPassFilters.length - 1].connect(s.genericReverbOutputGain);

        // 4. Convolver wet path setup
        s.convolverNode.connect(s.convolverWetGainNode);
        // The boost node is now correctly placed here to only affect the convolver's wet signal
        s.convolverWetGainNode.connect(s.convolverBoostGainNode);

        // 5. All Effect Paths -> Sum at the Compressor

        // NOTE: If convolver and generic reverb are OFF, these dry/wet gains should ensure no signal passes.
        // If a signal should ALWAYS pass through the compressor from the EQ output regardless of effects,
        // then eqOutput.connect(s.compressorNode) should be added directly here.
        // For now, assuming effects *always* funnel into the compressor.
        s.convolverDryGainNode.connect(s.compressorNode);
        s.convolverBoostGainNode.connect(s.compressorNode); // Connect the boosted wet path
        s.genericReverbOutputGain.connect(s.compressorNode);

        // 6. Post-Processing Chain: Compressor -> Spatial Audio Cross-fader -> Loudness -> Stereo Widening -> Analyser -> Master

        // The loudness meter is always connected in parallel after the compressor to measure its output
        s.compressorNode.connect(s.loudnessMeterNode);

        // --- Spatial Audio Cross-fader setup ---
        // The compressor output splits into two parallel paths that will be cross-faded.
        // The wet path's gain node is placed *before* the panner to gate the signal, saving CPU
        // when spatial audio is disabled.

        // Path 1: The "wet" signal with spatialization
        s.compressorNode.connect(s.spatialWetGainNode);
        s.spatialWetGainNode.connect(s.pannerNode);
        s.pannerNode.connect(s.loudnessNormalizationGainNode);

        // Path 2: The "dry" (bypass) signal
        s.compressorNode.connect(s.spatialBypassGainNode);
        s.spatialBypassGainNode.connect(s.loudnessNormalizationGainNode);
        // --- End Cross-fader ---

        // The two paths merge at the loudnessNormalizationGainNode, which then continues the chain.
        // NEW: Insert Stereo Widening AFTER Loudness Normalization
        s.loudnessNormalizationGainNode.connect(s.stereoWidenerBypassGainNode); // Dry path for widener
        s.loudnessNormalizationGainNode.connect(s.stereoWidenerSplitterNode); // Input for wet widener path

        // Stereo Widening wet path connections
        s.stereoWidenerSplitterNode.connect(s.stereoWidenerDelayLNode, 0, 0); // Left channel to left delay
        s.stereoWidenerSplitterNode.connect(s.stereoWidenerDelayRNode, 1, 0); // Right channel to right delay
        s.stereoWidenerDelayLNode.connect(s.stereoWidenerMergerNode, 0, 0); // Left delay to merger's left input
        s.stereoWidenerDelayRNode.connect(s.stereoWidenerMergerNode, 0, 1); // Right delay to merger's right input
        s.stereoWidenerMergerNode.connect(s.stereoWidenerWetGainNode); // Merger output to wet gain

        // Merge widened and bypassed signals before analyser
        s.stereoWidenerBypassGainNode.connect(s.analyserNode);
        s.stereoWidenerWetGainNode.connect(s.analyserNode);

        // The convolverBoostGainNode has been moved to the convolver's wet path to prevent it from boosting the entire mix.
        s.analyserNode.connect(s.masterGainNode);
        // The masterGainNode now goes to a final limiter to prevent any clipping.
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
        updatePanner(state); // Update panner manual values, automation is separate
        updateSpatialAudioFade(state);
        updateLoudnessNormalization(state);
        updateStereoWidener(state); // NEW: Update stereo widener

        // Manage panner automation: Only run if enabled and context is running.
        const shouldRunAutomation = state.pannerAutomationEnabled &&
                                     state.audioContext?.state === 'running';

        if (shouldRunAutomation) {
            startPannerAutomation();
        } else {
            stopPannerAutomation();
        }

        audioEffectsStore.saveSettings(); // Debounced save
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
     * Saves current audio effects settings to localStorage, with debouncing.
     */
    saveSettings: () => {
        if (saveSettingsDebounceTimer) {
            clearTimeout(saveSettingsDebounceTimer);
        }
        saveSettingsDebounceTimer = setTimeout(() => {
            saveToLocalStorage(getCurrentState());
        }, 500) as unknown as number;
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
        await audioEffectsStore.loadImpulseResponse(getCurrentState().selectedIrUrl); // Ensure this uses the updated selectedIrUrl from the state
    },

    // --- Generic Reverb Management ---
    toggleGenericReverb: (enabled: boolean) => {
        store.update(s => ({ ...s, genericReverbEnabled: enabled }));
        // If enabling for the first time, start LFOs lazily to reduce startup cost
        if (enabled) ensureStartReverbLFOs();
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbMix: (mix: number) => {
        store.update(s => {
            // Only mark as custom if not currently in a performance mode that overrides
            if (s.performanceMode === 'high') {
                 s.genericReverbType = 'custom';
                 s.genericReverbCustomSettings.mix = mix;
            }
            return { ...s, genericReverbMix: mix };
        });
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbDecay: (decay: number) => {
        store.update(s => {
            if (s.performanceMode === 'high') {
                s.genericReverbType = 'custom';
                s.genericReverbCustomSettings.decay = decay;
            }
            return { ...s, genericReverbDecay: decay };
        });
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbDamping: (damping: number) => {
        store.update(s => {
            if (s.performanceMode === 'high') {
                s.genericReverbType = 'custom';
                s.genericReverbCustomSettings.damping = damping;
            }
            return { ...s, genericReverbDamping: damping };
        });
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbPreDelay: (preDelay: number) => {
        store.update(s => {
            if (s.performanceMode === 'high') {
                s.genericReverbType = 'custom';
                s.genericReverbCustomSettings.preDelay = preDelay;
            }
            return { ...s, genericReverbPreDelay: preDelay };
        });
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbModulationRate: (rate: number) => {
        store.update(s => {
            if (s.performanceMode === 'high') {
                s.genericReverbType = 'custom';
                s.genericReverbCustomSettings.modulationRate = rate;
            }
            return { ...s, genericReverbModulationRate: rate };
        });
        audioEffectsStore.updateAllEffects();
    },
    setGenericReverbModulationDepth: (depth: number) => {
        store.update(s => {
            if (s.performanceMode === 'high') {
                s.genericReverbType = 'custom';
                s.genericReverbCustomSettings.modulationDepth = depth;
            }
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
                genericReverbType: type, // This will be 'custom' if the user's settings were 'custom'
                genericReverbModulationRate: p.modulationRate,
                genericReverbModulationDepth: p.modulationDepth,
                // If switching from a preset to custom, or if a preset is selected, copy values.
                // If type is custom, genericReverbCustomSettings should already have the correct values.
                genericReverbCustomSettings: type === 'custom' ? s.genericReverbCustomSettings : { ...p }
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
            // Do not allow manual control if automation is enabled or not in high performance mode
            if (s.pannerAutomationEnabled || s.performanceMode !== 'high') return s;
            const newPos = { ...s.pannerPosition, ...position };
            return { ...s, pannerPosition: newPos };
        });
        audioEffectsStore.updateAllEffects();
    },
    togglePannerAutomation: (enabled: boolean) => {
        store.update(s => ({ ...s, pannerAutomationEnabled: enabled }));
        // Call updateAllEffects to manage starting/stopping automation based on new state and visibility
        audioEffectsStore.updateAllEffects();
        audioEffectsStore.saveSettings();
    },
    setPannerAutomationRate: (rate: number) => {
        store.update(s => ({ ...s, pannerAutomationRate: rate }));
        audioEffectsStore.saveSettings();
    },

    toggleSpatialAudio: (enabled: boolean) => {
        store.update(s => ({ ...s, spatialAudioEnabled: enabled }));
        audioEffectsStore.updateAllEffects(); // This handles the cross-fade logic
    },

    // --- Stereo Widening Management ---
    toggleStereoWidening: (enabled: boolean) => {
        store.update(s => ({ ...s, stereoWideningEnabled: enabled }));
        audioEffectsStore.updateAllEffects();
    },
    setStereoWideningAmount: (amount: number) => {
        store.update(s => ({ ...s, stereoWideningAmount: amount }));
        audioEffectsStore.updateAllEffects();
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
     */
    setMasterVolume: (volume: number) => {
        const s = getCurrentState();
        if (s.masterGainNode) {
            s.masterGainNode.gain.value = volume;
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