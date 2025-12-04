# Homepage Feature Inventory & Template System Key

**Purpose:** Comprehensive catalog of all homepage elements, components, and features for creating reusable, high-end UX templates.

---

## 📋 **Core Sections & Components**

### 1. **Header/Navigation**
- **Login Button** (top-right)
  - Route: `/login`
  - Style: Ghost variant, small size
  - Data-testid: `button-login`

### 2. **Hero Section**
- **Animated Logo** (`SophisticatedAnimatedLogo`)
  - Framer Motion animations
  - Responsive sizing: 72px mobile, 96px desktop
  - Subtle glow effects

- **About Text** (CMS-editable)
  - Field: `content.aboutText`
  - Default: "Clean Machine Auto Detail offers extensive detailing services..."
  - Typography: base/lg, blue-100/70, light font-weight
  - Animation: Fade-in from bottom (y: 20)

- **Tagline**
  - Text: "ask anything. book anytime."
  - Style: Italic, blue-200/90

### 3. **Call-to-Action Buttons**

#### **Primary CTA**
- **AI Assistant Button**
  - Text: CMS-editable (`content.heroCtaText`)
  - Link: CMS-editable (`content.heroCtaLink`)
  - Color: CMS-editable (`content.primaryColor`)
  - Icon: MessageSquare
  - Effects: Scale on hover, gradient sweep animation
  - Data-testid: Dynamic based on link

#### **Secondary CTA**
- **Visual Scheduler Button**
  - Route: `/schedule`
  - Color: CMS-editable (`content.accentColor`)
  - Icon: CalendarClock
  - Style: Outline variant
  - Effects: Scale on hover, gradient sweep

#### **Tertiary CTA**
- **Call Now Button**
  - Tel: `+19188565304`
  - Color: Green-600
  - Icon: Phone
  - Effects: Green shadow on hover

### 4. **Feature Action Buttons** (`FeatureActionButtons`)
- **Gallery** → `/gallery` (Image icon)
- **Gift Cards** → External Square link (GiftIcon)
- **Reviews** → `/reviews` (Star icon)
- **My Loyalty Points** → `/rewards` (Award icon)

**Layout:** 2x2 grid on all screens
**Style:** Ghost variant, blue-600/10 background, pulse animations

---

## 5. **Services Showcase Section**

- **Heading** (CMS-editable)
  - Field: `content.servicesHeading`
  - Default: "Premium Auto Detailing Services"
  - Style: Gradient text (blue-200 → blue-400 → blue-200)

- **Subheading** (CMS-editable, optional)
  - Field: `content.servicesSubheading`

- **Services Carousel** (`ServicesCarousel`)
  - Data source: `/api/services`
  - Displays service cards with pricing, descriptions
  - Swipeable/scrollable

**Container Style:** Skewed background panel, dark gray-900 rounded-3xl

---

## 6. **Social Proof Section**

- **Heading:** "What Our Customers Say"
- **Subheading:** Premium description about service quality
- **Google Reviews Component** (`GoogleReviews`)
  - Place ID: `ChIJVX4B3d2TtocRCjnc7bJevHw`
  - Displays star ratings, review text, reviewer names
  - Carousel layout

---

## 7. **Footer**

#### **Left Side:**
- **Logo**
  - CMS-editable (`content.logoUrl`)
  - Fallback: `/logo.jpg`
  - Size: h-16
  - Hover: Scale + shadow effects

- **Company Info**
  - Business name
  - Location tagline
  - Phone link: `tel:9188565304`
  - Email link: `mailto:cleanmachinetulsa@gmail.com`

#### **Right Side:**
- **Navigation Links**
  - Careers → `/careers`
  - Showcase → `/showcase`

- **Copyright Text**
  - Dynamic year
  - "All rights reserved"
  - Location: "Serving Tulsa and surrounding areas"

---

## 8. **Floating Chat Widget**

- **Component:** `EnhancedChatbotUI`
- **Position:** Fixed bottom-4 right-4
- **Z-index:** 50
- **Features:**
  - Message history
  - File uploads
  - AI responses
  - Appointment scheduling integration
  - Emoji picker
  - Typing indicators

---

## 🎨 **CMS-Editable Properties**

