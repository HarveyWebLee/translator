#!/usr/bin/env bash
#
# beforeShellExecution 钩子：拦截高风险命令，触发人工二次确认。
#
# 注意事项：
# - hooks.json 中 failClosed=false，本脚本失败时放行（避免阻塞日常开发）
# - 不依赖 jq 等外部工具，使用 grep / sed 兜底解析
# - Windows Git Bash / macOS / Linux 均能跑通
#
# 输入（stdin JSON）：{"command": "...", ...}
# 输出：{"permission": "allow" | "ask", "user_message": "...", "agent_message": "..."}

# 保底：任何异常情况都先打印 allow，避免阻塞
trap 'printf "%s" "{ \"permission\": \"allow\" }"; exit 0' ERR

input="$(cat 2>/dev/null || true)"

# 提取 command 字段（不依赖 jq）
# 命中 "command": "..."（首个），允许内含转义双引号但不复杂处理
cmd=$(printf '%s' "$input" \
  | tr -d '\n' \
  | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(\(\\"\|[^"]\)*\)".*/\1/p')

# 命令为空 → 放行（信息不足，避免误拦）
if [[ -z "$cmd" ]]; then
  printf '%s' '{ "permission": "allow" }'
  exit 0
fi

# 危险命令模式（与 hooks.json matcher 互为冗余）
# 使用基础 ERE，避免 [[:space:]] 在不同 bash 上行为差异
if printf '%s' "$cmd" | grep -Eq 'rm[[:space:]]+-rf|git[[:space:]]+push[[:space:]].*--force|pnpm[[:space:]]+publish|npm[[:space:]]+publish|DROP[[:space:]]+TABLE|TRUNCATE[[:space:]]+TABLE'; then
  # 转义命令字符串中的双引号，避免 JSON 解析失败
  cmd_escaped=$(printf '%s' "$cmd" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{ "permission": "ask", "user_message": "%s\\n\\n  %s\\n\\n%s", "agent_message": "%s" }' \
    "⚠️ 命令命中高风险模式：" \
    "$cmd_escaped" \
    "请确认是否预期操作（删除文件 / 强制推送 / 发布 / 破坏性 SQL）。" \
    "shell guard hook 拦截了一条潜在破坏性命令，需要用户确认。"
  exit 0
fi

# 默认放行
printf '%s' '{ "permission": "allow" }'
exit 0
