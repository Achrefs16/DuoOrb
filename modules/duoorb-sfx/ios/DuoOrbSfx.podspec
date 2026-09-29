Pod::Spec.new do |s|
  s.name           = 'DuoOrbSfx'
  s.version        = '1.0.0'
  s.summary        = 'Preloaded multi-voice game SFX for DuoOrb'
  s.description    = 'Android SoundPool / iOS AVAudioPlayer pool behind one JS bridge.'
  s.authors        = 'DuoOrb'
  s.homepage       = 'https://github.com/Achrefs16/DuoOrb'
  s.platforms      = { ios: '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.4'
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
