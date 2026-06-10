// Browser-only audio helpers for the dictation flow (hooks/use-stt.ts).
//
// MediaRecorder produces webm/opus (Chromium, Firefox) or mp4/AAC (Safari),
// but the transcription route only accepts WAV — it's the one format every
// audio-capable OpenRouter model ingests and the AI SDK maps to `input_audio`.
// Decode whatever the recorder gave us, downmix to mono, resample to 16 kHz
// (plenty for speech) and re-encode as 16-bit PCM WAV.

const TARGET_SAMPLE_RATE = 16_000

export interface EncodedRecording {
  wav: Blob
  durationSeconds: number
  /** Peak absolute sample amplitude (0–1). ~0 means the mic captured silence. */
  peak: number
}

export async function encodeRecordingToWav(blob: Blob): Promise<EncodedRecording> {
  const encoded = await blob.arrayBuffer()

  const decodeCtx = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await decodeCtx.decodeAudioData(encoded)
  } finally {
    void decodeCtx.close()
  }

  const length = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE))
  const offline = new OfflineAudioContext(1, length, TARGET_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  const samples = rendered.getChannelData(0)

  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    if (a > peak) peak = a
  }

  return {
    wav: encodeWavPcm16(samples, TARGET_SAMPLE_RATE),
    durationSeconds: samples.length / TARGET_SAMPLE_RATE,
    peak,
  }
}

function encodeWavPcm16(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  writeAscii(view, 0, "RIFF")
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, "WAVE")
  writeAscii(view, 12, "fmt ")
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeAscii(view, 36, "data")
  view.setUint32(40, dataBytes, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([buffer], { type: "audio/wav" })
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}
