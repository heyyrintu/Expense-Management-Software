// Policy flag chips.
//
// D2.1 moved the implementation to components/ui/policy-flag-chip.tsx, which
// reads the warning token instead of a raw amber and puts the rule text in a
// real Tooltip instead of a `title` attribute no keyboard user could reach.
// This module stays as the import path six screens already use, so the fix
// reached all of them without touching each one.
export {
  asFlags,
  PolicyFlagChip,
  PolicyFlagChips as FlagChips,
  ruleLabel,
  type FlagLike,
} from "@/components/ui/policy-flag-chip";
