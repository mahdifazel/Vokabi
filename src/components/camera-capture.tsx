"use client";

import { useEffect, useRef, useState } from "react";
import { Images, X } from "lucide-react";
import { Button } from "./ui";

/**
 * In-app camera view for the photo scan feature. Uses getUserMedia instead of
 * a file input with capture: opening the system camera app suspends the PWA
 * and iOS/Android often kill and reload the page while it is open, losing the
 * photo and the sheet state. A live preview inside our own page never leaves
 * the app. Mount only while needed; parent conditionally renders it.
 */
export function CameraCapture({
  onClose,
  onCapture,
  onPickGallery,
}: {
  onClose: () => void;
  onCapture: (frame: HTMLCanvasElement) => void;
  onPickGallery: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 2048 },
            height: { ideal: 2048 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    onCapture(canvas);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex justify-end p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={onClose}
          aria-label="Close camera"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white active:scale-95"
        >
          <X size={20} />
        </button>
      </div>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-sm font-semibold text-white/80">
            The camera is not available. You can pick a photo from your gallery
            instead.
          </p>
          <Button onClick={onPickGallery}>
            <Images size={18} /> Choose from gallery
          </Button>
        </div>
      ) : (
        <>
          {/* muted + playsInline are required for autoplay on iOS Safari */}
          <video
            ref={videoRef}
            muted
            playsInline
            className="min-h-0 flex-1 object-contain"
          />
          <div className="grid grid-cols-3 items-center px-8 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button
              onClick={onPickGallery}
              aria-label="Choose from gallery"
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white active:scale-95"
            >
              <Images size={22} />
            </button>
            <button
              onClick={takePhoto}
              aria-label="Take photo"
              className="mx-auto h-16 w-16 cursor-pointer rounded-full bg-white ring-4 ring-white/30 active:scale-95"
            />
            <span />
          </div>
        </>
      )}
    </div>
  );
}
