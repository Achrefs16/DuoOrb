Pod::Spec.new do |s|
  s.name           = 'DuoOrbAi'
  s.version        = '1.0.0'
  s.summary        = 'Native multi-threaded MCTS bot engine for DuoOrb'
  s.description    = 'Multi-threaded MCTS bot search running on background threads.'
  s.authors        = 'DuoOrb'
  s.homepage       = 'https://github.com/Achrefs16/DuoOrb'
  s.platforms      = { ios: '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.4'
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end