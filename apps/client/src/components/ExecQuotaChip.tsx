import { useEffect, useState } from "react";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import BoltIcon from "@mui/icons-material/Bolt";
import { getBackend, getQuota, subscribeQuota, type ExecQuota } from "../lib/codeExecutor";

const formatReset = (resetAt: number | null) => {
  if (!resetAt) return "";
  const seconds = Math.max(0, Math.floor(resetAt - Date.now() / 1000));
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

export const ExecQuotaChip = () => {
  const [quota, setQuotaState] = useState<ExecQuota>(getQuota());

  useEffect(() => {
    const unsub = subscribeQuota(setQuotaState);
    return () => { unsub(); };
  }, []);

  const backend = getBackend();

  if (backend === "codex") {
    return (
      <Tooltip title="Code runs try Wandbox → CodeX → Agent Code Runner in order. All free, no key.">
        <Chip
          size="small"
          variant="outlined"
          icon={<BoltIcon sx={{ fontSize: "0.85rem !important" }} />}
          label="FREE · auto"
          sx={{ mr: 1, fontFamily: "monospace", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em" }}
        />
      </Tooltip>
    );
  }

  if (backend === "wandbox") {
    return (
      <Tooltip title="Code runs are executed via Wandbox (free, no key — broad language coverage)">
        <Chip
          size="small"
          variant="outlined"
          icon={<BoltIcon sx={{ fontSize: "0.85rem !important" }} />}
          label="WANDBOX · free"
          sx={{ mr: 1, fontFamily: "monospace", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em" }}
        />
      </Tooltip>
    );
  }

  if (backend === "agent") {
    return (
      <Tooltip title="Code runs are executed via Agent Code Runner (free, no key — Python/JS/TS/Bash only)">
        <Chip
          size="small"
          variant="outlined"
          icon={<BoltIcon sx={{ fontSize: "0.85rem !important" }} />}
          label="AGENT · free"
          sx={{ mr: 1, fontFamily: "monospace", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em" }}
        />
      </Tooltip>
    );
  }

  if (backend === "piston") {
    return (
      <Tooltip title="Code runs are executed via Piston (self-hosted or public)">
        <Chip
          size="small"
          variant="outlined"
          icon={<BoltIcon sx={{ fontSize: "0.85rem !important" }} />}
          label="PISTON"
          sx={{ mr: 1, fontFamily: "monospace", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em" }}
        />
      </Tooltip>
    );
  }

  // Judge0
  const remaining = quota.remaining;
  const limit = quota.limit;
  const reset = formatReset(quota.resetAt);

  let label: string;
  let color: "default" | "warning" | "error" | "success" = "default";

  if (remaining === null) {
    label = "JUDGE0 · ready";
  } else {
    label = `JUDGE0 · ${remaining}${limit !== null ? `/${limit}` : ""} left`;
    if (remaining <= 0) color = "error";
    else if (remaining <= 5) color = "warning";
    else color = "success";
  }

  return (
    <Tooltip
      title={
        remaining === null
          ? "Run code once to populate Judge0 daily quota"
          : `Daily quota: ${remaining}/${limit ?? "?"} requests remaining${reset ? ` · resets in ${reset}` : ""}`
      }
    >
      <Chip
        size="small"
        variant={color === "default" ? "outlined" : "filled"}
        color={color}
        icon={<BoltIcon sx={{ fontSize: "0.85rem !important" }} />}
        label={label}
        sx={{ mr: 1, fontFamily: "monospace", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.04em" }}
      />
    </Tooltip>
  );
};
