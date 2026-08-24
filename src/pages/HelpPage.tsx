/* ============================================================
   FamilyBuild — Help & Support Center
   ------------------------------------------------------------
   Role-aware FAQs, quick guides, and contact information.
   Suggestions live on their own page (/suggestions).
   ============================================================ */

import { Link } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { EmptyState } from "../components/ui/EmptyState";

const FAQ: { q: string; a: string; roles?: string[] }[] = [
  {
    q: "How do I report a problem?",
    a: "Open Problems in the sidebar and click “+ New Problem Report”. Describe what's wrong — Customer Service is notified immediately and you can follow the repair on the ticket timeline.",
    roles: ["property-owner"],
  },
  {
    q: "How do I submit a request (not an emergency)?",
    a: "Use Requests → “+ New Request”. Examples: repainting, document copies, scheduling questions. Every submission becomes a numbered support ticket.",
    roles: ["property-owner"],
  },
  {
    q: "What happens after I submit a request or report a problem?",
    a: "Customer Service reviews it, assigns a handler, and keeps you updated on the timeline. Technical issues are escalated to the Developer; management decisions go to the Owner. You receive a notification at every step.",
    roles: ["property-owner"],
  },
  {
    q: "When will my project be finished?",
    a: "Each project card shows a live progress bar and target completion date. For specifics, message your builder directly from Messages.",
  },
  {
    q: "Who can see my information?",
    a: "Only the FamilyBuild team members working on your property. You never see internal company finances, and other clients never see your property.",
    roles: ["property-owner"],
  },
  {
    q: "How do I get documents like permits or inspection reports?",
    a: "Submit a Request and describe what you need (e.g. a permit copy or inspection report). Customer Service will share it with you through your ticket or Messages.",
    roles: ["property-owner"],
  },
  {
    q: "How does the support inbox work?",
    a: "Every customer submission lands here as a ticket. Assign it to yourself or another handler, reply directly on the ticket, change status as work progresses, and escalate technical problems to the Developer or management decisions to the Owner.",
    roles: ["customer-service", "owner"],
  },
  {
    q: "When should I escalate a ticket?",
    a: "Escalate to the Developer when the issue needs platform or technical investigation. Escalate to the Owner when a management decision (budget, policy, exception) is required. Always include a short reason so the recipient has context.",
    roles: ["customer-service", "owner"],
  },
  {
    q: "How do I update my assigned tasks?",
    a: "Open Tasks, open your task, move the progress slider, add work notes, and mark status. Report blockers immediately by marking the task Blocked with a comment explaining what you need.",
    roles: ["worker"],
  },
  {
    q: "How do I record stock movements?",
    a: "In Inventory, use Stock In when materials arrive, Stock Out when issued to a site, and Adjust for physical count corrections. Current quantities are always calculated from the full movement ledger.",
    roles: ["owner", "builder"],
  },
  {
    q: "How does purchasing affect inventory and finance?",
    a: "Workflow: Requested → Approved → Purchased → Received. When a delivery is marked Received, stock is added to inventory AND the matching expense is recorded in Finance automatically.",
    roles: ["owner", "builder"],
  },
];

const GUIDES: { title: string; steps: string[]; roles?: string[] }[] = [
  {
    title: "Submitting & tracking a support ticket",
    roles: ["property-owner"],
    steps: [
      "Go to Requests or Problems and click “+ New”.",
      "Fill in the title, property, category, priority, and description.",
      "Submit — you'll get a ticket number (e.g. #1046).",
      "Open the ticket anytime to read replies and see the timeline.",
      "You'll get a notification whenever the status changes.",
    ],
  },
  {
    title: "Handling a ticket end-to-end",
    roles: ["customer-service"],
    steps: [
      "Review new tickets in the Support Inbox (unassigned ones are highlighted).",
      "Assign the ticket to yourself or the right handler.",
      "Reply to the customer directly on the ticket.",
      "Escalate technical issues to the Developer; management calls to the Owner.",
      "Mark Resolved once fixed, then Closed after customer confirmation.",
    ],
  },
  {
    title: "Recording stock movements",
    roles: ["owner", "builder"],
    steps: [
      "Open Inventory and find the item.",
      "Click Stock In / Stock Out / Adjust depending on the event.",
      "Enter the quantity and a short reason (e.g. PO reference, crew issue).",
      "The current quantity recalculates instantly from the ledger.",
      "Crossing below minimum stock alerts the Owner automatically.",
    ],
  },
  {
    title: "Running a purchase through to delivery",
    roles: ["owner", "builder"],
    steps: [
      "Create the purchase request linked to a project.",
      "Owner approves (or rejects) from Purchasing.",
      "Mark Purchased once ordered with the supplier.",
      "When goods arrive, click “Mark received” — stock and finance update automatically.",
    ],
  },
];

export function HelpPage() {
  const { user } = useApp();
  if (!user) return null;
  const role = user.role;

  const faqs = FAQ.filter((f) => !f.roles || f.roles.includes(role));
  const guides = GUIDES.filter((g) => !g.roles || g.roles.includes(role));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Help</h1>
          <p className="page-header__subtitle">
            Answers, guides, and contact information tailored to your role ({role.replace("-", " ")}).
          </p>
        </div>
      </div>

      <div className="content-grid">
        <div>
          <h2 style={{ fontSize: 15, margin: "4px 0 10px" }}>Frequently asked questions</h2>
          {faqs.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>

        <div>
          <h2 style={{ fontSize: 15, margin: "4px 0 10px" }}>Quick guides</h2>
          {guides.length === 0 ? (
            <EmptyState icon="📘" title="No guides yet" text="Guides for your role will appear here." />
          ) : (
            guides.map((g) => (
              <div key={g.title} className="card" style={{ marginBottom: 12 }}>
                <div className="card__header">
                  <h3 className="card__title">{g.title}</h3>
                </div>
                <ol style={{ fontSize: 13.5, color: "var(--text-muted)", paddingLeft: 20, display: "grid", gap: 6 }}>
                  {g.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__header">
          <h2 className="card__title">Contact & support</h2>
        </div>
        <div className="info-grid">
          <div className="info-item">
            <div className="info-item__label">Customer Service</div>
            <div className="info-item__value">Liza Ramos · +63 917 222 4455</div>
          </div>
          <div className="info-item">
            <div className="info-item__label">Support hours</div>
            <div className="info-item__value">Mon–Sat, 8:00 AM – 6:00 PM</div>
          </div>
          <div className="info-item">
            <div className="info-item__label">Response time</div>
            <div className="info-item__value">Within one business day</div>
          </div>
          <div className="info-item">
            <div className="info-item__label">Technical issues</div>
            <div className="info-item__value">Escalated via tickets to the Developer</div>
          </div>
        </div>
      </div>

      <EmptyState
        icon="💬"
        title="Still need help?"
        text="Send us a message and we'll get back to you within one business day."
        action={
          <Link to="/messages" className="btn btn--primary">
            Open Messages
          </Link>
        }
      />
    </div>
  );
}