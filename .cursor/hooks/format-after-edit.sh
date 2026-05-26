#!/usr/bin/env bash
#
# afterFileEdit 钩子：被编辑过的代码文件自动跑 prettier --write。
# 仅对 .ts/.tsx/.js/.cjs/.json/.md/.css 生效；其它类型直接放行。
#
# 注意事项：
# - hooks.json 中 failClosed=false，本脚本失败时不阻断编辑
# - 不强依赖 jq（grep 兜底解析）
# - Windows Git Bash / macOS / Linux 均能跑通
#
# 输入（stdin JSON）：{"tool_name":"Write"|"TabWrite","file_paths":["..."]}
# 输出：{}（本事件不需返回数据）

trap 'printf "%s" "{}"; exit 0' ERR

input="$(cat 2>/dev/null || true)"

# 提取 file_paths（不依赖 jq）：抓 "file_paths":[...] 内的字符串
paths_block=$(printf '%s' "$input" | tr -d '\n' \
  | sed -n 's/.*"file_paths"[[:space:]]*:[[:space:]]*\[\([^]]*\)\].*/\1/p')

if [[ -z "$paths_block" ]]; then
  printf '%s' '{}'
  exit 0
fi

# 拆分为单行路径列表
paths=$(printf '%s' "$paths_block" \
  | grep -oE '"[^"]+"' \
  | sed 's/^"//; s/"$//')

if [[ -z "$paths" ]]; then
  printf '%s' '{}'
  exit 0
fi

# 仅保留我们关心的扩展名
filtered=()
while IFS= read -r p; do
  [[ -z "$p" ]] && continue
  case "$p" in
    *.ts|*.tsx|*.js|*.cjs|*.json|*.md|*.css)
      filtered+=("$p")
      ;;
  esac
done <<< "$paths"

if [[ ${#filtered[@]} -eq 0 ]]; then
  printf '%s' '{}'
  exit 0
fi

# 选执行器：优先 pnpm exec（拿到本地 prettier）
runner=""
if command -v pnpm >/dev/null 2>&1; then
  runner="pnpm exec"
elif command -v npx >/dev/null 2>&1; then
  runner="npx --no-install"
fi

# 没有可用执行器：直接放行
if [[ -z "$runner" ]]; then
  printf '%s' '{}'
  exit 0
fi

# 跑 prettier；失败也吞掉（编辑器体验优先）
$runner prettier --write --log-level silent "${filtered[@]}" >/dev/null 2>&1 || true

printf '%s' '{}'
exit 0
