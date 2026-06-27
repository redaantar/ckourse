import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  SparkleIcon as Sparkle,
  FolderPlusIcon as FolderPlus,
  PlugsConnectedIcon as PlugsConnected,
  IdentificationBadgeIcon as IdentificationBadge,
  UserPlusIcon as UserPlus,
  KeyIcon as Key,
  LockKeyIcon as LockKey,
  CheckCircleIcon as CheckCircle,
  ArrowLeftIcon as ArrowLeft,
  ArrowRightIcon as ArrowRight,
  ArrowSquareOutIcon as ArrowSquareOut,
  WarningIcon as Warning,
  QuestionIcon as Question,
  XIcon as X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/constants";

/** A value the user should type or click verbatim, shown as a mono chip. */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
      {children}
    </span>
  );
}

interface GuideAction {
  label: string;
  url: string;
}

interface GuideStep {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  instructions?: React.ReactNode[];
  actions?: GuideAction[];
  note?: React.ReactNode;
}

const STEPS: GuideStep[] = [
  {
    icon: <Sparkle className="size-5 text-primary" weight="fill" />,
    title: "Connect your Google Drive",
    blurb:
      "To let Ckourse read your Drive, Google asks you to create your own free key. It's a one-time setup and your files stay private to you — nobody else can use this key.",
    instructions: [
      <>Takes about 5 minutes, and you only do it once.</>,
      <>It's completely free — no credit card, no charges.</>,
      <>
        Along the way you'll copy <Pill>3 values</Pill> and paste them into
        Ckourse at the end.
      </>,
      <>
        First, make sure you're signed into your Google account in your web
        browser.
      </>,
    ],
  },
  {
    icon: <FolderPlus className="size-5 text-primary" weight="bold" />,
    title: "Create a project",
    blurb:
      "A project is just a container for your settings on Google's side. Give it any name you like.",
    actions: [
      {
        label: "Open Google Cloud",
        url: "https://console.cloud.google.com/projectcreate",
      },
    ],
    instructions: [
      <>
        In <Pill>Project name</Pill> type anything, e.g. <Pill>Ckourse</Pill>.
      </>,
      <>
        Click <Pill>Create</Pill> and wait a few seconds.
      </>,
      <>
        Make sure the new project is selected in the bar at the top of the page
        before moving on.
      </>,
    ],
  },
  {
    icon: <PlugsConnected className="size-5 text-primary" weight="bold" />,
    title: "Turn on two services",
    blurb:
      "Tell Google you want to use Drive and its file picker. Open each link below and click the blue Enable button.",
    actions: [
      {
        label: "Enable Google Drive API",
        url: "https://console.cloud.google.com/apis/library/drive.googleapis.com",
      },
      {
        label: "Enable Google Picker API",
        url: "https://console.cloud.google.com/apis/library/picker.googleapis.com",
      },
    ],
    instructions: [
      <>
        On each page, click <Pill>Enable</Pill>.
      </>,
      <>
        If a page already says <Pill>Manage</Pill> instead, it's on — you're
        good.
      </>,
    ],
  },
  {
    icon: <IdentificationBadge className="size-5 text-primary" weight="bold" />,
    title: "Set up the sign-in screen",
    blurb:
      "This is the screen you'll see when you connect. You just fill in a couple of fields.",
    actions: [
      {
        label: "Open sign-in setup",
        url: "https://console.cloud.google.com/auth/overview",
      },
    ],
    instructions: [
      <>
        Click <Pill>Get started</Pill>.
      </>,
      <>
        App name: type anything, e.g. <Pill>Ckourse</Pill>. Support email: pick
        your own email.
      </>,
      <>
        For audience, choose <Pill>External</Pill>.
      </>,
      <>
        Enter your email again as the contact, agree to the policy, then click
        <Pill>Create</Pill>.
      </>,
    ],
  },
  {
    icon: <UserPlus className="size-5 text-primary" weight="bold" />,
    title: "Add yourself as a test user",
    blurb: "This tells Google to let you — and only you — use your new key.",
    actions: [
      {
        label: "Open Audience page",
        url: "https://console.cloud.google.com/auth/audience",
      },
    ],
    instructions: [
      <>
        Scroll to <Pill>Test users</Pill> and click <Pill>Add users</Pill>.
      </>,
      <>Type your own Google email address.</>,
      <>
        Click <Pill>Save</Pill>.
      </>,
    ],
    note: (
      <>
        Because this stays in test mode (which keeps it free), you'll need to
        press Connect again about once a week. That's normal.
      </>
    ),
  },
  {
    icon: <Key className="size-5 text-primary" weight="bold" />,
    title: "Get values 1 & 2",
    blurb:
      "Now create the Client ID and Client secret — the first two of your three values.",
    actions: [
      {
        label: "Open Clients page",
        url: "https://console.cloud.google.com/auth/clients",
      },
    ],
    instructions: [
      <>
        Click <Pill>Create client</Pill>.
      </>,
      <>
        For application type, choose <Pill>Desktop app</Pill>. Name it anything.
      </>,
      <>
        Click <Pill>Create</Pill>. A box pops up showing your{" "}
        <Pill>Client ID</Pill> and <Pill>Client secret</Pill> — copy both
        somewhere safe.
      </>,
    ],
    note: <>You can reopen the client later if you need to see these again.</>,
  },
  {
    icon: <LockKey className="size-5 text-primary" weight="bold" />,
    title: "Get value 3",
    blurb: "Last one: the API key, which powers the folder picker.",
    actions: [
      {
        label: "Open Credentials page",
        url: "https://console.cloud.google.com/apis/credentials",
      },
    ],
    instructions: [
      <>
        Click <Pill>Create credentials</Pill>, then <Pill>API key</Pill>.
      </>,
      <>
        Copy the key that appears (it starts with <Pill>AIza…</Pill>).
      </>,
      <>You can close the dialog after copying.</>,
    ],
  },
  {
    icon: <CheckCircle className="size-5 text-primary" weight="fill" />,
    title: "You're all set!",
    blurb:
      "You now have your three values. Close this guide and paste each one into its box below.",
    instructions: [
      <>
        Paste your <Pill>Client ID</Pill>, <Pill>Client secret</Pill>, and{" "}
        <Pill>API key</Pill> into the matching fields.
      </>,
      <>
        Click <Pill>Save credentials</Pill>, then <Pill>Connect</Pill>.
      </>,
      <>A browser window opens — approve access and you're done.</>,
    ],
  },
];

