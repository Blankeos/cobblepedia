#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

COBBLEVERSE_MRPACK_PATH_DEFAULT="${PROJECT_ROOT}/.tmp-cobbleverse/COBBLEVERSE 1.7.3.mrpack"
COBBLEVERSE_MRPACK_URL_DEFAULT="https://cdn.modrinth.com/data/Jkb29YJU/versions/Cg3gXABt/COBBLEVERSE%201.7.3.mrpack"
COBBLEVERSE_MRPACK_SHA1_DEFAULT="4e2f5fe329e764a74da637508c2d54844d01e757"

COBBLEVERSE_MRPACK_PATH="${COBBLEVERSE_MRPACK_PATH:-${COBBLEVERSE_MRPACK_PATH_DEFAULT}}"
COBBLEVERSE_MRPACK_URL="${COBBLEVERSE_MRPACK_URL:-${COBBLEVERSE_MRPACK_URL_DEFAULT}}"
COBBLEVERSE_MRPACK_SHA1="${COBBLEVERSE_MRPACK_SHA1:-${COBBLEVERSE_MRPACK_SHA1_DEFAULT}}"

clone_repo() {
  local target_dir="$1"
  local repo_url="$2"

  if [[ -d "${target_dir}/.git" ]]; then
    printf "[skip] %s already exists (git repo)\n" "${target_dir}"
    return
  fi

  if [[ -e "${target_dir}" ]]; then
    printf "[error] %s exists but is not a git repo\n" "${target_dir}"
    printf "        Move or remove it, then rerun this script.\n"
    return 1
  fi

  printf "[clone] %s -> %s\n" "${repo_url}" "${target_dir}"
  git clone --filter=blob:none "${repo_url}" "${target_dir}"
}

file_sha1() {
  local file_path="$1"
  shasum -a 1 "${file_path}" | awk '{print $1}'
}

download_file() {
  local target_path="$1"
  local file_url="$2"
  local expected_sha1="$3"

  mkdir -p "$(dirname "${target_path}")"

  if [[ -f "${target_path}" ]]; then
    if [[ -n "${expected_sha1}" ]]; then
      local current_sha1
      current_sha1="$(file_sha1 "${target_path}")"
      if [[ "${current_sha1}" == "${expected_sha1}" ]]; then
        printf "[skip] %s already exists (sha1 ok)\n" "${target_path}"
        return
      fi
      printf "[info] %s exists but sha1 differs; re-downloading\n" "${target_path}"
    else
      printf "[skip] %s already exists\n" "${target_path}"
      return
    fi
  fi

  local temp_path="${target_path}.tmp.$$"
  printf "[download] %s -> %s\n" "${file_url}" "${target_path}"
  curl -fL --retry 3 --retry-delay 1 --connect-timeout 20 -o "${temp_path}" "${file_url}"

  if [[ -n "${expected_sha1}" ]]; then
    local downloaded_sha1
    downloaded_sha1="$(file_sha1 "${temp_path}")"
    if [[ "${downloaded_sha1}" != "${expected_sha1}" ]]; then
      printf "[error] sha1 mismatch for %s\n" "${target_path}"
      printf "        expected: %s\n" "${expected_sha1}"
      printf "        actual:   %s\n" "${downloaded_sha1}"
      rm -f "${temp_path}"
      return 1
    fi
  fi

  mv "${temp_path}" "${target_path}"
  printf "[ok] downloaded %s\n" "${target_path}"
}

clone_repo "${PROJECT_ROOT}/.tmp-cobblemon" "https://gitlab.com/cable-mc/cobblemon.git"
clone_repo "${PROJECT_ROOT}/.tmp-blockbench" "https://github.com/JannisX11/blockbench.git"
download_file "${COBBLEVERSE_MRPACK_PATH}" "${COBBLEVERSE_MRPACK_URL}" "${COBBLEVERSE_MRPACK_SHA1}"

printf "Done. Local reference sources are ready under %s\n" "${PROJECT_ROOT}"
