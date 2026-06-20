/**
 * Password Strength Validation and Scoring
 */

export interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
}

export type PasswordStrength = "weak" | "fair" | "good" | "strong";

export function checkPasswordRequirements(
  password: string,
): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
}

export function calculatePasswordStrength(password: string): {
  strength: PasswordStrength;
  score: number;
  color: string;
  label: string;
} {
  if (password.length === 0) {
    return {
      strength: "weak",
      score: 0,
      color: "bg-slate-200",
      label: "Enter password",
    };
  }

  const requirements = checkPasswordRequirements(password);
  let score = 0;

  // Each requirement adds points
  if (requirements.minLength) score += 20;
  if (requirements.hasUppercase) score += 20;
  if (requirements.hasLowercase) score += 20;
  if (requirements.hasDigit) score += 20;
  if (requirements.hasSymbol) score += 20;

  // Determine strength level
  let strength: PasswordStrength;
  let color: string;
  let label: string;

  if (score <= 40) {
    strength = "weak";
    color = "bg-rose-500";
    label = "Weak";
  } else if (score <= 60) {
    strength = "fair";
    color = "bg-amber-500";
    label = "Fair";
  } else if (score <= 80) {
    strength = "good";
    color = "bg-blue-500";
    label = "Good";
  } else {
    strength = "strong";
    color = "bg-emerald-500";
    label = "Strong";
  }

  return { strength, score, color, label };
}

export function isPasswordValid(password: string): boolean {
  const requirements = checkPasswordRequirements(password);
  return Object.values(requirements).every((req) => req === true);
}