export function DriveSetupGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const close = () => {
    setOpen(false);
    setStep(0);
  };

  // While open: close on Escape and lock background scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setStep(0);
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5",
          "text-left font-sans text-sm transition-colors hover:bg-primary/20",
        )}
      >
        <span className="flex items-center gap-2.5">
          <Question className="size-4 shrink-0 text-primary" weight="bold" />
          <span>
            <span className="font-medium text-foreground">
              First time? Follow the step-by-step guide
            </span>
            <span className="block text-xs text-muted-foreground">
              Get your 3 values in ~5 minutes — no tech skills needed
            </span>
          </span>
        </span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={close}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="drive-guide-title"
              className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              style={{ animation: `card-in 250ms ${EASE_OUT} both` }}
            >
              {/* Progress bar */}
              <div className="h-1 w-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="max-h-[80vh] overflow-y-auto p-6">
                <button
                  onClick={close}
                  className="absolute right-4 top-5 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Close guide"
                >
                  <X className="size-4" />
                </button>

                {/* Header */}
                <div className="mb-4 flex items-center gap-3 pr-8">
                  <div className="squircle flex size-10 shrink-0 items-center justify-center bg-primary/15">
                    {current.icon}
                  </div>
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      Step {step + 1} of {STEPS.length}
                    </div>
                    <h3
                      id="drive-guide-title"
                      className="font-heading text-lg font-bold text-foreground"
                    >
                      {current.title}
                    </h3>
                  </div>
                </div>

                {/* Blurb */}
                <p className="mb-4 font-sans text-sm leading-relaxed text-muted-foreground">
                  {current.blurb}
                </p>

                {/* Action buttons (open in browser) */}
                {current.actions && (
                  <div className="mb-4 flex flex-col gap-2">
                    {current.actions.map((action) => (
                      <button
                        key={action.url}
                        onClick={() => void openUrl(action.url).catch(() => {})}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5",
                          "font-sans text-sm font-medium text-foreground transition-colors hover:bg-primary/20",
                        )}
                      >
                        {action.label}
                        <ArrowSquareOut
                          className="size-4 shrink-0 text-primary"
                          weight="bold"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Numbered instructions */}
                {current.instructions && (
                  <ol className="mb-4 flex flex-col gap-2.5">
                    {current.instructions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-bold text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="font-sans text-sm leading-relaxed text-foreground">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {/* Note callout */}
                {current.note && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-info/20 bg-info/10 px-3 py-2.5">
                    <Warning
                      className="mt-0.5 size-4 shrink-0 text-info"
                      weight="fill"
                    />
                    <p className="font-sans text-xs leading-relaxed text-muted-foreground">
                      {current.note}
                    </p>
                  </div>
                )}

                {/* Footer navigation */}
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    disabled={isFirst}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-2 font-sans text-sm font-medium transition-colors",
                      isFirst
                        ? "cursor-not-allowed text-muted-foreground/30"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </button>

                  {isLast ? (
                    <button
                      onClick={close}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-sans text-sm font-semibold text-primary-foreground",
                        "transition-colors hover:bg-primary/90",
                      )}
                    >
                      <CheckCircle className="size-4" weight="bold" />
                      Done
                    </button>
                  ) : (
                    <button
                      onClick={() => setStep((s) => s + 1)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-sans text-sm font-semibold text-primary-foreground",
                        "transition-colors hover:bg-primary/90",
                      )}
                    >
                      Next
                      <ArrowRight className="size-4" weight="bold" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
