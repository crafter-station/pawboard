"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_MIN_LENGTH = 2;
const DEFAULT_MAX_LENGTH = 30;

interface EditNameDialogProps {
  currentName: string;
  onSave: (newName: string) => Promise<{ success: boolean; error?: string }>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  placeholder?: string;
  maxLength?: number;
}

export function EditNameDialog({
  currentName,
  onSave,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  title = "Edit your name",
  description = "This name will be visible to other participants in this session.",
  placeholder = "Enter your name",
  maxLength = DEFAULT_MAX_LENGTH,
}: EditNameDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (controlledOnOpenChange ?? (() => {}))
    : setInternalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Reset state when dialog opens
      setName(currentName);
      setError(null);
    }
  };

  const validateName = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length < DEFAULT_MIN_LENGTH) {
      return `Name must be at least ${DEFAULT_MIN_LENGTH} characters`;
    }
    if (trimmed.length > maxLength) {
      return `Name must be at most ${maxLength} characters`;
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    const result = await onSave(name.trim());

    setIsSaving(false);

    if (result.success) {
      setOpen(false);
    } else {
      setError(result.error ?? "Failed to save name");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSaving) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={maxLength}
            autoFocus
            aria-invalid={!!error}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            {name.trim().length}/{maxLength} characters
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
