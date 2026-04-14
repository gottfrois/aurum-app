import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import type { ReactNode } from "react";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
} from "~/components/reui/timeline";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";

export interface TimelineEntry {
  id: string;
  timestamp: number;
  event: string;
  actorType: "user" | "system" | "agent";
  actorName?: string;
  actorAvatarUrl?: string;
  metadata: string;
  resourceType?: string;
}

function CategoryBadge({ label, color }: { label: string; color?: string }) {
  return (
    <Badge variant="outline" className="inline-badge rounded-md">
      <span
        className="mr-1 inline-block size-2 rounded-full"
        style={{ backgroundColor: color ?? "currentColor" }}
      />
      {label}
    </Badge>
  );
}

function LabelBadge({ name, color }: { name: string; color: string }) {
  return (
    <Badge
      variant="secondary"
      className="inline-badge gap-1 px-2 py-0.5 text-xs"
      style={{
        backgroundColor: `${color}20`,
        color,
        borderColor: `${color}40`,
      }}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </Badge>
  );
}

// Human-readable action descriptions — written so they read naturally after
// the actor name, e.g. "Alice updated labels (2 labels)" or "Bunkr synced
// 15 new and 8 updated transactions from bank".
function formatLabelDiff(m: Record<string, unknown>): ReactNode {
  const added = m.addedLabels as
    | Array<{ name: string; color: string }>
    | undefined;
  const removed = m.removedLabels as
    | Array<{ name: string; color: string }>
    | undefined;
  // Fallback to legacy string-only format
  const addedNames = m.addedLabelNames as string[] | undefined;
  const removedNames = m.removedLabelNames as string[] | undefined;

  const parts: ReactNode[] = [];

  if (added?.length) {
    parts.push(
      <span key="added">
        added{" "}
        {added.map((l, i) => (
          <span key={l.name}>
            {i > 0 && ", "}
            <LabelBadge name={l.name} color={l.color} />
          </span>
        ))}
      </span>,
    );
  } else if (addedNames?.length) {
    parts.push(
      <span key="added">
        added {addedNames.map((n) => `"${n}"`).join(", ")}
      </span>,
    );
  }

  if (removed?.length) {
    parts.push(
      <span key="removed">
        removed{" "}
        {removed.map((l, i) => (
          <span key={l.name}>
            {i > 0 && ", "}
            <LabelBadge name={l.name} color={l.color} />
          </span>
        ))}
      </span>,
    );
  } else if (removedNames?.length) {
    parts.push(
      <span key="removed">
        removed {removedNames.map((n) => `"${n}"`).join(", ")}
      </span>,
    );
  }

  if (parts.length === 2) {
    return (
      <>
        {parts[0]} and {parts[1]}
      </>
    );
  }
  if (parts.length === 1) return parts[0];
  return `updated labels (${m.labelCount} label${m.labelCount !== 1 ? "s" : ""})`;
}

function formatCategoryChange(m: Record<string, unknown>): ReactNode {
  const fromLabel = m.previousCategoryLabel as string | undefined;
  const fromColor = m.previousCategoryColor as string | undefined;
  const toLabel = m.categoryLabel as string | undefined;
  const toColor = m.categoryColor as string | undefined;

  if (fromLabel && toLabel) {
    return (
      <>
        changed category from{" "}
        <CategoryBadge label={fromLabel} color={fromColor} /> to{" "}
        <CategoryBadge label={toLabel} color={toColor} />
      </>
    );
  }
  if (toLabel) {
    return (
      <>
        set category to <CategoryBadge label={toLabel} color={toColor} />
      </>
    );
  }
  return "changed the category";
}

function formatRuleChanges(m: Record<string, unknown>): ReactNode {
  return `updated rule "${m.pattern}"`;
}

const EVENT_LABELS: Record<
  string,
  (metadata: Record<string, unknown>) => ReactNode
