import { useEffect, useState } from "react";
import {
  X,
  Palette,
  Pipette,
  FlaskConical,
  GraduationCap,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useOnboardingOpen, closeOnboarding } from "@/hooks/useOnboarding";
import { Button } from "@/components/ui/button";

// First-run guided intro (also re-openable from Help). Shows once, then
// remembers via localStorage. A few short steps pointing at the main tools.
export function Onboarding() {
  const { t } = useT();
  const open = useOnboardingOpen();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeOnboarding();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const steps = [
    { icon: Palette, title: t("onboarding.s1Title"), body: t("onboarding.s1Body") },
    { icon: Pipette, title: t("onboarding.s2Title"), body: t("onboarding.s2Body") },
    { icon: FlaskConical, title: t("onboarding.s3Title"), body: t("onboarding.s3Body") },
    { icon: GraduationCap, title: t("onboarding.s4Title"), body: t("onboarding.s4Body") },
  ];
  const cur = steps[step];
  const Icon = cur.icon;
  const last = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h3 className="font-semibold">{t("onboarding.title")}</h3>
          <Button variant="ghost" size="icon" onClick={closeOnboarding}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-5 py-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Icon className="h-6 w-6" />
          </div>
          <h4 className="mb-1 text-lg font-semibold">{cur.title}</h4>
          <p className="text-sm text-muted-foreground">{cur.body}</p>

          <div className="mt-5 flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (i === step ? "w-5 bg-accent" : "w-1.5 bg-border")
                }
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-5 py-3">
          <button
            onClick={closeOnboarding}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t("onboarding.skip")}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
              >
                {t("onboarding.back")}
              </Button>
            )}
            <Button
              variant="accent"
              size="sm"
              onClick={() => (last ? closeOnboarding() : setStep((s) => s + 1))}
            >
              {last ? t("onboarding.start") : t("onboarding.next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
