import { DspSettings } from "../types";

/**
 * Generates a synthetic impulse response buffer to simulate reverb.
 * This allows reverb without needing to load large external impulse response WAV files.
 */
function createReverbImpulseResponse(context: BaseAudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulse = context.createBuffer(2, length, sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
       // Exponential decay noise
       channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

/**
 * Applique des filtres audio Web Audio API sur un fichier audio d'entrée.
 */
export async function applyAudioDsp(
  audioBlob: Blob,
  settings: DspSettings,
  mode: "normal" | "robot" | "megaphone" | "cave" | "custom" | "moroccan"
): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Read blob to ArrayBuffer, and decode it
  const arrayBuffer = await audioBlob.arrayBuffer();
  const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Determine offline context length (speed can shorten or lengthen)
  const speed = settings.speed || 1.0;
  const targetDuration = originalBuffer.duration / speed;
  const sampleRate = originalBuffer.sampleRate;
  const outputLength = Math.floor(sampleRate * targetDuration);
  
  // Use OfflineAudioContext for fast, non-real-time audio rendering
  const offlineCtx = new OfflineAudioContext(
    originalBuffer.numberOfChannels,
    outputLength,
    sampleRate
  );
  
  // 1. Source Node
  const source = offlineCtx.createBufferSource();
  source.buffer = originalBuffer;
  source.playbackRate.value = speed;
  
  let lastNode: AudioNode = source;
  
  // 2. Pitch Shifter (Semi-tones)
  // Standard Web Audio doesn't have an instant pitch-shifter out-of-the-box without custom worklets,
  // but if we change speed, playbackRate already modifies pitch.
  // For custom pitch modifications, we can combine playbackRate with frequency filtering,
  // or use playbackRate directly if the user is fine with speed modifications.
  // Let's also implement a Pitch modification via playbackRate directly.
  if (mode === "custom" && settings.pitch !== 0) {
    // Semi-tones to playback rate multiplier: 2^(pitch/12)
    const pitchMultiplier = Math.pow(2, settings.pitch / 12);
    source.playbackRate.value = speed * pitchMultiplier;
  } else if (mode === "cave") {
    // Deeper cave pitch
    source.playbackRate.value = speed * 0.85;
  }
  
  // 3. Robotic Filter (Ring Modulator using sinusoidal waves and high frequencies)
  if (mode === "robot") {
    // We achieve a robotic mechanical vibrato using a WaveShaper for folding
    const distortionNode = offlineCtx.createWaveShaper();
    const makeDistortionCurve = (amount = 20) => {
      const k = typeof amount === 'number' ? amount : 50;
      const n_samples = 44100;
      const curve = new Float32Array(n_samples);
      const deg = Math.PI / 180;
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
      return curve;
    };
    distortionNode.curve = makeDistortionCurve(50);
    distortionNode.oversample = '4x';
    
    lastNode.connect(distortionNode);
    lastNode = distortionNode;
    
    // Add a bandpass filter focusing on high-mid mechanical resonances (1000Hz)
    const bpf = offlineCtx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.value = 1200;
    bpf.Q.value = 3.0;
    
    lastNode.connect(bpf);
    lastNode = bpf;
  }
  
  // 4. Megaphone / Telephone Speaker Filter (Bandpass + overdrive shape)
  if (mode === "megaphone") {
    const loFilter = offlineCtx.createBiquadFilter();
    loFilter.type = "highpass";
    loFilter.frequency.value = 750; // Cut off muddy bass frequencies
    
    const hiFilter = offlineCtx.createBiquadFilter();
    hiFilter.type = "lowpass";
    hiFilter.frequency.value = 2800; // Cut off high crisp air frequencies
    
    // Connect Megaphone filters
    lastNode.connect(loFilter);
    loFilter.connect(hiFilter);
    lastNode = hiFilter;
    
    // Light distortion overdrive
    const waveShaper = offlineCtx.createWaveShaper();
    const curve = new Float32Array(44100);
    for (let i = 0; i < 44100; i++) {
      const x = (i * 2) / 44100 - 1;
      curve[i] = x < 0 ? Math.atan(x * 2.5) : Math.atan(x * 4) / 1.5;
    }
    waveShaper.curve = curve;
    waveShaper.oversample = "2x";
    
    lastNode.connect(waveShaper);
    lastNode = waveShaper;
  }

  // Moroccan Warm Voice Presets Stage (DSP - gratis)
  if (mode === "moroccan") {
    // 1. Warm traditional Maghrebi vocal resonance EQ
    // Boost low shelf warmth slightly (+4.5 dB low shelf at 220Hz)
    const eqLowNode = offlineCtx.createBiquadFilter();
    eqLowNode.type = "lowshelf";
    eqLowNode.frequency.value = 220;
    eqLowNode.gain.value = 4.5;
    
    // Boost mid frequency vocal presence (+2.5 dB Peaking at 1400Hz)
    const eqMidNode = offlineCtx.createBiquadFilter();
    eqMidNode.type = "peaking";
    eqMidNode.frequency.value = 1400;
    eqMidNode.Q.value = 1.0;
    eqMidNode.gain.value = 2.5;

    // Attenuate excessive high sibilance (-2 dB high shelf at 5500Hz)
    const eqHighNode = offlineCtx.createBiquadFilter();
    eqHighNode.type = "highshelf";
    eqHighNode.frequency.value = 5500;
    eqHighNode.gain.value = -2.0;

    lastNode.connect(eqLowNode);
    eqLowNode.connect(eqMidNode);
    eqMidNode.connect(eqHighNode);
    lastNode = eqHighNode;

    // Slightly adjust pitch to warm conversational frequency tone (-1 semitone)
    const pitchMultiplier = Math.pow(2, -1 / 12);
    source.playbackRate.value = speed * pitchMultiplier;
  }
  
  // 5. Echo (Delay Effect)
  const echoVal = mode === "cave" ? 40 : (mode === "custom" ? settings.echo : 0);
  if (echoVal > 0) {
    const delayNode = offlineCtx.createDelay(1.0);
    delayNode.delayTime.value = 0.35; // 350ms echo interval
    
    const feedbackNode = offlineCtx.createGain();
    feedbackNode.gain.value = (echoVal / 100) * 0.7; // Cap feedback gain at 70%
    
    delayNode.connect(feedbackNode);
    feedbackNode.connect(delayNode); // feedback loop
    
    const echoMixNode = offlineCtx.createGain();
    echoMixNode.gain.value = 0.75;
    
    lastNode.connect(delayNode);
    lastNode.connect(echoMixNode);
    
    // Mix direct and delay signals
    const mergerNode = offlineCtx.createGain();
    delayNode.connect(mergerNode);
    echoMixNode.connect(mergerNode);
    lastNode = mergerNode;
  }
  
  // 6. Reverb (Hall/Cave reverb Tail Simulation)
  const reverbVal = mode === "cave" ? 65 : (mode === "custom" ? settings.reverb : 0);
  if (reverbVal > 0) {
    const convolver = offlineCtx.createConvolver();
    // Simulate cavernous reverb (2.5 seconds decay, decay rating of 4)
    convolver.buffer = createReverbImpulseResponse(offlineCtx, 2.5, 4.0);
    
    const wetGain = offlineCtx.createGain();
    wetGain.gain.value = (reverbVal / 100) * 0.6; // Wet mix volume
    
    const dryGain = offlineCtx.createGain();
    dryGain.gain.value = 1.0 - (wetGain.gain.value / 2);
    
    lastNode.connect(convolver);
    convolver.connect(wetGain);
    lastNode.connect(dryGain);
    
    const reverbMixer = offlineCtx.createGain();
    wetGain.connect(reverbMixer);
    dryGain.connect(reverbMixer);
    
    lastNode = reverbMixer;
  }
  
  // 7. Parametric EQ (Custom equalizer filters)
  if (mode === "custom") {
    // Low Shelf
    const eqLowNode = offlineCtx.createBiquadFilter();
    eqLowNode.type = "lowshelf";
    eqLowNode.frequency.value = 250;
    eqLowNode.gain.value = settings.eqLow;
    
    // Mid Peaking
    const eqMidNode = offlineCtx.createBiquadFilter();
    eqMidNode.type = "peaking";
    eqMidNode.frequency.value = 1500;
    eqMidNode.Q.value = 1.0;
    eqMidNode.gain.value = settings.eqMid;
    
    // High Shelf
    const eqHighNode = offlineCtx.createBiquadFilter();
    eqHighNode.type = "highshelf";
    eqHighNode.frequency.value = 6000;
    eqHighNode.gain.value = settings.eqHigh;
    
    lastNode.connect(eqLowNode);
    eqLowNode.connect(eqMidNode);
    eqMidNode.connect(eqHighNode);
    lastNode = eqHighNode;
  }
  
  // Connect final node to destination
  lastNode.connect(offlineCtx.destination);
  
  // Play the source internally in our rendering timeline
  source.start(0);
  
  // Render of offline channel starts
  const renderedBuffer = await offlineCtx.startRendering();
  
  // Close testing context
  await audioContext.close();
  
  // Convert rendered AudioBuffer to Blob (as WAV format)
  return audioBufferToWavBlob(renderedBuffer);
}

/**
 * Converts an AudioBuffer to a WAV formatted Blob.
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // Write WAV header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // chunk length
  setUint16(1); // sample format (raw PCM)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bits per sample

  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4); // chunk length

  // Split channels
  for (i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  // Interleave and write audio data
  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp sample
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff; // 16-bit PCM conversion
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArr], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
