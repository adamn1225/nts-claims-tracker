"use client";

import { Toaster } from "react-hot-toast";

export default function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        // Default options
        duration: 4000,
        style: {
          background: "#363636",
          color: "#fff",
        },

        // Default options for specific types
        success: {
          duration: 4000,
          style: {
            background: "#10B981",
            color: "#fff",
          },
          iconTheme: {
            primary: "#fff",
            secondary: "#10B981",
          },
        },
        error: {
          duration: 4000,
          style: {
            background: "#EF4444",
            color: "#fff",
          },
          iconTheme: {
            primary: "#fff",
            secondary: "#EF4444",
          },
        },
      }}
    />
  );
}