### Content Fields:
```typescript
{
  metaTitle: string;           // SEO page title
  metaDescription: string;     // SEO description
  heroCtaText: string;         // Primary button text
  heroCtaLink: string;         // Primary button URL
  aboutText: string;           // Hero description
  servicesHeading: string;     // Services section title
  servicesSubheading: string;  // Services subtitle (optional)
  logoUrl: string;             // Company logo URL (optional)
}
```

### Design Tokens:
```typescript
{
  primaryColor: string;   // HSL format (e.g., "220, 90%, 56%")
  accentColor: string;    // HSL format
}
```

---

## 🧩 **Reusable Component Dependencies**

### UI Components (shadcn/ui):
- Button
- Card
- Carousel
- Skeleton
- ScrollArea
- Tooltip
- Dialog
- Switch
- Label
- Input

### Icons (lucide-react):
- CalendarClock
- MessageSquare
- Phone
- Image
- GiftIcon
- Star
- Award

### Custom Components:
- SophisticatedAnimatedLogo
- FeatureActionButtons
- ServicesCarousel
- GoogleReviews
- EnhancedChatbotUI

---

## 🎭 **Animation Patterns (Framer Motion)**

### Entry Animations:
```typescript
{
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.2, ease: "easeOut" }
}
```

### Scroll-triggered:
```typescript
{
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  transition: { duration: 0.8 },
  viewport: { once: true }
}
```

### Hover Effects:
- `hover:scale-105` - Buttons
- `hover:translate-x-1` - Links
- Gradient sweep animations on CTAs
- Shadow effects on hover

---

## 🖼️ **Background Elements**

### Current Template:
- **Gradient Base:** from-gray-900 via-blue-950/10 to-black
- **Animated Gradient:** Purple → Blue → Indigo (slow pulse)
- **Floating Orbs:** Blue-500/5 blur-3xl (animated pulse)

### Positioning Patterns:
- Top-left orb: `top-[20%] left-[10%]`
- Bottom-right orb: `bottom-[10%] right-[20%]`
- Z-index layers: Background (0), Content (10), Header (20), Chat (50)

---

## 📱 **Responsive Breakpoints**

### Text Sizing:
- Mobile: `text-base`
- Desktop: `md:text-lg`

### Grid Layouts:
- Feature buttons: 2 columns (all screens)
- Hero CTAs: Stack on mobile (`flex-col`), row on tablet (`sm:flex-row`)

### Container Width:
- Max-width: `max-w-7xl`
- Padding: `px-4 md:px-8`

---

## 🚀 **Interactive Features**

### Actions:
1. Navigate to chat/scheduler
2. Make phone call
3. Open external gift card page
4. View gallery/reviews/loyalty
5. Access careers/showcase pages
6. Login to admin

### Data Sources:
- `/api/services` - Service listings
- `/api/homepage-content` - CMS content
- Google Places API - Reviews

---

## 🎯 **Template System Requirements**

### Must Support:
✅ All CMS-editable content  
✅ All interactive buttons/links  
✅ Services carousel integration  
✅ Google Reviews integration  
✅ Floating chat widget  
✅ Mobile responsiveness  
✅ Accessibility (ARIA labels, keyboard nav)  
✅ SEO meta tags  
✅ Framer Motion animations  

### Template Variants Should Differ In:
- Layout composition (grid vs vertical vs split-screen)
- Background styles (gradients, patterns, imagery)
- Typography hierarchy
- Spacing/whitespace
- Component arrangement
- Animation choreography
- Visual effects (glass-morphism, neon, minimal, etc.)

### Must Stay Consistent:
- All functional buttons/links
- CMS content rendering
- Chat widget position
- Footer information
- Data integrations
- Accessibility features

---

## 📊 **Template Performance Metrics**

### Required Standards:
- **Mobile-first:** 44px touch targets
- **Animation:** 60fps, motion-safe fallbacks
- **Load Time:** < 2s first contentful paint
- **Accessibility:** WCAG 2.1 AA compliance
- **SEO:** Semantic HTML, meta tags

---

## 🔑 **Template Switching Architecture**

### Schema Addition:
```typescript
homepage_content table:
  + templateId: string (default: 'current')
  + layoutSettings: jsonb (optional template-specific config)
```

### Template Registry:
```typescript
homeTemplates.ts exports:
  - Template configurations
  - Component variant mappings
  - Animation specs
  - Breakpoint definitions
```

### Preview System:
- Non-destructive selection
- Live preview pane
- Revert/confirm workflow
- One-click application

---

**Last Updated:** Nov 16, 2025  
**Version:** 1.0
