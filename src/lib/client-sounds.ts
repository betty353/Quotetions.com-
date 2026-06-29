"use client"

type Tone = {
  frequency: number
  duration: number
  gap?: number
}

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext
  return AudioContextConstructor ? new AudioContextConstructor() : null
}

function playToneSequence(sequence: Tone[], volume = 0.08) {
  if (typeof window === "undefined") return

  const context = getAudioContext()
  if (!context) return

  let startAt = context.currentTime + 0.02

  for (const tone of sequence) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = "square"
    oscillator.frequency.setValueAtTime(tone.frequency, startAt)
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + tone.duration + 0.02)

    startAt += tone.duration + (tone.gap ?? 0.035)
  }
}

export function playNotificationTone() {
  try {
    playToneSequence([
      { frequency: 1318.51, duration: 0.08 },
      { frequency: 1567.98, duration: 0.08 },
      { frequency: 1174.66, duration: 0.1 },
      { frequency: 1760, duration: 0.14 },
    ], 0.07)
  } catch {
    // Browsers may block audio until the user interacts with the page.
  }
}

export function playSentMessageTone() {
  try {
    playToneSequence([
      { frequency: 880, duration: 0.045 },
      { frequency: 1174.66, duration: 0.07 },
    ], 0.055)
  } catch {
    // Sound is optional; sending the message must never depend on audio.
  }
}
