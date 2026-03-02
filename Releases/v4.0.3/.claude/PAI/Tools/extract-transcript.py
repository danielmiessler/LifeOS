# /// script
# dependencies = [
#   "faster-whisper",
# ]
# ///
"""
extract-transcript.py

CLI tool for extracting transcripts from audio/video files using faster-whisper
Part of PAI's extracttranscript skill

Self-contained UV script with inline dependencies (PEP 723)

Usage:
    uv run extract-transcript.py <file-or-folder> [options]

Examples:
    uv run extract-transcript.py audio.m4a
    uv run extract-transcript.py video.mp4 --model large-v3 --format srt
    uv run extract-transcript.py ~/Podcasts/ --batch
"""

import sys
import os
import argparse
from pathlib import Path
from faster_whisper import WhisperModel
import json

# Supported audio/video formats
SUPPORTED_FORMATS = [
    ".m4a", ".mp3", ".wav", ".flac", ".ogg", ".aac", ".wma",
    ".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv"
]

# Available models
MODELS = ["tiny", "tiny.en", "base", "base.en", "small", "small.en", "medium", "medium.en", "large-v1", "large-v2", "large-v3"]

# Output formats
OUTPUT_FORMATS = ["txt", "json", "srt", "vtt"]


def is_supported_file(file_path):
    """Check if file has supported extension"""
    return Path(file_path).suffix.lower() in SUPPORTED_FORMATS


def get_files_from_directory(dir_path):
    """Get all supported audio/video files from directory"""
    files = []
    for file_path in Path(dir_path).iterdir():
        if file_path.is_file() and is_supported_file(file_path):
            files.append(str(file_path))
    return sorted(files)


def format_time_srt(seconds):
    """Format time for SRT subtitles (HH:MM:SS,mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def format_time_vtt(seconds):
    """Format time for WebVTT (HH:MM:SS.mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def transcribe_file(file_path, model, output_format):
    """Transcribe audio file using faster-whisper"""
    print(f"\nTranscribing: {Path(file_path).name}")
    print(f"Model: {model} | Format: {output_format}")
    print("Processing...")

    try:
        # Initialize model
        whisper_model = WhisperModel(model, device="cpu", compute_type="int8")

        # Transcribe
        segments, info = whisper_model.transcribe(file_path, beam_size=5)

        # Collect segments
        segment_list = []
        for segment in segments:
            segment_list.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })

        print(f"✓ Transcription complete ({len(segment_list)} segments)")
        return segment_list

    except Exception as e:
        raise Exception(f"Transcription failed: {str(e)}")


def format_transcript(segments, output_format):
    """Format transcript in requested format"""
    if output_format == "txt":
        return " ".join([seg["text"] for seg in segments])

    elif output_format == "json":
        return json.dumps(segments, indent=2)

    elif output_format == "srt":
        output = []
        for i, seg in enumerate(segments, 1):
            start = format_time_srt(seg["start"])
            end = format_time_srt(seg["end"])
            output.append(f"{i}\n{start} --> {end}\n{seg['text']}\n")
        return "\n".join(output)

    elif output_format == "vtt":
        output = ["WEBVTT\n"]
        for i, seg in enumerate(segments, 1):
            start = format_time_vtt(seg["start"])
            end = format_time_vtt(seg["end"])
            output.append(f"{i}\n{start} --> {end}\n{seg['text']}\n")
        return "\n".join(output)

    else:
        raise ValueError(f"Unsupported format: {output_format}")


def save_transcript(file_path, transcript, output_format, output_dir=None):
    """Save transcript to file"""
    # Determine output directory
    if output_dir:
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
    else:
        out_dir = Path(file_path).parent

    # Generate output filename
    base_name = Path(file_path).stem
    output_path = out_dir / f"{base_name}.{output_format}"

    # Save to file
    output_path.write_text(transcript, encoding="utf-8")

    return str(output_path)


def main():
    parser = argparse.ArgumentParser(
        description="Extract transcripts from audio/video files using faster-whisper"
    )
    parser.add_argument("path", help="File or folder path to transcribe")
    parser.add_argument(
        "--model",
        default="base.en",
        choices=MODELS,
        help="Whisper model size (default: base.en)"
    )
    parser.add_argument(
        "--format",
        default="txt",
        choices=OUTPUT_FORMATS,
        help="Output format (default: txt)"
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Process all files in folder"
    )
    parser.add_argument(
        "--output",
        help="Output directory (default: same as input)"
    )

    args = parser.parse_args()

    # Check if path exists
    input_path = Path(args.path).expanduser().resolve()
    if not input_path.exists():
        print(f"Error: Path does not exist: {input_path}")
        sys.exit(1)

    # Get files to process
    if input_path.is_dir():
        if not args.batch:
            print("Error: Path is a directory. Use --batch flag to process all files.")
            sys.exit(1)

        print(f"Processing directory: {input_path}")
        files = get_files_from_directory(input_path)

        if not files:
            print(f"Error: No supported audio/video files found")
            print(f"Supported formats: {', '.join(SUPPORTED_FORMATS)}")
            sys.exit(1)

        print(f"Found {len(files)} file(s) to transcribe")

    elif input_path.is_file():
        if not is_supported_file(input_path):
            print(f"Error: Unsupported file format: {input_path.suffix}")
            print(f"Supported formats: {', '.join(SUPPORTED_FORMATS)}")
            sys.exit(1)
        files = [str(input_path)]

    else:
        print(f"Error: Path is neither a file nor directory: {input_path}")
        sys.exit(1)

    # Process each file
    results = []
    errors = []

    for file_path in files:
        try:
            segments = transcribe_file(file_path, args.model, args.format)
            transcript = format_transcript(segments, args.format)
            output_path = save_transcript(file_path, transcript, args.format, args.output)
            results.append({"file": file_path, "output": output_path})
            print(f"✓ Saved to: {output_path}")
        except Exception as e:
            errors.append({"file": Path(file_path).name, "error": str(e)})
            print(f"✗ Failed to transcribe {Path(file_path).name}: {e}")

    # Summary
    print("\n" + "=" * 60)
    print("Transcription complete!")
    print(f"Successfully processed: {len(results)}/{len(files)} files")
    if errors:
        print(f"Failed: {len(errors)} files")
    print("=" * 60)

    if results:
        print("\nOutput files:")
        for result in results:
            print(f"  - {result['output']}")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"  - {error['file']}: {error['error']}")


if __name__ == "__main__":
    main()
