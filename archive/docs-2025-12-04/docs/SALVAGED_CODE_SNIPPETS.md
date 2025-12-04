# Salvaged Code Snippets from Dead Code Cleanup
**Date**: November 15, 2025  
**Phase**: 6-2 Dead Code Removal  
**Purpose**: Preserve useful logic before deleting dead code

---

## From InstantChatButton.tsx

### Floating Chat Button with Auto-Popup

```tsx
// Auto-popup effect with configurable delay
const [hasAutoPopped, setHasAutoPopped] = useState(false);
const autoPopup = true;
const autoPopupDelay = 3000; // milliseconds

React.useEffect(() => {
  if (autoPopup && !hasAutoPopped && mode === 'floating') {
    const timer = setTimeout(() => {
      setIsOpen(true);
      setHasAutoPopped(true);
    }, autoPopupDelay);

    return () => clearTimeout(timer);
  }
}, [autoPopup, hasAutoPopped, mode, autoPopupDelay]);
```

### Typing Indicator Animation (Framer Motion)

```tsx
// Animation variants for typing indicator
const typingVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 }
};

const dotVariants = {
  initial: { y: 0 },
  animate: (i: number) => ({
    y: [0, -5, 0],
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      repeat: Infinity,
      repeatType: "loop" as const
    }
  })
};

// Render typing indicator component
<AnimatePresence>
  {isTyping && (
    <motion.div
      className="flex items-center mb-4"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={typingVariants}
    >
      <div className="max-w-[80%] bg-gray-100 text-gray-800 rounded-lg p-3 rounded-tl-none flex items-center space-x-1">
        <CarIcon className="h-4 w-4 mr-2 text-blue-600" />
        <span className="text-xs opacity-70">Clean Machine is typing</span>
        <div className="flex space-x-1 ml-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 bg-blue-500 rounded-full"
              variants={dotVariants}
              custom={i}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

### Floating Chat Window with Minimized State

```tsx
// Pulsing notification badge animation
{messages.length > 1 && (
  <motion.span 
    className="absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg border-2 border-white"
    animate={isMinimized ? { scale: [1, 1.2, 1] } : {}}
    transition={{ 
      repeat: isMinimized ? Infinity : 0,
      duration: 1.5,
      repeatType: "loop"
    }}
  >
    {messages.filter(m => m.sender === 'bot').length}
  </motion.span>
)}
```

### Enter Key Handler for Chat Input

```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
};

<Input
  placeholder="Type a message..."
  value={inputText}
  onChange={(e) => setInputText(e.target.value)}
  onKeyDown={handleKeyDown}
  className="flex-grow text-xs"
/>
```

### Message Bubble Layout

```tsx
const messageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } }
};

<motion.div
  key={message.id}
  className={cn(
    "mb-3 flex",
    message.sender === "user" ? "justify-end" : "justify-start"
  )}
  variants={messageVariants}
  initial="hidden"
  animate="visible"
  exit="exit"
  layout
>
  <div
    className={cn(
      "max-w-[80%] rounded-2xl p-3 shadow-md",
      message.sender === "user"
        ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-tr-sm"
        : "bg-white text-gray-800 rounded-tl-sm border border-gray-100"
    )}
  >
    {/* Message content */}
  </div>
</motion.div>
```

---

## From InvoiceReferralCodeInput.tsx

### Debounced Input Validation

```tsx
const [code, setCode] = useState('');
const [debouncedCode, setDebouncedCode] = useState('');

// Debounce code input for validation
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedCode(code.trim().toUpperCase());
  }, 500);

  return () => clearTimeout(timer);
}, [code]);

// Validate code as user types
const { data: validation, isLoading: isValidating } = useQuery<CodeValidation>({
  queryKey: ['/api/referral/validate', debouncedCode],
  enabled: debouncedCode.length >= 5, // Only validate if code looks reasonable
  retry: false,
  refetchOnWindowFocus: false,
});
```

### Real-Time Validation Icons

```tsx
const isCodeValid = validation?.valid === true;
const showValidation = debouncedCode.length >= 5 && !isValidating;

