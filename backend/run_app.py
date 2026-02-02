import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).parent

BACKEND_PORT = 8000
FRONTEND_PORT = 5173

def start_backend():
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app:app",
            "--host",
            "0.0.0.0",
            "--port",
            str(BACKEND_PORT),
        ],
        cwd=ROOT / "backend",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

def start_frontend():
    return subprocess.Popen(
        [sys.executable, "-m", "http.server", str(FRONTEND_PORT)],
        cwd=ROOT / "frontend",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

if __name__ == "__main__":

    print("🚀 Starting FastAPI backend...")
    backend = start_backend()

    print("🌐 Starting frontend...")
    frontend = start_frontend()

    time.sleep(1)

    print("🔓 Opening browser...")
    webbrowser.open(f"http://localhost:{FRONTEND_PORT}")

    print("✅ App running. Close this window to stop.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        frontend.terminate()
        backend.terminate()

