import { writable, get } from 'svelte/store';

// Define initial EQ band parameters
const initialEqBands = [
    { frequency: 60, type: 'lowshelf', q: 0.7, gain: 0 },
    { frequency: 170, type: 'peaking', q: 1.0, gain: 0 },
    { frequency: 350, type: 'peaking', q: 1.0, gain: 0 },
    { frequency: 1000, type: 'peaking', q: 1.0, gain: 0 },
    { frequency: 3000, type: 'peaking', q: 1.0, gain: 0 },
    { frequency: 8000, type: 'highshelf', q: 0.7, gain: 0 }
] as const;

// Define default custom generic reverb settings
const defaultGenericReverbCustomSettings = {
    decay: 0.6,
    damping: 6000,
    preDelay: 0.02,
    mix: 0.2
};

// Define the shape of the audio effects state
export type AudioEffectsState = {
    // UI-controlled effect parameters
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

    // Web Audio API Nodes (managed internally, exposed for Eq.svelte props)
    audioContext: AudioContext | null;
    sourceNode: MediaElementAudioSourceNode | null;
    masterGainNode: GainNode | null;
    filterNodes: BiquadFilterNode[];
    convolverNode: ConvolverNode | null;
    convolverDryGainNode: GainNode | null;
    convolverWetGainNode: GainNode | null;
    convolverBoostGainNode: GainNode | null; // NEW: Gain node for convolver boost
    genericReverbPreDelayNode: DelayNode | null;
    genericReverbOutputGain: GainNode | null;
    combFilters: { delay: DelayNode; feedback: GainNode; filter: BiquadFilterNode }[];
    allPassFilters: BiquadFilterNode[];
    combMergerNode: GainNode | null;
    analyserNode: AnalyserNode | null;
};

// Initial state for the store
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

    // Audio API nodes are initially null and get set during `init`
    audioContext: null,
    sourceNode: null,
    masterGainNode: null,
    filterNodes: [],
    convolverNode: null,
    convolverDryGainNode: null,
    convolverWetGainNode: null,
    convolverBoostGainNode: null, // NEW: Initialize as null
    genericReverbPreDelayNode: null,
    genericReverbOutputGain: null,
    combFilters: [],
    allPassFilters: [],
    combMergerNode: null,
    analyserNode: null,
};

const AUDIO_SETTINGS_LOCAL_STORAGE_KEY = 'musify-audio-settings';

// Create the writable store
const store = writable<AudioEffectsState>(initialAudioEffectsState);

// Helper to get current state outside of a store.update call
function getCurrentState(): AudioEffectsState {
    return get(store);
}

