import ExpoModulesCore
import AVFoundation

/**
 * DuoOrb game SFX on iOS: a preloaded pool of AVAudioPlayers per sound.
 *
 * Same contract as the Android SoundPool side: every clip decoded once at
 * init (`prepareToPlay`), every play event takes an idle voice, a repeated
 * event never restarts the voice that is still playing. With 4 voices per
 * sound and 10 sounds, even a worst-case burst (5 rapid moves + wall +
 * notify + goal tail) always finds an idle voice; if all 4 are somehow busy,
 * the eldest is reused, which mirrors SoundPool's evict-oldest behavior.
 *
 * Audio session is `.ambient` with `.mixWithOthers`: game/UI sounds on the
 * speakers, mixing with other audio, obeying the silent switch. No record
 * category (never the earpiece), no background-audio modes.
 */
public class DuoOrbSfxModule: Module {
  private static let voicesPerSound = 4

  private var voices: [String: [AVAudioPlayer]] = [:]
  private var cursor: [String: Int] = [:]
  private var muted = false

  public func definition() -> ModuleDefinition {
    Name("DuoOrbSfx")

    /**
     * Decodes every sound into its voice pool and resolves true only when
     * ALL of them prepared. Throws/rejects on the first unreadable file —
     * a half-loaded mixer that silently drops sounds is worse than a loud
     * init failure the JS side can report.
     */
    AsyncFunction("loadSounds") { (sounds: [String: String], promise: Promise) in
      do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.ambient, options: [.mixWithOthers])
        try session.setActive(true)

        self.voices.removeAll()
        self.cursor.removeAll()
        for (name, uri) in sounds {
          let url: URL
          if uri.hasPrefix("file://"), let fileURL = URL(string: uri) {
            url = fileURL
          } else {
            url = URL(fileURLWithPath: uri)
          }
          var list: [AVAudioPlayer] = []
          for _ in 0..<Self.voicesPerSound {
            let player = try AVAudioPlayer(contentsOf: url)
            player.prepareToPlay()
            list.append(player)
          }
          self.voices[name] = list
          self.cursor[name] = 0
        }
        promise.resolve(true)
      } catch {
        self.voices.removeAll()
        self.cursor.removeAll()
        promise.reject("SFX_INIT_FAILED", error.localizedDescription)
      }
    }

    /**
     * One idle voice per call. Never seeks, never restarts the voice that is
     * still playing, never queues. Unknown or unloaded names are dropped —
     * a missing blip beats a gameplay hitch.
     */
    Function("playSound") { (name: String) in
      if self.muted { return }
      guard let list = self.voices[name], !list.isEmpty else { return }
      if let idle = list.first(where: { !$0.isPlaying }) {
        idle.play()
        return
      }
      let i = self.cursor[name, default: 0]
      list[i].stop()
      list[i].currentTime = 0
      list[i].play()
      self.cursor[name] = (i + 1) % list.count
    }

    /**
     * Gates future plays. In-flight tails (every DuoOrb clip is <=0.7s)
     * decay naturally — identical to the Android side, no paused-voice
     * bookkeeping.
     */
    Function("setNativeMuted") { (muted: Bool) in
      self.muted = muted
    }

    Function("releaseSounds") {
      for list in self.voices.values {
        for player in list { player.stop() }
      }
      self.voices.removeAll()
      self.cursor.removeAll()
    }

    Function("isNativeReady") { () -> Bool in
      return !self.voices.isEmpty
    }
  }
}
