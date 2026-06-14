import sys
import os

try:
    import librosa
    import numpy as np
except Exception:
    librosa = None
    np = None

# Check if file path is provided
if len(sys.argv) < 2:
    print("Usage: python script.py <path_to_audio_file>")
    sys.exit(1)

file_path = sys.argv[1]

def detect_emotion(file_path):
    if not os.path.exists(file_path):
        return "error: file not found"

    try:
        if librosa is None or np is None:
            return "neutral"

        # Load audio (mono)
        y, sr = librosa.load(file_path, sr=None)
        
        if len(y) == 0:
            return "error: empty audio"

        # 1. Pitch detection (YIN algorithm)
        # yin returns f0 for each frame. Need to handle NaNs (unvoiced/silent frames)
        f0 = librosa.yin(y, fmin=50, fmax=300, sr=sr)
        # Use median to ignore extreme outliers/NaNs
        median_pitch = np.nanmedian(f0) 
        
        # 2. Energy detection (RMS)
        rms = librosa.feature.rms(y=y)
        mean_energy = np.mean(rms)

        # 3. Simple Heuristic Emotion Detection
        if mean_energy < 0.01:
            return "sad/calm" # Low energy
        elif median_pitch > 170: # Typical female/high pitch range
            return "happy/excited"
        elif median_pitch > 0 and median_pitch < 120: # Typical male/low pitch
            return "neutral"
        else:
            return "neutral"

    except Exception:
        return "neutral"

print(detect_emotion(file_path))
