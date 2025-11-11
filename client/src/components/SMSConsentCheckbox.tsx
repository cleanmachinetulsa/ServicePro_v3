import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface SMSConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  businessName?: string;
  required?: boolean;
  id?: string;
}

export function SMSConsentCheckbox({
  checked,
  onCheckedChange,
  businessName = "Clean Machine Auto Detail",
  required = true,
  id = "sms-consent"
}: SMSConsentCheckboxProps) {
  return (
    <div className="flex items-start space-x-3 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-1"
        data-testid="checkbox-sms-consent"
      />
      <div className="flex-1">
        <Label
          htmlFor={id}
          className="text-sm font-medium leading-relaxed cursor-pointer"
        >
          I Consent to Receive Informational messages & Alerts from {businessName}.{" "}
          <span className="font-normal text-muted-foreground">
            Message frequency varies. Message & data rates may apply.{" "}
            You can reply STOP to unsubscribe at any time.
          </span>
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          By checking this box and entering your phone number, you explicitly agree to receive messages from our business.
        </p>
      </div>
    </div>
  );
}
