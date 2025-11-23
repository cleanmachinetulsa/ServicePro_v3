import { DashboardTourStep } from "../components/onboarding/DashboardTour";

export const dashboardTourSteps: DashboardTourStep[] = [
  {
    id: "welcome",
    targetId: "main-dashboard-root",
    title: "Welcome in 👋",
    body: "Hey there! Just wanna show you around real quick so you know where everything's at. We'll keep it short and simple.",
  },
  {
    id: "nav",
    targetId: "sidebar-nav",
    title: "Your main hub",
    body: "This is your main navigation. You'll bounce between messages, your schedule, and setup from right here. If you ever feel lost, start here.",
  },
  {
    id: "messages",
    targetId: "nav-messages",
    title: "Customer messages",
    body: "All your customer texts and conversations live in this inbox. This is where the magic happens—booking jobs, answering questions, and keeping folks happy.",
  },
  {
    id: "schedule",
    targetId: "nav-scheduling",
    title: "Your schedule",
    body: "Here's your calendar—what's booked, what's open, and what's coming up. This is where you keep your days from turning into total chaos.",
  },
  {
    id: "settings",
    targetId: "nav-settings",
    title: "Setup & services",
    body: "This is where you tweak your services, pricing, and automations. We've got smart defaults to get you rolling, and you can fine-tune anytime.",
  },
  {
    id: "help",
    targetId: "ai-help-search",
    title: "Need a hand?",
    body: "Anytime you're not sure what to do next, use this search. Ask about setup, pricing, automations—you name it. It's here so you don't have to figure everything out alone.",
  },
  {
    id: "wrapup",
    targetId: "main-dashboard-root",
    title: "You're all set 👍",
    body: "That's the quick tour. You're ready to click around and make it yours. If you ever want to see this again, just ask—we've got your back!",
  },
];
