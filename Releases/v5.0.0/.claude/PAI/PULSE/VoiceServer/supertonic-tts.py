#!/usr/bin/env python3
"""PAI Supertonic TTS wrapper — generates WAV from text on CPU."""

import argparse
import sys
import os

def main():
    parser = argparse.ArgumentParser(description="Supertonic TTS")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--voice", default="M1", help="Voice name (M1-M5, F1-F5)")
    parser.add_argument("--lang", default="en", help="Language code")
    parser.add_argument("--output", required=True, help="Output WAV file path")
    args = parser.parse_args()

    from supertonic import TTS

    tts = TTS(auto_download=True)
    style = tts.get_voice_style(voice_name=args.voice)
    wav, _ = tts.synthesize(args.text, voice_style=style, lang=args.lang)
    tts.save_audio(wav, args.output)
    print(args.output)

if __name__ == "__main__":
    main()