> = {
  "transaction.labels_updated": formatLabelDiff,
  "transaction.labels_batch_updated": (m) =>
    `updated labels on ${m.affectedCount} transaction${m.affectedCount !== 1 ? "s" : ""}`,
  "transaction.excluded_from_budget": () =>
    "excluded this transaction from budget",
  "transaction.included_in_budget": () => "included this transaction in budget",
  "transaction.exclusion_batch_updated": (m) =>
    `updated budget exclusion on ${m.affectedCount} transaction${m.affectedCount !== 1 ? "s" : ""}`,
  "transaction.description_updated": () => "updated the description",
  "transaction.description_batch_updated": (m) =>
    `updated description on ${m.affectedCount} transaction${m.affectedCount !== 1 ? "s" : ""}`,
  "transaction.category_updated": formatCategoryChange,
  "transaction.category_batch_updated": (m) =>
    `changed category on ${m.affectedCount} transaction${m.affectedCount !== 1 ? "s" : ""}`,
  "transaction.manual_created": () => "created a new transaction manually",
  "transaction.manual_updated": () => "edited a manual transaction",
  "transaction.manual_deleted": () => "deleted a manual transaction",
  "rule.created": (m) => `created rule "${m.pattern}"`,
  "rule.updated": formatRuleChanges,
  "rule.toggled": (m) =>
    m.enabled ? `enabled rule "${m.pattern}"` : `disabled rule "${m.pattern}"`,
  "rule.deleted": (m) => `deleted rule "${m.pattern}"`,
  "rule.batch_deleted": (m) =>
    `deleted ${m.count} rule${m.count !== 1 ? "s" : ""}`,
  "rule.reordered": (m) =>
    `reordered ${m.count} rule${m.count !== 1 ? "s" : ""}`,
  "workspace.renamed": (m) =>
    `renamed workspace from "${m.previousName}" to "${m.newName}"`,
  "workspace.member_invited": (m) => `invited ${m.invitedEmail}`,
  "workspace.member_removed": () => "removed a member",
  "workspace.member_permissions_updated": () => "updated member permissions",
  "workspace.invitation_revoked": (m) =>
    `revoked invitation for ${m.invitedEmail}`,
  "transaction.synced": (m) =>
    `synced ${m.created} new and ${m.updated} updated transaction${(m.created as number) + (m.updated as number) !== 1 ? "s" : ""} from bank`,
  "transaction.rule_applied": (m) => (
    <>
      applied rule{" "}
      <Link
        to="/settings/workspace/rules"
        className="font-medium text-foreground underline"
      >
        "{String(m.rulePattern ?? "")}"
      </Link>{" "}
      to this transaction
    </>
  ),
  "connection.synced": () => "synced a bank connection",
  "connection.state_changed": (m) => {
    const prev = m.previousState as string | undefined;
    if (prev)
      return `changed connection state from "${prev}" to "${m.newState}"`;
    return `changed connection state to "${m.newState}"`;
  },
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getDisplayName(entry: TimelineEntry): string {
  if (entry.actorType === "system") return "Bunkr";
  if (entry.actorType === "agent") return "Bunkr Agent";
  return entry.actorName ?? "Someone";
}

function getEventLabel(event: string, metadata: string): ReactNode {
  try {
    const parsed = JSON.parse(metadata);
    const labelFn = EVENT_LABELS[event];
    if (labelFn) return labelFn(parsed);
  } catch {
    // Fall through to default
  }
  return event;
}

export function AuditTimeline({
  entries,
  className,
}: {
  entries: TimelineEntry[];
  className?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <Timeline defaultValue={entries.length} className={className}>
      {entries.map((entry, index) => (
        <TimelineItem
          key={entry.id}
          step={index + 1}
          className="group-data-[orientation=vertical]/timeline:ms-7"
        >
          <TimelineHeader>
            <TimelineSeparator className="bg-border! group-data-[orientation=vertical]/timeline:top-1.5 group-data-[orientation=vertical]/timeline:-left-5 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.75rem)] group-data-[orientation=vertical]/timeline:translate-y-5" />
            <TimelineIndicator className="size-6 overflow-hidden rounded-full border-none group-data-[orientation=vertical]/timeline:-left-5">
              {entry.actorType === "system" || entry.actorType === "agent" ? (
                <div className="flex size-6 items-center justify-center rounded-full bg-muted">
                  <Bot className="size-3 text-muted-foreground" />
                </div>
              ) : (
                <Avatar className="size-6">
                  {entry.actorAvatarUrl && (
                    <AvatarImage src={entry.actorAvatarUrl} />
                  )}
                  <AvatarFallback className="text-2xs">
                    {getInitials(entry.actorName)}
                  </AvatarFallback>
                </Avatar>
              )}
            </TimelineIndicator>
          </TimelineHeader>
          <TimelineContent className="-mt-0.5">
            {(() => {
              const name = getDisplayName(entry);
              const label = getEventLabel(entry.event, entry.metadata);
              const isKnown = EVENT_LABELS[entry.event] !== undefined;
              return isKnown ? (
                <p className="text-sm leading-relaxed [&_span]:inline [&_.inline-badge]:inline-flex [&_.inline-badge]:align-middle [&_.inline-badge]:mx-0.5">
                  <span className="text-foreground font-medium">{name}</span>{" "}
                  <span className="text-muted-foreground">{label}</span>
                </p>
              ) : (
                <p className="text-sm">
                  <span className="text-foreground font-medium">{name}</span>{" "}
                  <Badge variant="outline" className="text-2xs">
                    {label}
                  </Badge>
                </p>
              );
            })()}
            <TimelineDate className="mt-0 mb-0">
              {formatRelativeTime(entry.timestamp)}
            </TimelineDate>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
}
