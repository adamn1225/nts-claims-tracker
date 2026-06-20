import toast from "react-hot-toast";

/**
 * Copy text to clipboard with toast notification
 */
export async function copyToClipboard(
  text: string,
  message: string = "Copied to clipboard",
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message, {
      duration: 2000,
      position: "bottom-center",
      style: {
        background: "#10B981",
        color: "#fff",
        padding: "12px 24px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "500",
      },
      icon: "✓",
    });
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    toast.error("Failed to copy to clipboard", {
      duration: 2000,
      position: "bottom-center",
      style: {
        background: "#EF4444",
        color: "#fff",
        padding: "12px 24px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "500",
      },
    });
    return false;
  }
}

/**
 * Copy email address to clipboard
 */
export async function copyEmail(email: string): Promise<boolean> {
  return copyToClipboard(email, `${email} copied to clipboard`);
}

/**
 * Copy phone number to clipboard
 */
export async function copyPhone(phone: string): Promise<boolean> {
  return copyToClipboard(phone, `${phone} copied to clipboard`);
}
