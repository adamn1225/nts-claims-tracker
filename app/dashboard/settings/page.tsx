"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Info,
  Bell,
  Mail,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  User,
  Check,
  ShieldCheck,
  PhoneOutgoing,
  ExternalLink,
  Smartphone,
  Monitor,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  checkPasswordRequirements,
  calculatePasswordStrength,
  isPasswordValid,
} from "@/lib/password-strength";
import NotificationSettings from "@/components/NotificationSettings";

const reminderOptions = [
  {
    key: "same_day",
    label: "Same Day (Morning)",
    description: "8:00 AM on the day of the task",
  },
  {
    key: "1_day",
    label: "1 Day Before",
    description: "24 hours before due time",
  },
  {
    key: "2_day",
    label: "2 Days Before",
    description: "48 hours before due time",
  },
  {
    key: "3_day",
    label: "3 Days Before",
    description: "72 hours before due time",
  },
  {
    key: "1_week",
    label: "1 Week Before",
    description: "7 days before due time",
  },
];

// Time-based reminders (in minutes)
const timeBasedReminderOptions = [
  {
    key: "10_min",
    label: "10 Minutes Before",
    description: "Short notice reminder",
  },
  {
    key: "15_min",
    label: "15 Minutes Before",
    description: "Quick heads-up",
  },
  {
    key: "30_min",
    label: "30 Minutes Before",
    description: "Half-hour warning",
  },
  {
    key: "1_hour",
    label: "1 Hour Before",
    description: "Hour advance notice",
  },
];

const notificationTypes = [
  {
    key: "task_reminders",
    label: "Task Reminders",
    description: "Notifications for upcoming tasks",
  },
  {
    key: "customer_updates",
    label: "Customer Updates",
    description: "When customers change status or are updated",
  },
  {
    key: "follow_up_reminders",
    label: "Follow-up Reminders",
    description: "Reminders for scheduled customer follow-ups",
  },
  {
    key: "overdue_alerts",
    label: "Overdue Alerts",
    description: "Alerts when tasks become overdue",
  },
  {
    key: "daily_digest",
    label: "Daily Digest",
    description: "Daily summary of tasks and follow-ups",
  },
];

