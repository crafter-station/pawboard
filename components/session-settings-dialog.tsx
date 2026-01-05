"use client";

import { Lock, Move, Settings, Trash, Trash2, Unlock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DeletePermission, MovePermission, Session } from "@/db/schema";

interface SessionSettingsDialogProps {
  session: Session;
  onUpdateSettings: (settings: {
    isLocked?: boolean;
    movePermission?: MovePermission;
    deletePermission?: DeletePermission;
  }) => Promise<{ success: boolean; error?: string }>;
  onDeleteSession: () => Promise<{ success: boolean; error?: string }>;
  trigger?: React.ReactNode;
}

export function SessionSettingsDialog({
  session,
  onUpdateSettings,
  onDeleteSession,
  trigger,
}: SessionSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(session.isLocked);
  const [movePermission, setMovePermission] = useState<MovePermission>(
    session.movePermission,
  );
  const [deletePermission, setDeletePermission] = useState<DeletePermission>(
    session.deletePermission,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasChanges =
    isLocked !== session.isLocked ||
    movePermission !== session.movePermission ||
    deletePermission !== session.deletePermission;

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Reset to current session values
      setIsLocked(session.isLocked);
      setMovePermission(session.movePermission);
      setDeletePermission(session.deletePermission);
      setError(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) {
      setOpen(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    const result = await onUpdateSettings({
      isLocked,
      movePermission,
      deletePermission,
    });

    setIsSaving(false);

    if (result.success) {
      setOpen(false);
    } else {
      setError(result.error ?? "Failed to save settings");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    const result = await onDeleteSession();

    setIsDeleting(false);

    if (!result.success) {
      setError(result.error ?? "Failed to delete session");
    }
    // If successful, the page will redirect, so no need to close dialog
  };

  const handleLockToggle = async () => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    setIsSaving(true);
    setError(null);

    const result = await onUpdateSettings({ isLocked: newLocked });

    setIsSaving(false);

    if (!result.success) {
      setIsLocked(!newLocked); // Revert
      setError(result.error ?? "Failed to update lock status");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Session Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Session Settings
          </DialogTitle>
          <DialogDescription>
            Configure permissions and lock status for this session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Lock/Unlock Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium flex items-center gap-2">
                  {isLocked ? (
                    <Lock className="h-4 w-4 text-destructive" />
                  ) : (
                    <Unlock className="h-4 w-4 text-green-600" />
                  )}
                  Session Lock
                </label>
                <p className="text-xs text-muted-foreground">
                  {isLocked
                    ? "Session is frozen. No one can add, edit, move, or vote on cards."
                    : "Session is active. Participants can interact with cards."}
                </p>
              </div>
              <Button
                variant={isLocked ? "destructive" : "outline"}
                size="sm"
                onClick={handleLockToggle}
                disabled={isSaving}
              >
                {isLocked ? "Unlock" : "Lock"}
              </Button>
            </div>
          </div>

          {/* Move Permission */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Move className="h-4 w-4" />
              Who can move cards?
            </label>
            <div className="flex gap-2">
              <Button
                variant={movePermission === "creator" ? "default" : "outline"}
                size="sm"
                onClick={() => setMovePermission("creator")}
                disabled={isSaving}
                className="flex-1"
              >
                Only card creator
              </Button>
              <Button
                variant={movePermission === "everyone" ? "default" : "outline"}
                size="sm"
                onClick={() => setMovePermission("everyone")}
                disabled={isSaving}
                className="flex-1"
              >
                Everyone
              </Button>
            </div>
          </div>

          {/* Delete Permission */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Trash className="h-4 w-4" />
              Who can delete cards?
            </label>
            <p className="text-xs text-muted-foreground">
              You can always delete any card as the session creator.
            </p>
            <div className="flex gap-2">
              <Button
                variant={deletePermission === "creator" ? "default" : "outline"}
                size="sm"
                onClick={() => setDeletePermission("creator")}
                disabled={isSaving}
                className="flex-1"
              >
                Only card creator
              </Button>
              <Button
                variant={
                  deletePermission === "everyone" ? "default" : "outline"
                }
                size="sm"
                onClick={() => setDeletePermission("everyone")}
                disabled={isSaving}
                className="flex-1"
              >
                Everyone
              </Button>
            </div>
          </div>

          {/* Danger Zone - Delete Session */}
          <div className="border-t pt-4 space-y-2">
            <label className="text-sm font-medium text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Danger Zone
            </label>
            {!showDeleteConfirm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                Delete Session
              </Button>
            ) : (
              <div className="space-y-2 p-3 bg-destructive/10 rounded-md">
                <p className="text-sm text-destructive">
                  Are you sure? This will permanently delete this session and
                  all its cards.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Yes, Delete"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
