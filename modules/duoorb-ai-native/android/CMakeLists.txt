cmake_minimum_required(VERSION 3.18.1)
project(duoorb_ai)

# Support 16 KB memory page sizes (Android 15+ requirement)
set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} -Wl,-z,max-page-size=16384")

add_library(duoorb_analyzer SHARED IMPORTED)
set_target_properties(duoorb_analyzer PROPERTIES
    IMPORTED_LOCATION ${CMAKE_CURRENT_SOURCE_DIR}/src/main/jniLibs/${ANDROID_ABI}/libduoorb_analyzer.so
    IMPORTED_SONAME libduoorb_analyzer.so
)

add_library(duoorb_ai SHARED src/main/cpp/bridge.cpp)

# Ensure 16 KB page size alignment on target
target_link_options(duoorb_ai PRIVATE "-Wl,-z,max-page-size=16384")

# Link against Android log and the Rust duoorb_analyzer library
target_link_libraries(duoorb_ai log duoorb_analyzer)
