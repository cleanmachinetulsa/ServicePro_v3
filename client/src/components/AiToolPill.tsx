import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiToolPillProps {
  toolNames: string[];
  className?: string;
  compact?: boolean;
}

const PRETTY: Record<string, string> = {
  check_customer_database: "Looked up customer",
  validate_address: "Validated address",
  get_available_slots: "Checked calendar",
  get_upsell_offers: "Looked up upsells",
  create_appointment: "Booked appointment",
  build_booking_summary: "Built summary",
  request_damage_photos: "Asked for photos",
  request_specialty_quote: "Quote request",
  confirm_address_validation: "Confirmed address",
  get_existing_appointment: "Found appointment",
  update_appointment_address: "Updated address",
  add_appointment_notes: "Added note",
  reschedule_appointment: "Rescheduled",
  offer_human_handoff: "Offered handoff",
  transfer_to_human: "Transferred to human",
};

export function AiToolPill({ toolNames, className, compact = false }: AiToolPillProps) {
  if (!toolNames || toolNames.length === 0) return null;
  const labels = toolNames.map((t) => PRETTY[t] ?? t);
  const shown = compact ? labels.slice(0, 2) : labels;
  const extra = labels.length - shown.length;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 border border-indigo-200",
        className
      )}
      title={`AI used: ${labels.join(", ")}`}
      data-testid="ai-tool-pill"
    >
      <Sparkles className="h-3 w-3" />
      <span>{shown.join(" · ")}</span>
      {extra > 0 && <span className="text-indigo-500">+{extra}</span>}
    </div>
  );
}

export default AiToolPill;
