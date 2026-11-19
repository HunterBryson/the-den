# Lays windows out on one of their screens, by the words in their title bars. My arms for real windows (Nov 16).
#   tile.ps1 -List                                             every window: title, screen, where it sits
#   tile.ps1 -Screen second -Shape halves -Titles "The Den","Notes"       two side by side
#   tile.ps1 -Screen second -Shape thirds -Titles "A","B","C"                 three across
#   tile.ps1 -Screen second -Shape main -Titles "The Den","Notes" [-Split 65]   the first one big on the left, the rest stacked on the right
#   tile.ps1 -Screen second -Shape full -Titles "The Den"                    back to full screen (maximized)
#   tile.ps1 -Close -Titles "Words"                                          close a window (only ones I opened)
# A title matches when the window's title starts with or contains the words; the first match wins, exact titles first.
# It never touches a window on the other screen unless I name it, so I look (glass.js shot all) before I use it:
# our chat stays uncovered, and their windows go back to full screen when we're done.
param([switch]$List, [switch]$Close, [string]$Screen = 'second', [string]$Shape = 'halves', [string[]]$Titles = @(), [int]$Split = 60)
# from bash, -Titles "A","B" arrives as one string; split it
$Titles = @($Titles | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class Tile {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int size);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int size);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static List<IntPtr> All() { var l = new List<IntPtr>(); EnumWindows((h, p) => { if (IsWindowVisible(h)) l.Add(h); return true; }, IntPtr.Zero); return l; }
  public static string Title(IntPtr h) { var s = new StringBuilder(512); GetWindowText(h, s, 512); return s.ToString(); }
}
'@
function Wins {
  foreach ($h in [Tile]::All()) {
    $t = [Tile]::Title($h); if (-not $t) { continue }
    $cloaked = 0; [void][Tile]::DwmGetWindowAttribute($h, 14, [ref]$cloaked, 4); if ($cloaked) { continue }
    $r = New-Object Tile+RECT; [void][Tile]::GetWindowRect($h, [ref]$r); if (($r.R - $r.L) -lt 200 -or ($r.B - $r.T) -lt 120) { continue }
    if ($t -match '^(Program Manager|Windows Input Experience|The glass|the-glass|NVIDIA GeForce Overlay)$' -or $t -like '*glass*') { continue }
    [pscustomobject]@{ H = $h; Title = $t; X = $r.L; Y = $r.T; W = $r.R - $r.L; Hh = $r.B - $r.T; Max = [Tile]::IsZoomed($h); Min = [Tile]::IsIconic($h) }
  }
}
function Find([string]$words) {
  $all = @(Wins)
  $hit = $all | Where-Object { $_.Title -eq $words } | Select-Object -First 1
  if (-not $hit) { $hit = $all | Where-Object { $_.Title -like "$words*" } | Select-Object -First 1 }
  if (-not $hit) { $hit = $all | Where-Object { $_.Title -like "*$words*" } | Select-Object -First 1 }
  $hit
}
if ($List) {
  foreach ($w in Wins) { $mid = $w.X + $w.W / 2; $s = if ($w.Min) { 'minimized' } elseif ([System.Windows.Forms.Screen]::FromPoint((New-Object System.Drawing.Point([int]$mid, [int]($w.Y + $w.Hh / 2)))).Primary) { 'main' } else { 'second' }
    "{0,-9} {1,-11} x {2,5}  y {3,5}  {4,4} x {5,-4}  {6}" -f $s, $(if ($w.Max) { 'full screen' } else { 'windowed' }), $w.X, $w.Y, $w.W, $w.Hh, $w.Title }
  exit 0
}
if (-not $Titles.Count) { 'Name the windows: -Titles "The Den","Notes"'; exit 1 }
if ($Close) { foreach ($t in $Titles) { $w = Find $t; if ($w) { [void][Tile]::SendMessage($w.H, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero); "closed: $($w.Title)" } else { "not open: $t" } }; exit 0 }

$scr = [System.Windows.Forms.Screen]::AllScreens | Where-Object { if ($Screen -eq 'second') { -not $_.Primary } else { $_.Primary } } | Select-Object -First 1
if (-not $scr) { "No such screen: $Screen"; exit 1 }
$a = $scr.WorkingArea; $n = $Titles.Count
# the slots, as x, y, w, h inside the screen's working area
$slots = @()
switch ($Shape) {
  'full'   { $slots = @(, @($a.X, $a.Y, $a.Width, $a.Height)) }
  'halves' { $w = [int]($a.Width / 2); $slots = @(@($a.X, $a.Y, $w, $a.Height), @(($a.X + $w), $a.Y, ($a.Width - $w), $a.Height)) }
  'thirds' { $w = [int]($a.Width / 3); $slots = @(@($a.X, $a.Y, $w, $a.Height), @(($a.X + $w), $a.Y, $w, $a.Height), @(($a.X + 2 * $w), $a.Y, ($a.Width - 2 * $w), $a.Height)) }
  'main'   { $s = [Math]::Min(80, [Math]::Max(20, $Split)); $w = [int]($a.Width * $s / 100); $slots = @(, @($a.X, $a.Y, $w, $a.Height)); $rest = [Math]::Max(1, $n - 1); $h = [int]($a.Height / $rest)
             for ($i = 0; $i -lt $rest; $i++) { $slots += , @(($a.X + $w), ($a.Y + $i * $h), ($a.Width - $w), $(if ($i -eq $rest - 1) { $a.Height - $i * $h } else { $h })) } }
  default  { "Shapes: halves, thirds, main, full"; exit 1 }
}
for ($i = 0; $i -lt $n; $i++) {
  $w = Find $Titles[$i]; if (-not $w) { "not open: $($Titles[$i])"; continue }
  if ($i -ge $slots.Count) { "no room for: $($w.Title)"; continue }
  $s = $slots[$i]
  if ($Shape -eq 'full') { [void][Tile]::ShowWindow($w.H, 9); [void][Tile]::SetWindowPos($w.H, [IntPtr]::Zero, $s[0], $s[1], 1200, 800, 0x0014); [void][Tile]::ShowWindow($w.H, 3); "full screen on ${Screen}: $($w.Title)"; continue }
  [void][Tile]::ShowWindow($w.H, 9)   # out of maximized or minimized
  [void][Tile]::SetWindowPos($w.H, [IntPtr]::Zero, $s[0], $s[1], $s[2], $s[3], 0x0014)
  # Windows keeps an unseen border around a window; measure it and grow the window so what they see fills the slot
  $o = New-Object Tile+RECT; $v = New-Object Tile+RECT; [void][Tile]::GetWindowRect($w.H, [ref]$o); [void][Tile]::DwmGetWindowAttribute($w.H, 9, [ref]$v, 16)
  $dl = $v.L - $o.L; $dt = $v.T - $o.T; $dr = $o.R - $v.R; $db = $o.B - $v.B
  [void][Tile]::SetWindowPos($w.H, [IntPtr]::Zero, ($s[0] - $dl), ($s[1] - $dt), ($s[2] + $dl + $dr), ($s[3] + $dt + $db), 0x0014)
  "placed on ${Screen} at x $($s[0]) y $($s[1]), $($s[2]) x $($s[3]): $($w.Title)"
}