// US timezones used for scheduling digests, reminders, and overdue checks.
// Values are IANA timezone names; labels are teamMember-friendly.
const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const todayIso = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState<string>(todayIso);
  const [time, setTime] = useState<string>("09:00");
  const [isSaving, setIsSaving] = useState(false);

  // Handle GoTo OAuth callback results
  useEffect(() => {
    const gotoConnected = searchParams.get("goto_connected");
    const gotoError = searchParams.get("goto_error");
    const sessionExpired = searchParams.get("session_expired");

    if (gotoConnected === "true") {
      if (sessionExpired === "true") {
        toast.success(
          "GoTo Connect account connected successfully! (Your session expired during setup, but everything worked.)",
          { duration: 5000 }
        );
      } else {
        toast.success("GoTo Connect account connected successfully!");
      }
      setGotoConnected(true);
      // Clean URL
      router.replace("/dashboard/settings");
    } else if (gotoError) {
      const messages: Record<string, string> = {
        access_denied: "GoTo authorization was denied.",
        token_exchange_failed: "GoTo authorization failed. Please try again.",
        state_mismatch: "GoTo authorization failed: security check failed.",
        save_failed: "GoTo connected but failed to save. Please try again.",
        network_error: "Network error connecting GoTo. Please try again.",
        not_configured: "GoTo Connect is not configured on this server.",
      };
      toast.error(messages[gotoError] || "GoTo authorization failed.");
      router.replace("/dashboard/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Account for sticky header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  // User Info State
  const [userEmail, setUserEmail] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [officeLocation, setOfficeLocation] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isManager, setIsManager] = useState<boolean>(false);
  const [userLoading, setUserLoading] = useState(true);

  // Password Change State
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(
    null,
  );
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetEmailLoading, setResetEmailLoading] = useState(false);

  // Simplified Notifications
  const [inAppNotificationsEnabled, setInAppNotificationsEnabled] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false);
  const [digestTime, setDigestTime] = useState("08:00");
  const [timezone, setTimezone] = useState("America/New_York");

  // Microsoft Integration
  const [microsoftIntegrationEnabled, setMicrosoftIntegrationEnabled] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);

  // GoTo Connect Integration
  const [gotoConnected, setGotoConnected] = useState(false);
  const [gotoLoading, setGotoLoading] = useState(false);
  const [gotoConnectedAt, setGotoConnectedAt] = useState<string | null>(null);
  const [gotoDevices, setGotoDevices] = useState<any[]>([]);
  const [gotoDevicesLoading, setGotoDevicesLoading] = useState(false);
  const [gotoPreferredDeviceId, setGotoPreferredDeviceId] = useState<string | null>(null);

  // Fetch user info and preferences on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/auth/login");
          return;
        }

        setUserEmail(user.email || "");

        const { data: teamMember, error } = await supabase
          .from("team_members")
          .select(
            "first_name, last_name, office_location, is_admin, is_manager",
          )
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Failed to fetch team member info:", error);
        } else if (teamMember) {
          setFirstName(teamMember.first_name || "");
          setLastName(teamMember.last_name || "");
          setOfficeLocation(teamMember.office_location || "");
          setIsAdmin(teamMember.is_admin ?? false);
          setIsManager(teamMember.is_manager ?? false);
        }

        // Fetch user preferences
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          const response = await fetch("/api/user-preferences", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (response.ok) {
            const prefs = await response.json();
            setInAppNotificationsEnabled(prefs.inAppNotificationsEnabled ?? false);
            setEmailNotificationsEnabled(prefs.emailNotificationsEnabled ?? false);
            setDailyDigestEnabled(prefs.dailyDigestEnabled ?? false);
            setDigestTime(prefs.digestTime || "08:00");
            // Use the saved timezone; if none, fall back to the browser's
            // detected timezone so new teamMembers get a sensible default.
            const detectedTz =
              Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
            setTimezone(prefs.timezone || detectedTz);
            setMicrosoftIntegrationEnabled(prefs.microsoftIntegrationEnabled ?? false);
          }
        }

        // Check if Microsoft account is connected
        const { data: msTokens } = await supabase
          .from('microsoft_tokens')
          .select('id')
          .eq('team_member_id', user.id)
          .single();

        setMicrosoftConnected(!!msTokens);

        // Check if GoTo Connect account is connected
        const { data: gotoConn } = await supabase
          .from('goto_connections')
          .select('created_at, preferred_device_id')
          .eq('user_id', user.id)
          .maybeSingle();

        setGotoConnected(!!gotoConn);
        setGotoConnectedAt(gotoConn?.created_at || null);
        setGotoPreferredDeviceId(gotoConn?.preferred_device_id || null);

        // Load devices if connected
        if (gotoConn) {
          fetchGotoDevices();
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
      } finally {
        setUserLoading(false);
      }
    };

    fetchUserInfo();
  }, [supabase, router]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Get the current session from Supabase
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Authentication failed. Please log in again.");
        setIsSaving(false);
        router.push("/auth/login");
        return;
      }

      const response = await fetch("/api/user-preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          inAppNotificationsEnabled,
          emailNotificationsEnabled,
          dailyDigestEnabled,
          digestTime,
          timezone,
          microsoftIntegrationEnabled,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to save settings");
        return;
      }

      toast.success("Settings saved successfully!");
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Error saving settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeLoading(true);
    setPasswordChangeError(null);
    setPasswordChangeSuccess(false);



    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError("New passwords do not match");
      setPasswordChangeLoading(false);
      return;
    }

    try {
      // First verify current password by attempting to sign in
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error("No authenticated user found");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordChangeError("Current password is incorrect");
        setPasswordChangeLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setPasswordChangeSuccess(true);
      toast.success("Password changed successfully!");

      // Reset form
      setTimeout(() => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        setShowPasswordSection(false);
        setPasswordChangeSuccess(false);
      }, 2000);
    } catch (err: any) {
      setPasswordChangeError(err.message || "Failed to change password");
      toast.error("Failed to change password");
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    setResetEmailLoading(true);
    setPasswordChangeError(null);
    setResetEmailSent(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        throw new Error("No authenticated user found");
      }

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast.success("Password reset email sent! Check your inbox.");

      // Close the password section after a delay
      setTimeout(() => {
        setShowPasswordSection(false);
        setResetEmailSent(false);
      }, 5000);
    } catch (err: any) {
      setPasswordChangeError(err.message || "Failed to send reset email");
      toast.error("Failed to send reset email");
    } finally {
      setResetEmailLoading(false);
    }
  };

  const handleConnectMicrosoft = async () => {
    setMicrosoftLoading(true);
    try {
      // Redirect to Microsoft OAuth flow
      window.location.href = '/api/microsoft/connect';
    } catch (error) {
      console.error('Error connecting Microsoft:', error);
      toast.error('Failed to connect Microsoft account');
      setMicrosoftLoading(false);
    }
  };

  const handleConnectGoTo = () => {
    // Redirect to GoTo OAuth flow
    window.location.href = '/api/goto/auth';
  };

  const handleDisconnectGoTo = async () => {
    if (!confirm('Disconnect your GoTo Connect account? Click-to-call will stop working.')) return;
    setGotoLoading(true);
    try {
      const response = await fetch('/api/goto/disconnect', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to disconnect');
      setGotoConnected(false);
      setGotoConnectedAt(null);
      setGotoDevices([]);
      setGotoPreferredDeviceId(null);
      toast.success('GoTo Connect account disconnected');
    } catch (error) {
      console.error('Error disconnecting GoTo:', error);
      toast.error('Failed to disconnect GoTo account');
    } finally {
      setGotoLoading(false);
    }
  };

  const fetchGotoDevices = async () => {
    setGotoDevicesLoading(true);
    try {
      const response = await fetch('/api/goto/devices');
      if (!response.ok) throw new Error('Failed to fetch devices');
      const data = await response.json();
      setGotoDevices(data.devices || []);
    } catch (error) {
      console.error('Error fetching GoTo devices:', error);
      toast.error('Failed to load GoTo devices');
    } finally {
      setGotoDevicesLoading(false);
    }
  };

  const handleSetPreferredDevice = async (deviceId: string | null) => {
    try {
      const response = await fetch('/api/goto/set-preferred-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });

      if (!response.ok) throw new Error('Failed to set preferred device');

      setGotoPreferredDeviceId(deviceId);
      toast.success(deviceId ? 'Preferred device updated' : 'Device preference cleared');
    } catch (error) {
      console.error('Error setting preferred device:', error);
      toast.error('Failed to update device preference');
    }
  };

  const handleDisconnectMicrosoft = async () => {
    if (!confirm('Are you sure you want to disconnect your Microsoft account? This will stop syncing tasks to Outlook Calendar.')) {
      return;
    }

    setMicrosoftLoading(true);
    try {
      const response = await fetch('/api/microsoft/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setMicrosoftConnected(false);
      setMicrosoftIntegrationEnabled(false);
      toast.success('Microsoft account disconnected');
    } catch (error) {
      console.error('Error disconnecting Microsoft:', error);
      toast.error('Failed to disconnect Microsoft account');
    } finally {
      setMicrosoftLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Account Settings
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your account, security, and notification preferences
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex gap-8">
          {/* Side Navigation */}


          {/* Main Content */}
          <div className="flex-1 space-y-8">
            {/* Personal Section */}
            <section id="personal" className="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
                <User className="h-5 w-5 text-orange-500" />
                Account Information
              </div>

              {userLoading ? (
                <div className="text-sm text-slate-500">
                  Loading account information...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Avatar and Name */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#E85D04] text-white flex items-center justify-center text-xl font-semibold shrink-0">
                      {firstName.charAt(0).toUpperCase()}
                      {lastName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-slate-800">
                        {firstName} {lastName}
                      </div>
                      <div className="text-sm text-slate-600">{userEmail}</div>
                    </div>
                  </div>

                  {/* Account Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                        Office Location
                      </div>
                      <div className="text-sm font-medium text-slate-800">
                        {officeLocation || "Not specified"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                        Role
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {isAdmin
                            ? "Administrator"
                            : isManager
                              ? "Manager"
                              : "TeamMember"}
                        </span>
                        {isAdmin && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                            Admin
                          </span>
                        )}
                        {isManager && !isAdmin && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            Manager
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* GoTo Connect Integration Section */}
            <section id="goto-integration" className="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
                <PhoneOutgoing className="h-5 w-5 text-orange-500" />
                GoTo Connect
              </div>
              <p className="mb-6 text-sm text-slate-600">
                Connect your GoTo Connect account to place click-to-call sessions from inside NTS Claims Tracker.
              </p>

              {gotoConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <Check className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-green-900">GoTo Connect account connected</p>
                        {gotoConnectedAt && (
                          <p className="text-sm text-green-700">
                            Connected {new Date(gotoConnectedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleDisconnectGoTo}
                      disabled={gotoLoading}
                      className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {gotoLoading ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <PhoneOutgoing className="h-4 w-4 shrink-0" />
                    <span>GoTo Connect is ready. Click-to-call is available from claim and party phone numbers.</span>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">
                        Preferred Device
                      </label>
                      {gotoDevicesLoading && (
                        <span className="text-xs text-slate-500">Loading devices...</span>
                      )}
                    </div>
                    <p className="mb-4 text-xs text-slate-600">
                      Choose which device rings when you click-to-call (your desk phone, mobile app, or desktop app).
                    </p>

                    {gotoDevices.length > 0 ? (
                      <div className="space-y-3 flex flex-col items-start w-full">
                        <div className="flex items-stretch justify-evenly gap-3 w-full">
                          <button
                            onClick={() => handleSetPreferredDevice(null)}
                            className={`w-full flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all ${!gotoPreferredDeviceId
                                ? 'border-orange-500 bg-orange-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                              }`}
                          >
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${!gotoPreferredDeviceId
                                ? 'border-orange-500 bg-orange-500'
                                : 'border-slate-300 bg-white'
                              }`}>
                              {!gotoPreferredDeviceId && (
                                <div className="h-2 w-2 rounded-full bg-white"></div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm text-slate-900">Auto (first available)</div>
                              <div className="text-xs text-slate-600">Ring the first device that's online</div>
                            </div>
                          </button>

                          {gotoDevices.map((device) => (
                            <button
                              key={device.id}
                              onClick={() => handleSetPreferredDevice(device.id)}
                              className={`w-full flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all ${gotoPreferredDeviceId === device.id
                                  ? 'border-orange-500 bg-orange-50 shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${gotoPreferredDeviceId === device.id
                                  ? 'border-orange-500 bg-orange-500'
                                  : 'border-slate-300 bg-white'
                                }`}>
                                {gotoPreferredDeviceId === device.id && (
                                  <div className="h-2 w-2 rounded-full bg-white"></div>
                                )}
                              </div>
                              {device.mobile ? (
                                <Smartphone className="h-5 w-5 shrink-0 text-orange-500" />
                              ) : (
                                <Monitor className="h-5 w-5 shrink-0 text-slate-500" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-slate-900 truncate">{device.name}</div>
                                <div className="text-xs text-slate-600">
                                  {device.type || (device.mobile ? 'Mobile' : 'Desktop')}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={fetchGotoDevices}
                          disabled={gotoDevicesLoading}
                          className="text-xs text-slate-600 hover:text-slate-900 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          Refresh devices
                        </button>
                      </div>
                    ) : gotoDevicesLoading ? (
                      <div className="text-sm text-slate-500">Loading your devices...</div>
                    ) : (
                      <div className="text-sm text-slate-500">
                        No devices found. Make sure GoTo Connect app is running.
                        <button
                          onClick={fetchGotoDevices}
                          className="ml-2 text-orange-600 hover:text-orange-700"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-700 mb-3">Connect your GoTo Connect account to:</p>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-start gap-2">
                        <PhoneOutgoing className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <span><strong>Click-to-call</strong> — one tap calls the customer through your GoTo desk phone</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <span><strong>Auto-detect outcomes</strong> — answered, no-answer, and voicemail detected automatically</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Bell className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <span><strong>Session-based dialing</strong> — work through call queues without switching apps</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={handleConnectGoTo}
                    disabled={gotoLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
                  >
                    <PhoneOutgoing className="h-5 w-5 text-orange-500" />
                    {gotoLoading ? 'Connecting...' : 'Connect GoTo Connect Account'}
                  </button>

                  <p className="text-xs text-slate-500 text-center">
                    You need a GoTo Connect account and OAuth credentials configured by your administrator.
                  </p>
                </div>
              )}
            </section>

            {/* Notifications Section */}
            <section id="notifications" className="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
                <Bell className="h-5 w-5 text-orange-500" />
                Notifications
              </div>
              <p className="mb-6 text-sm text-slate-600">
                Control how you receive notifications about tasks, customers, and follow-ups
              </p>

              <div className="space-y-4">
                {/* Timezone — drives digest, reminders, and overdue timing */}
                <div className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">Your Timezone</div>
                      <div className="text-sm text-slate-600">
                        Task reminders, overdue alerts, and your daily digest are
                        scheduled in this timezone
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 sm:mt-0">
                      <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="rounded-md border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:ring-orange-500"
                      >
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <option key={tz.value} value={tz.value}>
                            {tz.label}
                          </option>
                        ))}
                        {/* Preserve a saved value that isn't in the common list */}
                        {!TIMEZONE_OPTIONS.some((tz) => tz.value === timezone) && (
                          <option value={timezone}>{timezone}</option>
                        )}
                      </select>
                    </div>
                  </div>
                  {(() => {
                    const detectedTz =
                      typeof Intl !== "undefined"
                        ? Intl.DateTimeFormat().resolvedOptions().timeZone
                        : "";
                    if (detectedTz && detectedTz !== timezone) {
                      return (
                        <button
                          type="button"
                          onClick={() => setTimezone(detectedTz)}
                          className="mt-2 text-xs font-medium text-orange-600 hover:text-orange-700"
                        >
                          Use detected timezone ({detectedTz})
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* In-App Notifications */}
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={inAppNotificationsEnabled}
                    onChange={(e) => setInAppNotificationsEnabled(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">
                      In-App Notifications
                    </div>
                    <div className="text-sm text-slate-600">
                      Show notifications within the app for tasks, reminders, and updates
                    </div>
                  </div>
                </label>

                {/* Email Notifications */}
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={emailNotificationsEnabled}
                    onChange={(e) => setEmailNotificationsEnabled(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">
                      Email Notifications
                    </div>
                    <div className="text-sm text-slate-600">
                      Receive email alerts for important tasks and reminders
                    </div>
                  </div>
                </label>

                {/* Daily Digest Email */}
                <div className="rounded-lg border border-slate-200 px-4 py-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dailyDigestEnabled}
                      onChange={(e) => setDailyDigestEnabled(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">
                        Daily Digest Email
                      </div>
                      <div className="text-sm text-slate-600">
                        Receive a daily summary of your tasks and follow-ups
                      </div>
                    </div>
                  </label>

                  {dailyDigestEnabled && (
                    <div className="mt-3 ml-8 flex flex-wrap items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <label className="text-sm text-slate-600">Send at:</label>
                      <input
                        type="time"
                        value={digestTime}
                        onChange={(e) => setDigestTime(e.target.value)}
                        className="rounded-md border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-xs text-slate-500">
                        in your timezone (
                        {TIMEZONE_OPTIONS.find((tz) => tz.value === timezone)?.label ||
                          timezone}
                        )
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Browser Notifications Section */}
            <section id="browser-notifications" className="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
                <Bell className="h-5 w-5 text-orange-500" />
                Browser Notifications
              </div>
              <p className="mb-6 text-sm text-slate-600">
                Enable desktop notifications to get instant alerts even when the app is in the background
              </p>
              <NotificationSettings />
            </section>

            {/* Microsoft Integration Section */}
            <section id="microsoft-integration" className="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
                <svg className="h-5 w-5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
                </svg>
                Microsoft Integration (Optional)
              </div>

              <p className="mb-6 text-sm text-slate-600">
                Connect your Microsoft account to sync tasks to Outlook Calendar and generate Teams meeting links.
              </p>

              {microsoftConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-green-900">Microsoft account connected</p>
                        <p className="text-sm text-green-700">Tasks will sync to Outlook Calendar</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDisconnectMicrosoft}
                      disabled={microsoftLoading}
                      className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {microsoftLoading ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 p-4 transition-all hover:bg-slate-50">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">Auto-sync tasks to Outlook Calendar</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Automatically create calendar events when you create tasks
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={microsoftIntegrationEnabled}
                        onChange={(e) => setMicrosoftIntegrationEnabled(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                      />
                    </label>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">Available Features:</p>
                    <ul className="space-y-1 text-sm text-blue-800">
                      <li className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Sync tasks to Outlook Calendar
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Generate Teams meeting links for customer calls
                      </li>
                      <li className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Keep all your appointments in one place
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-700 mb-3">
                      By connecting your Microsoft account, you can:
                    </p>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-start gap-2">
                        <svg className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span><strong>Sync tasks to Outlook Calendar</strong> - Never miss a follow-up with automatic calendar events</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span><strong>Generate Teams meeting links</strong> - One-click virtual meeting setup for customer calls</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span><strong>Secure OAuth connection</strong> - We never see your Microsoft password</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={handleConnectMicrosoft}
                    disabled={microsoftLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
                    </svg>
                    {microsoftLoading ? 'Connecting...' : 'Connect Microsoft Account'}
                  </button>

                  <p className="text-xs text-slate-500 text-center">
                    Optional - you can continue using the app without Microsoft integration
                  </p>
                </div>
              )}
            </section>

            {/* Security Section */}
            <section id="security" className="scroll-mt-20 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
                <ShieldCheck className="h-5 w-5 text-orange-500" />
                Security
              </div>

              {!showPasswordSection ? (
                <button
                  onClick={() => setShowPasswordSection(true)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Lock className="h-4 w-4" />
                  Change Password
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">
                      Change Your Password
                    </h3>
                    <button
                      onClick={() => {
                        setShowPasswordSection(false);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmNewPassword("");
                        setPasswordChangeError(null);
                        setPasswordChangeSuccess(false);
                      }}
                      className="text-sm text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>

                  {passwordChangeSuccess && (
                    <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                      <div className="text-sm text-emerald-800">
                        <p className="font-semibold mb-1">Password changed!</p>
                        <p>Your password has been successfully updated.</p>
                      </div>
                    </div>
                  )}

                  {passwordChangeError && (
                    <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <p>{passwordChangeError}</p>
                    </div>
                  )}

                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    {/* Current Password */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Current Password
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Lock className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          disabled={passwordChangeLoading || passwordChangeSuccess}
                          required
                          className="block w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-10 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:bg-slate-50"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          disabled={passwordChangeLoading || passwordChangeSuccess}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendResetEmail}
                        disabled={resetEmailLoading || resetEmailSent}
                        className="mt-2 text-sm text-orange-600 hover:text-orange-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resetEmailLoading ? "Sending email..." : resetEmailSent ? "✓ Reset email sent!" : "Forgot your current password?"}
                      </button>
                    </div>

                    {resetEmailSent && (
                      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <AlertCircle className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-semibold mb-1">Password reset email sent</p>
                          <p>Check your inbox ({userEmail}) for a link to reset your password.</p>
                        </div>
                      </div>
                    )}

                    {/* New Password */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Lock className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={passwordChangeLoading || passwordChangeSuccess}
                          required
                          className="block w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-10 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:bg-slate-50"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          disabled={passwordChangeLoading || passwordChangeSuccess}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* Password Strength Meter */}
                      {newPassword && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-700">
                              Password Strength
                            </span>
                            <span
                              className={`text-xs font-semibold ${calculatePasswordStrength(newPassword).score <= 40
                                  ? "text-rose-600"
                                  : calculatePasswordStrength(newPassword).score <= 60
                                    ? "text-amber-600"
                                    : calculatePasswordStrength(newPassword).score <= 80
                                      ? "text-blue-600"
                                      : "text-emerald-600"
                                }`}
                            >
                              {calculatePasswordStrength(newPassword).label}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full transition-all duration-300 ${calculatePasswordStrength(newPassword).color}`}
                              style={{
                                width: `${calculatePasswordStrength(newPassword).score}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Password Requirements Checklist */}
                      {newPassword && (
                        <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                          <p className="mb-1.5 text-xs font-semibold text-slate-700">
                            Password must contain:
                          </p>
                          {[
                            {
                              key: "minLength",
                              label: "At least 8 characters",
                              met: checkPasswordRequirements(newPassword).minLength,
                            },
                            {
                              key: "hasUppercase",
                              label: "One uppercase letter (A-Z)",
                              met: checkPasswordRequirements(newPassword).hasUppercase,
                            },
                            {
                              key: "hasLowercase",
                              label: "One lowercase letter (a-z)",
                              met: checkPasswordRequirements(newPassword).hasLowercase,
                            },
                            {
                              key: "hasDigit",
                              label: "One number (0-9)",
                              met: checkPasswordRequirements(newPassword).hasDigit,
                            },
                            {
                              key: "hasSymbol",
                              label: "One symbol (!@#$%...)",
                              met: checkPasswordRequirements(newPassword).hasSymbol,
                            },
                          ].map((req) => (
                            <div key={req.key} className="flex items-center gap-1.5 text-xs">
                              {req.met ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <X className="h-3 w-3 text-slate-400" />
                              )}
                              <span className={req.met ? "text-emerald-700" : "text-slate-600"}>
                                {req.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Confirm New Password */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Lock className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type={showConfirmNewPassword ? "text" : "password"}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          disabled={passwordChangeLoading || passwordChangeSuccess}
                          required
                          className="block w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-10 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:bg-slate-50"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                          disabled={passwordChangeLoading || passwordChangeSuccess}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                        >
                          {showConfirmNewPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {confirmNewPassword && newPassword !== confirmNewPassword && (
                        <p className="mt-1 text-xs text-rose-600">
                          Passwords do not match
                        </p>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={passwordChangeLoading || passwordChangeSuccess}
                      className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {passwordChangeLoading ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : passwordChangeSuccess ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Password Updated
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Update Password
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </section>

            {/* Action Buttons */}
            <div className="sticky bottom-0 z-10 mt-8 border-t border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-4 -mx-4 sm:-mx-6">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 min-w-35"
                >
                  {isSaving ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 min-w-25"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageContent />
    </Suspense>
  );
}