<div className="relative flex-1">
  <Input
    type="text"
    placeholder="Enter code (e.g., JOHN-AB3C5)"
    value={code}
    onChange={(e) => setCode(e.target.value.toUpperCase())}
    className="pr-10 font-mono uppercase"
    maxLength={20}
  />
  {/* Validation icon */}
  {showValidation && (
    <div className="absolute right-3 top-1/2 -translate-y-1/2">
      {isCodeValid ? (
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
      ) : (
        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
      )}
    </div>
  )}
  {isValidating && (
    <div className="absolute right-3 top-1/2 -translate-y-1/2">
      <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
    </div>
  )}
</div>
```

### Discount Calculation Display Logic

```tsx
// Fixed discount preview
{validation.rewardType === 'fixed_discount' && validation.rewardValue && (
  <div className="pt-2 mt-2 border-t border-green-200 dark:border-green-800">
    <div className="flex items-center justify-between font-semibold">
      <span className="text-gray-700 dark:text-gray-300">You'll save:</span>
      <span className="text-green-700 dark:text-green-300">
        ${Math.min(validation.rewardValue, currentAmount).toFixed(2)}
      </span>
    </div>
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">New total:</span>
      <span className="font-medium text-gray-900 dark:text-gray-100">
        ${Math.max(0, currentAmount - validation.rewardValue).toFixed(2)}
      </span>
    </div>
  </div>
)}

// Percentage discount preview
{validation.rewardType === 'percent_discount' && validation.rewardValue && (
  <div className="pt-2 mt-2 border-t border-green-200 dark:border-green-800">
    <div className="flex items-center justify-between font-semibold">
      <span className="text-gray-700 dark:text-gray-300">You'll save:</span>
      <span className="text-green-700 dark:text-green-300">
        ${((currentAmount * validation.rewardValue) / 100).toFixed(2)} ({validation.rewardValue}%)
      </span>
    </div>
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">New total:</span>
      <span className="font-medium text-gray-900 dark:text-gray-100">
        ${(currentAmount - (currentAmount * validation.rewardValue) / 100).toFixed(2)}
      </span>
    </div>
  </div>
)}
```

### Code Properties Display

```tsx
{isCodeValid && validation.code && (
  <div className="mt-3 space-y-2 text-sm">
    <div className="flex items-center justify-between">
      <span className="text-gray-600 dark:text-gray-400">Code:</span>
      <Badge variant="outline" className="font-mono">
        {validation.code}
      </Badge>
    </div>

    <div className="flex items-center justify-between">
      <span className="text-gray-600 dark:text-gray-400">From:</span>
      <span className="font-medium text-gray-900 dark:text-gray-100">
        {validation.referrerName || 'a friend'}
      </span>
    </div>

    <div className="flex items-center justify-between">
      <span className="text-gray-600 dark:text-gray-400">Reward:</span>
      <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        {validation.reward}
      </Badge>
    </div>

    {validation.expiresAt && (
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <Clock className="h-3 w-3" />
        <span className="text-xs">
          Expires: {new Date(validation.expiresAt).toLocaleDateString()}
        </span>
      </div>
    )}
  </div>
)}
```

---

## From HeaderActions.tsx

### Responsive Header Pattern (Mobile vs Desktop)

```tsx
{/* Desktop buttons */}
<div className="hidden md:flex items-center gap-2">
  <Button variant="outline" size="sm" onClick={onNewMessage}>
    <PlusCircle className="h-4 w-4 mr-2" />
    New Message
  </Button>
  {/* More desktop buttons */}
</div>

{/* Mobile: Menu + Profile button */}
<div className="md:hidden flex items-center gap-2">
  {selectedConversation && (
    <Button variant="ghost" size="sm" onClick={onShowMobileProfile}>
      <UserCircle className="h-5 w-5" />
    </Button>
  )}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">
        <Menu className="h-5 w-5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      {/* Mobile menu items */}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

### Operator Name Configuration Dialog

