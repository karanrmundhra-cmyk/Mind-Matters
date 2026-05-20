import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// FIX #10: Uniform recurrence options used across Reminders, Routines, CashFlow
export const RECURRENCE_OPTIONS = [
  { value: "never",      label: "Never" },
  { value: "daily",      label: "Daily" },
  { value: "weekly",     label: "Weekly" },
  { value: "biweekly",   label: "Every 2 Weeks" },
  { value: "monthly",    label: "Monthly" },
  { value: "bimonthly",  label: "Every 2 Months" },
  { value: "quarterly",  label: "Quarterly" },
  { value: "halfyearly", label: "Half-Yearly" },
  { value: "yearly",     label: "Yearly" },
  { value: "custom",     label: "+ Custom..." },
];

export const getRecurrenceLabel = (value) => {
  const option = RECURRENCE_OPTIONS.find((o) => o.value === value);
  return option ? option.label : "Never";
};

export const normalizeRecurrence = (value) => {
  const map = {
    "Daily": "daily",
    "Weekly": "weekly",
    "Monthly": "monthly",
    "Quarterly": "quarterly",
    "Half-Yearly": "halfyearly",
    "Half-yearly": "halfyearly",
    "Yearly": "yearly",
    "Every 2 Weeks": "biweekly",
    "Every 2 Months": "bimonthly",
    "Custom": "custom",
    "Never": "never",
  };
  return map[value] || value;
};