// Public API for the audio effects store
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

        // 1. Initialize AudioContext
        const newAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (newAudioContext.state === 'suspended') {
            await newAudioContext.resume(); // Resume if suspended (browser policy)
        }
        console.log('AudioEffectsStore: AudioContext initialized. State:', newAudioContext.state);

        // 2. Create Core Nodes
        const newSourceNode = newAudioContext.createMediaElementSource(audioElement);
        const newMasterGainNode = newAudioContext.createGain();
        newMasterGainNode.gain.value = initialVolume;
        const newAnalyserNode = newAudioContext.createAnalyser();
        newAnalyserNode.fftSize = 256;
        console.log('AudioEffectsStore: Core nodes (source, masterGain, analyser) created.');

        // 3. Create EQ Filter Nodes
        const newFilterNodes = initialEqBands.map((band, i) => {
            const filter = newAudioContext.createBiquadFilter();
            filter.type = band.type as BiquadFilterType;
            filter.frequency.value = band.frequency;
            filter.Q.value = band.q;
            filter.gain.value = state.eqGains[i]; // Use loaded gain
            return filter;
        });
        console.log('AudioEffectsStore: EQ filter nodes created.');

        // 4. Create ConvolverNode and its Dry/Wet GainNodes
        const newConvolverNode = newAudioContext.createConvolver();
        const newConvolverDryGainNode = newAudioContext.createGain();
        const newConvolverWetGainNode = newAudioContext.createGain();
        const newConvolverBoostGainNode = newAudioContext.createGain(); // NEW: Convolver Boost Gain Node
        newConvolverBoostGainNode.gain.value = 1; // Default to no boost
        console.log('AudioEffectsStore: Convolver and its Dry/Wet GainNodes created.');

        // 5. Create Generic Reverb Nodes (Freeverb-style architecture)
        const newGenericReverbPreDelayNode = newAudioContext.createDelay(0.5); // Max 0.5s pre-delay
        const newGenericReverbOutputGain = newAudioContext.createGain();
        const newCombMergerNode = newAudioContext.createGain();
        newCombMergerNode.gain.value = 1 / 4; // Average the 4 comb filter outputs

        const newCombFilters: typeof state.combFilters = [];
        const combDelayTimes = [0.0297, 0.0371, 0.0411, 0.0437]; // Prime-based delay times
        for (const time of combDelayTimes) {
            const delay = newAudioContext.createDelay(1.0);
            delay.delayTime.value = time;
            const feedback = newAudioContext.createGain();
            const filter = newAudioContext.createBiquadFilter();
            filter.type = 'lowpass'; // Damping filter
            filter.Q.value = 0.7; // Fixed Q for damping filter
            newCombFilters.push({ delay, feedback, filter });
        }

        const newAllPassFilters: BiquadFilterNode[] = [];
        const allPassFrequencies = [225, 556]; // Frequencies for all-pass diffusers
        for (const freq of allPassFrequencies) {
            const allpass = newAudioContext.createBiquadFilter();
            allpass.type = 'allpass';
            allpass.frequency.value = freq;
            newAllPassFilters.push(allpass);
        }
        console.log('AudioEffectsStore: Generic Reverb (Freeverb-style) nodes created.');

        // 6. Update the store with all new nodes and context
        store.update(s => ({
            ...s,
            audioContext: newAudioContext,
            sourceNode: newSourceNode,
            masterGainNode: newMasterGainNode,
            analyserNode: newAnalyserNode,
            filterNodes: newFilterNodes,
            convolverNode: newConvolverNode,
            convolverDryGainNode: newConvolverDryGainNode,
            convolverWetGainNode: newConvolverWetGainNode,
            convolverBoostGainNode: newConvolverBoostGainNode, // NEW: Add to store
            genericReverbPreDelayNode: newGenericReverbPreDelayNode,
            genericReverbOutputGain: newGenericReverbOutputGain,
            combMergerNode: newCombMergerNode,
            combFilters: newCombFilters,
            allPassFilters: newAllPassFilters,
        }));

        // 7. Establish the Audio Graph Connections (once permanently)
        audioEffectsStore.setupAudioGraph();
        console.log('AudioEffectsStore: Audio graph connections established.');

        // 8. Fetch available IRs and apply loaded settings
        await audioEffectsStore.fetchAvailableIrs();
        // After IRs are fetched and selectedIrUrl potentially updated, load the IR
        await audioEffectsStore.loadImpulseResponse(getCurrentState().selectedIrUrl);
        // Configure generic reverb (this also applies settings to nodes)
        audioEffectsStore.configureGenericReverb(getCurrentState().genericReverbType);
        audioEffectsStore.updateAllEffects(); // Final update to set all gains/states

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
        store.set(initialAudioEffectsState); // Reset to initial state
        console.log('AudioEffectsStore: Store reset.');
    },

    /**
     * Establishes the permanent connections for the Web Audio API graph.
     * This method is only called once during initialization.
     */
    setupAudioGraph: () => {
        const state = getCurrentState();
        const { sourceNode, filterNodes, convolverNode, convolverDryGainNode, convolverWetGainNode,
                convolverBoostGainNode, // NEW: Destructure boost node
                genericReverbPreDelayNode, genericReverbOutputGain, combFilters, allPassFilters, combMergerNode,
                analyserNode, masterGainNode, audioContext } = state;

        // Basic validation that required nodes exist
        if (!audioContext || !sourceNode || !masterGainNode || !analyserNode || !convolverNode || !genericReverbPreDelayNode ||
            !convolverDryGainNode || !convolverWetGainNode || !genericReverbOutputGain || !combMergerNode || !combFilters.length || !allPassFilters.length || !convolverBoostGainNode) { // NEW: Validate boost node
            console.error('AudioEffectsStore: Cannot setup audio graph, some required nodes are null/missing.');
            return;
        }

        // 1. Source -> EQ Chain
        let currentAudioNode: AudioNode = sourceNode;
        if (filterNodes.length > 0) {
            currentAudioNode.connect(filterNodes[0]);
            for (let i = 0; i < filterNodes.length - 1; i++) {
                filterNodes[i].connect(filterNodes[i+1]);
            }
            currentAudioNode = filterNodes[filterNodes.length - 1]; // Output of EQ chain
        }

        // 2. EQ Chain Output -> Split into multiple paths (Convolver dry/wet, Generic Reverb)
        currentAudioNode.connect(convolverDryGainNode);   // Dry path for convolver mix
        currentAudioNode.connect(convolverNode);          // Wet path for convolver
        currentAudioNode.connect(genericReverbPreDelayNode); // Input for generic reverb starts with pre-delay

        // 3. Set up Generic Reverb Routing
        genericReverbPreDelayNode.connect(combMergerNode); // Connect to comb merger directly for early reflections
        for (const comb of combFilters) {
            genericReverbPreDelayNode.connect(comb.delay); // Main signal into each comb's delay

            // Setup feedback loop for each comb filter: Delay -> Feedback Gain -> Damping Filter -> Delay
            comb.delay.connect(comb.feedback);
            comb.feedback.connect(comb.filter);
            comb.filter.connect(comb.delay);

            // Connect comb output to the merger
            comb.delay.connect(combMergerNode);
        }
        // Comb Merger -> Series All-Pass Filters -> Output Gain
        combMergerNode.connect(allPassFilters[0]);
        allPassFilters[0].connect(allPassFilters[1]); // Assuming 2 all-pass filters
        allPassFilters[1].connect(genericReverbOutputGain); // Final generic reverb output

        // 4. All Effect Paths -> Analyser -> Convolver Boost -> Master Gain -> Destination
        convolverDryGainNode.connect(analyserNode);      // Convolver dry path
        convolverNode.connect(convolverWetGainNode);    // Convolver feeds its wet gain
        convolverWetGainNode.connect(analyserNode);     // Convolver wet path
        genericReverbOutputGain.connect(analyserNode);  // Generic reverb path

        analyserNode.connect(convolverBoostGainNode);   // NEW: Analyser feeds into Convolver Boost
        convolverBoostGainNode.connect(masterGainNode); // NEW: Convolver Boost feeds into Master Gain
        masterGainNode.connect(audioContext.destination); // Master volume feeds to speakers
    },

    /**
     * Loads audio effects settings from localStorage.
     */
    loadSettings: () => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const storedSettings = localStorage.getItem(AUDIO_SETTINGS_LOCAL_STORAGE_KEY);
        if (storedSettings) {
            try {
                const settings = JSON.parse(storedSettings);
                store.update(s => ({
                    ...s,
                    eqGains: settings.eqGains || s.eqGains,
                    convolverEnabled: typeof settings.convolverEnabled === 'boolean' ? settings.convolverEnabled : s.convolverEnabled,
                    convolverMix: typeof settings.convolverMix === 'number' ? settings.convolverMix : s.convolverMix,
                    selectedIrUrl: typeof settings.selectedIrUrl === 'string' || settings.selectedIrUrl === null ? settings.selectedIrUrl : s.selectedIrUrl,
                    genericReverbEnabled: typeof settings.genericReverbEnabled === 'boolean' ? settings.genericReverbEnabled : s.genericReverbEnabled,
                    genericReverbMix: typeof settings.genericReverbMix === 'number' ? settings.genericReverbMix : s.genericReverbMix,
                    genericReverbDecay: typeof settings.genericReverbDecay === 'number' ? settings.genericReverbDecay : s.genericReverbDecay,
                    genericReverbDamping: typeof settings.genericReverbDamping === 'number' ? settings.genericReverbDamping : s.genericReverbDamping,
                    genericReverbPreDelay: typeof settings.genericReverbPreDelay === 'number' ? settings.genericReverbPreDelay : s.genericReverbPreDelay,
                    genericReverbType: typeof settings.genericReverbType === 'string' ? settings.genericReverbType : s.genericReverbType,
                    genericReverbCustomSettings: settings.genericReverbCustomSettings ? { ...defaultGenericReverbCustomSettings, ...settings.genericReverbCustomSettings } : s.genericReverbCustomSettings,
                }));
                console.log('AudioEffectsStore: Loaded audio settings from localStorage.');
            } catch (e) {
                console.error('AudioEffectsStore: Failed to parse audio settings from localStorage:', e);
            }
        }
    },

    /**
     * Saves current audio effects settings to localStorage.
     */
    saveSettings: () => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const state = getCurrentState();
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
        };
        localStorage.setItem(AUDIO_SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(settingsToSave));
        console.log('AudioEffectsStore: Saved audio settings to localStorage.');
    },

    // --- EQ Management ---
    updateEqGain: (index: number, value: number) => {
        store.update(s => {
            s.eqGains[index] = value;
            if (s.filterNodes[index]) s.filterNodes[index].gain.value = value;
            return { ...s, eqGains: [...s.eqGains] }; // Trigger reactivity
        });
        audioEffectsStore.saveSettings();
    },
    applyEqPreset: (gains: number[]) => {
        store.update(s => {
            s.eqGains = [...gains];
            s.filterNodes.forEach((filter, i) => {
                if (filter) filter.gain.value = gains[i];
            });
            return s;
        });
        audioEffectsStore.saveSettings();
    },

    // --- Convolver (IR Reverb) Management ---
    toggleConvolver: (enabled: boolean) => {
        store.update(s => ({ ...s, convolverEnabled: enabled }));
        audioEffectsStore.updateAllEffects();
        audioEffectsStore.saveSettings();
    },
    setConvolverMix: (mix: number) => {
        store.update(s => ({ ...s, convolverMix: mix }));
        audioEffectsStore.updateAllEffects();
        audioEffectsStore.saveSettings();
    },
    selectIr: async (irUrl: string | null) => {
        store.update(s => ({ ...s, selectedIrUrl: irUrl }));
        await audioEffectsStore.loadImpulseResponse(irUrl); // This will update impulseResponseBuffer
        audioEffectsStore.saveSettings();
    },

    // --- Generic Reverb Management ---
    toggleGenericReverb: (enabled: boolean) => {
        store.update(s => ({ ...s, genericReverbEnabled: enabled }));
        audioEffectsStore.updateAllEffects();
        audioEffectsStore.saveSettings();
    },
    setGenericReverbMix: (mix: number) => {
        store.update(s => {
            if (s.genericReverbType !== 'custom') s.genericReverbType = 'custom';
            s.genericReverbCustomSettings.mix = mix; // Update custom settings
            return { ...s, genericReverbMix: mix }; // Update current mix value
        });
        audioEffectsStore.updateAllEffects();
        audioEffectsStore.saveSettings();
    },
    setGenericReverbDecay: (decay: number) => {
        store.update(s => {
            if (s.genericReverbType !== 'custom') s.genericReverbType = 'custom';
            s.genericReverbCustomSettings.decay = decay;
            return { ...s, genericReverbDecay: decay };
        });
        audioEffectsStore.updateAllEffects();
        audioEffectsStore.saveSettings();
    },
    setGenericReverbDamping: (damping: number) => {
        store.update(s => {
            if (s.genericReverbType !== 'custom') s.genericReverbType = 'custom';
            s.genericReverbCustomSettings.damping = damping;
            return { ...s, genericReverbDamping: damping };
        });
        audioEffectsStore.updateAllEffects();
        audioEffectsStore.saveSettings();
    },
    setGenericReverbPreDelay: (preDelay: number) => {
        store.update(s => {
            if (s.genericReverbType !== 'custom') s.genericReverbType = 'custom';
            s.genericReverbCustomSettings.preDelay = preDelay;
            return { ...s, genericReverbPreDelay: preDelay };
        });
        audioEffectsStore.updateAllEffects();
        audioEffectsStore.saveSettings();
    },
    setGenericReverbType: (type: string) => {
        store.update(s => ({ ...s, genericReverbType: type }));
        audioEffectsStore.configureGenericReverb(type); // Apply preset parameters to nodes
        audioEffectsStore.saveSettings();
    },

    /**
     * Sets the master volume of the entire audio graph.
     * This is called by Player.svelte when the playerStore's volume changes.
     * @param volume The new master volume (0-1).
     */
    setMasterVolume: (volume: number) => {
        const state = getCurrentState();
        if (state.masterGainNode) {
            state.masterGainNode.gain.value = volume;
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

    /**
     * Configures generic reverb parameters based on a preset type.
     * Applies the selected preset's values to the generic reverb nodes.
     * If type is 'custom', it applies the values from genericReverbCustomSettings.
     * @param type The preset type ('room', 'hall', 'plate', 'custom', etc.).
     */
    configureGenericReverb: (type: string) => {
        store.update(s => {
            if (!s.combFilters.length || !s.genericReverbPreDelayNode || !s.genericReverbOutputGain) {
                console.warn('AudioEffectsStore: Generic reverb nodes not initialized yet for configuration.');
                return s;
            }

            let newDecay = s.genericReverbDecay;
            let newDamping = s.genericReverbDamping;
            let newMix = s.genericReverbMix;
            let newPreDelay = s.genericReverbPreDelay;

            switch (type) {
                case 'room':
                    newDecay = 0.5;
                    newDamping = 8000;
                    newMix = 0.2;
                    newPreDelay = 0.01;
                    break;
                case 'hall':
                    newDecay = 0.7;
                    newDamping = 5000;
                    newMix = 0.3;
                    newPreDelay = 0.02;
                    break;
                case 'plate':
                    newDecay = 0.8;
                    newDamping = 12000;
                    newMix = 0.25;
                    newPreDelay = 0.01;
                    break;
                case 'cathedral':
                    newDecay = 0.9;
                    newDamping = 3500;
                    newMix = 0.4;
                    newPreDelay = 0.03;
                    break;
                case 'spring':
                    newDecay = 0.85;
                    newDamping = 10000;
                    newMix = 0.35;
                    newPreDelay = 0.005;
                    break;
                case 'custom':
                    newDecay = s.genericReverbCustomSettings.decay;
                    newDamping = s.genericReverbCustomSettings.damping;
                    newPreDelay = s.genericReverbCustomSettings.preDelay;
                    newMix = s.genericReverbCustomSettings.mix;
                    break;
                default: // Fallback
                    newDecay = 0.7;
                    newDamping = 5000;
                    newMix = 0.3;
                    newPreDelay = 0.02;
                    type = 'hall'; // Ensure type is 'hall' if it was unrecognized
                    break;
            }
            
            // Apply new values to the audio nodes immediately
            s.genericReverbPreDelayNode.delayTime.value = newPreDelay;
            // genericReverbOutputGain will be handled by updateAllEffects()
            s.combFilters.forEach(comb => {
                comb.feedback.gain.value = newDecay;
                comb.filter.frequency.value = newDamping;
            });

            console.log(`AudioEffectsStore: Generic reverb preset set to "${type}".`);
            return {
                ...s,
                genericReverbDecay: newDecay,
                genericReverbDamping: newDamping,
                genericReverbMix: newMix,
                genericReverbPreDelay: newPreDelay,
                genericReverbType: type
            };
        });
        audioEffectsStore.updateAllEffects(); // Ensure overall state is updated
    },

    /**
     * Updates all effect connections (dry/wet mixes, enable states) based on current store state.
     * This is called whenever an enable/disable or mix parameter changes.
     */
    updateAllEffects: () => {
        const state = getCurrentState();
        const { convolverNode, convolverDryGainNode, convolverWetGainNode,
                convolverBoostGainNode, // NEW: Destructure boost node
                genericReverbPreDelayNode, genericReverbOutputGain, combFilters,
                convolverEnabled, impulseResponseBuffer, convolverMix,
                genericReverbEnabled, genericReverbMix, genericReverbPreDelay, genericReverbDecay, genericReverbDamping } = state;

        if (!convolverNode || !convolverDryGainNode || !convolverWetGainNode || !convolverBoostGainNode || // NEW: Validate boost node
            !genericReverbPreDelayNode || !genericReverbOutputGain || !combFilters.length) {
                // console.warn('AudioEffectsStore: Not all nodes available for updateAllEffects. Skipping.');
                return;
            }

        // --- Convolver Reverb (IR) Logic ---
        if (convolverEnabled && impulseResponseBuffer && convolverNode.buffer) {
            convolverWetGainNode.gain.value = convolverMix;
            convolverDryGainNode.gain.value = 1 - convolverMix;
        } else {
            convolverWetGainNode.gain.value = 0; // Disable wet signal
            convolverDryGainNode.gain.value = 1; // Full dry signal if convolver is off
        }

        // --- Convolver Volume Boost Logic (NEW) ---
        const MAX_CONVOLVER_BOOST_DB = 9; // Increased from 3dB to 6dB for more volume
        const MIN_MIX_FOR_BOOST = 0.2; // Start boosting from 20% mix

        if (convolverEnabled && convolverMix >= MIN_MIX_FOR_BOOST) {
            // Normalize convolverMix from [MIN_MIX_FOR_BOOST, 1.0] to [0, 1]
            const normalizedMix = (convolverMix - MIN_MIX_FOR_BOOST) / (1.0 - MIN_MIX_FOR_BOOST);
            const boostDb = normalizedMix * MAX_CONVOLVER_BOOST_DB;
            convolverBoostGainNode.gain.value = Math.pow(10, boostDb / 20); // Convert dB to linear gain
        } else {
            convolverBoostGainNode.gain.value = 1; // No boost
        }

        // --- Generic Reverb Logic ---
        if (genericReverbEnabled) {
            genericReverbPreDelayNode.delayTime.value = genericReverbPreDelay;
            genericReverbOutputGain.gain.value = genericReverbMix; // Control overall output level of generic reverb

            // Update comb filter parameters (in case genericReverbType was 'custom' and updated)
            for (const comb of combFilters) {
                comb.feedback.gain.value = genericReverbDecay;
                comb.filter.frequency.value = genericReverbDamping;
            }
        } else {
            genericReverbOutputGain.gain.value = 0; // Disable generic reverb output
            // Kill the feedback loops immediately to stop reverb tail
            for (const comb of combFilters) {
                comb.feedback.gain.value = 0;
            }
        }
    }
};

audioEffectsStore.loadSettings(); // Load settings on store initialization

// Export initialEqBands also, as Eq.svelte needs it for rendering labels
export { initialEqBands };