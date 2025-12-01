<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import Music from 'lucide-svelte/icons/music'; // Import Lucide icons
    import Sliders from 'lucide-svelte/icons/sliders';
    import Zap from 'lucide-svelte/icons/zap';
    import Ear from 'lucide-svelte/icons/ear';
    import Gauge from 'lucide-svelte/icons/gauge'; // NEW: Import icon for Loudness
    import Activity from 'lucide-svelte/icons/activity'; // NEW: Import icon for Performance

    const dispatch = createEventDispatcher(); // Initialize dispatcher for custom events

    // Exported props, now received from Player.svelte (which gets them from audioEffectsStore)
    export let audioContext: AudioContext;
    export let performanceMode: 'low' | 'balanced' | 'high';
    export let filterNodes: BiquadFilterNode[];
    export let bands: readonly ({ frequency: number; type: "lowshelf" | "peaking" | "highshelf"; q: number; gain: number; })[];
    export let eqGains: number[]; // Two-way bound
    export let convolverNode: ConvolverNode;
    export let convolverEnabled: boolean; // Two-way bound
    export let convolverMix: number; // Two-way bound
    export let impulseResponseBuffer: AudioBuffer | null;
    export let availableIrs: string[];
    export let selectedIrUrl: string | null; // Two-way bound
    export let reverbEnabled: boolean; // Generic reverb enabled, two-way bound
    export let reverbMix: number; // Two-way bound
    export let reverbDecay: number; // Two-way bound
    export let reverbDamping: number; // Two-way bound
    export let reverbPreDelay: number; // Two-way bound
    export let reverbType: string = 'hall'; // Two-way bound
    // NEW: Add props for reverb modulation
    export let reverbModulationRate: number; // Two-way bound
    export let reverbModulationDepth: number; // Two-way bound
    // NEW: Add props for Dynamics Compressor
    export let compressorEnabled: boolean; // Two-way bound
    export let compressorThreshold: number; // Two-way bound
    export let compressorKnee: number;     // Two-way bound
    export let compressorRatio: number;    // Two-way bound
    export let compressorAttack: number;   // Two-way bound
    export let compressorRelease: number;  // Two-way bound
    // NEW: Add props for Spatial Audio (Panner)
    export let pannerPosition: { x: number; y: number; z: number }; // Two-way bound
    export let pannerAutomationEnabled: boolean; // Two-way bound
    export let pannerAutomationRate: number; // Two-way bound
    export let spatialAudioEnabled: boolean; // Two-way bound
    // NEW: Add props for Loudness Normalization
    export let loudnessNormalizationEnabled: boolean; // Two-way bound
    export let loudnessTarget: number; // Two-way bound
    export let momentaryLoudness: number; // One-way bound for display
    export let isMobileDevice: boolean = false; // NEW: Prop to indicate if on a mobile device

    let irDropdownOpen: boolean = false;
    let reverbTypeDropdownOpen: boolean = false; // Still needed for the reverb type dropdown within the reverb card
    let eqPresetDropdownOpen: boolean = false;
    
    // UI state for collapsible cards
    let reverbCardOpen: boolean = false;
    let compressorCardOpen: boolean = false;
    let spatialAudioCardOpen: boolean = false;
    let loudnessCardOpen: boolean = false; // NEW: UI state for Loudness card

    // Available reverb types, including 'Custom'
    const reverbTypes = [
        { value: 'room', label: 'Room' },
        { value: 'hall', label: 'Hall' },
        { value: 'plate', label: 'Plate' },
        { value: 'space', label: 'Space' }, // Changed from 'cathedral'
        { value: 'studio', label: 'Studio' }, // Changed from 'spring'
        { value: 'custom', label: 'Custom' }
    ];

    // EQ Presets
    const eqPresets = [
        { name: 'Flat', gains: [0, 0, 0, 0, 0, 0] },
        { name: 'Bass Boost', gains: [6, 4, 0, -2, -4, -6] },
        { name: 'Vocal Boost', gains: [-4, 0, 4, 6, 4, 0] },
        { name: 'Treble Boost', gains: [-6, -4, -2, 0, 4, 6] },
        { name: 'Rock', gains: [4, 2, -2, 0, 3, 5] },
        { name: 'Pop', gains: [3, 0, -1, 2, 4, 3] },
        { name: 'Jazz', gains: [4, 2, 0, -2, -3, -4] },
    ];

    // NEW: Loudness Target Presets
    const loudnessPresets = [
        { name: 'Spotify', value: -14 },
        { name: 'Apple Music', value: -16 },
    ];

    let selectedEqPresetName: string = 'Flat';

    // Helper to determine if current EQ gains match a preset
    function getMatchingPresetName(currentGains: number[]): string {
        for (const preset of eqPresets) {
            // Check if all gains match with a small tolerance for floating point comparisons
            if (preset.gains.every((g, i) => Math.abs(g - currentGains[i]) < 0.001)) {
                return preset.name;
            }
        }
        return 'Custom';
    }

    onMount(() => {
        // Initialize selectedEqPresetName based on the initially loaded eqGains
        selectedEqPresetName = getMatchingPresetName(eqGains);
    });

    // Reactive statement: whenever eqGains changes, update the selected preset name
    $: eqGains, selectedEqPresetName = getMatchingPresetName(eqGains);

    // Event handlers for UI interaction, dispatching events for the parent to handle
    function handleEqSliderChange(index: number, event: Event) {
        const value = (event.target as HTMLInputElement).valueAsNumber;
        eqGains[index] = value; // Update bound prop directly (important for Svelte reactivity)
        dispatch('updateEqGain', { index, value }); // Notify parent for audio logic
    }

    function handleApplyEqPreset(preset: typeof eqPresets[0]) {
        eqGains = [...preset.gains]; // Update bound prop directly
        selectedEqPresetName = preset.name;
        eqPresetDropdownOpen = false;
        dispatch('applyEqPreset', { gains: preset.gains }); // Notify parent for audio logic
    }

    function getFilenameFromUrl(url: string): string {
        const parts = url.split('/');
        return parts[parts.length - 1];
    }

    function toggleIrDropdown() {
        irDropdownOpen = !irDropdownOpen;
        reverbTypeDropdownOpen = false;
        eqPresetDropdownOpen = false;
    }

    function handleSelectIr(url: string | null) {
        selectedIrUrl = url; // Update bound prop directly
        irDropdownOpen = false;
        dispatch('selectIr', { url }); // Notify parent for audio logic
    }

    function toggleReverbTypeDropdown() {
        reverbTypeDropdownOpen = !reverbTypeDropdownOpen;
        irDropdownOpen = false;
        eqPresetDropdownOpen = false;
    }

    function handleSelectReverbType(type: string) {
        reverbType = type; // Update bound prop directly
        reverbTypeDropdownOpen = false;
        dispatch('setGenericReverbType', { type }); // Notify parent for audio logic
    }

    function toggleEqPresetDropdown() {
        eqPresetDropdownOpen = !eqPresetDropdownOpen;
        irDropdownOpen = false;
        reverbTypeDropdownOpen = false;
    }

    // Handlers for checkboxes and sliders, updating bound props and dispatching events
    function handleConvolverToggle(event: Event) {
        const enabled = (event.target as HTMLInputElement).checked;
        convolverEnabled = enabled;
        dispatch('toggleConvolver', { enabled });
    }

    function handleConvolverMixChange(event: Event) {
        const mix = (event.target as HTMLInputElement).valueAsNumber;
        convolverMix = mix;
        dispatch('setConvolverMix', { mix });
    }

    function handleReverbToggle(event: Event) {
        const enabled = (event.target as HTMLInputElement).checked;
        reverbEnabled = enabled;
        dispatch('toggleGenericReverb', { enabled });
    }

    function handleReverbMixChange(event: Event) {
        const mix = (event.target as HTMLInputElement).valueAsNumber;
        reverbMix = mix;
        dispatch('setGenericReverbMix', { mix });
    }

    function handleReverbDecayChange(event: Event) {
        const decay = (event.target as HTMLInputElement).valueAsNumber;
        reverbDecay = decay;
        dispatch('setGenericReverbDecay', { decay });
    }

    function handleReverbDampingChange(event: Event) {
        const damping = (event.target as HTMLInputElement).valueAsNumber;
        reverbDamping = damping;
        dispatch('setGenericReverbDamping', { damping });
    }

    function handleReverbPreDelayChange(event: Event) {
        const preDelay = (event.target as HTMLInputElement).valueAsNumber;
        reverbPreDelay = preDelay;
        dispatch('setGenericReverbPreDelay', { preDelay });
    }

    // NEW: Handlers for new reverb modulation parameters
    function handleReverbModRateChange(event: Event) {
        const rate = (event.target as HTMLInputElement).valueAsNumber;
        reverbModulationRate = rate;
        dispatch('setGenericReverbModulationRate', { rate });
    }

    function handleReverbModDepthChange(event: Event) {
        const depth = (event.target as HTMLInputElement).valueAsNumber;
        reverbModulationDepth = depth;
        dispatch('setGenericReverbModulationDepth', { depth });
    }

    // NEW: Handlers for Dynamics Compressor parameters
    function handleCompressorToggle(event: Event) {
        const enabled = (event.target as HTMLInputElement).checked;
        compressorEnabled = enabled;
        dispatch('toggleCompressor', { enabled });
    }

    function handleCompressorThresholdChange(event: Event) {
        const threshold = (event.target as HTMLInputElement).valueAsNumber;
        compressorThreshold = threshold;
        dispatch('setCompressorThreshold', { threshold });
    }

    function handleCompressorKneeChange(event: Event) {
        const knee = (event.target as HTMLInputElement).valueAsNumber;
        compressorKnee = knee;
        dispatch('setCompressorKnee', { knee });
    }

    function handleCompressorRatioChange(event: Event) {
        const ratio = (event.target as HTMLInputElement).valueAsNumber;
        compressorRatio = ratio;
        dispatch('setCompressorRatio', { ratio });
    }

    function handleCompressorAttackChange(event: Event) {
        const attack = (event.target as HTMLInputElement).valueAsNumber;
        compressorAttack = attack;
        dispatch('setCompressorAttack', { attack });
    }

    function handleCompressorReleaseChange(event: Event) {
        const release = (event.target as HTMLInputElement).valueAsNumber;
        compressorRelease = release;
        dispatch('setCompressorRelease', { release });
    }

    // NEW: Handlers for Spatial Audio (Panner)
    function handlePannerChange(axis: 'x' | 'y' | 'z', event: Event) {
        const value = (event.target as HTMLInputElement).valueAsNumber;
        // Update the bound prop to keep UI in sync
        pannerPosition = { ...pannerPosition, [axis]: value };
        // Dispatch only the changed value to the store for efficiency
        dispatch('setPannerPosition', { position: { [axis]: value } });
    }

    function handlePannerAutomationToggle(event: Event) {
        const enabled = (event.target as HTMLInputElement).checked;
        pannerAutomationEnabled = enabled;
        dispatch('togglePannerAutomation', { enabled });
    }

    function handlePannerAutomationRateChange(event: Event) {
        const rate = (event.target as HTMLInputElement).valueAsNumber;
        pannerAutomationRate = rate;
        dispatch('setPannerAutomationRate', { rate });
    }

    function handleSpatialAudioToggle(event: Event) {
        const enabled = (event.target as HTMLInputElement).checked;
        spatialAudioEnabled = enabled;
        dispatch('toggleSpatialAudio', { enabled });
    }

    // NEW: Handlers for Loudness Normalization
    function handleLoudnessNormalizationToggle(event: Event) {
        const enabled = (event.target as HTMLInputElement).checked;
        loudnessNormalizationEnabled = enabled;
        dispatch('toggleLoudnessNormalization', { enabled });
    }

    function handleLoudnessTargetChange(value: number) {
        loudnessTarget = value;
        dispatch('setLoudnessTarget', { target: value });
    }


    function handleClickOutside(event: MouseEvent) {
        const irDropdownElement = document.getElementById('ir-custom-dropdown');
        const reverbTypeDropdownElement = document.getElementById('reverb-type-dropdown'); // Use the specific ID for generic reverb type dropdown
        const eqPresetDropdownElement = document.getElementById('eq-preset-dropdown');

        if (irDropdownElement && !irDropdownElement.contains(event.target as Node)) {
            irDropdownOpen = false;
        }
        if (reverbTypeDropdownElement && !reverbTypeDropdownElement.contains(event.target as Node)) {
            reverbTypeDropdownOpen = false;
        }
        if (eqPresetDropdownElement && !eqPresetDropdownElement.contains(event.target as Node)) {
            eqPresetDropdownOpen = false;
        }
    }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="eq-scroll-wrapper">
  <div class="eq-controls">
    <!-- NEW: Performance Mode Section -->
    <div class="card">
      <div class="card-header">
        <span class="card-header-label">
          <Activity size={18} /> Performance Profile
        </span>
      </div>
      <div class="card-body">
        <div class="performance-presets">
          <button
            class="preset-button"
            class:selected={performanceMode === 'low'}
            on:click={() => dispatch('setPerformanceMode', { mode: 'low' })}
            title="Only EQ is active. Lowest CPU usage."
          >
            Low
            <span class="preset-desc">Basic EQ</span>
          </button>
          <button
            class="preset-button"
            class:selected={performanceMode === 'balanced'}
            on:click={() => dispatch('setPerformanceMode', { mode: 'balanced' })}
            title="Enables standard reverb and compressor. Disables heavy effects like IR reverb and spatial audio."
          >
            Balanced
            <span class="preset-desc">Standard Effects</span>
          </button>
          <button
            class="preset-button"
            class:selected={performanceMode === 'high'}
            on:click={() => dispatch('setPerformanceMode', { mode: 'high' })}
            title="All audio effects are available. Highest CPU usage."
          >
            High
            <span class="preset-desc">All Effects</span>
          </button>
        </div>
        {#if isMobileDevice && performanceMode === 'high'}
          <p class="mobile-performance-tip">
            <Zap size={14} class="inline-icon" /> On mobile, 'High' performance mode may lead to audio issues. Consider 'Balanced' or 'Low' for stability.
          </p>
        {/if}
      </div>
    </div>

    <!-- EQ Section -->
    <div class="card">
      <div class="card-header">
        <span>EQ Presets</span>
        <div class="custom-dropdown-wrapper" id="eq-preset-dropdown">
          <button class="dropdown-toggle" on:click|stopPropagation={toggleEqPresetDropdown} aria-expanded={eqPresetDropdownOpen}>
            {selectedEqPresetName} <span class="arrow">▼</span>
          </button>
          {#if eqPresetDropdownOpen}
            <ul class="dropdown-menu" role="menu">
              {#each eqPresets as preset (preset.name)}
                <li role="presentation">
                  <button
                    class="dropdown-item"
                    class:selected={preset.name === selectedEqPresetName}
                    on:click={() => handleApplyEqPreset(preset)}
                    role="menuitem"
                  >
                    {preset.name}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>

      <!-- EQ Sliders -->
      <div class="eq-grid">
        {#each bands as band, i}
          <div class="eq-item">
            <label for={`eq-slider-${i}`}>{band.frequency}Hz</label>
            <input
              id={`eq-slider-${i}`}
              type="range"
              min="-20"
              max="20"
              step="0.1"
              bind:value={eqGains[i]}
              on:input={(e) => handleEqSliderChange(i, e)}
              class="horizontal-slider"
            />
            <span>{eqGains[i].toFixed(1)}dB</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Reverb Section -->
    <div class="card collapsible">
      <button type="button" class="card-header" on:click={() => reverbCardOpen = !reverbCardOpen} disabled={performanceMode === 'low'}>
        <span class="card-header-label">
          <Sliders size={18} /> Reverb
        </span>
      </button>
      {#if reverbCardOpen && performanceMode !== 'low'}
        <div class="card-body">
          <!-- IR Reverb -->
          <div class="reverb-subheader">
            <span class="reverb-label">Impulse Response</span>
            <input type="checkbox" id="convolver-enable" bind:checked={convolverEnabled} on:change={handleConvolverToggle} disabled={!impulseResponseBuffer || performanceMode !== 'high'} />
          </div>
          <div class="custom-dropdown-wrapper" id="ir-custom-dropdown">
            <button class="dropdown-toggle" on:click|stopPropagation={toggleIrDropdown} aria-expanded={irDropdownOpen} disabled={!convolverEnabled || performanceMode !== 'high'}>
              {selectedIrUrl ? getFilenameFromUrl(selectedIrUrl) : 'Select IR'} <span class="arrow">▼</span>
            </button>
            {#if irDropdownOpen}
              <ul class="dropdown-menu" role="menu">
                {#if !availableIrs.length}
                  <li class="dropdown-item disabled" role="presentation">No IRs available</li>
                {:else}
                  <li role="presentation">
                    <button class="dropdown-item" class:selected={!selectedIrUrl} on:click={() => handleSelectIr(null)} role="menuitem">
                      No IR selected
                    </button>
                  </li>
                  {#each availableIrs as irUrl (irUrl)}
                    <li role="presentation">
                      <button class="dropdown-item" class:selected={irUrl === selectedIrUrl} on:click={() => handleSelectIr(irUrl)} role="menuitem">
                        {getFilenameFromUrl(irUrl)}
                      </button>
                    </li>
                  {/each}
                {/if}
              </ul>
            {/if}
          </div>

          {#if convolverEnabled}
            <div class="slider-control">
              <span>Mix:</span>
              <input type="range" min="0" max="1" step="0.01" bind:value={convolverMix} on:input={handleConvolverMixChange} class="horizontal-slider" />
              <span>{(convolverMix*100).toFixed(0)}%</span>
            </div>
          {/if}
          
          {#if !impulseResponseBuffer && selectedIrUrl && convolverEnabled}
            <p class="status-message loading">Loading...</p>
          {:else if !selectedIrUrl && convolverEnabled}
            <p class="status-message info">No IR selected</p>
          {/if}

          <!-- Standard Reverb -->
          <div class="reverb-subheader" style="margin-top: 15px;">
            <span class="reverb-label">Standard Reverb</span>
            <input type="checkbox" bind:checked={reverbEnabled} on:change={handleReverbToggle} />
          </div>
          <div class="custom-dropdown-wrapper" id="reverb-type-dropdown">
            <button class="dropdown-toggle" on:click|stopPropagation={toggleReverbTypeDropdown} aria-expanded={reverbTypeDropdownOpen} disabled={!reverbEnabled}>
              {reverbTypes.find(r => r.value === reverbType)?.label || 'Custom'} <span class="arrow">▼</span>
            </button>
            {#if reverbTypeDropdownOpen}
              <ul class="dropdown-menu" role="menu">
                {#each reverbTypes as type (type.value)}
                  <li role="presentation">
                    <button
                      class="dropdown-item"
                      class:selected={type.value === reverbType}
                      on:click={() => handleSelectReverbType(type.value)}
                      role="menuitem"
                    >
                      {type.label}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>

          <!-- Standard Reverb Sliders -->
          <div class="slider-control">
            <span>Mix:</span>
            <input type="range" min="0" max="1" step="0.01" bind:value={reverbMix} on:input={handleReverbMixChange} class="horizontal-slider" disabled={!reverbEnabled}/>
            <span>{(reverbMix*100).toFixed(0)}%</span>
          </div>
          <div class="slider-control">
            <span>Decay:</span>
            <input type="range" min="0" max="0.95" step="0.01" bind:value={reverbDecay} on:input={handleReverbDecayChange} class="horizontal-slider" disabled={!reverbEnabled}/>
            <span>{(reverbDecay*100).toFixed(0)}%</span>
          </div>
          <div class="slider-control">
            <span>Damping:</span>
            <input type="range" min="500" max="15000" step="100" bind:value={reverbDamping} on:input={handleReverbDampingChange} class="horizontal-slider" disabled={!reverbEnabled}/>
            <span>{reverbDamping.toFixed(0)}Hz</span>
          </div>
          <div class="slider-control">
            <span>Pre-delay:</span>
            <input type="range" min="0" max="0.2" step="0.001" bind:value={reverbPreDelay} on:input={handleReverbPreDelayChange} class="horizontal-slider" disabled={!reverbEnabled}/>
            <span>{(reverbPreDelay*1000).toFixed(0)}ms</span>
          </div>
          <div class="slider-control">
            <span>Mod Rate:</span>
            <input type="range" min="0" max="10" step="0.1" bind:value={reverbModulationRate} on:input={handleReverbModRateChange} class="horizontal-slider" disabled={!reverbEnabled}/>
            <span>{reverbModulationRate.toFixed(1)}Hz</span>
          </div>
          <div class="slider-control">
            <span>Mod Depth:</span>
            <input type="range" min="0" max="0.005" step="0.0001" bind:value={reverbModulationDepth} on:input={handleReverbModDepthChange} class="horizontal-slider" disabled={!reverbEnabled}/>
            <span>{(reverbModulationDepth * 1000).toFixed(1)}ms</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Compressor Section -->
    <div class="card collapsible">
      <button type="button" class="card-header" on:click={() => compressorCardOpen = !compressorCardOpen} disabled={performanceMode === 'low'}>
        <span class="card-header-label">
          <Zap size={18} /> Compressor
        </span>
        <input type="checkbox" on:click|stopPropagation bind:checked={compressorEnabled} on:change={handleCompressorToggle} disabled={performanceMode === 'low'} />
      </button>
      {#if compressorCardOpen && performanceMode !== 'low'}
        <div class="card-body">
          <div class="slider-control">
            <span>Threshold:</span>
            <input type="range" min="-60" max="0" step="1" bind:value={compressorThreshold} on:input={handleCompressorThresholdChange} class="horizontal-slider"/>
            <span>{compressorThreshold.toFixed(0)}dB</span>
          </div>
          <div class="slider-control">
            <span>Knee:</span>
            <input type="range" min="0" max="40" step="1" bind:value={compressorKnee} on:input={handleCompressorKneeChange} class="horizontal-slider"/>
            <span>{compressorKnee.toFixed(0)}dB</span>
          </div>
          <div class="slider-control">
            <span>Ratio:</span>
            <input type="range" min="1" max="20" step="0.1" bind:value={compressorRatio} on:input={handleCompressorRatioChange} class="horizontal-slider"/>
            <span>{compressorRatio.toFixed(1)}:1</span>
          </div>
          <div class="slider-control">
            <span>Attack:</span>
            <input type="range" min="0" max="1" step="0.001" bind:value={compressorAttack} on:input={handleCompressorAttackChange} class="horizontal-slider"/>
            <span>{(compressorAttack*1000).toFixed(0)}ms</span>
          </div>
          <div class="slider-control">
            <span>Release:</span>
            <input type="range" min="0" max="1" step="0.001" bind:value={compressorRelease} on:input={handleCompressorReleaseChange} class="horizontal-slider"/>
            <span>{(compressorRelease*1000).toFixed(0)}ms</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Spatial Audio Section -->
    <div class="card collapsible">
      <button type="button" class="card-header" on:click={() => spatialAudioCardOpen = !spatialAudioCardOpen} disabled={performanceMode !== 'high'}>
        <span class="card-header-label">
          <Ear size={18} /> Spatial Audio
        </span>
        <input type="checkbox" on:click|stopPropagation bind:checked={spatialAudioEnabled} on:change={handleSpatialAudioToggle} disabled={performanceMode !== 'high'} />
      </button>
      {#if spatialAudioCardOpen && performanceMode === 'high'}
        <div class="card-body">
          <div class="reverb-subheader">
            <span class="reverb-label">8D Automation</span>
            <input type="checkbox" bind:checked={pannerAutomationEnabled} on:change={handlePannerAutomationToggle} disabled={!spatialAudioEnabled} />
          </div>
           <div class="slider-control">
            <span>Speed:</span>
            <input type="range" min="0.05" max="1" step="0.01" bind:value={pannerAutomationRate} on:input={handlePannerAutomationRateChange} class="horizontal-slider" disabled={!pannerAutomationEnabled || !spatialAudioEnabled}/>
            <span>{pannerAutomationRate.toFixed(2)}</span>
          </div>

          {#if !pannerAutomationEnabled}
            <hr class="border-gray-700 my-2">

            <div class="slider-control">
              <span>X (Left/Right):</span>
              <input type="range" min="-10" max="10" step="0.1" bind:value={pannerPosition.x} on:input={(e) => handlePannerChange('x', e)} class="horizontal-slider" disabled={!spatialAudioEnabled}/>
              <span>{pannerPosition.x.toFixed(1)}</span>
            </div>
            <div class="slider-control">
              <span>Y (Up/Down):</span>
              <input type="range" min="-10" max="10" step="0.1" bind:value={pannerPosition.y} on:input={(e) => handlePannerChange('y', e)} class="horizontal-slider" disabled={!spatialAudioEnabled}/>
              <span>{pannerPosition.y.toFixed(1)}</span>
            </div>
            <div class="slider-control">
              <span>Z (Forward/Back):</span>
              <input type="range" min="-10" max="10" step="0.1" bind:value={pannerPosition.z} on:input={(e) => handlePannerChange('z', e)} class="horizontal-slider" disabled={!spatialAudioEnabled}/>
              <span>{pannerPosition.z.toFixed(1)}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- NEW: Loudness Normalization Section -->
    <div class="card collapsible">
      <button type="button" class="card-header" on:click={() => loudnessCardOpen = !loudnessCardOpen} disabled={performanceMode !== 'high'}>
        <span class="card-header-label">
          <Gauge size={18} /> Loudness Matching
        </span>
        <input type="checkbox" on:click|stopPropagation bind:checked={loudnessNormalizationEnabled} on:change={handleLoudnessNormalizationToggle} disabled={performanceMode !== 'high'} />
      </button>
      {#if loudnessCardOpen && performanceMode === 'high'}
        <div class="card-body">
          <div class="loudness-presets">
            {#each loudnessPresets as preset (preset.name)}
              <button
                class="preset-button"
                class:selected={loudnessTarget === preset.value}
                on:click={() => handleLoudnessTargetChange(preset.value)}
                disabled={!loudnessNormalizationEnabled}
              >
                {preset.name} <span>{preset.value} LUFS</span>
              </button>
            {/each}
          </div>

          <div class="slider-control">
            <span>Target:</span>
            <input type="range" min="-24" max="-8" step="0.5" bind:value={loudnessTarget} on:input={(e) => handleLoudnessTargetChange((e.target as HTMLInputElement).valueAsNumber)} class="horizontal-slider" disabled={!loudnessNormalizationEnabled}/>
            <span>{loudnessTarget.toFixed(1)} LUFS</span>
          </div>

          <div class="status-display">
            <span>Momentary Loudness:</span>
            <span class="value">{momentaryLoudness.toFixed(1)} LUFS</span>
          </div>
        </div>
      {/if}
    </div>

  </div>
</div>

<style>
    /* NEW: Wrapper for scrolling */
    .eq-scroll-wrapper {
        /* This max-height should leave space for the player footer at the bottom */
        max-height: calc(100vh - 100px); /* Example: 100vh - (footer height + some top/bottom margin if needed) */
        overflow-y: auto; /* Enable vertical scrolling */
        padding-right: 10px; /* Space for scrollbar to not overlay content */
        box-sizing: border-box; /* Include padding in the max-height */
        /* Position the wrapper relative to its parent .eq-overlay in Player.svelte */
        position: absolute;
        bottom: 0;
        right: 0;
        /* Adjust width as needed for your UI, making it reasonable for a side panel */
        width: min(calc(100vw - 20px), 400px); /* Max 400px, or full width minus padding on smaller screens */
    }

    /* Style the scrollbar for better aesthetics (Webkit only) */
    .eq-scroll-wrapper::-webkit-scrollbar {
        width: 8px;
    }

    .eq-scroll-wrapper::-webkit-scrollbar-track {
        background: #333;
        border-radius: 4px;
    }

    .eq-scroll-wrapper::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 4px;
    }

    .eq-scroll-wrapper::-webkit-scrollbar-thumb:hover {
        background: #1DB954;
    }

    .eq-controls {
        background-color: #1a1a1a;
        padding: 15px;
        border-radius: 8px;
        color: #fff;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        /* Remove max-width from here, as the wrapper now controls the overall width */
        margin: 0 auto; /* Keep content centered horizontally within the wrapper */
        width: 100%; /* Ensure it fills the wrapper */
    }

    .title {
        margin: 0 0 12px 0;
        text-align: center;
        font--size: 1.2em; /* Made smaller for desktop */
        color: #1DB954;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px; /* Space between icon and text */
        font-weight: 600; /* Keep it bold as a header */
    }

    /* Card styles */
    .card {
      background-color: #1e1e1e;
      border-radius: 8px;
      margin-bottom: 12px;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      overflow: hidden;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background-color: #282828;
      cursor: pointer;
      font-weight: 600;
      color: #1DB954;
      font-size: 0.85em; /* Made smaller for desktop */
    }

    /* Add this rule to reset default button styles for card headers */
    button.card-header {
        border: none;
        width: 100%;
        font-family: inherit;
        text-align: left;
    }

    .card-header .card-header-label {
        display: flex;
        align-items: center;
        gap: 6px; /* Space between icon and text in card headers */
    }

    .card-body {
      padding: 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* EQ Grid (inside EQ card) */
    .eq-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        padding: 12px 12px 0; /* Add padding to match card-body, but no bottom for separation */
    }

    .eq-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        background-color: #333;
        border-radius: 4px;
    }

    .eq-item label {
        font-size: 0.7em; /* Slightly smaller for desktop */
        color: #b3b3b3;
        text-align: left;
        flex-shrink: 0;
        min-width: 45px;
    }

    .eq-item span { /* Updated from .gain-value */
        font-size: 0.65em; /* Slightly smaller for desktop */
        color: #1DB954;
        min-width: 40px;
        text-align: right;
        font-weight: 600;
        flex-shrink: 0;
    }

    /* Reverb Sub-header for Impulse Response / Standard Reverb distinction */
    .reverb-subheader {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      margin-top: 5px;
    }

    .reverb-label {
        font-size: 0.8em; /* Slightly smaller for desktop */
        color: #b3b3b3;
        font-weight: 500;
    }

    input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: #1DB954;
    }

    input[type="checkbox"]:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Dropdown Styles - generic, used by all dropdowns */
    .custom-dropdown-wrapper {
        position: relative;
        width: 100%;
    }

    .dropdown-toggle {
        width: 100%;
        padding: 8px 10px;
        border-radius: 4px;
        border: 1px solid #555;
        background-color: #333;
        color: #fff;
        font-size: 0.8em; /* Slightly smaller for desktop */
        cursor: pointer;
        text-align: left;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: border-color 0.2s ease;
    }

    .dropdown-toggle:hover,
    .dropdown-toggle:focus {
        border-color: #1DB954;
        outline: none;
    }

    .dropdown-toggle:disabled {
        background-color: #2a2a2a;
        color: #777;
        cursor: not-allowed;
        border-color: #444;
    }

    .arrow {
        font-size: 0.7em;
        color: #b3b3b3;
        transition: transform 0.2s ease;
    }

    .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        width: 100%;
        max-height: 200px;
        overflow-y: auto;
        background-color: #282828;
        border: 1px solid #444;
        border-radius: 4px;
        list-style: none;
        padding: 0;
        margin: 4px 0 0 0;
        z-index: 10;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    }

    .dropdown-item {
        padding: 8px 10px;
        color: #fff;
        font-size: 0.8em; /* Slightly smaller for desktop */
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .dropdown-item:hover {
        background-color: #3a3a3a;
    }

    .dropdown-item.selected {
        background-color: #1DB954;
        color: #000;
        font-weight: bold;
    }

    .dropdown-item.disabled {
        color: #888;
        cursor: not-allowed;
        background-color: #2f2f2f;
    }

    /* Slider Control */
    .slider-control {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .slider-control span:first-child { /* Targets the label span */
        font-size: 0.75em; /* Slightly smaller for desktop */
        color: #b3b3b3;
        min-width: 55px; /* Adjust as needed */
    }

    .slider-control span:last-child { /* Targets the value span */
        font-size: 0.7em; /* Slightly smaller for desktop */
        color: #1DB954;
        min-width: 35px; /* Adjust as needed */
        text-align: right;
        font-weight: 600;
    }

    .horizontal-slider {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        flex: 1; /* Allow the slider to take up remaining space */
        height: 6px;
        background: #333;
        outline: none;
        border-radius: 3px;
    }

    .horizontal-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #1DB954;
        cursor: pointer;
        transition: background 0.15s ease-in-out;
        box-shadow: 0 0 0 2px rgba(0,0,0,0.2);
    }

    .horizontal-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #1DB954;
        cursor: pointer;
        transition: background 0.15s ease-in-out;
        box-shadow: 0 0 0 2px rgba(0,0,0,0.2);
        border: none;
    }

    .horizontal-slider::-webkit-slider-runnable-track,
    .horizontal-slider::-moz-range-track {
        background: #333;
        border-radius: 3px;
        height: 6px;
    }

    .horizontal-slider:disabled::-webkit-slider-thumb {
        background: #777;
    }

    .horizontal-slider:disabled::-moz-range-thumb {
        background: #777;
    }

    /* Status Messages */
    .status-message {
        text-align: center;
        font-size: 0.65em; /* Slightly smaller for desktop */
        margin: 5px 0 0 0;
    }

    .status-message.loading {
        color: #ff6b6b;
    }

    .status-message.info {
        color: #9bd3ff;
    }

    /* NEW STYLES for Performance Card */
    .performance-presets {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }

    .preset-button .preset-desc {
        display: block;
        font-size: 0.8em;
        color: #b3b3b3;
    }
    
    .preset-button.selected .preset-desc {
        color: #111;
    }


    /* NEW STYLES for Loudness Card */
    .loudness-presets {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 10px;
    }

    .preset-button {
        padding: 6px 8px;
        border-radius: 4px;
        border: 1px solid #555;
        background-color: #333;
        color: #fff;
        font-size: 0.75em;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s ease;
    }
    
    .preset-button:hover {
        border-color: #1DB954;
    }

    .preset-button.selected {
        background-color: #1DB954;
        color: #000;
        font-weight: bold;
        border-color: #1DB954;
    }

    .preset-button:disabled {
        background-color: #2a2a2a;
        color: #777;
        cursor: not-allowed;
        border-color: #444;
    }

    .preset-button span {
        display: block;
        font-size: 0.9em;
        color: #b3b3b3;
    }
    
    .preset-button.selected span {
        color: #000;
    }

    .status-display {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #2a2a2a;
      padding: 8px 10px;
      border-radius: 4px;
      margin-top: 5px;
      font-size: 0.8em;
      color: #b3b3b3;
    }

    .status-display .value {
      font-weight: bold;
      color: #1DB954;
    }


    /* Responsive Design */
    @media (max-width: 768px) {
        .eq-scroll-wrapper {
            position: fixed; /* Keep fixed to position relative to the viewport */
            top: 20px; /* Small margin from the top of the viewport */
            left: 50%;
            transform: translateX(-50%); /* Horizontally center the modal */
            width: calc(100vw - 20px); /* Take up almost full width with 10px margin on each side */
            bottom: 80px; /* Adjust this value based on your player's actual height to prevent blocking it */
            height: auto; /* Let top and bottom properties define the height */
            max-width: none; /* Allow it to take full available width */
            max-height: none; /* Allow it to take full available height (defined by top/bottom) */
            padding-right: 10px; /* Keep space for scrollbar to prevent overlaying content */
            z-index: 1000; /* Ensure it appears above other content */
            border: 1px solid #333; /* Optional: subtle border for modal */
            border-radius: 8px; /* Match the inner component radius */
            background-color: #1a1a1a; /* Match the inner component background */
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5); /* Stronger shadow for modal */
        }

        .eq-controls {
            /* On mobile, the wrapper is the modal, so the controls should fill it */
            width: 100%;
            padding: 15px 0; /* Adjust padding as the wrapper now has padding */
            background-color: transparent; /* Remove background as wrapper has it now */
            box-shadow: none; /* Remove shadow as wrapper has it now */
        }

        /* Adjustments for the title to be within the modal's internal padding */
        .title {
            padding: 0 15px; /* Add horizontal padding to title */
            font-size: 1.1em; /* Smaller title for mobile */
        }

        /* Adjustments for card content padding to match the new .eq-controls padding */
        .card-header {
            padding-left: 15px;
            padding-right: 15px;
            font-size: 0.85em; /* Smaller card header text for mobile */
        }
        .card-body {
            padding-left: 15px;
            padding-right: 15px;
        }

        .eq-grid {
            grid-template-columns: 1fr;
            padding-left: 15px; /* Adjust padding */
            padding-right: 15px; /* Adjust padding */
        }

        .eq-item label {
            font-size: 0.7em; /* Smaller EQ band label */
            min-width: 40px;
        }
        .eq-item span { /* Gain value */
            font-size: 0.65em; /* Smaller EQ gain value */
            min-width: 35px;
        }

        .custom-dropdown-wrapper {
            padding: 0 15px;
        }

        .dropdown-toggle {
            font-size: 0.8em; /* Smaller dropdown toggle text */
            padding: 7px 9px;
        }
        .dropdown-menu button.dropdown-item {
            font-size: 0.8em; /* Smaller dropdown item text */
            padding: 7px 9px;
        }

        .slider-control {
            padding: 0 15px;
        }
        .slider-control span:first-child { /* Slider label */
            font-size: 0.75em; /* Smaller slider label text */
            min-width: 50px;
        }
        .slider-control span:last-child { /* Slider value */
            font-size: 0.7em; /* Smaller slider value text */
            min-width: 30px;
        }

        .reverb-subheader {
            padding-left: 15px;
            padding-right: 15px;
        }
        .reverb-label {
            font-size: 0.8em; /* Smaller reverb subheader label */
        }

        .status-message {
             padding: 0 15px;
             font-size: 0.65em; /* Smaller status messages */
        }
    }

    /* Styles for the dropdown item buttons specifically */
    .dropdown-menu button.dropdown-item {
        background: none;
        border: none;
        color: inherit;
        padding: 8px 10px;
        text-align: left;
        width: 100%;
        display: block;
        cursor: pointer;
        font-size: 0.8em; /* Adjusted for consistency, slightly smaller than prev 0.85em */
    }

    .dropdown-menu button.dropdown-item:hover {
        background-color: #3a3a3a;
    }

    .dropdown-menu button.dropdown-item.selected {
        background-color: #1DB954;
        color: #000;
        font-weight: bold;
    }

    /* NEW STYLE for mobile performance tip */
    .mobile-performance-tip {
        font-size: 0.75em;
        color: #ffcc00; /* A warning yellow/orange */
        background-color: #3a3000;
        border-left: 3px solid #ffcc00;
        padding: 8px 10px;
        margin-top: 10px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .mobile-performance-tip .inline-icon {
      color: #ffcc00;
    }
</style>