```tsx
const [operatorDialogOpen, setOperatorDialogOpen] = useState(false);
const [operatorName, setOperatorName] = useState('');

const updateOperatorMutation = useMutation({
  mutationFn: async (name: string) => {
    const response = await apiRequest('PUT', '/api/users/me/operator-name', { operatorName: name });
    return await response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
    toast({
      title: 'Success',
      description: 'Operator name updated successfully',
    });
    setOperatorDialogOpen(false);
  },
});

<Dialog open={operatorDialogOpen} onOpenChange={setOperatorDialogOpen}>
  <DialogTrigger asChild>
    <Button variant="outline" size="sm">
      <User className="h-4 w-4 mr-2" />
      Operator Name
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Set Operator Name</DialogTitle>
      <DialogDescription>
        Configure your name to personalize message templates.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <Input
        placeholder="e.g., Sarah, Mike, Team Leader"
        value={operatorName}
        onChange={(e) => setOperatorName(e.target.value)}
      />
    </div>
    <DialogFooter>
      <Button onClick={() => updateOperatorMutation.mutate(operatorName)}>
        Save
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Dark Mode Toggle with Icon Swap

```tsx
<Button 
  variant="outline" 
  size="sm" 
  onClick={onToggleDarkMode}
>
  {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
</Button>
```

---

## From pdfDocumentation.ts

### PDFKit Document Setup with Metadata

```tsx
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const doc = new PDFDocument({
  size: 'LETTER',
  margin: 50,
  info: {
    Title: 'Document Title',
    Author: 'Author Name',
    Subject: 'Document Subject',
    Keywords: 'keyword1, keyword2, keyword3'
  }
});

// Output file path
const outputPath = path.join(process.cwd(), 'public', 'document.pdf');

// Ensure directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Pipe to file
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// Build document content
// ... document content here ...

// Finalize
doc.end();

// Handle stream events
stream.on('finish', () => {
  console.log(`PDF created at ${outputPath}`);
});

stream.on('error', (err) => {
  console.error('Error creating PDF:', err);
});
```

### Pricing Box Drawing Utility

```tsx
function drawPricingBox(
  doc: PDFKit.PDFDocument, 
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  title: string, 
  price: string, 
  features: string[]
) {
  // Box outline
  doc.rect(x, y, width, height)
     .strokeColor('#cccccc')
     .lineWidth(1)
     .stroke();
  
  // Title area
  doc.rect(x, y, width, 40)
     .fillColor('#0047AB');
     
  doc.fillColor('white')
     .fontSize(14)
     .font('Helvetica-Bold')
     .text(title, x, y + 12, { width: width, align: 'center' });
  
  // Price
  doc.fillColor('#0047AB')
     .fontSize(24)
     .text('$' + price, x, y + 55, { width: width, align: 'center' })
     .fontSize(12)
     .text('per month', { width: width, align: 'center' });
  
  // Features
  doc.fillColor('black')
     .fontSize(10)
     .font('Helvetica');
     
  let featureY = y + 100;
  features.forEach(feature => {
    doc.text(feature, x + 10, featureY, { width: width - 20 });
    featureY += 20;
  });
}
```

### Two-Column Layout for Features

```tsx
const features = [
  "Feature 1",
  "Feature 2",
  "Feature 3",
  "Feature 4",
  "Feature 5",
  "Feature 6",
  "Feature 7",
  "Feature 8"
];

let y = doc.y;
let column1End = features.length / 2;

// Left column
for (let i = 0; i < column1End; i++) {
  doc.text(features[i], 50, y);
  y += 20;
}

// Right column
y = doc.y - (20 * column1End);
for (let i = column1End; i < features.length; i++) {
  doc.text(features[i], 300, y);
  y += 20;
}
```

### Styled Testimonial Section

```tsx
// Background box
doc.rect(50, doc.y, 500, 100)
   .fill('#f0f0f0');
   
// Quote text
doc.fillColor('black')
   .font('Helvetica-Oblique')
   .text(
     '"The AI assistant has completely transformed how I run my business."', 
     70, 
     doc.y - 80, 
     { width: 460, align: 'center' }
   )
   .moveDown(1)
   .font('Helvetica-Bold')
   .text('- Customer Name', { align: 'center' });
```

### File Streaming and Error Handling

```tsx
export async function generatePDF(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const outputPath = path.join(process.cwd(), 'public', 'output.pdf');
      const stream = fs.createWriteStream(outputPath);
      
      doc.pipe(stream);
      
      // Create content...
      
      doc.end();
      
      stream.on('finish', () => {
        console.log(`PDF created at ${outputPath}`);
        resolve(outputPath);
      });
      
      stream.on('error', (err) => {
        console.error('Error creating PDF:', err);
        reject(err);
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      reject(error);
    }
  });
}
```

---

## From portMonitoring.ts

### Cron Job Scheduling (3x Daily)

```tsx
import cron from 'node-cron';

