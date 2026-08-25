import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MAX_AVATAR_SIZE, deleteAvatar, setAvatar } from "../api/rctf";
import { avatarRejectionReason } from "../utils";

/**
 * The team avatar on the profile page, which is also the control that changes
 * it: clicking the picture opens a file dialog.
 *
 * There is no separate "upload" button because there is nothing else the
 * picture could plausibly do when clicked - but a picture that does something
 * on click has to say so, hence the brush that fades in on hover and focus. It
 * is a real `<button>` rather than a clickable `<div>` so that the keyboard
 * reaches it and the label is announced.
 *
 * The file input is hidden and driven from the click handler. Styling one is
 * not possible to any useful degree, and the button already is the affordance.
 */
export function AvatarPicker({ url, teamName }: { url: string | null; teamName: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  // Rejections we make ourselves, before any request. Server-side failures
  // live on the mutation instead - two sources, one line of message below.
  const [rejected, setRejected] = useState<string | null>(null);

  const refreshProfile = () => {
    // The avatar is read off the profile query that AuthContext holds, and the
    // header renders from the same object. Without this the new picture shows
    // up nowhere until a reload.
    queryClient.invalidateQueries({ queryKey: ["myProfile"] });
  };

  const upload = useMutation({
    mutationFn: (file: File) => setAvatar(file),
    onSettled: refreshProfile,
  });

  const remove = useMutation({
    mutationFn: () => deleteAvatar(),
    onSettled: refreshProfile,
  });

  const pending = upload.isPending || remove.isPending;
  const error = rejected ?? errorText(upload.error) ?? errorText(remove.error);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const reason = avatarRejectionReason(file, MAX_AVATAR_SIZE);
    setRejected(reason);
    upload.reset();
    if (!reason) upload.mutate(file);
  };

  return (
    <div className="avatar-picker">
      <button
        type="button"
        className="avatar-edit"
        disabled={pending}
        title="Change your team picture"
        aria-label={`Change the team picture for ${teamName}`}
        onClick={() => inputRef.current?.click()}
      >
        {url ? <img className="avatar-edit-img" src={url} alt="" /> : null}
        <span className="avatar-edit-overlay" aria-hidden="true">
          <BrushIcon />
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        // Reset the value so choosing the same file twice fires onChange
        // again - after a failed upload, re-picking the same image is exactly
        // what someone retrying would do.
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {url && !pending && (
        <button type="button" className="avatar-remove" onClick={() => remove.mutate()}>
          Remove
        </button>
      )}
      {pending && <span className="avatar-status">Uploading&hellip;</span>}
      {error && (
        <span className="avatar-status avatar-status-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function errorText(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

/** A brush, drawn rather than imported - it is the only icon on this page. */
function BrushIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15.4 4.6l4 4" />
      <path d="M3.6 20.4l4.2-1.1L17.9 9.2l-3.1-3.1L4.7 16.2z" />
    </svg>
  );
}
