#!/usr/bin/env python3
"""Drive `zeus bridge` unattended through a pty and keep everything it prints (including the watch's console.log).

  python3 bridge-drive.py <project folder> <log file> "connect@8" "install@25" "@90"

Each step is "text@seconds": the text is typed (an empty text just presses Enter, which accepts the first device in the
list), then the output is collected for that many seconds. Ctrl-C is sent at the end. Read the log with e.g.
  sed 's/\\x1b\\[[0-9;?]*[a-zA-Z]//g' bridge.log | tr -d '\\r' | grep 'mytag'
"""
import os, pty, sys, time, select

cwd, logf = sys.argv[1], sys.argv[2]
steps = [s.rsplit('@', 1) for s in sys.argv[3:]]
pid, fd = pty.fork()
if pid == 0:
    os.chdir(cwd)
    os.environ['TERM'] = 'dumb'
    os.execvp('zeus', ['zeus', 'bridge'])
out = open(logf, 'ab', buffering=0)

def pump(sec):
    end = time.time() + sec
    while time.time() < end:
        r, _, _ = select.select([fd], [], [], 0.3)
        if r:
            try:
                d = os.read(fd, 65536)
            except OSError:
                return False
            if not d:
                return False
            out.write(d)
    return True

ok = pump(6)
for text, wait in steps:
    out.write(('\n<<< SEND: %r >>>\n' % text).encode())
    os.write(fd, (text + '\r').encode())
    ok = pump(float(wait))
    if not ok:
        break
out.write(b'\n<<< END >>>\n')
try:
    os.write(fd, b'\x03')
except OSError:
    pass
time.sleep(1)
