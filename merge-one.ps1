param(
  [int]$Num,
  [string]$Branch
)

Set-Location "C:\Users\a9999\AppData\Local\Temp\liff-merge-work"
git fetch origin main
git fetch origin "${Branch}:refs/remotes/origin/${Branch}"
git checkout -B ("pr" + $Num) ("origin/" + $Branch)
git merge origin/main -m ("merge main for PR #" + $Num)
if ($LASTEXITCODE -ne 0) {
  $conflicts = git diff --name-only --diff-filter=U
  foreach ($f in $conflicts) {
    git checkout --ours $f
  }
  git add -A
  git commit -m ("merge main: resolve conflicts for PR #" + $Num)
}
git push --force origin ("pr" + $Num + ":" + $Branch)
gh pr merge $Num --repo nephi4377/liff-checkin --merge --delete-branch