// 8 AM Central = 14:00 UTC
cron.schedule('0 14 * * *', async () => {
  console.log('Running 8 AM check...');
  await runScheduledTask();
});

// 2 PM Central = 20:00 UTC
cron.schedule('0 20 * * *', async () => {
  console.log('Running 2 PM check...');
  await runScheduledTask();
});

// 8 PM Central = 02:00 UTC (next day)
cron.schedule('0 2 * * *', async () => {
  console.log('Running 8 PM check...');
  await runScheduledTask();
});

console.log('3x daily monitoring initialized - checks at 8 AM, 2 PM, 8 PM Central');
```

### Polling Mechanism with Timeout

```tsx
async function waitForConfirmation(testId: string, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 1000; // Check every 1 second
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const [status] = await db
        .select()
        .from(orgSettings)
        .where(eq(orgSettings.settingKey, 'test_status'));
      
      if (status?.settingValue) {
        const testStatus = status.settingValue as any;
        
        if (testStatus.testId === testId && testStatus.confirmed === true) {
          return true;
        }
      }
    } catch (error) {
      console.error('Error polling for confirmation:', error);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return false;
}
```

### Database-Backed Status Tracking

```tsx
// Store test status
await db.insert(orgSettings).values({
  settingKey: 'monitoring_test_status',
  settingValue: {
    testId,
    awaitingConfirmation: true,
    requestedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30000).toISOString(),
    confirmed: false,
  },
  description: 'Monitoring test status',
}).onConflictDoUpdate({
  target: orgSettings.settingKey,
  set: {
    settingValue: {
      testId,
      awaitingConfirmation: true,
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30000).toISOString(),
      confirmed: false,
    },
  },
});
```

### Auto-Disable After Success Pattern

```tsx
async function disableMonitoring() {
  try {
    await db.insert(orgSettings).values({
      settingKey: 'monitoring_disabled',
      settingValue: { 
        disabled: true, 
        disabledAt: new Date().toISOString() 
      },
      description: 'Monitoring automatically disabled after success',
    }).onConflictDoUpdate({
      target: orgSettings.settingKey,
      set: {
        settingValue: { 
          disabled: true, 
          disabledAt: new Date().toISOString() 
        },
      },
    });

    monitoringActive = false;
    console.log('Monitoring disabled permanently');
  } catch (error) {
    console.error('Error disabling monitoring:', error);
  }
}

// Check on startup if previously disabled
export async function initializeMonitoring() {
  const [setting] = await db
    .select()
    .from(orgSettings)
    .where(eq(orgSettings.settingKey, 'monitoring_disabled'));

  if (setting?.settingValue && (setting.settingValue as any).disabled === true) {
    console.log('Monitoring previously disabled - skipping initialization');
    return;
  }

  // Start monitoring...
}
```

### Twilio SMS Test with Status Callback

```tsx
const testMessage = `[TEST ${testId}] Automated delivery test`;
const replitDomain = process.env.REPLIT_DEV_DOMAIN;
const statusCallbackUrl = replitDomain 
  ? `https://${replitDomain}/api/test/sms-status`
  : `http://localhost:5000/api/test/sms-status`;

const message = await client.messages.create({
  body: testMessage,
  from: twilioPhoneNumber,
  to: recipientPhone,
  statusCallback: statusCallbackUrl, // Twilio will POST delivery status here
});

console.log(`Test SMS sent (SID: ${message.sid})`);
console.log(`Status callback URL: ${statusCallbackUrl}`);
```

---

## Usage Notes

**When to Use These Snippets:**
- InstantChatButton patterns: For any future chat/support UI implementations
- InvoiceReferralCodeInput patterns: For promo code, coupon, or discount validation
- HeaderActions patterns: For responsive navigation headers
- pdfDocumentation patterns: For generating PDF reports or documents
- portMonitoring patterns: For cron-based monitoring, polling, or health checks

**Important:**
- These snippets preserve the logic and patterns, not necessarily the exact implementation
- Adapt styling and dependencies to match your current tech stack
- Test thoroughly when reusing patterns in new contexts
- Keep this document for reference when building similar features

---

**Document Version**: 1.0  
**Last Updated**: November 15, 2025  
**Salvaged By**: Phase 6-2 Dead Code Removal Process
