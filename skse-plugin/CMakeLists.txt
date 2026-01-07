cmake_minimum_required(VERSION 3.21)
project(OverlayBridge VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# SKSE SDK path
set(SKSE_SDK_PATH "C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition/src/skse64")

# Source files
set(SOURCES
    overlay-bridge.cpp
)

# Add library
add_library(${PROJECT_NAME} SHARED ${SOURCES})

# Include directories
target_include_directories(${PROJECT_NAME} PRIVATE
    "${SKSE_SDK_PATH}/include"
    "${SKSE_SDK_PATH}/common"
)

# Compiler options for SKSE plugin
if(MSVC)
    target_compile_options(${PROJECT_NAME} PRIVATE
        /W4
        /WX-
        /permissive-
    )
endif()

# Output directory
set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    SUFFIX ".dll"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)
