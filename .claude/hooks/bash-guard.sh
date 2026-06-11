#!/bin/sh
# PreToolUse(Bash) guard: blocks force-pushes and rm -rf aimed outside the repo.
# Exit 2 blocks the tool call and feeds stderr back to Claude.

cmd=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.command??"")}catch{}})')

case "$cmd" in
  *"git push"*--force-with-lease*)
    ;; # lease-protected force pushes on feature branches are acceptable
  *"git push"*--force*|*"git push -f"*|*"git push"*" -f "*)
    echo "Blocked by Vantera guard: force-pushing is not allowed (rule 12). Use --force-with-lease on a feature branch if truly needed." >&2
    exit 2
    ;;
esac

case "$cmd" in
  *"rm -rf /"*|*"rm -rf ~"*|*"rm -fr /"*|*"rm -fr ~"*|*"rm -rf .."*|*"rm -fr .."*)
    echo "Blocked by Vantera guard: rm -rf outside the repository is not allowed." >&2
    exit 2
    ;;
esac

exit 0