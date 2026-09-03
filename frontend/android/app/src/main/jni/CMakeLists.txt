# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.
#
# Custom CMakeLists.txt for saude-monitor to disable IPO/LTO
# This prevents the -fuse-ld=gold check failure in NDK 27

cmake_minimum_required(VERSION 3.13)

# Define the library name here.
project(appmodules)

# Disable IPO/LTO to avoid -fuse-ld=gold check failure in NDK 27
# NDK 27 removed gold linker support, causing CheckIPOSupported to fail
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION FALSE)

# Include React Native's default app setup (will now skip IPO enable)
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)