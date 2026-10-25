import ExpoModulesCore

public class DuoOrbAiModule: Module {
  private let queue = DispatchQueue(label: "com.duoorb.ai.queue", qos: .userInitiated, attributes: .concurrent)

  public func definition() -> ModuleDefinition {
    Name("DuoOrbAi")

    AsyncFunction("getBestAction") { (stateJson: String, simulations: Int, threads: Int, promise: Promise) in
      self.queue.async {
        // Runs on background OS thread
        promise.resolve(nil)
      }
    }
  }
}