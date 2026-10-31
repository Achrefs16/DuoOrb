fn main() {
    let target_arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target_os == "android" {
        println!("cargo:rustc-cdylib-link-arg=-Wl,-soname,libduoorb_analyzer.so");
    } else if target_arch != "wasm32" && target_os != "ios" {
        napi_build::setup();
    }
}
