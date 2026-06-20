"use client";

import { useState } from "react";
import { X, Send, MessageSquare, Paperclip, FileIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FeedbackPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackPanel({ isOpen, onClose }: FeedbackPanelProps) {
  const [category, setCategory] = useState<string>("general");
  const [message, setMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const categories = [
    {
      value: "bug",
      label: "Bug Report",
      description: "Something isn't working correctly",
    },
    {
      value: "feature_request",
      label: "Feature Request",
      description: "Suggest a new feature",
    },
    {
      value: "improvement",
      label: "Improvement",
      description: "Make something better",
    },
    {
      value: "general",
      label: "General Feedback",
      description: "General thoughts or comments",
    },
    { value: "other", label: "Other", description: "Something else" },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setSubmitStatus({
        type: "error",
        message: "File size must be less than 5MB",
      });
      return;
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      setSubmitStatus({
        type: "error",
        message: "Only images and documents (PDF, DOC, DOCX) are allowed",
      });
      return;
    }

    setSelectedFile(file);
    setSubmitStatus({ type: null, message: "" });

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      setSubmitStatus({
        type: "error",
        message: "Please enter your feedback message",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      let attachmentPath = null;
      let attachmentName = null;
      let attachmentSize = null;
      let attachmentType = null;

      // Upload file if selected
      if (selectedFile) {
        const fileName = `${user.id}/${Date.now()}_${selectedFile.name}`;

        const { error: uploadError } = await supabase.storage
          .from("feedback-attachments")
          .upload(fileName, selectedFile);

        if (uploadError) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }

        attachmentPath = fileName;
        attachmentName = selectedFile.name;
        attachmentSize = selectedFile.size;
        attachmentType = selectedFile.type;
      }

      // Get current page context
      const pageContext = window.location.pathname;

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          message,
          pageContext,
          attachmentPath,
          attachmentName,
          attachmentSize,
          attachmentType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      setSubmitStatus({
        type: "success",
        message: "Thank you for your feedback! We'll review it soon.",
      });

      // Reset form after 2 seconds and close panel
      setTimeout(() => {
        setCategory("general");
        setMessage("");
        setSelectedFile(null);
        setFilePreview(null);
        setSubmitStatus({ type: null, message: "" });
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setSubmitStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to submit feedback. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setCategory("general");
      setMessage("");
      setSelectedFile(null);
      setFilePreview(null);
      setSubmitStatus({ type: null, message: "" });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 h-screen z-100 bg-slate-900/50 transition-opacity"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-101 h-screen w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-slate-900">
                Send Feedback
              </h2>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Help us improve NTS Claims Tracker
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                What type of feedback do you have?
              </label>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <label
                    key={cat.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                      category === cat.value
                        ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500 ring-opacity-20"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={cat.value}
                      checked={category === cat.value}
                      onChange={(e) => setCategory(e.target.value)}
                      className="mt-1 h-4 w-4 border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {cat.label}
                      </div>
                      <div className="text-xs text-slate-600">
                        {cat.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="feedback-message"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Your feedback <span className="text-red-500">*</span>
              </label>
              <textarea
                id="feedback-message"
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind... Be as detailed as you'd like!"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-20"
                required
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-slate-500">
                {message.length} characters
              </p>
            </div>

            {/* File Attachment */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Attach Screenshot or Document (optional)
              </label>
              
              {!selectedFile ? (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 transition-colors hover:border-orange-400 hover:bg-orange-50">
                  <Paperclip className="mb-2 h-8 w-8 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    Click to upload
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    PNG, JPG, GIF, PDF, DOC (max 5MB)
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                </label>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  {filePreview ? (
                    <div className="mb-3">
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="h-32 w-full rounded object-cover"
                      />
                    </div>
                  ) : (
                    <div className="mb-3 flex h-32 items-center justify-center rounded bg-slate-50">
                      <FileIcon className="h-12 w-12 text-slate-400" />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Paperclip className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-700">
                        {selectedFile.name}
                      </span>
                      <span className="text-slate-500">
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      disabled={isSubmitting}
                      className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Status Messages */}
            {submitStatus.type && (
              <div
                className={`rounded-lg border p-3 ${
                  submitStatus.type === "success"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {submitStatus.message}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Feedback
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-500">
              Your feedback helps us build a better product. Thank you!
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
