/**
 * Sound notification utility
 * Plays a notification sound when new notifications arrive
 */

export function playNotificationSound() {
  // Check if user has sound enabled (we'll store this in localStorage)
  const soundEnabled = localStorage.getItem('notifications_sound_enabled') !== 'false'
  
  if (!soundEnabled) return

  try {
    // Create an audio context for the beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Create oscillator for a pleasant beep (double tone)
    const now = audioContext.currentTime
    
    // First tone (higher pitch)
    const osc1 = audioContext.createOscillator()
    const gain1 = audioContext.createGain()
    osc1.connect(gain1)
    gain1.connect(audioContext.destination)
    osc1.frequency.value = 800 // Hz
    osc1.type = 'sine'
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
    osc1.start(now)
    osc1.stop(now + 0.2)
    
    // Second tone (lower pitch, slightly delayed)
    const osc2 = audioContext.createOscillator()
    const gain2 = audioContext.createGain()
    osc2.connect(gain2)
    gain2.connect(audioContext.destination)
    osc2.frequency.value = 600 // Hz
    osc2.type = 'sine'
    gain2.gain.setValueAtTime(0, now + 0.1)
    gain2.gain.setValueAtTime(0.3, now + 0.1)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc2.start(now + 0.1)
    osc2.stop(now + 0.3)
  } catch (error) {
    console.warn('Could not play notification sound:', error)
  }
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem('notifications_sound_enabled', enabled ? 'true' : 'false')
}

export function isSoundEnabled(): boolean {
  return localStorage.getItem('notifications_sound_enabled') !== 'false'
}
