/**
 * A simplified LUFS meter inspired by the EBU R 128 standard, implemented as an AudioWorkletProcessor.
 *
 * This processor performs the following steps:
 * 1. A K-weighting filter (pre-filter + high-shelf) to approximate human hearing sensitivity.
 * 2. Calculates the mean square of the audio signal over a 400ms window (for momentary loudness).
 * 3. Converts the mean square value to a logarithmic scale (LUFS).
 * 4. Periodically posts the momentary loudness value back to the main thread.
 *
 * Note: This is a simplified implementation for demonstration and real-time control.
 * A fully compliant EBU R 128 meter would also include gating for integrated loudness,
 * which is omitted here for performance in a real-time streaming context.
 */
class LufsMeterProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Configuration for a 400ms window at a 48kHz sample rate.
        this.MEASUREMENT_WINDOW_SECONDS = 0.4;
        this.samplesInWindow = this.MEASUREMENT_WINDOW_SECONDS * sampleRate;
        this.channelData = [];
        this.channelSquares = [];
        this.sampleIndex = 0;
        
        // K-Weighting Filter Coefficients (biquad filters)
        // Stage 1: High-pass pre-filter
        this.hp_b0 = 1.0; this.hp_b1 = -2.0; this.hp_b2 = 1.0;
        this.hp_a1 = -1.9900474548339844; this.hp_a2 = 0.9900722503662109;
        // Stage 2: High-shelf filter
        this.hs_b0 = 1.535124898436955; this.hs_b1 = -2.691696189406383; this.hs_b2 = 1.198392810852852;
        this.hs_a1 = -1.69065929318241; this.hs_a2 = 0.732480774215850;
        
        this.port.onmessage = (event) => {
            // Can receive messages from the main thread if needed, e.g., to adjust window size
        };
    }

    /**
     * Applies the two-stage K-weighting filter to the input signal.
     * @param {Float32Array} inputData - The raw audio data for one channel.
     * @param {object} z - The filter state (z1, z2) for the given channel.
     * @returns {Float32Array} - The filtered audio data.
     */
    kFilter(inputData, z) {
        const outputData = new Float32Array(inputData.length);
        
        // Apply stage 1 (HPF)
        for (let i = 0; i < inputData.length; i++) {
            const input = inputData[i];
            const filtered = this.hp_b0 * input + z.hp_z1;
            z.hp_z1 = (this.hp_b1 * input) - (this.hp_a1 * filtered) + z.hp_z2;
            z.hp_z2 = (this.hp_b2 * input) - (this.hp_a2 * filtered);
            outputData[i] = filtered;
        }
        
        // Apply stage 2 (HSF)
        for (let i = 0; i < outputData.length; i++) {
            const input = outputData[i];
            const filtered = this.hs_b0 * input + z.hs_z1;
            z.hs_z1 = (this.hs_b1 * input) - (this.hs_a1 * filtered) + z.hs_z2;
            z.hs_z2 = (this.hs_b2 * input) - (this.hs_a2 * filtered);
            outputData[i] = filtered;
        }
        
        return outputData;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length === 0) {
            return true;
        }

        // Initialize buffers and filter states for each channel on first run
        if (this.channelData.length === 0) {
            for (let i = 0; i < input.length; i++) {
                this.channelData.push(new Float32Array(this.samplesInWindow));
                this.channelSquares.push(0);
                // z contains the filter state variables
                this.channelData[i].filterZ = { hp_z1: 0, hp_z2: 0, hs_z1: 0, hs_z2: 0 };
            }
        }
        
        // Assuming the input is stereo, we average the channels.
        // For mono, it will just use the single channel.
        const block_len = input[0].length;
        const num_channels = input.length;

        for (let i = 0; i < block_len; i++) {
            let sum_of_squares = 0;
            for (let ch = 0; ch < num_channels; ch++) {
                // Get the filtered sample for the current channel
                const filtered_sample_arr = this.kFilter(input[ch].slice(i, i + 1), this.channelData[ch].filterZ);
                const filtered_sample = filtered_sample_arr[0];
                
                // --- Sliding Window Calculation ---
                // Subtract the oldest sample's square from the running total
                this.channelSquares[ch] -= this.channelData[ch][this.sampleIndex] ** 2;
                // Add the new sample's square
                this.channelSquares[ch] += filtered_sample ** 2;
                // Store the new sample in the circular buffer
                this.channelData[ch][this.sampleIndex] = filtered_sample;

                sum_of_squares += this.channelSquares[ch];
            }

            // Update the circular buffer index
            this.sampleIndex = (this.sampleIndex + 1) % this.samplesInWindow;

            // Post a message every 100ms with the current momentary loudness
            if (this.sampleIndex % Math.floor(sampleRate * 0.1) === 0) {
                const mean_square = sum_of_squares / (num_channels * this.samplesInWindow);
                if (mean_square > 0) {
                    const lufs = 10 * Math.log10(mean_square) - 0.691;
                    this.port.postMessage({ type: 'momentaryLoudness', value: lufs });
                }
            }
        }

        return true;
    }
}

registerProcessor('lufs-meter-processor', LufsMeterProcessor);