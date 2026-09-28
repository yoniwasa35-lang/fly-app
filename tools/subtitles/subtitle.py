"""Hebrew typewriter-style burned-in subtitles.

setup: pip install faster-whisper imageio-ffmpeg pillow fonttools
usage: python3 subtitle.py input.mp4 [output.mp4]
Produces output.mp4 (burned subs), output.srt and output.ass next to it.
To fix wording: edit output.words.json and re-run (transcription is skipped).
"""
import json, os, subprocess, sys

import imageio_ffmpeg
from faster_whisper import WhisperModel

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
MODEL = "ivrit-ai/whisper-large-v3-turbo-ct2"
MAX_CHARS = 34        # max characters per subtitle line
MAX_GAP = 0.7         # pause (s) that forces a new line
TYPE_MAX = 0.45       # max seconds to type a single word
HOLD = 0.8            # seconds a line stays after its last word
RLM = "\u200f"        # libass lays out LTR; RLM marks keep trailing punctuation on the left


def probe_size(path):
    out = subprocess.run([FFMPEG, "-i", path], capture_output=True, text=True).stderr
    import re
    m = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", out)
    return (int(m.group(1)), int(m.group(2))) if m else (1920, 1080)


def transcribe(path):
    model = WhisperModel(MODEL, device="cpu", compute_type="int8")
    segs, _ = model.transcribe(path, language="he", word_timestamps=True,
                               vad_filter=True, beam_size=5)
    words = []
    for s in segs:
        for w in s.words:
            t = w.word.strip()
            if t:
                words.append({"w": t, "s": w.start, "e": w.end})
    return words


def group_lines(words):
    lines, cur = [], []
    for w in words:
        if cur:
            text = " ".join(x["w"] for x in cur + [w])
            gap = w["s"] - cur[-1]["e"]
            if len(text) > MAX_CHARS or gap > MAX_GAP or cur[-1]["w"][-1] in ".?!":
                lines.append(cur)
                cur = []
        cur.append(w)
    if cur:
        lines.append(cur)
    return lines


def ts_ass(t):
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ts_srt(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


FONT_FILE = os.path.expanduser("~/.fonts/RubikSemiBold.ttf")
FONT_NAME = "Rubik SemiBold"


def ensure_font():
    """Install a static SemiBold instance of Google's Rubik (variable fonts confuse libass)."""
    if os.path.exists(FONT_FILE):
        return
    import urllib.request
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    os.makedirs(os.path.dirname(FONT_FILE), exist_ok=True)
    var = FONT_FILE + ".var.ttf"
    urllib.request.urlretrieve(
        "https://raw.githubusercontent.com/google/fonts/main/ofl/rubik/Rubik%5Bwght%5D.ttf", var)
    inst = instancer.instantiateVariableFont(TTFont(var), {"wght": 600}, updateFontNames=True)
    inst.save(FONT_FILE)
    os.remove(var)
    subprocess.run(["fc-cache", "-f"], check=False)


def text_width(text, size):
    """Approximate libass rendered width (libass sizes by win ascent+descent)."""
    from PIL import ImageFont
    from fontTools.ttLib import TTFont
    tt = TTFont(FONT_FILE)
    os2 = tt["OS/2"]
    scale = tt["head"].unitsPerEm / (os2.usWinAscent + os2.usWinDescent)
    return ImageFont.truetype(FONT_FILE, 200).getlength(text) * size * scale / 200


def build(words, w, h, base):
    lines = group_lines(words)
    font = max(28, int(min(h * 0.058, w * 0.075)))  # portrait: size by width so lines fit
    outline = max(2, font // 13)
    ass = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {w}", f"PlayResY: {h}",
        "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Type,{FONT_NAME},{font},&H00FFFFFF,&H00FFFFFF,&H00181818,&H80000000,"
        f"0,0,0,0,100,100,0,0,1,{outline},{max(1, font // 22)},3,0,0,0,1",
        "", "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    srt = []
    y = int(h * (0.78 if h > w else 0.91))  # portrait: stay clear of app UI at the bottom
    for i, ln in enumerate(lines):
        start = ln[0]["s"]
        nxt = lines[i + 1][0]["s"] if i + 1 < len(lines) else ln[-1]["e"] + HOLD
        end = min(max(min(ln[-1]["e"] + HOLD, nxt), ln[-1]["e"] + 0.05), nxt)  # never overlap next line
        full = " ".join(x["w"] for x in ln)
        x = int(min(w - 20, w / 2 + text_width(full, font) / 2))
        # reveal times: one per character of the full line
        reveals, pos = [], 0
        for j, wd in enumerate(ln):
            dur = max(0.05, min(wd["e"] - wd["s"], TYPE_MAX))
            step = dur / len(wd["w"])
            for k in range(len(wd["w"])):
                reveals.append((pos + k + 1, wd["s"] + k * step))
            pos += len(wd["w"]) + 1
        for n, (cut, t0) in enumerate(reveals):
            t1 = reveals[n + 1][1] if n + 1 < len(reveals) else end
            if t1 - t0 < 0.01:
                continue
            ass.append(f"Dialogue: 0,{ts_ass(t0)},{ts_ass(t1)},Type,,0,0,0,,"
                       f"{{\\an3\\pos({x},{y})}}{RLM}{full[:cut]}{RLM}")
        srt += [str(i + 1), f"{ts_srt(start)} --> {ts_srt(end)}", full, ""]
    with open(base + ".ass", "w", encoding="utf-8") as f:
        f.write("\n".join(ass) + "\n")
    with open(base + ".srt", "w", encoding="utf-8") as f:
        f.write("\n".join(srt))


def burn(inp, base, out):
    subprocess.run([FFMPEG, "-y", "-i", inp, "-vf", f"ass={base}.ass",
                    "-c:v", "libx264", "-crf", "18", "-preset", "medium",
                    "-c:a", "copy", "-movflags", "+faststart", out], check=True)


if __name__ == "__main__":
    inp = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(inp)[0] + "_subs.mp4"
    base = os.path.splitext(out)[0]
    words_json = base + ".words.json"
    if os.path.exists(words_json):
        words = json.load(open(words_json, encoding="utf-8"))
    else:
        words = transcribe(inp)
        json.dump(words, open(words_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ensure_font()
    w, h = probe_size(inp)
    build(words, w, h, base)
    burn(inp, base, out)
    print("done:", out)
