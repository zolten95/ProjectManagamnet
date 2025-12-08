"use client";

import { useState, useRef, useCallback } from "react";
import { uploadAvatar, removeAvatar } from "../actions/avatar-actions";
import { supabaseBrowser } from "@/lib/supabaseClient";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  userName: string;
  onAvatarUpdated?: (avatarUrl: string | null) => void;
}

export default function AvatarUpload({
  currentAvatarUrl,
  userName,
  onAvatarUpdated,
}: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: "%",
          width: 90,
        },
        1,
        width,
        height
      ),
      width,
      height
    );
    setCrop(crop);
  }

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    setError(null);

    // Read file and show crop modal
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCropComplete = useCallback(async () => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) {
      return;
    }

    const image = imgRef.current;
    const canvas = canvasRef.current;
    const crop = completedCrop;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const pixelRatio = window.devicePixelRatio;
    canvas.width = crop.width * pixelRatio;
    canvas.height = crop.height * pixelRatio;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = "high";

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;
    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;

    // Calculate center crop for circular avatar
    const size = Math.min(cropWidth, cropHeight);
    const x = cropX + (cropWidth - size) / 2;
    const y = cropY + (cropHeight - size) / 2;

    // Draw circular crop
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      image,
      x,
      y,
      size,
      size,
      0,
      0,
      canvas.width,
      canvas.height
    );
    ctx.restore();

    // Convert to blob and upload
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setError("Failed to process image");
          return;
        }

        // Create file from blob
        const croppedFile = new File([blob], "avatar.jpg", {
          type: "image/jpeg",
          lastModified: Date.now(),
        });

        setUploading(true);
        setShowCropModal(false);
        const formData = new FormData();
        formData.append("file", croppedFile);
        const result = await uploadAvatar(formData);

        if (result.error) {
          setError(result.error);
          setUploading(false);
        } else {
          setPreview(result.data || null);
          if (onAvatarUpdated) {
            onAvatarUpdated(result.data || null);
          }
          setUploading(false);
        }
      },
      "image/jpeg",
      0.9
    );
  }, [completedCrop, onAvatarUpdated]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    const result = await removeAvatar();
    if (result.error) {
      setError(result.error);
    } else {
      setPreview(null);
      if (onAvatarUpdated) {
        onAvatarUpdated(null);
      }
    }
    setUploading(false);
  };

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-[#6295ff] flex items-center justify-center text-white text-2xl font-semibold">
            {preview ? (
              <img
                src={preview}
                alt={userName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{getInitials(userName)}</span>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex flex-col items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            id="avatar-upload"
          />
          <label
            htmlFor="avatar-upload"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-md text-sm font-medium transition-colors cursor-pointer disabled:opacity-60"
          >
            {uploading ? "Uploading..." : preview ? "Change Photo" : "Upload Photo"}
          </label>
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="px-4 py-2 bg-red-950/40 hover:bg-red-900/40 border border-red-900/50 text-red-400 rounded-md text-sm font-medium transition-colors disabled:opacity-60"
            >
              Remove Photo
            </button>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-400 text-center max-w-xs">{error}</div>
        )}
      </div>

      {/* Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-semibold text-white mb-4">
              Position your photo
            </h3>
            <p className="text-sm text-zinc-400 mb-4">
              Drag the image to position your face in the circle, then click "Apply Crop"
            </p>
            
            <div className="flex justify-center mb-4">
              {imgSrc && (
                <div className="relative">
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={1}
                    className="max-w-full"
                  >
                    <img
                      ref={imgRef}
                      alt="Crop me"
                      src={imgSrc}
                      onLoad={onImageLoad}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "70vh",
                        objectFit: "contain",
                      }}
                    />
                  </ReactCrop>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCropComplete}
                disabled={!completedCrop || uploading}
                className="flex-1 px-4 py-2 bg-[#6295ff] hover:bg-[#4b7af0] disabled:opacity-60 text-white rounded-md font-medium transition-colors"
              >
                {uploading ? "Uploading..." : "Apply Crop"}
              </button>
              <button
                onClick={() => {
                  setShowCropModal(false);
                  setImgSrc("");
                  setCrop(undefined);
                  setCompletedCrop(undefined);
                }}
                disabled={uploading}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

