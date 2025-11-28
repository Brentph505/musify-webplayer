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
    compressorNode: null
};

const store = writable<AudioEffectsState>(initialAudioEffectsState);

// ---------------------------
// Helper Functions
// ---------------------------

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
        compressorRelease: state.compressorRelease
    };
    localStorage.setItem(AUDIO_SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(settingsToSave));
    console.log('AudioEffectsStore: Saved audio settings to localStorage.');
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
    const { genericReverbEnabled, genericReverbPreDelayNode, genericReverbOutputGain, combFilters, reverbLFOs, reverbModGains } = state;
    if (!genericReverbPreDelayNode || !genericReverbOutputGain || !combFilters.length || !reverbLFOs.length || !reverbModGains.length) {
        console.warn('AudioEffectsStore: Generic reverb nodes not ready for update.');
        return;
    }

    if (genericReverbEnabled) {
        genericReverbPreDelayNode.delayTime.value = state.genericReverbPreDelay;
        genericReverbOutputGain.gain.value = state.genericReverbMix;

        const lfoBaseFrequencies = [2.1, 2.3, 1.9, 2.5]; // Must match LFOs created in init
        combFilters.forEach((comb, i) => {
            comb.feedback.gain.value = state.genericReverbDecay;
            comb.filter.frequency.value = state.genericReverbDamping;
            // Update modulation from state
            reverbLFOs[i].frequency.value = lfoBaseFrequencies[i] * (state.genericReverbModulationRate / 2.5);
            reverbModGains[i].gain.value = state.genericReverbModulationDepth;
        });
    } else {
        genericReverbOutputGain.gain.value = 0; // Disable generic reverb output
        // Kill the feedback loops immediately to stop reverb tail
        combFilters.forEach(comb => {
            comb.feedback.gain.value = 0;
            // Kill modulation when reverb is off to save resources
            reverbModGains.forEach(g => g.gain.value = 0);
        });
    }
};

const updateCompressor = (state: AudioEffectsState) => {
    const { compressorNode, compressorEnabled, compressorThreshold, compressorKnee, compressorRatio, compressorAttack, compressorRelease } = state;
    if (!compressorNode) {
        console.warn('AudioEffectsStore: Compressor node not ready for update.');
        return;
    }

    if (compressorEnabled) {
        compressorNode.threshold.value = compressorThreshold;
        compressorNode.knee.value = compressorKnee;
        compressorNode.ratio.value = compressorRatio;
        compressorNode.attack.value = compressorAttack;
        compressorNode.release.value = compressorRelease;
    } else {
        // Effectively bypass the compressor
        compressorNode.threshold.value = 0;
        compressorNode.ratio.value = 1;
        compressorNode.attack.value = 0;
        compressorNode.release.value = 0;
        compressorNode.knee.value = 0;
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
            await audioContext.resume();
        }
        console.log('AudioEffectsStore: AudioContext initialized. State:', audioContext.state);

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
        console.log('AudioEffectsStore: DynamicsCompressorNode created.');

        store.set({
            ...state,
            audioContext, sourceNode, masterGainNode, analyserNode, filterNodes,
            convolverNode, convolverDryGainNode, convolverWetGainNode, convolverBoostGainNode,
            genericReverbPreDelayNode, genericReverbOutputGain, combMergerNode,
            combFilters, allPassFilters, reverbLFOs, reverbModGains, compressorNode
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
     * Cleans up the AudioContext and resets the store state.
     */
    destroy: () => {
        const state = getCurrentState();
        if (state.audioContext) {
            state.audioContext.close().then(() => {
                console.log('AudioEffectsStore: AudioContext closed.');
            }).catch(e => console.error('AudioEffectsStore: Error closing AudioContext:', e));
        }
        state.reverbLFOs.forEach(lfo => {
            try {
                lfo.stop();
            } catch (e) {
                console.warn('AudioEffectsStore: Error stopping LFO, might already be stopped:', e);
            }
        });
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
            !s.reverbLFOs.length || !s.reverbModGains.length || !s.compressorNode) {
            console.error('AudioEffectsStore: Cannot setup audio graph, some required nodes are null/missing.');
            return;
        }

        // 1. Source -> EQ Chain
        let current: AudioNode = s.sourceNode;
        if (s.filterNodes.length > 0) {
            current.connect(s.filterNodes[0]);
            for (let i = 0; i < s.filterNodes.length - 1; i++) {
                s.filterNodes[i].connect(s.filterNodes[i + 1]);
            }
            current = s.filterNodes[s.filterNodes.length - 1]; // Output of EQ chain
        }

        // 2. EQ Chain Output -> Split into multiple paths (Convolver dry/wet, Generic Reverb)
        current.connect(s.convolverDryGainNode);   // Dry path for convolver mix
        current.connect(s.convolverNode);          // Wet path for convolver
        current.connect(s.genericReverbPreDelayNode); // Input for generic reverb starts with pre-delay

        // 3. Set up Generic Reverb Routing
        s.genericReverbPreDelayNode.connect(s.combMergerNode); // Connect to comb merger directly for early reflections
        for (let i = 0; i < s.combFilters.length; i++) {
            const comb = s.combFilters[i];
            // The LFO -> ModGain -> DelayTime connection is established in init, permanent.
            s.genericReverbPreDelayNode.connect(comb.delay); // Main signal into each comb's delay

            // Setup feedback loop for each comb filter: Delay -> Feedback Gain -> Damping Filter -> Delay
            comb.delay.connect(comb.feedback);
            comb.feedback.connect(comb.filter);
            comb.filter.connect(comb.delay);

            // Connect comb output to the merger
            comb.delay.connect(s.combMergerNode);
        }
        // Comb Merger -> Series All-Pass Filters -> Output Gain
        s.combMergerNode.connect(s.allPassFilters[0]);
        for (let i = 0; i < s.allPassFilters.length - 1; i++) {
            s.allPassFilters[i].connect(s.allPassFilters[i + 1]);
        }
        s.allPassFilters[s.allPassFilters.length - 1].connect(s.genericReverbOutputGain); // Final generic reverb output

        // 4. All Effect Paths -> Compressor -> Analyser -> Convolver Boost -> Master Gain -> Destination
        s.convolverDryGainNode.connect(s.compressorNode);
        s.convolverNode.connect(s.convolverWetGainNode);
        s.convolverWetGainNode.connect(s.compressorNode);
        s.genericReverbOutputGain.connect(s.compressorNode);
        s.compressorNode.connect(s.analyserNode);
        s.analyserNode.connect(s.convolverBoostGainNode);
        s.convolverBoostGainNode.connect(s.masterGainNode);
        s.masterGainNode.connect(s.audioContext.destination);
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
        saveToLocalStorage(state); // Save settings after all effects are updated
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
                genericReverbModulationDepth: p.modulationDepth,
                // If switching from custom, copy preset values into custom settings as well
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